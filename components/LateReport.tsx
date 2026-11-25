
import React, { useState, useEffect, useMemo } from 'react';
import { Sector } from '../types';
import { LOCAL_PONTO, SECTOR_CONFIG, SECTOR_ID_MAP, getShortShift } from '../constants';
import { supabase } from '../services/supabaseClient';
import { formatDateBR, formatMinutes, formatTimeBR, getCurrentMonthLocal, getMonthRange } from '../utils/date';
import { formatBRL } from '../utils/finance';
import {
  buildLateReportHtml, formatDia,
  DoctorSummary, Justificativa, JustificativaSummary, LateRecord,
} from '../utils/lateReportHtml';
import { formatHorario } from '../src/services/pedidoService';
import PedidoStatus from './PedidoStatus';

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
  const [justificativas, setJustificativas] = useState<Justificativa[]>([]);

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

        // Justificativas dos plantões do mês (a RLS só entrega as de todos ao admin)
        let pedidosQuery = supabase
          .from('ponto_pedido')
          .select('id, user_id, data_dia, turno, setor_id, horario, motivo, status, minutos_atraso, desconto_original, decidido_por, decidido_em')
          .eq('tipo', 'atraso')
          .gte('data_dia', start)
          .lte('data_dia', end);

        if (selectedSector !== 'all') {
          pedidosQuery = pedidosQuery.eq('setor_id', SECTOR_ID_MAP[selectedSector]);
        }

        const [{ data, error }, { data: pedidos, error: pedidosError }] = await Promise.all([
          query.order('data_dia', { ascending: true }).order('id', { ascending: true }),
          pedidosQuery.order('data_dia', { ascending: true }).order('id', { ascending: true }),
        ]);

        if (cancelled) return;

        if (error || pedidosError) {
          console.error('Erro ao buscar atrasos:', error || pedidosError);
          setLoadError(true);
          setRecords([]);
          setJustificativas([]);
          return;
        }

        const userIds = [...new Set([
          ...(data || []).map(r => r.user_id),
          ...(pedidos || []).flatMap(p => [p.user_id, p.decidido_por]),
        ].filter(Boolean))];
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

        setJustificativas((pedidos || []).map(p => ({
          id: p.id,
          userId: p.user_id,
          nome: nomes.get(p.user_id) || 'Médico não identificado',
          dataDia: p.data_dia,
          turno: p.turno,
          setor: SECTOR_NAMES.get(p.setor_id) ?? 'Sem setor',
          horario: p.horario,
          minutos: p.minutos_atraso ?? 0,
          desconto: Number(p.desconto_original ?? 0),
          motivo: p.motivo,
          status: p.status,
          decididoPor: p.decidido_por ? (nomes.get(p.decidido_por) || 'Admin não identificado') : null,
          decididoEm: p.decidido_em,
        })));
      } catch (err) {
        if (cancelled) return;
        console.error('Erro geral ao buscar atrasos:', err);
        setLoadError(true);
        setRecords([]);
        setJustificativas([]);
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

  const justificativaSummary = useMemo(() => {
    const grouped = new Map<string, JustificativaSummary>();
    justificativas.forEach(j => {
      const doctor = grouped.get(j.userId)
        ?? { userId: j.userId, nome: j.nome, total: 0, aprovadas: 0, recusadas: 0, pendentes: 0, descontoRetirado: 0 };
      doctor.total += 1;
      if (j.status === 'aprovado') {
        doctor.aprovadas += 1;
        doctor.descontoRetirado += j.desconto;
      } else if (j.status === 'recusado') {
        doctor.recusadas += 1;
      } else {
        doctor.pendentes += 1;
      }
      grouped.set(j.userId, doctor);
    });
    return Array.from(grouped.values()).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [justificativas]);

  const justAprovadas = justificativas.filter(j => j.status === 'aprovado');
  const justRecusadas = justificativas.filter(j => j.status === 'recusado').length;
  const justPendentes = justificativas.filter(j => j.status === 'pendente').length;
  const totalRetirado = justAprovadas.reduce((total, j) => total + j.desconto, 0);
  const temDados = records.length > 0 || justificativas.length > 0;

  const sectorText = selectedSector === 'all' ? 'Todos os Setores' : selectedSector;

  const handlePrint = () => {
    if (!temDados) return;

    const [year, month] = selectedMonth.split('-').map(Number);
    const periodText = new Date(year, month - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const geradoEm = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const htmlContent = buildLateReportHtml({
      local: LOCAL_PONTO.nome,
      periodo: periodText,
      setor: sectorText,
      geradoEm,
      records,
      doctorSummary,
      justificativas,
      justificativaSummary,
    });

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
            Médicos que bateram o ponto depois da tolerância de 1 hora e as justificativas enviadas
          </p>
        </div>
        {temDados && (
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
      ) : !temDados ? (
        <div className="text-center py-16 bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700">
          <p className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary font-medium">
            Nenhum atraso e nenhuma justificativa
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            para {sectorText} no período selecionado
          </p>
        </div>
      ) : (
        <>
          {records.length === 0 ? (
            <div className="p-4 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700">
              Nenhum atraso com desconto para {sectorText} no período selecionado.
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

          {/* Justificativas de atraso */}
          <div className="pt-4">
            <h2 className="text-xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">
              Justificativas de atraso
            </h2>
            <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary mt-1">
              Aprovada: o desconto é retirado e o atraso sai da lista acima. Recusada ou aguardando: o desconto continua.
            </p>
          </div>

          {justificativas.length === 0 ? (
            <div className="p-4 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700">
              Nenhuma justificativa de atraso para {sectorText} no período selecionado.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { rotulo: 'Justificativas', valor: String(justificativas.length) },
                  { rotulo: 'Aprovadas', valor: String(justAprovadas.length) },
                  { rotulo: 'Recusadas', valor: String(justRecusadas) },
                  { rotulo: 'Aguardando', valor: String(justPendentes) },
                  { rotulo: 'Desconto retirado', valor: formatBRL(totalRetirado) },
                ].map(card => (
                  <div key={card.rotulo} className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wide">
                      {card.rotulo}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mt-1">{card.valor}</p>
                  </div>
                ))}
              </div>

              <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <h3 className="px-4 py-3 text-base font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary border-b border-gray-200 dark:border-gray-700">
                  Justificativas por Médico
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th scope="col" className={`${headerCell} text-left`}>Médico</th>
                        <th scope="col" className={`${headerCell} text-center`}>Justificativas</th>
                        <th scope="col" className={`${headerCell} text-center`}>Aprovadas</th>
                        <th scope="col" className={`${headerCell} text-center`}>Recusadas</th>
                        <th scope="col" className={`${headerCell} text-center`}>Aguardando</th>
                        <th scope="col" className={`${headerCell} text-right`}>Desconto retirado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {justificativaSummary.map(d => (
                        <tr key={d.userId}>
                          <td className={`${bodyCell} font-medium !text-pmp-text-primary dark:!text-dark-pmp-text-primary`}>{d.nome}</td>
                          <td className={`${bodyCell} text-center`}>{d.total}</td>
                          <td className={`${bodyCell} text-center`}>{d.aprovadas}</td>
                          <td className={`${bodyCell} text-center`}>{d.recusadas}</td>
                          <td className={`${bodyCell} text-center`}>{d.pendentes}</td>
                          <td className={`${bodyCell} text-right font-semibold !text-pmp-text-primary dark:!text-dark-pmp-text-primary`}>{formatBRL(d.descontoRetirado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <h3 className="px-4 py-3 text-base font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary border-b border-gray-200 dark:border-gray-700">
                  Justificativas por Data
                </h3>
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
                        <th scope="col" className={`${headerCell} text-left`}>Motivo informado</th>
                        <th scope="col" className={`${headerCell} text-left`}>Situação</th>
                        <th scope="col" className={`${headerCell} text-left`}>Decidido por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {justificativas.map(j => (
                        <tr key={j.id} className="align-top">
                          <td className={bodyCell}>{formatDateBR(j.dataDia)}</td>
                          <td className={`${bodyCell} font-medium !text-pmp-text-primary dark:!text-dark-pmp-text-primary`}>{j.nome}</td>
                          <td className={bodyCell}>{j.setor}</td>
                          <td className={bodyCell}>{j.turno}</td>
                          <td className={`${bodyCell} text-center`}>{formatHorario(j.horario)}</td>
                          <td className={`${bodyCell} text-right`}>{formatMinutes(j.minutos)}</td>
                          <td className={`${bodyCell} text-right`}>{formatBRL(j.desconto)}</td>
                          <td className="px-4 py-3 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary min-w-[16rem] max-w-md break-words">{j.motivo}</td>
                          <td className={bodyCell}><PedidoStatus status={j.status} /></td>
                          <td className={bodyCell}>
                            {j.decididoPor ? `${j.decididoPor}${j.decididoEm ? ` · ${formatDia(j.decididoEm)}` : ''}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default LateReport;
