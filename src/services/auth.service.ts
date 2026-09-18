import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Staff = Database['public']['Tables']['staff']['Row'];

const AUTH_SESSION_KEY = 'ethiocare_auth_session';

export const authService = {
  /**
   * Log in hospital staff using Email + Staff Code or Password.
   * Enforces strict portal role isolation: if targetPortal is provided, staff.role must match.
   */
  async loginStaff(email: string, credential: string, targetPortal?: string): Promise<Profile> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCredential = credential.trim();

    if (!cleanEmail) throw new Error('Hospital email is required');
    if (!cleanCredential) throw new Error('Staff code or password is required');

    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }

    // 1. Attempt server-side verification via SECURITY DEFINER RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('verify_staff_login', {
        p_email: cleanEmail,
        p_credential: cleanCredential,
        p_target_portal: targetPortal || null,
      });

      if (!rpcError && rpcData) {
        if (!rpcData.success) {
          throw new Error(rpcData.error || 'Authentication failed');
        }
        const profile = rpcData.profile as Profile;
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(profile));
        return profile;
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Could not find the function')) {
        throw err;
      }
    }

    // 2. Direct Supabase Database Verification (Fallback before RPC migration applied)
    const { data: staffMember, error: staffError } = await supabase
      .from('staff')
      .select('id, full_name, email, role, department, specialization, phone, status, activation_code, password_set, created_at, updated_at')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (staffError || !staffMember) {
      throw new Error('Invalid hospital email or credentials');
    }

    if (staffMember.status !== 'active') {
      throw new Error('Your staff account is deactivated. Please contact hospital administration.');
    }

    // Strict 1:1 portal role restriction check
    if (targetPortal && staffMember.role !== targetPortal) {
      const readableRole = staffMember.role.replace(/_/g, ' ');
      const readablePortal = targetPortal.replace(/_/g, ' ');
      throw new Error(`Access denied. ${readableRole} credentials cannot be used for the ${readablePortal} portal.`);
    }

    // Verify credential against activation code or default hospital password
    const matchesCode = staffMember.activation_code && staffMember.activation_code.trim().toUpperCase() === cleanCredential.toUpperCase();
    const matchesDefault = cleanCredential === 'Hospital@2026';

    if (!matchesCode && !matchesDefault) {
      throw new Error('Invalid password or staff activation code');
    }

    // Attempt to update last_login on staff table (silently handled if RLS restricts direct anon update)
    try {
      await supabase
        .from('staff')
        .update({
          last_login: new Date().toISOString(),
        })
        .eq('id', staffMember.id);
    } catch {
      // Handled silently
    }

    // Construct safe profile (never contains password or activation code)
    const safeProfile: Profile = {
      id: staffMember.id,
      email: staffMember.email,
      full_name: staffMember.full_name,
      role: staffMember.role,
      department: staffMember.department || '',
      specialization: staffMember.specialization || '',
      phone: staffMember.phone || '',
      status: staffMember.status,
      avatar_url: null,
      created_at: staffMember.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Establish real Supabase Auth session so PostgREST receives Authorization: Bearer <jwt> with role: authenticated and auth.uid()
    if (isSupabaseConfigured()) {
      let authRes = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanCredential,
      });

      // 2. If that failed (e.g. staff activation code was used), try default password 'Hospital@2026'
      if (authRes.error) {
        authRes = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: 'Hospital@2026',
        });
      }

      if (authRes.error) {
        console.error('[authService] Supabase Auth session sign-in failed:', authRes.error);
        throw new Error(`Authentication session error: ${authRes.error.message}`);
      }

      if (authRes.data?.user) {
        safeProfile.id = authRes.data.user.id;
      }
    }

    // Save active session in localStorage
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(safeProfile));
    return safeProfile;
  },

  /**
   * Log in via email and password/code (compatibility alias).
   */
  async login(email: string, password: string, targetPortal?: string): Promise<Profile | null> {
    return this.loginStaff(email, password, targetPortal);
  },

  /**
   * Activate staff account with Email + Activation Code + New Password (NO OTP REQUIRED).
   */
  async activateAccount(email: string, activationCode: string, newPassword: string): Promise<Profile> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = activationCode.trim().toUpperCase();

    if (!cleanEmail) throw new Error('Hospital email is required');
    if (!cleanCode) throw new Error('Activation code is required');
    if (!newPassword || newPassword.length < 8) throw new Error('Password must be at least 8 characters');

    // 1. Try secure RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('activate_staff_account', {
        p_email: cleanEmail,
        p_activation_code: cleanCode,
        p_new_password: newPassword,
      });

      if (!rpcError && rpcData) {
        if (!rpcData.success) {
          throw new Error(rpcData.error || 'Activation failed');
        }
        const profile = rpcData.profile as Profile;
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(profile));
        return profile;
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('Could not find the function')) {
        throw err;
      }
    }

    // 2. Direct Supabase Fallback
    const { data: staffMember, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (staffError || !staffMember) {
      throw new Error('No staff member found with this email address');
    }

    if (staffMember.status !== 'active') {
      throw new Error('This staff account is deactivated. Contact administration.');
    }

    if (!staffMember.activation_code || staffMember.activation_code.trim().toUpperCase() !== cleanCode) {
      throw new Error('Invalid activation code for this staff account');
    }

    const safeProfile: Profile = {
      id: staffMember.id,
      email: staffMember.email,
      full_name: staffMember.full_name,
      role: staffMember.role,
      department: staffMember.department || '',
      specialization: staffMember.specialization || '',
      phone: staffMember.phone || '',
      status: staffMember.status,
      avatar_url: null,
      created_at: staffMember.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(safeProfile));
    return safeProfile;
  },

  /**
   * Fetch user profile from Supabase profiles table, or fallback to staff record
   */
  async getProfile(userId: string, email?: string): Promise<Profile> {
    if (isSupabaseConfigured()) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile && !error) {
        return profile as Profile;
      }

      if (email) {
        const { data: staffMember } = await supabase
          .from('staff')
          .select('id, full_name, email, role, department, specialization, phone, status, created_at, updated_at')
          .eq('email', email.toLowerCase().trim())
          .maybeSingle();

        if (staffMember) {
          const newProfile: Profile = {
            id: userId,
            email: staffMember.email,
            full_name: staffMember.full_name,
            role: staffMember.role,
            department: staffMember.department || '',
            specialization: staffMember.specialization || '',
            phone: staffMember.phone || '',
            status: staffMember.status,
            avatar_url: null,
            created_at: staffMember.created_at || new Date().toISOString(),
            updated_at: staffMember.updated_at || new Date().toISOString(),
          };

          return newProfile;
        }
      }
    }

    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    if (stored) return JSON.parse(stored);

    throw new Error('Profile not found');
  },

  /**
   * Log out of current session.
   */
  async logout(): Promise<void> {
    localStorage.removeItem(AUTH_SESSION_KEY);
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore network signout errors on local session clear
      }
    }
  },

  /**
   * Get currently active session profile.
   * Restores session from localStorage and verifies against live Supabase database.
   */
  async getCurrentUser(): Promise<Profile | null> {
    // 1. Check live Supabase Auth session first
    if (isSupabaseConfigured()) {
      try {
        let { data: { session } } = await supabase.auth.getSession();

        // If no active Supabase Auth session exists, attempt auto-reconnect using stored hospital profile
        if (!session?.user) {
          const stored = localStorage.getItem(AUTH_SESSION_KEY);
          if (stored) {
            try {
              const profile = JSON.parse(stored) as Profile;
              if (profile?.email) {
                const signInRes = await supabase.auth.signInWithPassword({
                  email: profile.email.toLowerCase().trim(),
                  password: 'Hospital@2026',
                });
                if (signInRes.data?.session) {
                  session = signInRes.data.session;
                }
              }
            } catch (reconErr) {
              console.warn('[authService] Auto-reconnect notice:', reconErr);
            }
          }
        }

        if (session?.user) {
          try {
            const profile = await this.getProfile(session.user.id, session.user.email);
            if (profile) {
              localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(profile));
              return profile;
            }
          } catch {
            // fallback to stored session
          }
        }
      } catch {
        // fallback
      }
    }

    // 2. Check stored hospital staff session
    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    if (stored) {
      try {
        const profile = JSON.parse(stored) as Profile;
        // Verify against live Supabase database
        if (isSupabaseConfigured() && profile.email) {
          try {
            const { data: staffMember, error } = await supabase
              .from('staff')
              .select('id, full_name, email, role, department, specialization, phone, status, created_at, updated_at')
              .eq('email', profile.email.toLowerCase().trim())
              .maybeSingle();

            if (!error && staffMember) {
              if (staffMember.status !== 'active') {
                localStorage.removeItem(AUTH_SESSION_KEY);
                return null;
              }
              const freshProfile: Profile = {
                ...profile,
                full_name: staffMember.full_name || profile.full_name,
                role: staffMember.role || profile.role,
                department: staffMember.department || profile.department,
                specialization: staffMember.specialization || profile.specialization,
                phone: staffMember.phone || profile.phone,
                status: staffMember.status,
              };
              localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(freshProfile));
              return freshProfile;
            }
          } catch (verifyErr) {
            console.warn('[authService] Error validating live profile against staff table:', verifyErr);
          }
        }
        return profile;
      } catch {
        localStorage.removeItem(AUTH_SESSION_KEY);
      }
    }

    return null;
  },

  /**
   * Request password reset link.
   */
  async requestPasswordReset(email: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
    }
  },

  /**
   * Reset password with token.
   */
  async updatePassword(newPassword: string): Promise<void> {
    if (isSupabaseConfigured()) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    }
  },
};
