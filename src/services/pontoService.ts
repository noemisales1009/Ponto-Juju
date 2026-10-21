import { supabase } from '../../services/supabaseClient';
import { SECTOR_ID_MAP, SHIFT_FULL_NAME_MAP, matchesShift } from '../../constants';
import { Shift } from '../../types';
import { formatDateBR, formatDateISO, isValidDateISO, toDbTimestamp } from '../../utils/date';
import { friendlyError } from '../../utils/errors';

const VALID_SHIFTS = Object.keys(SHIFT_FULL_NAME_MAP);
const VALID_SECTOR_IDS = Object.values(SECTOR_ID_MAP);

// Aceita "YYYY-MM-DD" (preferido) ou Date local
const toDateISO = (data: string | Date): string =>
  typeof data === 'string' ? data : formatDateISO(data);

/**
 * ✅ Verificar se o médico já bateu ponto no MESMO TURNO
 * Permite múltiplos turnos no mesmo dia, mas não permite duplicar o mesmo turno
 */
export const verificarPontoDuplicado = async (
  userId: string | number,
  data: string | Date,
  turno: string
): Promise<{ pode_bater: boolean; mensagem?: string }> => {
  const dataDia = toDateISO(data);

  // Buscar TODOS os pontos do dia para este usuário
  const { data: registros, error } = await supabase
    .from('ponto_juju2')
    .select('id, turno')
    .eq('user_id', userId)
    .eq('data_dia', dataDia);

  if (error) {
    console.error('Erro ao verificar ponto duplicado:', error);
    return {
      pode_bater: false,
      mensagem: 'Não foi possível verificar o histórico de ponto. Tente novamente.',
    };
  }

  // Aceita variações do nome (ex: "Manhã" combina com "Manhã Semana (07h - 13h)")
  const jaBateuNesteTurno = (registros || []).some(r => matchesShift(r.turno, turno as Shift));

  if (jaBateuNesteTurno) {
    return {
      pode_bater: false,
      mensagem: `⚠️ Você já registrou o turno da ${turno} em ${formatDateBR(dataDia)}.`,
    };
  }

  return { pode_bater: true };
};

/**
 * 🕐 Registrar ponto com validação automática
 */
export const registrarPonto = async (
  userId: string | number,
  data: string | Date,
  turno: string,
  setorId: number,
  falta?: string
): Promise<{ sucesso: boolean; erro?: string; dados?: any }> => {
  const dataDia = toDateISO(data);

  // Validação de entrada
  if (!isValidDateISO(dataDia)) {
    return { sucesso: false, erro: 'Selecione uma data válida.' };
  }
  if (!VALID_SHIFTS.includes(turno)) {
    return { sucesso: false, erro: 'Turno inválido.' };
  }
  if (!VALID_SECTOR_IDS.includes(setorId)) {
    return { sucesso: false, erro: 'Setor inválido.' };
  }

  // ✅ Validação: verifica se já bateu neste TURNO específico
  const validacao = await verificarPontoDuplicado(userId, dataDia, turno);

  if (!validacao.pode_bater) {
    return {
      sucesso: false,
      erro: validacao.mensagem,
    };
  }

  // ✅ Obter usuário autenticado atual (quem está registrando)
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  if (!currentUser) {
    return {
      sucesso: false,
      erro: 'Sessão expirada. Faça login novamente.',
    };
  }

  // Inserir o ponto (o banco fará a validação final)
  const insertData = {
    user_id: userId,
    created_by: currentUser.id,  // ✅ QUEM está registrando o ponto
    data: toDbTimestamp(dataDia),  // ✅ O trigger deriva data_dia deste campo
    data_dia: dataDia,
    turno,
    setor_id: setorId,
    falta,
    turno_preenchido: !falta,
  };

  const { data: resultado, error } = await supabase
    .from('ponto_juju2')
    .insert(insertData)
    .select();

  if (error) {
    console.error('Erro ao registrar ponto:', error);
    return {
      sucesso: false,
      erro: friendlyError(error, 'Não foi possível registrar o ponto. Tente novamente.'),
    };
  }

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
  dataInicio?: string,
  dataFim?: string
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
    query = query.gte('data_dia', dataInicio);
  }

  if (dataFim) {
    query = query.lte('data_dia', dataFim);
  }

  const { data, error } = await query.order('data', { ascending: false });

  if (error) {
    console.error('Erro ao buscar histórico:', error);
    return [];
  }

  return data || [];
};
