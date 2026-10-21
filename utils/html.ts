const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapa qualquer valor antes de colocá-lo em HTML montado como string
 * (ex.: janelas de impressão). Nomes vêm do banco e podem ter sido digitados por qualquer usuário.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);

/**
 * Política de segurança para documentos de impressão: bloqueia scripts e recursos externos
 * mesmo que algum valor escape da sanitização.
 */
export const PRINT_CSP_META =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`;

/**
 * Formata uma célula de CSV: aspas duplicadas e proteção contra "CSV injection"
 * (células iniciadas por = + - @ são interpretadas como fórmula pelo Excel/Sheets).
 */
export const csvCell = (value: unknown): string => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
