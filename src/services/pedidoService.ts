import { supabase } from '../../services/supabaseClient';
import { PontoPedido, Shift } from '../../types';
import { formatDateISO, getTodayLocal } from '../../utils/date';
import { friendlyError } from '../../utils/errors';

/**
 * Pedidos de correção do ponto (sql/adicionar_pedidos_ponto.sql):
 *  - atraso: o médico justifica um atraso; aprovado, o desconto sai
 *  - esquecido: o médico pede um ponto que não bateu; aprovado, o ponto entra no pagamento
 * As regras (prazo, quem decide) ficam no banco. Aqui só chamamos as funções.
 */

/** Prazo para pedir: até 2 dias depois do plantão. Igual ao banco. */
export const PRAZO_PEDIDO_DIAS = 2;

/** Primeiro dia ainda dentro do prazo, "YYYY-MM-DD" */
export const getPrimeiroDiaNoPrazo = (): string => {
  const data = new Date();
  data.setDate(data.getDate() - PRAZO_PEDIDO_DIAS);
  return formatDateISO(data);
};

export const estaNoPrazo = (dataDia: string): boolean =>
  dataDia >= getPrimeiroDiaNoPrazo() && dataDia <= getTodayLocal();

type Resultado = { sucesso: true; pedido: PontoPedido } | { sucesso: false; erro: string };

const tratarResposta = (data: unknown, error: { code?: string; message?: string } | null, contexto: string): Resultado => {
  if (error) {
    console.error(`Erro ao ${contexto}:`, error);
    return { sucesso: false, erro: friendlyError(error, 'Não foi possível enviar. Tente novamente.') };
  }
  return { sucesso: true, pedido: data as PontoPedido };
};

export const pedirAbonoAtraso = async (pontoId: number, motivo: string): Promise<Resultado> => {
  const { data, error } = await supabase.rpc('pedir_abono_atraso', {
    p_ponto_id: pontoId,
    p_motivo: motivo,
  });
  return tratarResposta(data, error, 'justificar atraso');
};

export const pedirPontoEsquecido = async (pedido: {
  dataDia: string;
  turno: Shift;
  setorId: number;
  horario: string; // "HH:MM"
  motivo: string;
}): Promise<Resultado> => {
  const { data, error } = await supabase.rpc('pedir_ponto_esquecido', {
    p_data_dia: pedido.dataDia,
    p_turno: pedido.turno,
    p_setor_id: pedido.setorId,
    p_horario: pedido.horario,
    p_motivo: pedido.motivo,
  });
  return tratarResposta(data, error, 'pedir ponto esquecido');
};

export const decidirPedido = async (pedidoId: number, aprovar: boolean, observacao: string): Promise<Resultado> => {
  const { data, error } = await supabase.rpc('decidir_pedido', {
    p_pedido_id: pedidoId,
    p_aprovar: aprovar,
    p_observacao: observacao,
  });
  return tratarResposta(data, error, 'decidir pedido');
};

/** Pedidos do próprio médico (a RLS já limita aos dele) */
export const buscarMeusPedidos = async (userId: string | number): Promise<PontoPedido[]> => {
  const { data, error } = await supabase
    .from('ponto_pedido')
    .select('*')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao buscar pedidos:', error);
    return [];
  }
  return data || [];
};

/** Quantos pedidos aguardam decisão (só o admin enxerga os de todos) */
export const contarPedidosPendentes = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('ponto_pedido')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pendente');

  if (error) {
    console.error('Erro ao contar pedidos:', error);
    return 0;
  }
  return count ?? 0;
};

/** "08:30:00" -> "08:30" */
export const formatHorario = (horario: string | null): string => (horario ? horario.slice(0, 5) : '-');

/** Pedidos de todos os médicos, do mais novo para o mais antigo (a RLS só entrega todos ao admin) */
export const buscarTodosPedidos = async (limite = 200): Promise<PontoPedido[] | null> => {
  const { data, error } = await supabase
    .from('ponto_pedido')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('Erro ao buscar pedidos:', error);
    return null;
  }
  return data || [];
};
