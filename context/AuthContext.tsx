import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { Profile, UserGoal, UserLastWeights } from '../types';
import type { AuthChangeEvent, Session, User as SupabaseAuthUser, Subscription } from '@supabase/supabase-js';

export interface AuthContextType {
  user: Profile | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  updateUserProfile: (updatedProfileData: Partial<Omit<Profile, 'id' | 'email' | 'created_at'>>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async (supabaseUser: SupabaseAuthUser) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        setUser(null);
        return;
      }

      if (profileData) {
        setUser({
          id: profileData.id,
          email: supabaseUser.email,
          name: profileData.name,
          goal: profileData.goal as UserGoal | undefined,
          last_exercise_weights: (profileData.last_exercise_weights as UserLastWeights) || {},
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
        });
      } else {
        console.warn(`No profile found for user ${supabaseUser.id}. User object will be null.`);
        setUser(null);
      }
    } catch (e) {
      console.error("Critical error in loadUserProfile:", e);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        
        // This will be handled by onAuthStateChange, but setting it here provides a faster initial state.
        setSession(initialSession);
        if (initialSession?.user) {
          await loadUserProfile(initialSession.user);
        }
      } catch (error) {
        console.error("Error during initial session load:", error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false); // Crucially, always stop loading.
      }
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession);
        if (currentSession?.user) {
          // This handles SIGNED_IN and USER_UPDATED.
          await loadUserProfile(currentSession.user);
        } else {
          // This handles SIGNED_OUT.
          setUser(null);
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadUserProfile]);


  const login = async (email: string, password: string): Promise<void> => {
    // The loading state is handled by the AuthPage's local state.
    // onAuthStateChange will handle the user/session update.
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      console.error("Supabase login error:", error);
      throw new Error(error.message || 'Error al iniciar sesión.');
    }
  };

  const register = async (email: string, password: string, name: string): Promise<void> => {
    // The loading state is handled by the AuthPage's local state.
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes("user already registered")) {
          throw new Error("Este correo electrónico ya está registrado.");
        }
        throw new Error("Error during el registro: " + signUpError.message);
      }

      const user = signUpData.user;
      if (!user) throw new Error("Registro exitoso, pero no se devolvió el usuario.");

      const profilePayload: Profile = {
        id: user.id,
        email: user.email!,
        name,
        goal: UserGoal.GENERAL_FITNESS,
        last_exercise_weights: {},
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .insert([profilePayload as any]); 

      if (profileError) {
        console.error("Error al crear el perfil del usuario:", profileError);
        throw new Error("Usuario registrado, pero falló la creación del perfil.");
      }

      // Manually update state after profile creation so user sees the app.
      setUser(profilePayload);
      const { data: sessionResult } = await supabase.auth.getSession();
      setSession(sessionResult.session);

    } catch (error: any) {
      console.error("Supabase registration error:", error);
      throw new Error(error.message || "Error desconocido al registrarse.");
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: any) {
      console.error("Supabase logout error:", error);
      throw new Error(error.message || 'Error al cerrar sesión.');
    }
  };

  const updateUserProfile = async (updatedProfileData: Partial<Omit<Profile, 'id' | 'email' | 'created_at'>>): Promise<void> => {
    if (!user || !session?.user) throw new Error("No hay usuario para actualizar.");
    try {
      const updatesToSave = {
        ...updatedProfileData,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updatesToSave)
        .eq('id', session.user.id);

      if (error) throw error;

      setUser(prevUser => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          ...updatedProfileData,
          last_exercise_weights: updatedProfileData.last_exercise_weights
            ? { ...(prevUser.last_exercise_weights || {}), ...updatedProfileData.last_exercise_weights }
            : prevUser.last_exercise_weights,
          updated_at: updatesToSave.updated_at
        };
      });
    } catch (error: any) {
      console.error("Error updating user profile in Supabase:", error);
      throw new Error(error.message || "Error al actualizar el perfil.");
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, logout, register, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};