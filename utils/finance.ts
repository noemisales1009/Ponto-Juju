// A view nova_total_por_medico_mes já teve nomes de coluna diferentes (o SQL do repositório
// usa total_valor_plantao / total_com_desconto; o banco em produção usa valor_soma_total / total_a_pagar).
// Aceitar os dois evita totais zerados se a view for recriada com o outro nome.

type NumericLike = number | string | null | undefined;

export interface FinanceTotalsRow {
  valor_soma_total?: NumericLike;
  total_valor_plantao?: NumericLike;
  total_a_pagar?: NumericLike;
  total_com_desconto?: NumericLike;
}

const toNumber = (value: NumericLike): number => {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

export const getValorTotal = (row: FinanceTotalsRow): number =>
  toNumber(row.valor_soma_total ?? row.total_valor_plantao);

export const getValorAPagar = (row: FinanceTotalsRow): number =>
  toNumber(row.total_a_pagar ?? row.total_com_desconto);

/** Mostra só os dígitos do meio: "123.456.789-09" -> "•••.456.789-••" */
export const maskCpf = (cpf: string | null | undefined): string => {
  if (!cpf) return '-';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '•••';
  return `•••.${digits.slice(3, 6)}.${digits.slice(6, 9)}-••`;
};

export const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
