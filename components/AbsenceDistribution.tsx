
import React, { useState, useEffect } from 'react';
import { Sector } from '../types';
import { SECTOR_CONFIG, SECTOR_ID_MAP } from '../constants';
import { supabase } from '../services/supabaseClient';

interface ViewDistribRow {
  falta_id: number;
  data_dia: string;
  turno: string;
  setor_id: number;
  medico_ausente_id: string;
  medico_ausente_nome: string | null;
  valor_plantao: number;
  medico_presente_id: string | null;
  medico_presente_nome: string | null;
  bonus_por_medico: number;
}

interface ViewBonusRow {
  user_id: string;
  nome: string | null;
  total_coberturas: number;
  total_bonus: number;
}

interface DistributionItem {
  key: string;
  dateRaw: string;
  dateFormatted: string;
  turno: string;
  absentDoctor: { userId: string; nome: string; valorPlantao: number };
  presentDoctors: { userId: string; nome: string; bonus: number }[];
  bonusPerDoctor: number;
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TURNO_COLORS: Record<string, string> = {
  'Manhã': 'text-amber-600 dark:text-amber-400',
  'Tarde': 'text-blue-600 dark:text-blue-400',
  'Noite': 'text-indigo-600 dark:text-indigo-400',
};

const TURNO_ICONS: Record<string, string> = {
  'Manhã': '🌅',
  'Tarde': '☀️',
  'Noite': '🌙',
};

const SHIFT_ORDER: Record<string, number> = { 'Manhã': 0, 'Tarde': 1, 'Noite': 2 };

const AbsenceDistribution: React.FC = () => {
  const [selectedSector, setSelectedSector] = useState<Sector>('UTI Ped');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [distributions, setDistributions] = useState<DistributionItem[]>([]);
  const [doctorSummary, setDoctorSummary] = useState<(ViewBonusRow & { nome: string })[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedMonth || !selectedSector) return;
      setIsLoading(true);

      const [year, month] = selectedMonth.split('-').map(Number);
      const sectorId = SECTOR_ID_MAP[selectedSector];

      const [{ data: distribData, error: distribError }, { data: bonusData, error: bonusError }] =
        await Promise.all([
          supabase
            .from('v_distribuicao_faltas')
            .select('falta_id, data_dia, turno, setor_id, medico_ausente_id, medico_ausente_nome, valor_plantao, medico_presente_id, medico_presente_nome, bonus_por_medico')
            .eq('ano', year)
            .eq('mes_numero', month)
            .eq('setor_id', sectorId),
          supabase
            .from('v_bonus_por_medico_mes')
            .select('user_id, nome, total_coberturas, total_bonus')
            .eq('ano', year)
            .eq('mes_numero', month)
            .eq('setor_id', sectorId)
            .order('total_bonus', { ascending: false }),
        ]);

      if (distribError) console.error('Erro v_distribuicao_faltas:', distribError);
      if (bonusError)  console.error('Erro v_bonus_por_medico_mes:', bonusError);

      // Agrupa as linhas por falta_id (1 linha por presente → N linhas por falta)
      const grouped = new Map<number, DistributionItem>();
      ((distribData || []) as ViewDistribRow[]).forEach(row => {
        if (!grouped.has(row.falta_id)) {
          const date = new Date(row.data_dia + 'T00:00:00');
          const dateFormatted = date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          grouped.set(row.falta_id, {
            key: `${row.falta_id}`,
            dateRaw: row.data_dia,
            dateFormatted,
            turno: row.turno,
            absentDoctor: {
              userId: row.medico_ausente_id,
              nome: row.medico_ausente_nome || 'Médico não identificado',
              valorPlantao: row.valor_plantao,
            },
            presentDoctors: [],
            bonusPerDoctor: row.bonus_por_medico,
          });
        }
        if (row.medico_presente_id) {
          grouped.get(row.falta_id)!.presentDoctors.push({
            userId: row.medico_presente_id,
            nome: row.medico_presente_nome || 'Médico não identificado',
            bonus: row.bonus_por_medico,
          });
        }
      });

      const sorted = Array.from(grouped.values()).sort((a, b) => {
        if (a.dateRaw !== b.dateRaw) return a.dateRaw.localeCompare(b.dateRaw);
        return (SHIFT_ORDER[a.turno] ?? 3) - (SHIFT_ORDER[b.turno] ?? 3);
      });

      setDistributions(sorted);
      setDoctorSummary(
        ((bonusData || []) as ViewBonusRow[]).map(r => ({ ...r, nome: r.nome || 'Médico não identificado' }))
      );
      setIsLoading(false);
    };

    fetchData();
  }, [selectedMonth, selectedSector]);

  const totalDistribuido = distributions.reduce((s, d) => s + d.absentDoctor.valorPlantao, 0);

  const handlePrint = () => {
    if (distributions.length === 0) return;

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
        <title>Distribuição de Faltas</title>
        <style>
          @page { size: A4; margin: 20mm 15mm; }
          body { font-family: Arial, sans-serif; color: #111; font-size: 13px; }
          .header { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 14px; }
          h1 { font-size: 22px; font-weight: 800; margin: 0 0 4px; }
          .subtitle { font-size: 13px; color: #6b7280; margin: 0; }
          .gerado { font-size: 11px; color: #9ca3af; margin-top: 4px; }
          .summary { display: flex; gap: 16px; margin-bottom: 24px; }
          .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; flex: 1; }
          .box-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
          .box-value { font-size: 22px; font-weight: 800; }
          .box-red .box-label { color: #dc2626; }
          .box-red .box-value { color: #991b1b; }
          .box-green .box-label { color: #16a34a; }
          .box-green .box-value { color: #15803d; }
          h2 { font-size: 15px; font-weight: 700; margin: 24px 0 6px; border-left: 4px solid #374151; padding-left: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
          th { background: #f3f4f6; font-weight: 700; font-size: 12px; color: #374151;
               padding: 10px 12px; border: 1px solid #e5e7eb; text-align: left; white-space: nowrap; }
          td { padding: 10px 12px; border: 1px solid #e5e7eb; vertical-align: top; }
          tr:nth-child(even) td { background: #f9fafb; }
          .right { text-align: right; white-space: nowrap; }
          .center { text-align: center; }
          .foot td { background: #f0fdf4 !important; font-weight: 700; color: #15803d; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Distribuição de Faltas</h1>
          <p class="subtitle">Setor: ${selectedSector} &nbsp;|&nbsp; Período: ${periodText}</p>
          <p class="gerado">Gerado em: ${geradoEm}</p>
        </div>

        <div class="summary">
          <div class="box box-red">
            <div class="box-label">Total de Faltas</div>
            <div class="box-value">${distributions.length}</div>
          </div>
          <div class="box box-green">
            <div class="box-label">Valor Total Distribuído</div>
            <div class="box-value">${formatCurrency(totalDistribuido)}</div>
          </div>
        </div>

        <h2>Detalhamento por Falta</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Turno</th>
              <th>Médico Ausente</th>
              <th class="right">Valor</th>
              <th>Presentes no Turno</th>
              <th class="right">Bônus cada</th>
            </tr>
          </thead>
          <tbody>
            ${distributions.map(item => `
              <tr>
                <td style="white-space:nowrap">${item.dateFormatted}</td>
                <td class="center">${item.turno}</td>
                <td>${item.absentDoctor.nome}</td>
                <td class="right">${formatCurrency(item.absentDoctor.valorPlantao)}</td>
                <td>${item.presentDoctors.length === 0 ? 'Nenhum presente' : item.presentDoctors.map(d => d.nome).join('<br>')}</td>
                <td class="right">${item.presentDoctors.length === 0 ? '—' : formatCurrency(item.bonusPerDoctor)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${doctorSummary.length > 0 ? `
        <h2>Resumo de Bônus por Médico</h2>
        <table>
          <thead>
            <tr>
              <th class="center">#</th>
              <th>Médico</th>
              <th class="center">Coberturas</th>
              <th class="right">Total Bônus</th>
            </tr>
          </thead>
          <tbody>
            ${doctorSummary.map((d, i) => `
              <tr>
                <td class="center">${i + 1}</td>
                <td>${d.nome}</td>
                <td class="center">${d.total_coberturas} cobertura${d.total_coberturas !== 1 ? 's' : ''}</td>
                <td class="right">${formatCurrency(d.total_bonus)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="foot">
              <td colspan="3">Total distribuído</td>
              <td class="right">${formatCurrency(totalDistribuido)}</td>
            </tr>
          </tfoot>
        </table>
        ` : ''}
      </body>
      </html>
    `;

    setIsPrinting(true);
    const printWindow = window.open('', '_blank');
    if (!printWindow) { setIsPrinting(false); return; }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      setIsPrinting(false);
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">
            Distribuição de Faltas
          </h1>
          <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary mt-1">
            Valor do plantão dos médicos ausentes dividido entre os presentes no mesmo turno
          </p>
        </div>
        {distributions.length > 0 && (
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-pmp-primary text-white text-sm font-medium hover:bg-pmp-primary-dark transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {isPrinting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            )}
            {isPrinting ? 'Gerando...' : 'Exportar PDF'}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wide">
            Mês
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-pmp-text-primary dark:text-dark-pmp-text-primary focus:ring-2 focus:ring-pmp-primary outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wide">
            Setor
          </label>
          <select
            value={selectedSector}
            onChange={e => setSelectedSector(e.target.value as Sector)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-pmp-text-primary dark:text-dark-pmp-text-primary focus:ring-2 focus:ring-pmp-primary outline-none"
          >
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
      ) : distributions.length === 0 ? (
        <div className="text-center py-16 bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary font-medium">
            Nenhuma falta registrada
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            para {selectedSector} no período selecionado
          </p>
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
              <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">
                Total de Faltas
              </p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-300 mt-1">
                {distributions.length}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
                Valor Total a Distribuir
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">
                {formatCurrency(totalDistribuido)}
              </p>
            </div>
          </div>

          {/* Lista de faltas */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">
              Detalhamento por Falta
            </h2>
            {distributions.map(item => (
              <div
                key={item.key}
                className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Cabeçalho */}
                <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">
                      Falta
                    </p>
                    <p className="text-sm font-bold text-red-700 dark:text-red-300 capitalize">
                      {item.dateFormatted}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${TURNO_COLORS[item.turno] ?? ''}`}>
                    {TURNO_ICONS[item.turno] ?? ''} {item.turno}
                  </span>
                </div>

                {/* Médico ausente */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                  <p className="text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wide mb-2">
                    Médico ausente
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-600 dark:text-red-400">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">
                        {item.absentDoctor.nome}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(item.absentDoctor.valorPlantao)}
                    </span>
                  </div>
                </div>

                {/* Médicos presentes */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wide mb-2">
                    Presentes neste turno ({item.presentDoctors.length})
                  </p>
                  {item.presentDoctors.length === 0 ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400 italic">
                      Nenhum médico presente — valor não distribuído
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {item.presentDoctors.map((doctor, i) => (
                        <div key={`${doctor.userId}-${i}`} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-green-600 dark:text-green-400">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className="text-sm text-pmp-text-primary dark:text-dark-pmp-text-primary">
                              {doctor.nome}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">
                            +{formatCurrency(doctor.bonus)}
                          </span>
                        </div>
                      ))}
                      {item.presentDoctors.length > 1 && (
                        <p className="text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary mt-2 text-right">
                          {formatCurrency(item.absentDoctor.valorPlantao)} ÷ {item.presentDoctors.length} ={' '}
                          <span className="font-semibold">{formatCurrency(item.bonusPerDoctor)}</span> cada
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Resumo por médico */}
          {doctorSummary.length > 0 && (
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h2 className="text-sm font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">
                  Resumo de Bônus por Médico
                </h2>
                <p className="text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary mt-0.5">
                  Total acumulado no mês por cobertura de faltas
                </p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {doctorSummary.map((d, i) => (
                  <div key={d.user_id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-pmp-text-secondary dark:text-dark-pmp-text-secondary w-5 text-right">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">
                        {d.nome}
                      </span>
                      <span className="text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                        {d.total_coberturas} cobertura{d.total_coberturas !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      +{formatCurrency(d.total_bonus)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center">
                <span className="text-sm font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">
                  Total distribuído
                </span>
                <span className="text-base font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(totalDistribuido)}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AbsenceDistribution;
