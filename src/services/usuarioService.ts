import supabase from './supabaseService';

/**
 * 👤 Interface para Usuário
 */
export interface Usuario {
  user_id: string;
  nome: string;
  email: string;
  funcao: string;
  setor?: string;
  setor_id?: number;
  foto?: string;
  ativo: boolean;
  created_at: string;
}

/**
 * 🩺 Interface para Médico
 */
export interface Medico {
  id: number;
  user_id: string;
  medico: string;
  banco?: string;
  agencia?: string;
  variacao?: string;
  cpf?: string;
  conta?: string;
  created_at: string;
}

/**
 * 🩺 Interface para Médico Completo (com dados do usuário)
 */
export interface MedicoCompleto extends Medico {
  usuario_nome: string;
  email: string;
  foto?: string;
  setor?: string;
  setor_id?: number;
  ativo: boolean;
}

/**
 * ✅ Criar novo usuário
 */
export const criarUsuario = async (
  nome: string,
  email: string,
  funcao: string,
  setorId?: number,
  foto?: string
): Promise<{ sucesso: boolean; erro?: string; dados?: Usuario }> => {
  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      nome,
      email,
      funcao,
      setor_id: setorId || null,
      foto,
      ativo: true,
    })
    .select();

  if (error) {
    return {
      sucesso: false,
      erro: error.message || 'Erro ao criar usuário',
    };
  }

  return {
    sucesso: true,
    dados: data?.[0],
  };
};

/**
 * 📊 Buscar usuário por ID
 */
export const buscarUsuario = async (userId: string): Promise<Usuario | null> => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Erro ao buscar usuário:', error);
    return null;
  }

  return data;
};

/**
 * 📊 Listar todos os usuários ativos
 */
export const listarUsuariosAtivos = async (): Promise<Usuario[]> => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao listar usuários:', error);
    return [];
  }

  return data || [];
};

/**
 * ✏️ Atualizar usuário
 */
export const atualizarUsuario = async (
  userId: string,
  updates: {
    nome?: string;
    email?: string;
    funcao?: string;
    setor?: string;
    setor_id?: number;
    foto?: string;
    ativo?: boolean;
  }
): Promise<{ sucesso: boolean; erro?: string }> => {
  const { error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('user_id', userId);

  if (error) {
    return {
      sucesso: false,
      erro: error.message,
    };
  }

  return { sucesso: true };
};

/**
 * 🩺 Registrar médico
 */
export const registrarMedico = async (
  userId: string,
  medico: string,
  banco?: string,
  agencia?: string,
  variacao?: string,
  cpf?: string,
  conta?: string
): Promise<{ sucesso: boolean; erro?: string; dados?: Medico }> => {
  const { data, error } = await supabase
    .from('medicos_juju')
    .insert({
      user_id: userId,
      medico,
      banco,
      agencia,
      variacao,
      cpf,
      conta,
    })
    .select();

  if (error) {
    return {
      sucesso: false,
      erro: error.message || 'Erro ao registrar médico',
    };
  }

  return {
    sucesso: true,
    dados: data?.[0],
  };
};

/**
 * 🩺 Buscar médico por user_id
 */
export const buscarMedicoComUsuario = async (userId: string): Promise<MedicoCompleto | null> => {
  const { data, error } = await supabase
    .from('vw_medicos_completo')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Erro ao buscar médico:', error);
    return null;
  }

  return data;
};

/**
 * 🩺 Listar todos os médicos com informações completas
 */
export const listarMedicosComDetalhes = async (): Promise<MedicoCompleto[]> => {
  const { data, error } = await supabase
    .from('vw_medicos_completo')
    .select('*')
    .order('medico', { ascending: true });

  if (error) {
    console.error('Erro ao listar médicos:', error);
    return [];
  }

  return data || [];
};

/**
 * ✏️ Atualizar dados bancários do médico
 */
export const atualizarDadosBancarios = async (
  medicoId: number,
  banco: string,
  agencia: string,
  conta: string,
  variacao?: string,
  cpf?: string
): Promise<{ sucesso: boolean; erro?: string }> => {
  const { error } = await supabase
    .from('medicos_juju')
    .update({
      banco,
      agencia,
      conta,
      variacao,
      cpf,
    })
    .eq('id', medicoId);

  if (error) {
    return {
      sucesso: false,
      erro: error.message,
    };
  }

  return { sucesso: true };
};

/**
 * ✏️ Atualizar nome do médico (dispara auditoria)
 */
export const atualizarNomeMedico = async (
  medicoId: number,
  novoNome: string
): Promise<{ sucesso: boolean; erro?: string }> => {
  const { error } = await supabase
    .from('medicos_juju')
    .update({ medico: novoNome })
    .eq('id', medicoId);

  if (error) {
    return {
      sucesso: false,
      erro: error.message,
    };
  }

  return { sucesso: true };
};

/**
 * 📋 Buscar auditoria de médico
 */
export const buscarAuditoriaMedico = async (medicoId: number) => {
  const { data, error } = await supabase
    .from('auditoria_medicos')
    .select('*')
    .eq('medico_id', medicoId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar auditoria:', error);
    return [];
  }

  return data || [];
};

/**
 * 🗑️ Desativar usuário
 */
export const desativarUsuario = async (userId: string): Promise<{ sucesso: boolean; erro?: string }> => {
  const { error } = await supabase
    .from('usuarios')
    .update({ ativo: false })
    .eq('user_id', userId);

  if (error) {
    return {
      sucesso: false,
      erro: error.message,
    };
  }

  return { sucesso: true };
};

/**
 * ✅ Ativar usuário
 */
export const ativarUsuario = async (userId: string): Promise<{ sucesso: boolean; erro?: string }> => {
  const { error } = await supabase
    .from('usuarios')
    .update({ ativo: true })
    .eq('user_id', userId);

  if (error) {
    return {
      sucesso: false,
      erro: error.message,
    };
  }

  return { sucesso: true };
};

export default {
  criarUsuario,
  buscarUsuario,
  listarUsuariosAtivos,
  atualizarUsuario,
  registrarMedico,
  buscarMedicoComUsuario,
  listarMedicosComDetalhes,
  atualizarDadosBancarios,
  atualizarNomeMedico,
  buscarAuditoriaMedico,
  desativarUsuario,
  ativarUsuario,
};
