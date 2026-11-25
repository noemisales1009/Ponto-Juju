import { PontoPedido } from '../types';
import { escapeHtml, PRINT_CSP_META } from './html';
import { formatDateBR, formatMinutes, formatTimeBR } from './date';
import { formatBRL } from './finance';

/** Ponto batido com atraso e desconto ainda valendo */
export interface LateRecord {
  id: number;
  userId: string;
  nome: string;
  dataDia: string;
  turno: string;
  setor: string;
  batidoEm: string | null;
  minutos: number;
  desconto: number;
}

export interface DoctorSummary {
  userId: string;
  nome: string;
  atrasos: number;
  minutos: number;
  desconto: number;
}

/** Justificativa de atraso (ponto_pedido, tipo 'atraso') dos plantões do mês */
export interface Justificativa {
  id: number;
  userId: string;
  nome: string;
  dataDia: string;
  turno: string;
  setor: string;
  /** "HH:MM:SS" em que o ponto foi batido */
  horario: string | null;
  minutos: number;
  /** Desconto que o atraso tinha quando foi justificado */
  desconto: number;
  motivo: string;
  status: PontoPedido['status'];
  decididoPor: string | null;
  decididoEm: string | null;
}

export interface JustificativaSummary {
  userId: string;
  nome: string;
  total: number;
  aprovadas: number;
  recusadas: number;
  pendentes: number;
  descontoRetirado: number;
}

export const STATUS_JUSTIFICATIVA: Record<PontoPedido['status'], string> = {
  pendente: 'Aguardando',
  aprovado: 'Aprovada',
  recusado: 'Recusada',
};

/** "2026-11-20T22:07:00Z" -> "20/11" (no fuso do aparelho) */
export const formatDia = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';

export interface LateReportData {
  local: string;
  periodo: string;
  setor: string;
  geradoEm: string;
  records: LateRecord[];
  doctorSummary: DoctorSummary[];
  justificativas: Justificativa[];
  justificativaSummary: JustificativaSummary[];
}

/** Texto dentro de content: "..." do CSS (rodapé das páginas) */
const cssText = (value: string): string => value.replace(/["\\\r\n<>]/g, ' ');

const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;

/** dd/mm: o mês e o ano já estão no cabeçalho do relatório */
const diaMes = (dataDia: string): string => formatDateBR(dataDia).slice(0, 5);

/**
 * Documento de impressão da tela Atrasos do Mês (o navegador salva como PDF).
 * Só HTML e CSS embutido: a política PRINT_CSP_META bloqueia scripts, fontes e imagens de fora.
 */
export const buildLateReportHtml = (dados: LateReportData): string => {
  const { records, doctorSummary, justificativas, justificativaSummary } = dados;

  const totalDesconto = records.reduce((total, r) => total + r.desconto, 0);
  const aprovadas = justificativas.filter(j => j.status === 'aprovado');
  const recusadas = justificativas.filter(j => j.status === 'recusado').length;
  const pendentes = justificativas.filter(j => j.status === 'pendente').length;
  const totalRetirado = aprovadas.reduce((total, j) => total + j.desconto, 0);

  const rodape = cssText(`Ponto Kids · Atrasos e justificativas · ${dados.periodo} · ${dados.setor}`);

  const atrasosHtml = records.length === 0
    ? '<p class="vazio">Nenhum atraso com desconto no período.</p>'
    : `
      <h3>Por médico</h3>
      <table>
        <thead>
          <tr>
            <th>Médico</th>
            <th class="num">Atrasos</th>
            <th class="num">Tempo de atraso</th>
            <th class="num">Desconto</th>
          </tr>
        </thead>
        <tbody>
          ${doctorSummary.map(d => `
            <tr>
              <td class="forte">${escapeHtml(d.nome.trim())}</td>
              <td class="num">${d.atrasos}</td>
              <td class="num">${escapeHtml(formatMinutes(d.minutos))}</td>
              <td class="num descontado">${formatBRL(d.desconto)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="num">${records.length}</td>
            <td class="num">${escapeHtml(formatMinutes(records.reduce((total, r) => total + r.minutos, 0)))}</td>
            <td class="num descontado">${formatBRL(totalDesconto)}</td>
          </tr>
        </tfoot>
      </table>

      <h3>Por data</h3>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Médico</th>
            <th>Setor</th>
            <th>Turno</th>
            <th class="num">Bateu às</th>
            <th class="num">Atraso</th>
            <th class="num">Desconto</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td class="fixo">${escapeHtml(diaMes(r.dataDia))}</td>
              <td class="forte">${escapeHtml(r.nome.trim())}</td>
              <td class="fixo">${escapeHtml(r.setor)}</td>
              <td class="fixo">${escapeHtml(r.turno)}</td>
              <td class="num">${r.batidoEm ? escapeHtml(formatTimeBR(r.batidoEm)) : '—'}</td>
              <td class="num">${escapeHtml(formatMinutes(r.minutos))}</td>
              <td class="num descontado">${formatBRL(r.desconto)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  const justificativasHtml = justificativas.length === 0
    ? '<p class="vazio">Nenhuma justificativa de atraso no período.</p>'
    : `
      <h3>Por médico</h3>
      <table>
        <thead>
          <tr>
            <th>Médico</th>
            <th class="num">Enviadas</th>
            <th class="num">Aprovadas</th>
            <th class="num">Recusadas</th>
            <th class="num">Aguardando</th>
            <th class="num">Desconto retirado</th>
          </tr>
        </thead>
        <tbody>
          ${justificativaSummary.map(d => `
            <tr>
              <td class="forte">${escapeHtml(d.nome.trim())}</td>
              <td class="num">${d.total}</td>
              <td class="num">${d.aprovadas}</td>
              <td class="num">${d.recusadas}</td>
              <td class="num">${d.pendentes}</td>
              <td class="num retirado">${formatBRL(d.descontoRetirado)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="num">${justificativas.length}</td>
            <td class="num">${aprovadas.length}</td>
            <td class="num">${recusadas}</td>
            <td class="num">${pendentes}</td>
            <td class="num retirado">${formatBRL(totalRetirado)}</td>
          </tr>
        </tfoot>
      </table>

      <h3>Por data</h3>
      <table class="detalhe">
        <thead>
          <tr>
            <th>Data</th>
            <th>Médico</th>
            <th>Turno</th>
            <th class="num">Bateu às</th>
            <th class="num">Atraso</th>
            <th class="num">Desconto</th>
            <th>Motivo informado pelo médico</th>
            <th>Decisão</th>
          </tr>
        </thead>
        <tbody>
          ${justificativas.map(j => `
            <tr>
              <td class="fixo">${escapeHtml(diaMes(j.dataDia))}</td>
              <td class="forte">${escapeHtml(j.nome.trim())}</td>
              <td class="fixo">${escapeHtml(j.turno)}<span class="apoio">${escapeHtml(j.setor)}</span></td>
              <td class="num">${j.horario ? escapeHtml(j.horario.slice(0, 5)) : '—'}</td>
              <td class="num">${escapeHtml(formatMinutes(j.minutos))}</td>
              <td class="num">${formatBRL(j.desconto)}</td>
              <td class="motivo">${escapeHtml(j.motivo.trim())}</td>
              <td class="decisao">
                <span class="selo ${j.status}">${STATUS_JUSTIFICATIVA[j.status]}</span>
                ${j.decididoPor ? `<span class="apoio">${escapeHtml(j.decididoPor.trim())}${j.decididoEm ? ` · ${escapeHtml(formatDia(j.decididoEm))}` : ''}</span>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      ${PRINT_CSP_META}
      <title>Atrasos e justificativas - ${escapeHtml(dados.periodo)}</title>
      <style>
        @page {
          size: A4;
          margin: 14mm 14mm 17mm;
          /* Caixas de cima vazias: sem elas o navegador imprime a data e o título por conta própria */
          @top-left { content: " "; }
          @top-center { content: " "; }
          @top-right { content: " "; }
          @bottom-center { content: " "; }
          @bottom-left {
            content: "${rodape}";
            font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 7.5pt;
            color: #94a3b8;
          }
          @bottom-right {
            content: "Página " counter(page) " de " counter(pages);
            font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 7.5pt;
            color: #94a3b8;
          }
        }
        * { box-sizing: border-box; }
        html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body {
          margin: 0;
          font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 10.5px;
          line-height: 1.45;
          color: #1e293b;
          font-variant-numeric: tabular-nums;
        }

        /* Cabeçalho */
        .topo { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px;
                padding-bottom: 12px; border-bottom: 3px solid #0f766e; }
        .marca { margin: 0 0 6px; font-size: 8.5px; font-weight: 700; letter-spacing: .14em;
                 text-transform: uppercase; color: #0f766e; }
        h1 { margin: 0; font-size: 23px; line-height: 1.15; font-weight: 700; letter-spacing: -.01em; color: #0f172a; }
        .local { margin: 4px 0 0; font-size: 11px; color: #475569; }
        .meta { margin: 0; display: grid; grid-template-columns: auto auto; column-gap: 10px; row-gap: 2px;
                font-size: 9.5px; white-space: nowrap; }
        .meta dt { color: #64748b; text-align: right; }
        .meta dd { margin: 0; font-weight: 600; color: #0f172a; }

        /* Números do mês */
        .numeros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0 6px; }
        .numero { border: 1px solid #e2e8f0; border-top: 3px solid #b45309; border-radius: 6px;
                  padding: 9px 12px 10px; break-inside: avoid; }
        .numero.perdoado { border-top-color: #0f766e; }
        .numero-rotulo { margin: 0; font-size: 8px; font-weight: 700; letter-spacing: .08em;
                         text-transform: uppercase; color: #64748b; }
        .numero-valor { margin: 3px 0 0; font-size: 20px; line-height: 1.2; font-weight: 700; color: #0f172a; white-space: nowrap; }
        .numero-apoio { margin: 1px 0 0; font-size: 9px; color: #64748b; }

        /* Seções */
        section { margin-top: 22px; }
        h2 { margin: 0; padding-left: 9px; border-left: 4px solid #b45309; font-size: 15px; line-height: 1.25;
             font-weight: 700; color: #0f172a; break-after: avoid; }
        section.perdoado h2 { border-left-color: #0f766e; }
        .explica { margin: 4px 0 0; font-size: 10px; color: #64748b; break-after: avoid; }
        h3 { margin: 14px 0 2px; font-size: 9px; font-weight: 700; letter-spacing: .08em;
             text-transform: uppercase; color: #334155; break-after: avoid; }
        .vazio { margin: 10px 0 0; padding: 10px 12px; border: 1px dashed #cbd5e1; border-radius: 6px; color: #64748b; }

        /* Tabelas */
        table { width: 100%; border-collapse: collapse; }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
        th { padding: 6px 8px 5px; border-bottom: 1.5px solid #94a3b8; text-align: left; vertical-align: bottom;
             font-size: 8px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #64748b; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tbody tr:last-child td { border-bottom: 0; }
        tfoot td { border-top: 1.5px solid #334155; border-bottom: 0; font-weight: 700; color: #0f172a; }
        .num { text-align: right; white-space: nowrap; }
        .fixo { white-space: nowrap; }
        .forte { font-weight: 600; color: #0f172a; }
        .descontado { font-weight: 600; color: #b45309; }
        .retirado { font-weight: 600; color: #0f766e; }
        .apoio { display: block; font-size: 8.5px; font-weight: 400; color: #64748b; }

        .detalhe td, .detalhe th { padding-left: 6px; padding-right: 6px; }
        .detalhe { font-size: 9.5px; }
        .motivo { width: 34%; color: #334155; overflow-wrap: anywhere; }
        .decisao { white-space: nowrap; }
        .selo { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 8.5px; font-weight: 700; }
        .selo.aprovado { background: #ccfbf1; color: #115e59; }
        .selo.recusado { background: #fee2e2; color: #991b1b; }
        .selo.pendente { background: #fef3c7; color: #92400e; }

        .notas { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9px; color: #64748b; break-inside: avoid; }
        .notas p { margin: 0 0 2px; }
      </style>
    </head>
    <body>
      <header class="topo">
        <div>
          <p class="marca">Ponto Kids · Relatório mensal</p>
          <h1>Atrasos e justificativas</h1>
          <p class="local">${escapeHtml(dados.local)}</p>
        </div>
        <dl class="meta">
          <dt>Período</dt><dd>${escapeHtml(dados.periodo)}</dd>
          <dt>Setor</dt><dd>${escapeHtml(dados.setor)}</dd>
          <dt>Gerado em</dt><dd>${escapeHtml(dados.geradoEm)}</dd>
        </dl>
      </header>

      <div class="numeros">
        <div class="numero">
          <p class="numero-rotulo">Atrasos com desconto</p>
          <p class="numero-valor">${records.length}</p>
          <p class="numero-apoio">${plural(doctorSummary.length, 'médico', 'médicos')}</p>
        </div>
        <div class="numero">
          <p class="numero-rotulo">Total descontado</p>
          <p class="numero-valor">${formatBRL(totalDesconto)}</p>
          <p class="numero-apoio">sai do pagamento do mês</p>
        </div>
        <div class="numero perdoado">
          <p class="numero-rotulo">Justificativas aprovadas</p>
          <p class="numero-valor">${aprovadas.length}</p>
          <p class="numero-apoio">de ${plural(justificativas.length, 'enviada', 'enviadas')}</p>
        </div>
        <div class="numero perdoado">
          <p class="numero-rotulo">Desconto retirado</p>
          <p class="numero-valor">${formatBRL(totalRetirado)}</p>
          <p class="numero-apoio">atrasos perdoados</p>
        </div>
      </div>

      <section>
        <h2>Atrasos com desconto</h2>
        <p class="explica">Pontos batidos depois da tolerância de 1 hora, com o desconto valendo.</p>
        ${atrasosHtml}
      </section>

      <section class="perdoado">
        <h2>Justificativas de atraso</h2>
        <p class="explica">${plural(justificativas.length, 'enviada', 'enviadas')} · ${plural(aprovadas.length, 'aprovada', 'aprovadas')} · ${plural(recusadas, 'recusada', 'recusadas')} · ${pendentes} aguardando decisão.</p>
        ${justificativasHtml}
      </section>

      <div class="notas">
        <p><strong>Tolerância:</strong> 1 hora a partir do início do turno (Manhã 07:00, Tarde 13:00, Noite 19:00). Só é descontado o tempo que passar dessa 1 hora.</p>
        <p><strong>Justificativa aprovada:</strong> o desconto daquele atraso é retirado e o plantão volta ao valor cheio, por isso ele não aparece em "Atrasos com desconto". Recusada ou aguardando: o desconto continua.</p>
      </div>
    </body>
    </html>
  `;
};
