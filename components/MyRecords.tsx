
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PontoPedido, PontoTroca, User } from '../types';
import { getSectorName, getShortShift } from '../constants';
import { buscarMeusPedidos, estaNoPrazo, formatHorario, PRAZO_PEDIDO_DIAS } from '../src/services/pedidoService';
import PedidoModal, { PontoAtrasado } from './PedidoModal';
import PedidoStatus, { TIPO_PEDIDO_LABEL } from './PedidoStatus';
import TrocaModal from './TrocaModal';
import { buscarMinhasTrocas, cancelarTroca, confirmarTroca } from '../src/services/trocaService';
import { supabase } from '../services/supabaseClient';
import { formatDateBR, formatMinutes, formatTimeBR, getCurrentMonthLocal, getTodayLocal } from '../utils/date';
import { formatBRL } from '../utils/finance';

interface MyRecordsProps {
    currentUser: User;
}

const MyRecords: React.FC<MyRecordsProps> = ({ currentUser }) => {
    const [userRecords, setUserRecords] = useState<any[]>([]);
    const [filterType, setFilterType] = useState<'month' | 'range'>('month');
    const [loading, setLoading] = useState(false);
    
    // Datas locais (toISOString viraria o dia/mês seguinte depois das 21h no Brasil)
    const currentMonth = getCurrentMonthLocal();

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [startDate, setStartDate] = useState(`${currentMonth}-01`);
    const [endDate, setEndDate] = useState(getTodayLocal());

    // Pedidos do médico: justificativas de atraso e pontos esquecidos
    const [pedidos, setPedidos] = useState<PontoPedido[]>([]);
    const [isPedidoModalOpen, setPedidoModalOpen] = useState(false);
    const [pontoParaJustificar, setPontoParaJustificar] = useState<PontoAtrasado | null>(null);
    // Muda a cada pedido enviado, para buscar os pontos de novo
    const [recarregar, setRecarregar] = useState(0);

    const carregarPedidos = useCallback(async () => {
        setPedidos(await buscarMeusPedidos(currentUser.id));
    }, [currentUser.id]);

    useEffect(() => {
        carregarPedidos();
    }, [carregarPedidos]);

    const abrirPedido = (ponto: PontoAtrasado | null) => {
        setPontoParaJustificar(ponto);
        setPedidoModalOpen(true);
    };

    // Plantões passados e já pagos: os que o médico passou e os que ele fez no lugar de um colega
    const [trocas, setTrocas] = useState<PontoTroca[]>([]);
    const [nomesTroca, setNomesTroca] = useState<Map<string, string>>(new Map());
    const [isTrocaModalOpen, setTrocaModalOpen] = useState(false);
    const [trocaOcupada, setTrocaOcupada] = useState<number | null>(null);

    const carregarTrocas = useCallback(async () => {
        const lista = await buscarMinhasTrocas(currentUser.id);
        const ids = [...new Set(lista.flatMap(t => [t.cedente_id, t.substituto_id]))];
        const { data: usuarios } = ids.length
            ? await supabase.from('usuarios').select('user_id, nome').in('user_id', ids)
            : { data: [] as { user_id: string; nome: string }[] };

        setNomesTroca(new Map((usuarios || []).map(u => [u.user_id, u.nome])));
        setTrocas(lista);
    }, [currentUser.id]);

    useEffect(() => {
        carregarTrocas();
    }, [carregarTrocas]);

    const nomeTroca = (userId: string | null | undefined) => (userId && nomesTroca.get(userId)) || 'colega';

    const handleTroca = async (troca: PontoTroca, acao: 'confirmar' | 'cancelar') => {
        const nome = nomeTroca(troca.cedente_id);
        if (acao === 'confirmar' && !window.confirm(`Confirma que ${nome} já pagou você por este plantão? O valor vai para ${nome}.`)) return;
        if (acao === 'cancelar' && !window.confirm('Cancelar este aviso de troca?')) return;

        setTrocaOcupada(troca.id);
        const resultado = acao === 'confirmar' ? await confirmarTroca(troca.id) : await cancelarTroca(troca.id);
        setTrocaOcupada(null);

        if (resultado.sucesso === false) {
            alert(`❌ ${resultado.erro}`);
            return;
        }
        carregarTrocas();
        setRecarregar(n => n + 1);
    };

    // Um pedido de atraso por ponto (o banco não aceita o segundo)
    const pedidoDoPonto = useMemo(() => {
        const mapa = new Map<number, PontoPedido>();
        pedidos.forEach(p => {
            if (p.tipo === 'atraso' && p.ponto_id !== null) mapa.set(p.ponto_id, p);
        });
        return mapa;
    }, [pedidos]);

    // Buscar os registros do próprio usuário no Supabase
    useEffect(() => {
        // Ignora a resposta se o usuário mudar enquanto carrega
        let cancelled = false;

        const fetchRecords = async () => {
            setLoading(true);
            try {
                const { data: pontos, error } = await supabase
                    .from('ponto_juju2')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('data_dia', { ascending: false });

                if (cancelled) return;

                if (error) {
                    console.error('Erro ao buscar registros:', error);
                    setUserRecords([]);
                    return;
                }

                setUserRecords(pontos || []);
            } catch (err) {
                if (cancelled) return;
                console.error('Erro geral ao buscar registros:', err);
                setUserRecords([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchRecords();
        return () => { cancelled = true; };
    }, [currentUser.id, recarregar]);

    const filteredRecords = useMemo(() => {
        if (filterType === 'month') {
            return userRecords.filter(r => r.data_dia && r.data_dia.startsWith(selectedMonth));
        } else { // 'range'
            // Datas "YYYY-MM-DD" comparam corretamente como texto, sem depender de fuso
            return userRecords.filter(r => {
                if (!r.data_dia) return false;
                if (startDate && r.data_dia < startDate) return false;
                if (endDate && r.data_dia > endDate) return false;
                return true;
            });
        }
    }, [userRecords, filterType, selectedMonth, startDate, endDate]);

    const lateRecords = useMemo(
        () => filteredRecords.filter(r => r.falta !== 'Sim' && Number(r.desconto_atraso) > 0),
        [filteredRecords]
    );
    const totalDiscount = lateRecords.reduce((total, r) => total + Number(r.desconto_atraso), 0);

    const inputClass = "block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20 sm:text-sm py-2.5 px-3 transition-all outline-none";

    return (
        <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl">
            <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight mb-6">Meus Pontos Registrados</h1>
            
            <div className="p-4 bg-slate-50 dark:bg-dark-pmp-surface/50 border border-slate-200 dark:border-slate-700/50 rounded-xl mb-6 space-y-4">
                <div className="flex items-center gap-6">
                    <span className="text-sm font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Filtrar por:</span>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="filterType" value="month" checked={filterType === 'month'} onChange={() => setFilterType('month')} className="h-4 w-4 text-pmp-primary focus:ring-pmp-primary-light border-gray-300 dark:border-gray-600"/>
                            <span className="text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">Mês</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="filterType" value="range" checked={filterType === 'range'} onChange={() => setFilterType('range')} className="h-4 w-4 text-pmp-primary focus:ring-pmp-primary-light border-gray-300 dark:border-gray-600"/>
                            <span className="text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">Período</span>
                        </label>
                    </div>
                </div>

                {filterType === 'month' ? (
                    <div>
                        <label htmlFor="month" className="sr-only">Mês</label>
                        <input
                            type="month"
                            id="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className={`${inputClass} max-w-xs`}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Data Inicial</label>
                            <input
                                type="date"
                                id="startDate"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Data Final</label>
                            <input
                                type="date"
                                id="endDate"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => abrirPedido(null)}
                className="w-full mb-6 p-4 flex items-center gap-4 text-left rounded-xl border border-pmp-primary/40 dark:border-dark-pmp-primary/40 bg-pmp-primary/5 dark:bg-dark-pmp-primary/10 hover:bg-pmp-primary/10 dark:hover:bg-dark-pmp-primary/20 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 flex-shrink-0 text-pmp-primary dark:text-dark-pmp-primary-light" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="flex-1">
                    <span className="block text-base font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">Esqueci de bater o ponto</span>
                    <span className="block text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                        Peça o ponto de um plantão de até {PRAZO_PEDIDO_DIAS} dias atrás
                    </span>
                </span>
                <span className="text-xl text-pmp-text-secondary dark:text-dark-pmp-text-secondary" aria-hidden="true">›</span>
            </button>

            <button
                type="button"
                onClick={() => setTrocaModalOpen(true)}
                className="w-full mb-6 p-4 flex items-center gap-4 text-left rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-dark-pmp-surface/50 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 flex-shrink-0 text-pmp-primary dark:text-dark-pmp-primary-light" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                <span className="flex-1">
                    <span className="block text-base font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">Passei meu plantão e já paguei</span>
                    <span className="block text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                        O colega bate o ponto e o valor entra no seu pagamento
                    </span>
                </span>
                <span className="text-xl text-pmp-text-secondary dark:text-dark-pmp-text-secondary" aria-hidden="true">›</span>
            </button>

            {trocas.length > 0 && (
                <section className="mb-6">
                    <h2 className="text-base font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mb-2">Trocas de plantão já pagas</h2>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700/50">
                        {trocas.map(troca => {
                            const passei = String(troca.cedente_id) === String(currentUser.id);
                            const confirmada = troca.status === 'confirmada';
                            return (
                                <li key={troca.id} className="p-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">
                                            {formatDateBR(troca.data_dia)} · {troca.turno} · {getSectorName(troca.setor_id) ?? 'Sem setor'}
                                        </p>
                                        <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                            {passei
                                                ? confirmada
                                                    ? `${nomeTroca(troca.substituto_id)} fez o plantão. O valor entra no seu pagamento.`
                                                    : `Você passou para ${nomeTroca(troca.substituto_id)}. Falta bater o ponto e confirmar.`
                                                : confirmada
                                                    ? `Você fez o plantão de ${nomeTroca(troca.cedente_id)}. O valor vai para ${nomeTroca(troca.cedente_id)}.`
                                                    : `${nomeTroca(troca.cedente_id)} avisou que passou este plantão para você e já pagou.`}
                                        </p>
                                    </div>
                                    {confirmada ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300">Confirmada</span>
                                    ) : (
                                        <button
                                            type="button"
                                            disabled={trocaOcupada !== null}
                                            onClick={() => handleTroca(troca, passei ? 'cancelar' : 'confirmar')}
                                            className={`min-h-[40px] px-4 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                                                passei
                                                    ? 'border border-slate-300 dark:border-slate-600 text-pmp-text-secondary dark:text-dark-pmp-text-secondary hover:bg-slate-100 dark:hover:bg-slate-700/40'
                                                    : 'bg-pmp-primary hover:bg-pmp-primary-dark text-white'
                                            }`}
                                        >
                                            {trocaOcupada === troca.id ? 'Salvando...' : passei ? 'Cancelar aviso' : 'Confirmar'}
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            <TrocaModal
                isOpen={isTrocaModalOpen}
                onClose={() => setTrocaModalOpen(false)}
                onSent={carregarTrocas}
                currentUser={currentUser}
            />

            {pedidos.length > 0 && (
                <section className="mb-6">
                    <h2 className="text-base font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mb-2">Meus pedidos</h2>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700/50">
                        {pedidos.map(pedido => (
                            <li key={pedido.id} className="p-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">
                                        {formatDateBR(pedido.data_dia)} · {pedido.turno} · {getSectorName(pedido.setor_id) ?? 'Sem setor'}
                                    </p>
                                    <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                        {TIPO_PEDIDO_LABEL[pedido.tipo]}
                                        {pedido.tipo === 'esquecido' ? ` · chegou às ${formatHorario(pedido.horario)}` : ''}
                                    </p>
                                    {pedido.observacao && (
                                        <p className="mt-1 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary break-words">
                                            <strong>Administração:</strong> {pedido.observacao}
                                        </p>
                                    )}
                                </div>
                                <PedidoStatus status={pedido.status} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <PedidoModal
                isOpen={isPedidoModalOpen}
                onClose={() => setPedidoModalOpen(false)}
                onSent={() => { carregarPedidos(); setRecarregar(n => n + 1); }}
                pontoAtrasado={pontoParaJustificar}
            />

            {/* ✅ NOVO: Mostrar estado de carregamento */}
            {loading && (
                <div className="text-center py-8">
                    <p className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Carregando registros...</p>
                </div>
            )}

            {!loading && lateRecords.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
                        <h2 className="text-base font-bold text-amber-800 dark:text-amber-300">
                            {lateRecords.length === 1 ? '1 atraso neste período' : `${lateRecords.length} atrasos neste período`}
                        </h2>
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            Total descontado: {formatBRL(totalDiscount)}
                        </span>
                    </div>
                    <ul className="divide-y divide-amber-200 dark:divide-amber-500/20">
                        {lateRecords.map(record => (
                            <li key={record.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                                <span className="font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">
                                    {formatDateBR(record.data_dia)} · {getShortShift(record.turno) ?? record.turno}
                                </span>
                                <span className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                    Bateu às {record.batido_em ? formatTimeBR(record.batido_em) : '-'}, {formatMinutes(record.minutos_atraso)} de atraso (-{formatBRL(Number(record.desconto_atraso))})
                                </span>
                                <span className="w-full flex justify-end pt-1">
                                    {pedidoDoPonto.has(record.id) ? (
                                        <PedidoStatus status={pedidoDoPonto.get(record.id)!.status} />
                                    ) : estaNoPrazo(record.data_dia) ? (
                                        <button
                                            type="button"
                                            onClick={() => abrirPedido(record)}
                                            className="min-h-[36px] px-3 rounded-lg border border-amber-400 dark:border-amber-500/50 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
                                        >
                                            Justificar atraso
                                        </button>
                                    ) : (
                                        <span className="text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Prazo para justificar encerrado</span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {!loading && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-dark-pmp-surface/80">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Data</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Turno</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Horário</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Valor</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-pmp-surface dark:bg-dark-pmp-surface divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredRecords.length > 0 ? filteredRecords.map(record => (
                                <tr key={record.id} className="hover:bg-pmp-primary/5 dark:hover:bg-dark-pmp-primary/10 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                            {formatDateBR(record.data_dia)}
                                        </div>
                                        <div className="text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                            {record.dia_semana_calculado}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">{record.turno}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                        {record.batido_em ? formatTimeBR(record.batido_em) : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                                        {Number(record.valor_plantao) ? `R$ ${Number(record.valor_plantao).toFixed(2)}` : '-'}
                                        {record.recebedor_id && (
                                            <span className="block text-xs font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                                Vai para {nomeTroca(record.recebedor_id)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {record.falta === 'Sim' ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 text-xs font-medium">
                                                <span>✗</span> Falta
                                            </span>
                                        ) : Number(record.desconto_atraso) > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium">
                                                <span>!</span> Atraso {formatMinutes(record.minutos_atraso)} (-{formatBRL(Number(record.desconto_atraso))})
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 text-xs font-medium">
                                                <span>✓</span> {record.batido_em ? 'Dentro da tolerância' : 'Ponto'}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum registro encontrado para o período selecionado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MyRecords;
