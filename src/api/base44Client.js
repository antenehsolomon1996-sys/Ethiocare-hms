import { EntityService } from '@/services/database.service';
import { authService } from '@/services/auth.service';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Entity proxy cache
const entityCache = new Map();

const getEntityService = (entityName) => {
  if (!entityCache.has(entityName)) {
    entityCache.set(entityName, new EntityService(entityName));
  }
  return entityCache.get(entityName);
};

// Dynamic entities Proxy
const entitiesProxy = new Proxy({}, {
  get: (_target, prop) => {
    if (typeof prop !== 'string') return undefined;
    return getEntityService(prop);
  }
});

// Drop-in Supabase-backed client
export const base44 = {
  entities: entitiesProxy,
  auth: {
    me: async () => {
      const user = await authService.getCurrentUser();
      if (!user) {
        throw { status: 401, message: 'Authentication required' };
      }
      return user;
    },

    loginViaEmailPassword: async (email, password, targetPortal) => {
      return await authService.loginStaff(email, password, targetPortal);
    },

    loginWithProvider: async (provider, redirectUrl = '/') => {
      if (!isSupabaseConfigured()) {
        const mockProfile = {
          id: 'demo-google-user',
          email: 'doctor@grandhorizonhospital.com',
          full_name: 'Dr. Selamawit Tadesse',
          role: 'doctor',
          department: 'Internal Medicine',
          specialization: 'Internal Medicine',
          phone: '+251 91 123 4567',
          status: 'active',
        };
        localStorage.setItem('ethiocare_demo_user', JSON.stringify(mockProfile));
        window.location.href = redirectUrl;
        return;
      }

      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${redirectUrl}`,
        },
      });
    },

    logout: async (redirectUrl) => {
      await authService.logout();
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },

    redirectToLogin: (redirectUrl = '/login') => {
      window.location.href = redirectUrl;
    },

    register: async ({ email, password }) => {
      if (!isSupabaseConfigured()) {
        return { user: { email } };
      }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      return data;
    },

    verifyOtp: async ({ email, otpCode }) => {
      if (!isSupabaseConfigured()) {
        return { access_token: 'mock-access-token' };
      }
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });
      if (error) throw new Error(error.message);
      return { access_token: data.session?.access_token };
    },

    resendOtp: async (email) => {
      if (!isSupabaseConfigured()) return true;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw new Error(error.message);
      return true;
    },

    updateMe: async (profileUpdates) => {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) return null;

      if (!isSupabaseConfigured()) {
        const updated = { ...currentUser, ...profileUpdates };
        localStorage.setItem('ethiocare_demo_user', JSON.stringify(updated));
        return updated;
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', currentUser.id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      return data;
    },

    resetPasswordRequest: async (email) => {
      await authService.requestPasswordReset(email);
      return true;
    },

    resetPassword: async ({ resetToken, newPassword }) => {
      await authService.updatePassword(newPassword);
      return true;
    },

    setToken: (token) => {
      if (token) localStorage.setItem('supabase_custom_token', token);
    },

    deleteAccount: async () => {
      await authService.logout();
    }
  }
};
