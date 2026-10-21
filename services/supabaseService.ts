
import { supabase } from './supabaseClient';
import { User } from '../types';

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 100;
const PHOTO_MAX_LENGTH = 700_000; // ~500 KB de imagem em base64
const PHOTO_DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp);base64,/;

// --- Authentication Functions ---

// Monta o perfil do app a partir do usuário do Auth, buscando só as colunas necessárias.
const buildUser = async (authUser: { id: string; email?: string | null }): Promise<User> => {
    const email = authUser.email ?? '';
    const fallbackName = email.split('@')[0];

    const { data: userData } = await supabase
        .from('usuarios')
        .select('nome, email, foto')
        .eq('user_id', authUser.id)
        .maybeSingle();

    if (userData) {
        return {
            id: authUser.id, // UUID do Auth é o ID principal
            name: userData.nome || fallbackName,
            email: userData.email || email,
            photoUrl: userData.foto ?? undefined,
        };
    }

    // Fallback: tenta medicos_juju se não houver perfil em usuarios
    const { data: medicoData } = await supabase
        .from('medicos_juju')
        .select('medico')
        .eq('user_id', authUser.id)
        .maybeSingle();

    return {
        id: authUser.id,
        name: medicoData?.medico || fallbackName,
        email,
    };
};

export const signIn = async (email: string, password: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        throw new Error(error.message);
    }

    if (!data.user) {
        throw new Error('Usuário não encontrado após login.');
    }

    return buildUser(data.user);
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

    return buildUser(session.user);
};

export const updateUserProfile = async (userId: string, updates: { name?: string; photoUrl?: string }) => {
    // Só o próprio usuário logado pode alterar o próprio perfil
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user || session.user.id !== userId) {
        throw new Error('Sessão inválida.');
    }

    const dbUpdates: { nome?: string; foto?: string } = {};

    if (updates.name !== undefined) {
        const name = updates.name.trim();
        if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
            throw new Error(`O nome deve ter entre ${NAME_MIN_LENGTH} e ${NAME_MAX_LENGTH} caracteres.`);
        }
        dbUpdates.nome = name;
    }

    if (updates.photoUrl !== undefined) {
        if (!PHOTO_DATA_URL_PATTERN.test(updates.photoUrl) || updates.photoUrl.length > PHOTO_MAX_LENGTH) {
            throw new Error('Foto inválida. Use PNG, JPG ou WebP de até 500 KB.');
        }
        dbUpdates.foto = updates.photoUrl;
    }

    if (Object.keys(dbUpdates).length === 0) return;

    // .select() é necessário: se a RLS bloquear, o Supabase não retorna erro, apenas 0 linhas
    const { data, error } = await supabase
        .from('usuarios')
        .update(dbUpdates)
        .eq('user_id', userId)
        .select('user_id');

    if (error) {
        throw error;
    }
    if (!data || data.length === 0) {
        throw new Error('Nenhum registro foi atualizado.');
    }

    // Mantém o nome consistente em medicos_juju (usado nos relatórios)
    if (dbUpdates.nome) {
        const { error: medicoError } = await supabase
            .from('medicos_juju')
            .update({ medico: dbUpdates.nome })
            .eq('user_id', userId);

        if (medicoError) {
            console.error('Erro ao sincronizar nome em medicos_juju:', medicoError);
        }
    }
};
