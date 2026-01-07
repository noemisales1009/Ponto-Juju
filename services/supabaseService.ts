
import { supabase } from './supabaseClient';
import { User } from '../types';

// Tipos baseados no Schema SQL fornecido

export interface MedicoJuju {
  id: number;
  medico: string; // Nome do médico
  user_id: string; // UUID
  banco?: string;
  agencia?: string;
  variacao?: string;
  cpf?: string;
  conta?: string;
}

export interface PontoJuju2 {
  id: number;
  data_dia: string; // Date
  turno: string;
  user_id: string;
  setor_id: number;
  falta?: string;
  created_at: string;
}

export interface SetorJuju {
  id: number;
  nome_setor: string;
}

export interface UsuarioJuju {
    user_id: string;
    nome: string;
    email: string;
    foto?: string;
}

// --- Authentication Functions ---

export const signIn = async (email: string, password: string): Promise<User> => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (authError) {
        throw new Error(authError.message);
    }

    if (!authData.user) {
        throw new Error("Usuário não encontrado após login.");
    }

    // Tenta buscar detalhes do usuário na tabela public.usuarios
    const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();

    if (userData) {
        return {
            id: authData.user.id, // Usando UUID do Auth como ID principal
            name: userData.nome || email.split('@')[0],
            email: userData.email || email,
            photoUrl: userData.foto
        };
    }
    
    // Fallback: Tenta buscar na tabela medicos_juju se usuarios falhar
    const { data: medicoData } = await supabase
        .from('medicos_juju')
        .select('*')
        .eq('user_id', authData.user.id)
        .single();
        
    if (medicoData) {
        return {
             id: authData.user.id,
             name: medicoData.medico || email.split('@')[0],
             email: authData.user.email || email,
        }
    }

    // Se não tiver perfil no banco, retorna dados básicos do Auth
    return {
        id: authData.user.id,
        name: email.split('@')[0],
        email: email,
    };
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Erro ao sair:', error);
    }
};

export const getCurrentUser = async (): Promise<User | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    // Tenta buscar perfil completo
    const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

    if (userData) {
         return {
            id: session.user.id,
            name: userData.nome || session.user.email!.split('@')[0],
            email: userData.email || session.user.email!,
            photoUrl: userData.foto
        };
    }

     // Fallback Medicos
    const { data: medicoData } = await supabase
        .from('medicos_juju')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

    if(medicoData) {
         return {
            id: session.user.id,
            name: medicoData.medico,
            email: session.user.email!
        }
    }

    return {
        id: session.user.id,
        name: session.user.email!.split('@')[0],
        email: session.user.email!,
    };
};

export const updateUserProfile = async (userId: string, updates: { name?: string; photoUrl?: string }) => {
    const dbUpdates: any = {};
    
    // Mapeia os campos do frontend para o banco de dados (usuarios)
    if (updates.name) dbUpdates.nome = updates.name;
    if (updates.photoUrl) dbUpdates.foto = updates.photoUrl;

    // Atualiza tabela usuarios
    const { data, error } = await supabase
        .from('usuarios')
        .update(dbUpdates)
        .eq('user_id', userId)
        .select();

    if (error) {
        throw new Error(error.message);
    }

    // Opcional: Tenta atualizar tabela medicos_juju também se o nome mudou, para manter consistência
    if (updates.name) {
        await supabase
            .from('medicos_juju')
            .update({ medico: updates.name })
            .eq('user_id', userId);
    }

    return data;
};


// --- Data Fetching Functions ---

// Buscar lista de médicos
export const fetchMedicos = async (): Promise<MedicoJuju[]> => {
  const { data, error } = await supabase
    .from('medicos_juju')
    .select('*')
    .order('medico', { ascending: true });

  if (error) {
    console.error('Erro ao buscar médicos:', error);
    return [];
  }
  return data as MedicoJuju[];
};

// Buscar pontos registrados
export const fetchPontos = async (startDate?: string, endDate?: string): Promise<PontoJuju2[]> => {
  let query = supabase
    .from('ponto_juju2')
    .select('*')
    .order('data_dia', { ascending: false });

  if (startDate) {
    query = query.gte('data_dia', startDate);
  }
  if (endDate) {
    query = query.lte('data_dia', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar pontos:', error);
    return [];
  }
  return data as PontoJuju2[];
};

// Buscar setores
export const fetchSetores = async (): Promise<SetorJuju[]> => {
  const { data, error } = await supabase
    .from('setor_juju')
    .select('*');

  if (error) {
    console.error('Erro ao buscar setores:', error);
    return [];
  }
  return data as SetorJuju[];
};
