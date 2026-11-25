import { FinanceTotalsRow, formatBRL, getValorAPagar, getValorTotal } from './finance';

/** Linha do relatório do Painel Administrativo (view nova_total_por_medico_mes, sem o CPF) */
export interface AdminReportRow extends FinanceTotalsRow {
  medico_nome: string;
  banco: string;
  agencia: string;
  conta: string;
  ano: number;
  nome_mes: string;
  total_plantao_realizados: number;
  total_faltas: number;
}

export interface AdminReportData {
  local: string;
  /** Ex.: "Novembro de 2026" ou "Ano de 2026" */
  periodo: string;
  geradoEm: string;
  /** true quando o filtro é "Todos os meses": a tabela ganha a coluna Mês */
  mostrarMes: boolean;
  linhas: AdminReportRow[];
}

// O banco devolve o mês em inglês (TO_CHAR)
const MESES_PT: Record<string, string> = {
  january: 'Janeiro', february: 'Fevereiro', march: 'Março', april: 'Abril', may: 'Maio', june: 'Junho',
  july: 'Julho', august: 'Agosto', september: 'Setembro', october: 'Outubro', november: 'Novembro', december: 'Dezembro',
};

const mesPt = (nomeMes: string | null | undefined): string => {
  const limpo = (nomeMes || '').trim();
  return MESES_PT[limpo.toLowerCase()] || limpo || '-';
};

/** As fontes padrão do PDF não têm o espaço especial que o formatador de moeda usa */
const texto = (valor: unknown): string => String(valor ?? '').replace(/\s/g, ' ').trim();
const reais = (valor: number): string => texto(formatBRL(valor));

const VERDE: [number, number, number] = [15, 118, 110];
const ESCURO: [number, number, number] = [15, 23, 42];
const CINZA: [number, number, number] = [100, 116, 139];
const LINHA: [number, number, number] = [226, 232, 240];
const MARGEM = 14;

/**
 * Monta o PDF do Painel Administrativo como ARQUIVO (jsPDF + autotable, carregados no index.html).
 * Antes o relatório usava a impressão do navegador, e no celular saía diferente: lá o sistema de
 * impressão escolhe papel, orientação e escala por conta própria. Um arquivo PDF é igual em todo aparelho.
 * Recebe o construtor do jsPDF para não depender de `window` (e poder ser testado fora do app).
 */
export const buildAdminReportPdf = (JsPDF: any, dados: AdminReportData): any => {
  const pdf = new JsPDF('l', 'mm', 'a4');
  const largura = pdf.internal.pageSize.getWidth();
  const altura = pdf.internal.pageSize.getHeight();

  const colunas = [
    'Médico',
    ...(dados.mostrarMes ? ['Mês'] : []),
    'Banco', 'Agência', 'Conta', 'Plantões', 'Faltas', 'Valor a pagar', 'Valor com desconto',
  ];
  const deslocamento = dados.mostrarMes ? 1 : 0;
  const colPlantoes = 4 + deslocamento;
  const colFaltas = 5 + deslocamento;
  const colValor = 6 + deslocamento;
  const colDesconto = 7 + deslocamento;

  const corpo = dados.linhas.map(m => [
    texto(m.medico_nome),
    ...(dados.mostrarMes ? [mesPt(m.nome_mes)] : []),
    texto(m.banco) || '-',
    texto(m.agencia) || '-',
    texto(m.conta) || '-',
    String(m.total_plantao_realizados ?? 0),
    String(m.total_faltas ?? 0),
    reais(getValorTotal(m)),
    reais(getValorAPagar(m)),
  ]);

  const totalPlantoes = dados.linhas.reduce((soma, m) => soma + (m.total_plantao_realizados || 0), 0);
  const totalFaltas = dados.linhas.reduce((soma, m) => soma + (m.total_faltas || 0), 0);
  const totalValor = dados.linhas.reduce((soma, m) => soma + getValorTotal(m), 0);
  const totalDesconto = dados.linhas.reduce((soma, m) => soma + getValorAPagar(m), 0);

  const rodapeTabela = [[
    { content: 'Total', colSpan: colPlantoes },
    String(totalPlantoes),
    String(totalFaltas),
    reais(totalValor),
    reais(totalDesconto),
  ]];

  pdf.autoTable({
    head: [colunas.map(c => c.toUpperCase())],
    body: corpo,
    foot: rodapeTabela,
    showFoot: 'lastPage',
    startY: 37,
    margin: { top: 18, bottom: 16, left: MARGEM, right: MARGEM },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 },
      lineColor: LINHA,
      lineWidth: { bottom: 0.2 },
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fontSize: 7.5,
      fontStyle: 'bold',
      textColor: CINZA,
      lineColor: [148, 163, 184],
      lineWidth: { bottom: 0.45 },
    },
    footStyles: {
      fontStyle: 'bold',
      textColor: ESCURO,
      lineColor: [51, 65, 85],
      lineWidth: { top: 0.45 },
    },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: ESCURO },
      [colPlantoes]: { halign: 'center' },
      [colFaltas]: { halign: 'center' },
      [colValor]: { halign: 'right', cellWidth: 34 },
      [colDesconto]: { halign: 'right', cellWidth: 40, fontStyle: 'bold', textColor: VERDE },
    },
    // Títulos e totais alinhados como os valores da coluna
    didParseCell: (celula: any) => {
      if (celula.section === 'body') return;
      const indice = celula.section === 'foot' && celula.column.index > 0
        ? celula.column.index
        : celula.column.index;
      if (indice === colPlantoes || indice === colFaltas) celula.cell.styles.halign = 'center';
      if (indice === colValor || indice === colDesconto) celula.cell.styles.halign = 'right';
      if (celula.section === 'foot' && indice === colDesconto) celula.cell.styles.textColor = VERDE;
    },
    didDrawPage: (pagina: any) => {
      if (pagina.pageNumber === 1) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(...VERDE);
        pdf.text('PONTO KIDS  ·  PAINEL ADMINISTRATIVO', MARGEM, 13);

        pdf.setFontSize(19);
        pdf.setTextColor(...ESCURO);
        pdf.text('Plantões e faturamento', MARGEM, 21.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        pdf.text(texto(dados.local), MARGEM, 27.5);

        // Período e data de geração, à direita
        const direita = largura - MARGEM;
        const larguraValor = Math.max(pdf.getTextWidth(texto(dados.periodo)), pdf.getTextWidth(texto(dados.geradoEm)));
        pdf.setFontSize(9);
        pdf.setTextColor(...CINZA);
        pdf.text('Período', direita - larguraValor - 3, 22, { align: 'right' });
        pdf.text('Gerado em', direita - larguraValor - 3, 27.5, { align: 'right' });
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...ESCURO);
        pdf.text(texto(dados.periodo), direita, 22, { align: 'right' });
        pdf.text(texto(dados.geradoEm), direita, 27.5, { align: 'right' });

        pdf.setDrawColor(...VERDE);
        pdf.setLineWidth(0.9);
        pdf.line(MARGEM, 31.5, largura - MARGEM, 31.5);
      } else {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(...ESCURO);
        pdf.text('Plantões e faturamento', MARGEM, 11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...CINZA);
        pdf.text(texto(dados.periodo), largura - MARGEM, 11, { align: 'right' });
        pdf.setDrawColor(...LINHA);
        pdf.setLineWidth(0.3);
        pdf.line(MARGEM, 13.5, largura - MARGEM, 13.5);
      }
    },
  });

  // Rodapé com "Página X de Y" (só dá para saber o total depois da tabela pronta)
  const paginas = pdf.internal.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    pdf.setPage(pagina);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Ponto Kids  ·  Plantões e faturamento  ·  ${texto(dados.periodo)}`, MARGEM, altura - 8);
    pdf.text(`Página ${pagina} de ${paginas}`, largura - MARGEM, altura - 8, { align: 'right' });
  }

  return pdf;
};
