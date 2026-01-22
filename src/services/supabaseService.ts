import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';

export const signIn = async (email: string, password: string): Promise<User> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('Falha ao fazer login');

  return {
    id: data.user.id,
    email: data.user.email || '',
    name: data.user.user_metadata?.name || 'Usuário',
    photoUrl: data.user.user_metadata?.photoUrl || '',
    role: data.user.user_metadata?.role || 'doctor',
  };
};

export const signUp = async (email: string, password: string, name: string): Promise<User> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error('Falha ao criar conta');

  return {
    id: data.user.id,
    email: data.user.email || '',
    name,
    photoUrl: '',
    role: 'doctor',
  };
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data, error } = await supabase.auth.getSession();
  
  if (error || !data.session?.user) return null;

  const user = data.session.user;
  return {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.name || 'Usuário',
    photoUrl: user.user_metadata?.photoUrl || '',
    role: user.user_metadata?.role || 'doctor',
  };
};

export const updateUserProfile = async (
  userId: string,
  updates: { name?: string; photoUrl?: string }
): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    data: updates,
  });

  if (error) throw error;
};

export const fetchMedicos = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'doctor');

  if (error) throw error;
  
  return (data || []).map((user: any) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    photoUrl: user.photo_url || '',
    role: user.role,
  }));
};

export default supabase;

