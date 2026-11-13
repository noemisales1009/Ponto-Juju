interface DbError {
  code?: string;
  message?: string;
}

const DEFAULT_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.';

/**
 * Converte erros do Supabase/Postgres em mensagens genéricas para o usuário.
 * O detalhe técnico deve ir apenas para o console (console.error), nunca para a tela.
 */
export const friendlyError = (error: DbError | null | undefined, fallback: string = DEFAULT_MESSAGE): string => {
  switch (error?.code) {
    case '23505':
      return 'Já existe um registro para este médico neste dia e turno.';
    case '42501':
      // As regras do ponto (GPS, data de hoje, início do turno) usam este código com uma mensagem
      // escrita para o médico. O Postgres usa o mesmo código para permissão negada, em inglês.
      return error?.message && !/permission denied|row-level security|violates/i.test(error.message)
        ? error.message
        : 'Você não tem permissão para realizar esta ação.';
    case 'PT400':
      // Mensagens das funções de pedido (sql/adicionar_pedidos_ponto.sql), escritas para o médico
      return error?.message || fallback;
    default:
      return fallback;
  }
};
