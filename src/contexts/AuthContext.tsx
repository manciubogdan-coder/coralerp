import React, { useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { AuthContext, type AppProfile } from './authState';
import { supabase } from '@/integrations/supabase/client';
import { AUTH_CONNECTION_ERROR, AUTH_TIMEOUT_MS, withAuthTimeout as withTimeout } from '@/lib/authTimeout';
import {
  DEPARTMENT_ROLES,
  type DepartmentRole,
} from '@/lib/departments';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [departments, setDepartments] = useState<DepartmentRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const profileRequestRef = useRef(0);

  const fetchProfile = async (userId: string) => {
    const request = ++profileRequestRef.current;
    let nextProfile: AppProfile | null = null;
    let nextIsAdmin = false;
    let nextDepartments: DepartmentRole[] = [];

    try {
      // Use raw query since types aren't generated yet
      const [profileResult, roleResult] = await withTimeout(Promise.all([
        supabase
          .from('app_profiles' as any)
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase.from('app_user_roles' as any).select('role').eq('user_id', userId),
      ]));
      if (request !== profileRequestRef.current) return;
      const { data: profileData, error: profileError } = profileResult;
      const { data: roleRows, error: roleError } = roleResult;

      if (profileError) {
        throw profileError;
      } else {
        nextProfile = (profileData as unknown as AppProfile) ?? null;
      }

      // Fetch ALL roles for this user, not just admin.
      if (roleError) {
        throw roleError;
      } else if (roleRows) {
        const roles = (roleRows as unknown as Array<{ role: string }>).map((r) => r.role);
        nextIsAdmin = roles.includes('admin');
        nextDepartments = roles.filter((r): r is DepartmentRole =>
          (DEPARTMENT_ROLES as readonly string[]).includes(r),
        );
      }
    } catch (error) {
      if (request === profileRequestRef.current) setLoadingError(AUTH_CONNECTION_ERROR);
      throw error;
    } finally {
      if (request === profileRequestRef.current) {
        setProfile(nextProfile);
        setIsAdmin(nextIsAdmin);
        setDepartments(nextDepartments);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      setIsLoading(true);
      setLoadingError(null);
      try { await fetchProfile(user.id); }
      catch { /* Connection error is displayed by the account gate. */ }
      finally { setIsLoading(false); }
    }
  };

  useEffect(() => {
    let active = true;
    let sessionReceived = false;
    let deferredProfile: ReturnType<typeof setTimeout> | undefined;
    currentUserIdRef.current = null;
    const startupTimer = setTimeout(() => {
      if (!active) return;
      profileRequestRef.current++;
      setLoadingError(AUTH_CONNECTION_ERROR);
      setIsLoading(false);
    }, AUTH_TIMEOUT_MS);

    const applySession = (nextSession: Session | null) => {
      if (!active) return;
      const nextUserId = nextSession?.user?.id ?? null;
      const prevUserId = currentUserIdRef.current;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        if (prevUserId === nextUserId) return;
        currentUserIdRef.current = nextUserId;
        profileRequestRef.current++;
        setProfile(null);
        setIsAdmin(false);
        setDepartments([]);
        setLoadingError(null);
        setIsLoading(true);
        clearTimeout(deferredProfile);
        deferredProfile = setTimeout(async () => {
          if (!active || currentUserIdRef.current !== nextUserId) return;
          try { await fetchProfile(nextSession.user.id); }
          catch { /* fetchProfile exposes a retryable connection error. */ }
          finally {
            if (active && currentUserIdRef.current === nextUserId) {
              clearTimeout(startupTimer);
              setIsLoading(false);
            }
          }
        }, 0);
      } else {
        clearTimeout(startupTimer);
        clearTimeout(deferredProfile);
        profileRequestRef.current++;
        currentUserIdRef.current = null;
        setProfile(null);
        setIsAdmin(false);
        setDepartments([]);
        setLoadingError(null);
        setIsLoading(false);
      }
    };
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      sessionReceived = true;
      applySession(nextSession);
    });

    // THEN check for existing session
    withTimeout(supabase.auth.getSession())
      .then(({ data: { session }, error }) => {
        if (!active || sessionReceived) return;
        if (error) throw error;
        applySession(session);
      })
      .catch(() => {
        if (!active || sessionReceived) return;
        clearTimeout(startupTimer);
        setLoadingError(AUTH_CONNECTION_ERROR);
        setIsLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(startupTimer);
      clearTimeout(deferredProfile);
      profileRequestRef.current++;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
      );
      return { error };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    try {
      const { error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              name,
            },
          },
        }),
      );
      return { error };
    } catch (e) {
      return { error: e as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setDepartments([]);
  };

  const isApproved = profile?.approved ?? false;
  const hasDepartment = (dept: DepartmentRole) =>
    isAdmin || departments.includes(dept);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isApproved,
        isLoading,
        loadingError,
        departments,
        hasDepartment,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
