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
      return 'Você não tem permissão para realizar esta ação.';
    default:
      return fallback;
  }
};
