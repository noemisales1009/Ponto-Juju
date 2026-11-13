import { supabase } from '../../services/supabaseClient';
import { PontoTroca, Shift } from '../../types';
import { friendlyError } from '../../utils/errors';

/**
 * Plantão passado e já pago (sql/adicionar_troca_ponto.sql):
 *  - quem passou o plantão (cedente) avisa no app
 *  - quem fez o plantão (substituto) bate o ponto e confirma: o valor vai para o cedente
 * As regras ficam no banco. Aqui só chamamos as funções.
 */

type Resultado = { sucesso: true; troca: PontoTroca } | { sucesso: false; erro: string };

const tratarResposta = (data: unknown, error: { code?: string; message?: string } | null, contexto: string): Resultado => {
  if (error) {
    console.error(`Erro ao ${contexto}:`, error);
    return { sucesso: false, erro: friendlyError(error, 'Não foi possível salvar. Tente novamente.') };
  }
  return { sucesso: true, troca: data as PontoTroca };
};

export const registrarTroca = async (troca: {
  substitutoId: string;
  dataDia: string;
  turno: Shift;
  setorId: number;
}): Promise<Resultado> => {
  const { data, error } = await supabase.rpc('registrar_troca', {
    p_substituto_id: troca.substitutoId,
    p_data_dia: troca.dataDia,
    p_turno: troca.turno,
    p_setor_id: troca.setorId,
  });
  return tratarResposta(data, error, 'registrar troca');
};

export const cancelarTroca = async (trocaId: number): Promise<Resultado> => {
  const { data, error } = await supabase.rpc('cancelar_troca', { p_troca_id: trocaId });
  return tratarResposta(data, error, 'cancelar troca');
};

export const confirmarTroca = async (trocaId: number): Promise<Resultado> => {
  const { data, error } = await supabase.rpc('confirmar_troca', { p_troca_id: trocaId });
  return tratarResposta(data, error, 'confirmar troca');
};

/** Trocas em que o médico passou ou fez o plantão, da mais nova para a mais antiga */
export const buscarMinhasTrocas = async (userId: string | number): Promise<PontoTroca[]> => {
  const { data, error } = await supabase
    .from('ponto_troca')
    .select('*')
    .or(`cedente_id.eq.${userId},substituto_id.eq.${userId}`)
    .neq('status', 'cancelada')
    .order('data_dia', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Erro ao buscar trocas:', error);
    return [];
  }
  return data || [];
};

/** Aviso de troca aguardando a confirmação de quem acabou de bater o ponto */
export const buscarTrocaPendente = async (
  substitutoId: string | number,
  dataDia: string,
  turno: Shift,
  setorId: number
): Promise<PontoTroca | null> => {
  const { data, error } = await supabase
    .from('ponto_troca')
    .select('*')
    .eq('substituto_id', substitutoId)
    .eq('data_dia', dataDia)
    .eq('turno', turno)
    .eq('setor_id', setorId)
    .eq('status', 'pendente')
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar troca pendente:', error);
    return null;
  }
  return data;
};
