import supabase from './supabaseService';

/**
 * 📋 Interface simplificada para Falta
 */
export interface Falta {
  id: number;
  user_id: string;
  data_falta: string;
  created_at: string;
}

/**
 * ✅ Registrar falta (apenas data + médico)
 */
export const registrarFalta = async (
  userId: string,
  dataFalta: Date
): Promise<{ sucesso: boolean; erro?: string; dados?: Falta }> => {
  const dataFormatada = dataFalta.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('falta_medico')
    .insert({
      user_id: userId,
      data_falta: dataFormatada,
    })
    .select();

  if (error) {
    return {
      sucesso: false,
      erro: error.message || 'Erro ao registrar falta',
    };
  }

  return {
    sucesso: true,
    dados: data?.[0],
  };
};

/**
 * 📊 Buscar faltas de um médico
 */
export const buscarFaltasMedico = async (
  userId: string,
  dataInicio?: Date,
  dataFim?: Date
): Promise<Falta[]> => {
  let query = supabase
    .from('falta_medico')
    .select('*')
    .eq('user_id', userId);

  if (dataInicio) {
    const dataStr = dataInicio.toISOString().split('T')[0];
    query = query.gte('data_falta', dataStr);
  }

  if (dataFim) {
    const dataStr = dataFim.toISOString().split('T')[0];
    query = query.lte('data_falta', dataStr);
  }

  const { data, error } = await query.order('data_falta', { ascending: false });

  if (error) {
    console.error('Erro ao buscar faltas:', error);
    return [];
  }

  return data || [];
};

/**
 * 📈 Contar faltas do mês
 */
export const contarFaltasMes = async (
  userId: string,
  mes: number,
  ano: number
): Promise<{
  total: number;
  faltas: Falta[];
}> => {
  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = new Date(ano, mes, 0);

  const faltas = await buscarFaltasMedico(userId, dataInicio, dataFim);

  return {
    total: faltas.length,
    faltas,
  };
};

/**
 * 🗑️ Deletar falta
 */
export const deletarFalta = async (faltaId: number): Promise<{ sucesso: boolean; erro?: string }> => {
  const { error } = await supabase
    .from('falta_medico')
    .delete()
    .eq('id', faltaId);

  if (error) {
    return {
      sucesso: false,
      erro: error.message,
    };
  }

  return { sucesso: true };
};

/**
 * 🏥 ADMIN: Listar todas as faltas
 */
export const listarTodasFaltas = async (): Promise<Falta[]> => {
  const { data, error } = await supabase
    .from('falta_medico')
    .select('*')
    .order('data_falta', { ascending: false });

  if (error) {
    console.error('Erro ao listar faltas:', error);
    return [];
  }

  return data || [];
};

export default {
  registrarFalta,
  buscarFaltasMedico,
  contarFaltasMes,
  deletarFalta,
  listarTodasFaltas,
};
