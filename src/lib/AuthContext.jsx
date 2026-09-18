import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authService } from '@/services/auth.service';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'ethiocare-hms', public_settings: {} });

  // Core session initialization and restoration
  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      const currentUser = await authService.getCurrentUser();

      if (!currentUser) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }

      if (currentUser.status !== 'active') {
        setAuthError({
          type: 'account_disabled',
          message: 'Your account has been deactivated. Please contact your administrator.',
        });
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }

      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('[AuthContext] User auth verification failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  }, [checkUserAuth]);

  // Direct login action called from Login.jsx
  const login = useCallback(async (email, credential, targetPortal) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const profile = await authService.loginStaff(email, credential, targetPortal);
      setUser(profile);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return profile;
    } catch (err) {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      throw err;
    }
  }, []);

  useEffect(() => {
    // Initial restoration of session on mount
    checkAppState();

    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await checkUserAuth();
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
          setAuthChecked(true);
        }
        // NOTE: On INITIAL_SESSION with session = null, do NOT wipe user state!
        // checkAppState() / checkUserAuth() is already actively restoring the hospital staff session.
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [checkAppState, checkUserAuth]);

  const logout = useCallback(async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
    await authService.logout();

    if (shouldRedirect) {
      window.location.href = '/login';
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      login,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};