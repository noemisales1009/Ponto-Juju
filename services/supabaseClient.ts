import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY). Verifique o arquivo .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseKey);