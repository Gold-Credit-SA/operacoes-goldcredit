import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { setCacheUserScope, clearPersistedCache } from '@/lib/queryPersister';

const MASTER_EMAIL = 'renan@goldcreditsa.com.br';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  must_change_password: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isMaster: boolean;
  mustChangePassword: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);
  const queryClient = useQueryClient();

  const isMaster = user?.email === MASTER_EMAIL;
  const isAdmin = isMaster || role === 'admin';
  const mustChangePassword = profile?.must_change_password === true;

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const [{ data: profileData, error }, { data: roleData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).single(),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);

      if (error) {
        console.error('Error fetching profile:', error);
        return { profile: null, role: null };
      }

      return { profile: profileData, role: (roleData?.role as string) ?? null };
    } catch (error) {
      console.error('Error fetching profile:', error);
      return { profile: null, role: null };
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return profileData;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Get initial session only once
    const initializeAuth = async () => {
      if (initializedRef.current) return;
      initializedRef.current = true;

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (initialSession?.user) {
          setCacheUserScope(initialSession.user.id);
          setSession(initialSession);
          setUser(initialSession.user);
          
          const profileData = await fetchProfile(initialSession.user.id);
          if (mounted) {
            setProfile(profileData);
          }
        } else {
          setCacheUserScope(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state listener - ALWAYS set up, not just on first mount
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        // Update session and user state
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          setCacheUserScope(currentSession.user.id);
          // Use setTimeout to avoid Supabase deadlock issue
          setTimeout(async () => {
            if (!mounted) return;
            const profileData = await fetchProfile(currentSession.user.id);
            if (mounted) {
              setProfile(profileData);
            }
          }, 0);
        } else {
          setCacheUserScope(null);
          setProfile(null);
        }

        // Ensure loading is false after auth state change
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // Limpa cache em memória + persistido (evita vazar dados entre usuários)
    queryClient.clear();
    await clearPersistedCache();
    setCacheUserScope(null);
    setUser(null);
    setSession(null);
    setProfile(null);
  }, [queryClient]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const data = await fetchProfile(user.id);
      setProfile(data);
    }
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isMaster,
        mustChangePassword,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
