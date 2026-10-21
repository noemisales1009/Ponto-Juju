// Todas as datas do app são "YYYY-MM-DD" no fuso local. Evite toISOString() para datas de calendário:
// ele converte para UTC e, no Brasil, vira o dia/mês seguinte depois das 21h.

const pad = (n: number) => String(n).padStart(2, '0');

export const formatDateISO = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const getTodayLocal = (): string => formatDateISO(new Date());

/** Mês atual no formato "YYYY-MM" */
export const getCurrentMonthLocal = (): string => getTodayLocal().slice(0, 7);

export const isValidDateISO = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
};

export const isValidMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** Primeiro e último dia de um mês "YYYY-MM", como "YYYY-MM-DD" */
export const getMonthRange = (yearMonth: string): { start: string; end: string } => {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
};

/** "2026-01-08" -> "08/01/2026" */
export const formatDateBR = (dateISO: string): string => dateISO.split('-').reverse().join('/');

/**
 * Timestamp enviado ao banco junto com data_dia. Usa meio-dia UTC para que o trigger
 * (DATE(data)) resulte no mesmo dia independentemente do fuso configurado no banco.
 */
export const toDbTimestamp = (dateISO: string): string => `${dateISO}T12:00:00.000Z`;
