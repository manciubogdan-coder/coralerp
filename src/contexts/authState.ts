import { createContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import type { DepartmentRole } from '@/lib/departments';

export interface AppProfile {
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

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AppProfile | null;
  isAdmin: boolean;
  isApproved: boolean;
  isLoading: boolean;
  loadingError: string | null;
  /** Rolurile pe departamente atribuite userului curent (fără 'admin'). */
  departments: DepartmentRole[];
  /** True dacă userul are accesul cerut (admin trece automat). */
  hasDepartment: (dept: DepartmentRole) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

