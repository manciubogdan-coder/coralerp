import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  DEPARTMENT_ROLES,
  type DepartmentRole,
} from '@/lib/departments';

interface AppProfile {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  approved: boolean;
  created_at: string;
  updated_at: string;
  // extensii noi
  avatar_url?: string | null;
  display_name?: string | null;
  theme_mode?: "light" | "dark" | "auto" | null;
  theme_palette?: "coral" | "blue" | "green" | "violet" | "mocha" | null;
  chat_background?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AppProfile | null;
  isAdmin: boolean;
  isApproved: boolean;
  isLoading: boolean;
  /** Rolurile pe departamente atribuite userului curent (fără 'admin'). */
  departments: DepartmentRole[];
  /** True dacă userul are accesul cerut (admin trece automat). */
  hasDepartment: (dept: DepartmentRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    let nextProfile: AppProfile | null = null;
    let nextIsAdmin = false;
    let nextDepartments: DepartmentRole[] = [];

    try {
      // Use raw query since types aren't generated yet
      const { data: profileData, error: profileError } = await supabase
        .from('app_profiles' as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        nextProfile = (profileData as unknown as AppProfile) ?? null;
      }

      // Fetch ALL roles for this user, not just admin.
      const { data: roleRows, error: roleError } = await supabase
        .from('app_user_roles' as any)
        .select('role')
        .eq('user_id', userId);

      if (roleError) {
        console.warn('Could not load user roles:', roleError.message);
      } else if (roleRows) {
        const roles = (roleRows as unknown as Array<{ role: string }>).map((r) => r.role);
        nextIsAdmin = roles.includes('admin');
        nextDepartments = roles.filter((r): r is DepartmentRole =>
          (DEPARTMENT_ROLES as readonly string[]).includes(r),
        );
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    } finally {
      setProfile(nextProfile);
      setIsAdmin(nextIsAdmin);
      setDepartments(nextDepartments);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      setIsLoading(true);
      await fetchProfile(user.id);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      const prevUserId = currentUserIdRef.current;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Dacă e același user (ex: TOKEN_REFRESHED sau revenire pe tab),
        // NU punem isLoading=true — altfel se remontează toată aplicația
        // și se pierde pagina/tabul curent.
        if (prevUserId === nextUserId) return;

        currentUserIdRef.current = nextUserId;
        setIsLoading(true);
        // Defer Supabase calls with setTimeout to avoid deadlock
        setTimeout(() => {
          (async () => {
            await fetchProfile(session.user.id);
            setIsLoading(false);
          })();
        }, 0);
      } else {
        currentUserIdRef.current = null;
        setProfile(null);
        setIsAdmin(false);
        setIsLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (currentUserIdRef.current === session.user.id) return;
          currentUserIdRef.current = session.user.id;
          setIsLoading(true);
          await fetchProfile(session.user.id);
          setIsLoading(false);
        } else {
          currentUserIdRef.current = null;
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
        },
      },
    });
    return { error };
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
