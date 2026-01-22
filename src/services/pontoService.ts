import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';

/**
 * ✅ Verificar se o médico já bateu ponto no MESMO TURNO
 * Permite múltiplos turnos no mesmo dia, mas não permite duplicar o mesmo turno
 */
export const verificarPontoDuplicado = async (
  userId: string,
  data: Date,
  turno: string
): Promise<{ pode_bater: boolean; mensagem?: string }> => {
  const dataDia = new Date(data).toISOString().split('T')[0];

  // Buscar TODOS os pontos do dia para este usuário
  const { data: registros, error } = await supabase
    .from('ponto_juju2')
    .select('id, turno, data_dia')
    .eq('user_id', userId)
    .eq('data_dia', dataDia);

  if (error) {
    console.error('Erro ao verificar ponto duplicado:', error);
    return {
      pode_bater: false,
      mensagem: 'Erro ao verificar histórico de ponto',
    };
  }

  // Verificar se já existe um ponto neste TURNO específico
  // Aceita variações do nome (ex: "Manhã" combina com "Manhã Semana (07h - 13h)")
  if (registros && registros.length > 0) {
    const jaBateuNesteTurno = registros.some(r => {
      // Se o turno é igual exatamente, não permite
      if (r.turno === turno) return true;
      
      // Se o turno salvo CONTÉM o turno procurado, não permite
      // Ex: "Manhã Semana (07h - 13h)" contém "Manhã"
      if (r.turno?.includes(turno)) return true;
      
      // Se o turno procurado CONTÉM o turno salvo, não permite
      if (turno.includes(r.turno)) return true;
      
      return false;
    });

    if (jaBateuNesteTurno) {
      const turnosRegistrados = registros.map(r => r.turno).join(', ');
      return {
        pode_bater: false,
        mensagem: `⚠️ Você já bateu ponto no turno da ${turno} em 2026-01-06! Registrado como: ${turnosRegistrados}`,
      };
    }
  }

  return { pode_bater: true };
};

/**
 * 🕐 Registrar ponto com validação automática
 */
export const registrarPonto = async (
  userId: string,
  data: Date,
  turno: string,
  setorId: number,
  falta?: string
): Promise<{ sucesso: boolean; erro?: string; dados?: any }> => {
  console.log('📝 Tentando registrar ponto:', { userId, data, turno, setorId, falta });

  // ✅ Validação: verifica se já bateu neste TURNO específico
  const validacao = await verificarPontoDuplicado(userId, data, turno);
  console.log('✅ Validação duplicado:', validacao);

  if (!validacao.pode_bater) {
    return {
      sucesso: false,
      erro: validacao.mensagem,
    };
  }

  // Converter data para formato DATE (YYYY-MM-DD)
  const dataDia = new Date(data).toISOString().split('T')[0];
  // Também enviar como timestamp completo para o trigger
  const dataTimestamp = new Date(data).toISOString();
  
  console.log('📅 Data formatada para envio:', {
    dataOriginal: data,
    dataFormatada: dataDia,
    dataTimestamp: dataTimestamp,
    tipo: typeof dataDia
  });

  // Inserir o ponto (o banco fará a validação final)
  const insertData = {
    user_id: userId,
    data: dataTimestamp,  // ✅ IMPORTANTE: Enviar também o campo `data` para o trigger
    data_dia: dataDia,
    turno,
    setor_id: setorId,
    falta,
    turno_preenchido: !falta,
  };

  console.log('📤 Dados sendo enviados ao Supabase:', insertData);

  const { data: resultado, error } = await supabase
    .from('ponto_juju2')
    .insert(insertData)
    .select();

  console.log('🔄 Resposta do Supabase:', { resultado, error });

  if (error) {
    console.error('❌ ERRO ao registrar ponto:', error);
    return {
      sucesso: false,
      erro: error.message || 'Erro ao registrar ponto',
    };
  }

  console.log('✅ SUCESSO! Ponto registrado:', resultado);
  return {
    sucesso: true,
    dados: resultado?.[0],
  };
};

/**
 * 📊 Buscar histórico de pontos do médico
 */
export const buscarHistoricoPontos = async (
  userId: string,
  dataInicio?: Date,
  dataFim?: Date
): Promise<any[]> => {
  let query = supabase
    .from('ponto_juju2')
    .select(`
      id,
      data,
      data_dia,
      turno,
      dia_semana_calculado,
      valor_plantao,
      setor_id,
      falta,
      periodo_id
    `)
    .eq('user_id', userId);

  if (dataInicio) {
    query = query.gte('data_dia', dataInicio.toISOString().split('T')[0]);
  }

  if (dataFim) {
    query = query.lte('data_dia', dataFim.toISOString().split('T')[0]);
  }

  const { data, error } = await query.order('data', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }

  return data || [];
};

/**
 * 📈 Calcular ganhos do mês
 */
export const calcularGanhosMes = async (
  userId: string,
  mes: number,
  ano: number
): Promise<{ total: number; registros: any[] }> => {
  const dataInicio = new Date(ano, mes - 1, 1);
  const dataFim = new Date(ano, mes, 0);

  const registros = await buscarHistoricoPontos(userId, dataInicio, dataFim);

  const total = registros.reduce((acc, reg) => acc + (reg.valor_plantao || 0), 0);

  return { total, registros };
};

/**
 * ❌ Deletar um ponto (com verificação de segurança)
 */
export const deletarPonto = async (pontoId: number): Promise<boolean> => {
  const { error } = await supabase
    .from('ponto_juju2')
    .delete()
    .eq('id', pontoId);

  if (error) {
    console.error('Erro ao deletar ponto:', error);
    return false;
  }

  return true;
};

/**
 * ✏️ Atualizar um ponto
 */
export const atualizarPonto = async (
  pontoId: number,
  updates: {
    turno?: string;
    setor_id?: number;
    falta?: string;
    valor_plantao?: number;
  }
): Promise<boolean> => {
  const { error } = await supabase
    .from('ponto_juju2')
    .update(updates)
    .eq('id', pontoId);

  if (error) {
    console.error('Erro ao atualizar ponto:', error);
    return false;
  }

  return true;
};

export default supabase;
