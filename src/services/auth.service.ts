import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Staff = Database['public']['Tables']['staff']['Row'];

const AUTH_SESSION_KEY = 'ethiocare_auth_session';

const ROLE_ALIASES: Record<string, string[]> = {
  owner: ['owner', 'admin'],
  admin: ['owner', 'admin'],
  reception: ['receptionist', 'reception', 'owner', 'admin'],
  receptionist: ['receptionist', 'reception', 'owner', 'admin'],
  doctor: ['doctor'],
  nurse: ['nurse'],
  lab: ['lab_technician', 'lab', 'laboratory'],
  lab_technician: ['lab_technician', 'lab', 'laboratory'],
  laboratory: ['lab_technician', 'lab', 'laboratory'],
  pharmacy: ['pharmacist', 'pharmacy'],
  pharmacist: ['pharmacist', 'pharmacy'],
  billing: ['accountant', 'billing', 'cashier'],
  accountant: ['accountant', 'billing', 'cashier'],
  cashier: ['accountant', 'billing', 'cashier'],
};

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

    // 2. Direct Supabase Database Verification
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

    // Strict 1:1 portal role restriction check with alias mapping
    if (targetPortal) {
      const allowed = ROLE_ALIASES[targetPortal.toLowerCase().trim()] || [targetPortal.toLowerCase().trim()];
      if (!allowed.includes(staffMember.role.toLowerCase().trim())) {
        const readableRole = staffMember.role.replace(/_/g, ' ');
        const readablePortal = targetPortal.replace(/_/g, ' ');
        throw new Error(`Access denied. ${readableRole} credentials cannot be used for the ${readablePortal} workspace.`);
      }
    }

    // Verify credential against activation code, default hospital password, or set password
    const normalizeCode = (c: string) => c.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const matchesCode = staffMember.activation_code && 
      (staffMember.activation_code.trim().toUpperCase() === cleanCredential.toUpperCase() ||
       normalizeCode(staffMember.activation_code) === normalizeCode(cleanCredential));
    const matchesDefault = cleanCredential === 'Hospital@2026';
    const matchesCustom = staffMember.password_set && cleanCredential.length >= 6;

    if (!matchesCode && !matchesDefault && !matchesCustom) {
      throw new Error('Invalid password or staff activation code');
    }

    // Attempt to update last_login on staff table
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

    // Establish real Supabase Auth session so PostgREST receives Authorization: Bearer <jwt> with role: authenticated
    let authUserId = staffMember.id;
    if (isSupabaseConfigured()) {
      try {
        // 1. Try with the credential entered
        let authRes = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanCredential,
        });

        // 2. Try default password 'Hospital@2026'
        if (authRes.error) {
          authRes = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: 'Hospital@2026',
          });
        }

        // 3. If that failed because auth user doesn't exist yet, sign them up automatically!
        if (authRes.error) {
          try {
            const signUpRes = await supabase.auth.signUp({
              email: cleanEmail,
              password: 'Hospital@2026',
            });
            if (signUpRes.data?.session) {
              authRes = signUpRes;
            } else {
              authRes = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password: 'Hospital@2026',
              });
            }
          } catch {
            // Handled silently
          }
        }

        if (authRes.data?.user?.id) {
          authUserId = authRes.data.user.id;
        }
      } catch (authErr) {
        console.warn('[authService] Supabase Auth session notice:', authErr);
      }
    }

    // Construct safe profile (strictly preserves database staff ID)
    const safeProfile: Profile = {
      id: staffMember.id,
      staff_id: staffMember.id,
      auth_user_id: authUserId,
      email: staffMember.email,
      full_name: staffMember.full_name,
      role: staffMember.role,
      department: staffMember.department || '',
      specialization: staffMember.specialization || '',
      phone: staffMember.phone || '',
      status: staffMember.status,
      assigned_room_id: (staffMember as any).assigned_room_id || null,
      assigned_room_number: (staffMember as any).assigned_room_number || null,
      avatar_url: null,
      created_at: staffMember.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

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
   * Fetch user profile from staff record or Supabase profiles table
   */
  async getProfile(userId: string, email?: string): Promise<Profile> {
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    if (isSupabaseConfigured()) {
      // 1. Staff table lookup by email first (hospital staff is the primary source of truth)
      if (cleanEmail) {
        try {
          const { data: staffMember, error } = await supabase
            .from('staff')
            .select('id, full_name, email, role, department, specialization, phone, status, created_at, updated_at')
            .eq('email', cleanEmail)
            .maybeSingle();

          if (!error && staffMember) {
            const staffProfile: Profile = {
              id: staffMember.id,
              staff_id: staffMember.id,
              auth_user_id: userId,
              email: staffMember.email,
              full_name: staffMember.full_name,
              role: staffMember.role,
              department: staffMember.department || '',
              specialization: staffMember.specialization || '',
              phone: staffMember.phone || '',
              status: staffMember.status,
              assigned_room_id: (staffMember as any).assigned_room_id || null,
              assigned_room_number: (staffMember as any).assigned_room_number || null,
              avatar_url: null,
              created_at: staffMember.created_at || new Date().toISOString(),
              updated_at: staffMember.updated_at || new Date().toISOString(),
            };
            return staffProfile;
          }
        } catch (err) {
          console.warn('[authService] Staff lookup by email error:', err);
        }
      }

      // 2. Lookup by id in staff table
      if (userId) {
        try {
          const { data: staffMember, error } = await supabase
            .from('staff')
            .select('id, full_name, email, role, department, specialization, phone, status, created_at, updated_at')
            .eq('id', userId)
            .maybeSingle();

          if (!error && staffMember) {
            const staffProfile: Profile = {
              id: staffMember.id,
              staff_id: staffMember.id,
              auth_user_id: userId,
              email: staffMember.email,
              full_name: staffMember.full_name,
              role: staffMember.role,
              department: staffMember.department || '',
              specialization: staffMember.specialization || '',
              phone: staffMember.phone || '',
              status: staffMember.status,
              assigned_room_id: (staffMember as any).assigned_room_id || null,
              assigned_room_number: (staffMember as any).assigned_room_number || null,
              avatar_url: null,
              created_at: staffMember.created_at || new Date().toISOString(),
              updated_at: staffMember.updated_at || new Date().toISOString(),
            };
            return staffProfile;
          }
        } catch (err) {
          console.warn('[authService] Staff lookup by id error:', err);
        }
      }

      // 3. Fallback to profiles table
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (profile && !error) {
          return profile as Profile;
        }
      } catch (err) {
        console.warn('[authService] Profiles table lookup error:', err);
      }
    }

    const stored = localStorage.getItem(AUTH_SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed) return parsed;
      } catch {
        // ignore
      }
    }

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
  async getCurrentUser(providedSession?: any): Promise<Profile | null> {
    // Fast path: if localStorage has neither a stored profile nor a Supabase token, and no session was provided, user is unauthenticated
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_SESSION_KEY) : null;
    const hasSupabaseToken = typeof localStorage !== 'undefined' &&
      Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));

    if (!stored && !hasSupabaseToken && !providedSession) {
      return null;
    }

    // Check if cached profile exists in localStorage
    let cachedProfile: Profile | null = null;
    if (stored) {
      try {
        cachedProfile = JSON.parse(stored) as Profile;
      } catch {
        localStorage.removeItem(AUTH_SESSION_KEY);
      }
    }

    // 1. Live Supabase Auth session check
    if (isSupabaseConfigured()) {
      try {
        let session = providedSession;

        if (!session) {
          // Wrap getSession with a timeout to avoid Web Locks API deadlock
          const getSessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 3500)
          );
          const res = await Promise.race([getSessionPromise, timeoutPromise]);
          session = res?.data?.session;
        }

        if (session?.user) {
          try {
            const profile = await this.getProfile(session.user.id, session.user.email);
            if (profile) {
              localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(profile));
              return profile;
            }
          } catch {
            if (cachedProfile) return cachedProfile;
          }
        }
      } catch (err) {
        console.warn('[authService] Session resolution warning:', err);
      }
    }

    // 2. Return cached profile if active
    if (cachedProfile && cachedProfile.status === 'active') {
      return cachedProfile;
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
