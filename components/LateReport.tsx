
import React, { useState, useEffect, useMemo } from 'react';
import { Sector } from '../types';
import { LOCAL_PONTO, SECTOR_CONFIG, SECTOR_ID_MAP, getShortShift } from '../constants';
import { supabase } from '../services/supabaseClient';
import { escapeHtml, PRINT_CSP_META } from '../utils/html';
import { formatDateBR, formatMinutes, formatTimeBR, getCurrentMonthLocal, getMonthRange } from '../utils/date';
import { formatBRL } from '../utils/finance';

interface LateRecord {
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

interface DoctorSummary {
  userId: string;
  nome: string;
  atrasos: number;
  minutos: number;
  desconto: number;
}

const SECTOR_NAMES = new Map(
  (Object.keys(SECTOR_ID_MAP) as Sector[]).map(sector => [SECTOR_ID_MAP[sector], sector])
);

const LateReport: React.FC = () => {
  const [selectedSector, setSelectedSector] = useState<Sector | 'all'>('all');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthLocal());
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [records, setRecords] = useState<LateRecord[]>([]);

  useEffect(() => {
    // Ignora respostas de buscas antigas se o mês/setor mudar enquanto carrega
    let cancelled = false;

    const fetchData = async () => {
      if (!selectedMonth) return;
      setIsLoading(true);
      setLoadError(false);

      try {
        const { start, end } = getMonthRange(selectedMonth);

        let query = supabase
          .from('ponto_juju2')
          .select('id, user_id, data_dia, turno, setor_id, batido_em, minutos_atraso, desconto_atraso')
          .gte('data_dia', start)
          .lte('data_dia', end)
          .is('falta', null)
          .gt('desconto_atraso', 0);

        if (selectedSector !== 'all') {
          query = query.eq('setor_id', SECTOR_ID_MAP[selectedSector]);
        }

        const { data, error } = await query.order('data_dia', { ascending: true }).order('id', { ascending: true });

        if (cancelled) return;

        if (error) {
          console.error('Erro ao buscar atrasos:', error);
          setLoadError(true);
          setRecords([]);
          return;
        }

        const userIds = [...new Set((data || []).map(r => r.user_id))];
        const [{ data: medicos }, { data: usuarios }] = await Promise.all([
          supabase.from('medicos_juju').select('user_id, medico').in('user_id', userIds),
          supabase.from('usuarios').select('user_id, nome').in('user_id', userIds),
        ]);

        if (cancelled) return;

        // Mesmo critério da tela de plantões: medicos_juju primeiro, usuarios como alternativa
        const nomes = new Map<string, string>();
        (medicos || []).forEach(m => {
          if (m.user_id && m.medico) nomes.set(m.user_id, m.medico);
        });
        (usuarios || []).forEach(u => {
          if (u.user_id && u.nome && !nomes.has(u.user_id)) nomes.set(u.user_id, u.nome);
        });

        setRecords((data || []).map(r => ({
          id: r.id,
          userId: r.user_id,
          nome: nomes.get(r.user_id) || 'Médico não identificado',
          dataDia: r.data_dia,
          turno: getShortShift(r.turno) ?? r.turno,
          setor: SECTOR_NAMES.get(r.setor_id) ?? 'Sem setor',
          batidoEm: r.batido_em,
          minutos: r.minutos_atraso,
          desconto: Number(r.desconto_atraso),
        })));
      } catch (err) {
        if (cancelled) return;
        console.error('Erro geral ao buscar atrasos:', err);
        setLoadError(true);
        setRecords([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [selectedMonth, selectedSector]);

  const doctorSummary = useMemo(() => {
    const grouped = new Map<string, DoctorSummary>();
    records.forEach(r => {
      const doctor = grouped.get(r.userId) ?? { userId: r.userId, nome: r.nome, atrasos: 0, minutos: 0, desconto: 0 };
      doctor.atrasos += 1;
      doctor.minutos += r.minutos;
      doctor.desconto += r.desconto;
      grouped.set(r.userId, doctor);
    });
    return Array.from(grouped.values()).sort((a, b) => b.desconto - a.desconto);
  }, [records]);

  const totalDesconto = records.reduce((total, r) => total + r.desconto, 0);
  const sectorText = selectedSector === 'all' ? 'Todos os Setores' : selectedSector;

  const handlePrint = () => {
    if (records.length === 0) return;

    const [year, month] = selectedMonth.split('-').map(Number);
    const periodText = new Date(year, month - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const geradoEm = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${PRINT_CSP_META}
        <title>Atrasos do Mês</title>
        <style>
          @page { size: A4; margin: 20mm 15mm; }
          body { font-family: Arial, sans-serif; color: #111; font-size: 13px; }
          .header { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 14px; }
          h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
          .subtitle { font-size: 13px; color: #6b7280; margin: 0; }
          .gerado { font-size: 11px; color: #9ca3af; margin-top: 4px; }
          .summary { display: flex; gap: 16px; margin-bottom: 24px; }
          .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; flex: 1; }
          .box-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; color: #b45309; }
          .box-value { font-size: 22px; font-weight: 800; color: #92400e; }
          h2 { font-size: 15px; font-weight: 700; margin: 24px 0 6px; border-left: 4px solid #374151; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
          th { background: #f3f4f6; font-weight: 700; font-size: 12px; color: #374151;
               padding: 10px 12px; border: 1px solid #e5e7eb; text-align: left; white-space: nowrap; }
          td { padding: 10px 12px; border: 1px solid #e5e7eb; vertical-align: top; }
          tr:nth-child(even) td { background: #f9fafb; }
          .right { text-align: right; white-space: nowrap; }
          .center { text-align: center; }
          .nowrap { white-space: nowrap; }
          .foot td { background: #fffbeb !important; font-weight: 700; color: #92400e; }
          .nota { font-size: 11px; color: #6b7280; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Atrasos do Mês</h1>
          <p class="subtitle">${escapeHtml(LOCAL_PONTO.nome)}</p>
          <p class="subtitle">Setor: ${escapeHtml(sectorText)} &nbsp;|&nbsp; Período: ${escapeHtml(periodText)}</p>
          <p class="gerado">Gerado em: ${escapeHtml(geradoEm)}</p>
        </div>

        <div class="summary">
          <div class="box">
            <div class="box-label">Médicos com atraso</div>
            <div class="box-value">${doctorSummary.length}</div>
          </div>
          <div class="box">
            <div class="box-label">Atrasos</div>
            <div class="box-value">${records.length}</div>
          </div>
          <div class="box">
            <div class="box-label">Total descontado</div>
            <div class="box-value">${formatBRL(totalDesconto)}</div>
          </div>
        </div>

        <h2>Resumo por Médico</h2>
        <table>
          <thead>
            <tr>
              <th>Médico</th>
              <th class="center">Atrasos</th>
              <th class="right">Tempo de atraso</th>
              <th class="right">Desconto</th>
            </tr>
          </thead>
          <tbody>
            ${doctorSummary.map(d => `
              <tr>
                <td>${escapeHtml(d.nome)}</td>
                <td class="center">${d.atrasos}</td>
                <td class="right">${escapeHtml(formatMinutes(d.minutos))}</td>
                <td class="right">${formatBRL(d.desconto)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="foot">
              <td colspan="3">Total descontado</td>
              <td class="right">${formatBRL(totalDesconto)}</td>
            </tr>
          </tfoot>
        </table>

        <h2>Detalhamento por Data</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Médico</th>
              <th>Setor</th>
              <th>Turno</th>
              <th class="center">Horário</th>
              <th class="right">Atraso</th>
              <th class="right">Desconto</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(r => `
              <tr>
                <td class="nowrap">${escapeHtml(formatDateBR(r.dataDia))}</td>
                <td>${escapeHtml(r.nome)}</td>
                <td class="nowrap">${escapeHtml(r.setor)}</td>
                <td class="nowrap">${escapeHtml(r.turno)}</td>
                <td class="center">${r.batidoEm ? escapeHtml(formatTimeBR(r.batidoEm)) : '—'}</td>
                <td class="right">${escapeHtml(formatMinutes(r.minutos))}</td>
                <td class="right">${formatBRL(r.desconto)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p class="nota">O médico tem 1 hora de tolerância a partir do início do turno (Manhã 07:00, Tarde 13:00, Noite 19:00). Só é descontado o tempo que passar dessa 1 hora.</p>
      </body>
      </html>
    `;

    setIsPrinting(true);
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setIsPrinting(false); return; }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    // onload pode já ter disparado depois do document.close(); um pequeno atraso é mais confiável
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setIsPrinting(false);
    }, 250);
  };

  const headerCell = 'px-4 py-3 text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider';
  const bodyCell = 'px-4 py-3 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary whitespace-nowrap';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">
            Atrasos do Mês
          </h1>
          <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary mt-1">
            Médicos que bateram o ponto depois da tolerância de 1 hora
          </p>
        </div>
        {records.length > 0 && (
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pmp-primary text-white text-sm font-medium hover:bg-pmp-primary-dark transition-colors disabled:opacity-60 flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {isPrinting ? 'Gerando...' : 'Exportar PDF'}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="late-month" className="text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wide">
            Mês
          </label>
          <input
            id="late-month"
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-pmp-text-primary dark:text-dark-pmp-text-primary focus:ring-2 focus:ring-pmp-primary outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="late-sector" className="text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wide">
            Setor
          </label>
          <select
            id="late-sector"
            value={selectedSector}
            onChange={e => setSelectedSector(e.target.value as Sector | 'all')}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-pmp-text-primary dark:text-dark-pmp-text-primary focus:ring-2 focus:ring-pmp-primary outline-none"
          >
            <option value="all">Todos os Setores</option>
            {Object.keys(SECTOR_CONFIG).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pmp-primary" />
        </div>
      ) : loadError ? (
        <div className="p-4 text-sm font-medium text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl" role="alert">
          Não foi possível carregar os atrasos. Tente novamente.
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary font-medium">
            Nenhum atraso registrado
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            para {sectorText} no período selecionado
          </p>
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Médicos com atraso
              </p>
              <p className="text-3xl font-bold text-amber-800 dark:text-amber-300 mt-1">{doctorSummary.length}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Atrasos
              </p>
              <p className="text-3xl font-bold text-amber-800 dark:text-amber-300 mt-1">{records.length}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                Total descontado
              </p>
              <p className="text-3xl font-bold text-amber-800 dark:text-amber-300 mt-1">{formatBRL(totalDesconto)}</p>
            </div>
          </div>

          {/* Resumo por médico */}
          <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <h2 className="px-4 py-3 text-base font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary border-b border-gray-200 dark:border-gray-700">
              Resumo por Médico
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className={`${headerCell} text-left`}>Médico</th>
                    <th scope="col" className={`${headerCell} text-center`}>Atrasos</th>
                    <th scope="col" className={`${headerCell} text-right`}>Tempo de atraso</th>
                    <th scope="col" className={`${headerCell} text-right`}>Desconto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {doctorSummary.map(d => (
                    <tr key={d.userId}>
                      <td className={`${bodyCell} font-medium !text-pmp-text-primary dark:!text-dark-pmp-text-primary`}>{d.nome}</td>
                      <td className={`${bodyCell} text-center`}>{d.atrasos}</td>
                      <td className={`${bodyCell} text-right`}>{formatMinutes(d.minutos)}</td>
                      <td className={`${bodyCell} text-right font-semibold !text-amber-700 dark:!text-amber-400`}>{formatBRL(d.desconto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detalhamento por data */}
          <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <h2 className="px-4 py-3 text-base font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary border-b border-gray-200 dark:border-gray-700">
              Detalhamento por Data
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th scope="col" className={`${headerCell} text-left`}>Data</th>
                    <th scope="col" className={`${headerCell} text-left`}>Médico</th>
                    <th scope="col" className={`${headerCell} text-left`}>Setor</th>
                    <th scope="col" className={`${headerCell} text-left`}>Turno</th>
                    <th scope="col" className={`${headerCell} text-center`}>Horário</th>
                    <th scope="col" className={`${headerCell} text-right`}>Atraso</th>
                    <th scope="col" className={`${headerCell} text-right`}>Desconto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {records.map(r => (
                    <tr key={r.id}>
                      <td className={bodyCell}>{formatDateBR(r.dataDia)}</td>
                      <td className={`${bodyCell} font-medium !text-pmp-text-primary dark:!text-dark-pmp-text-primary`}>{r.nome}</td>
                      <td className={bodyCell}>{r.setor}</td>
                      <td className={bodyCell}>{r.turno}</td>
                      <td className={`${bodyCell} text-center`}>{r.batidoEm ? formatTimeBR(r.batidoEm) : '-'}</td>
                      <td className={`${bodyCell} text-right`}>{formatMinutes(r.minutos)}</td>
                      <td className={`${bodyCell} text-right font-semibold !text-amber-700 dark:!text-amber-400`}>{formatBRL(r.desconto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LateReport;
