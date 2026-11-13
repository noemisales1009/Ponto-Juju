import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PontoPedido, User } from '../types';
import { getSectorName, getShortShift } from '../constants';
import { supabase } from '../services/supabaseClient';
import { formatDateBR, formatMinutes, formatTimeBR } from '../utils/date';
import { formatBRL } from '../utils/finance';
import { buscarTodosPedidos, decidirPedido, formatHorario } from '../src/services/pedidoService';
import PedidoStatus, { TIPO_PEDIDO_LABEL } from './PedidoStatus';

interface RequestsProps {
    currentUser: User;
    /** Chamado depois de cada decisão, para atualizar o contador do menu */
    onDecided?: () => void;
}

const OBSERVACAO_MAXIMA = 1000;

/** Chave de um turno de um médico: usada para achar a falta que um colega registrou */
const turnoKey = (userId: string, dataDia: string, turno: string) => `${userId}|${dataDia}|${turno}`;

const Requests: React.FC<RequestsProps> = ({ currentUser, onDecided }) => {
    const [pedidos, setPedidos] = useState<PontoPedido[]>([]);
    const [nomes, setNomes] = useState<Map<string, string>>(new Map());
    const [faltas, setFaltas] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [observacoes, setObservacoes] = useState<Record<number, string>>({});
    const [decidindo, setDecidindo] = useState<number | null>(null);
    const [erros, setErros] = useState<Record<number, string>>({});

    const carregar = useCallback(async () => {
        setLoadError(false);

        const lista = await buscarTodosPedidos();
        if (lista === null) {
            setLoadError(true);
            setPedidos([]);
            setLoading(false);
            return;
        }

        const userIds = [...new Set(lista.flatMap(p => (p.decidido_por ? [p.user_id, p.decidido_por] : [p.user_id])))];
        const esquecidosPendentes = lista.filter(p => p.tipo === 'esquecido' && p.status === 'pendente');

        const [{ data: medicos }, { data: usuarios }, { data: faltasDb }] = await Promise.all([
            userIds.length
                ? supabase.from('medicos_juju').select('user_id, medico').in('user_id', userIds)
                : Promise.resolve({ data: [] as { user_id: string; medico: string }[] }),
            userIds.length
                ? supabase.from('usuarios').select('user_id, nome').in('user_id', userIds)
                : Promise.resolve({ data: [] as { user_id: string; nome: string }[] }),
            esquecidosPendentes.length
                ? supabase
                    .from('ponto_juju2')
                    .select('user_id, data_dia, turno')
                    .eq('falta', 'Sim')
                    .in('user_id', [...new Set(esquecidosPendentes.map(p => p.user_id))])
                    .in('data_dia', [...new Set(esquecidosPendentes.map(p => p.data_dia))])
                : Promise.resolve({ data: [] as { user_id: string; data_dia: string; turno: string }[] }),
        ]);

        // Mesmo critério da tela de plantões: medicos_juju primeiro, usuarios como alternativa
        const mapa = new Map<string, string>();
        (medicos || []).forEach(m => {
            if (m.user_id && m.medico) mapa.set(m.user_id, m.medico);
        });
        (usuarios || []).forEach(u => {
            if (u.user_id && u.nome && !mapa.has(u.user_id)) mapa.set(u.user_id, u.nome);
        });

        setNomes(mapa);
        setFaltas(new Set((faltasDb || []).map(f => turnoKey(f.user_id, f.data_dia, getShortShift(f.turno) ?? f.turno))));
        setPedidos(lista);
        setLoading(false);
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    const pendentes = useMemo(
        () => pedidos.filter(p => p.status === 'pendente').sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
        [pedidos]
    );
    const decididos = useMemo(() => pedidos.filter(p => p.status !== 'pendente'), [pedidos]);

    const handleDecidir = async (pedido: PontoPedido, aprovar: boolean) => {
        setDecidindo(pedido.id);
        setErros(prev => ({ ...prev, [pedido.id]: '' }));

        const resultado = await decidirPedido(pedido.id, aprovar, observacoes[pedido.id] ?? '');

        if (resultado.sucesso === false) {
            setErros(prev => ({ ...prev, [pedido.id]: resultado.erro }));
            setDecidindo(null);
            return;
        }

        await carregar();
        setDecidindo(null);
        onDecided?.();
    };

    const nomeDe = (userId: string | null) => (userId && nomes.get(userId)) || 'Médico não identificado';

    const resumo = pendentes.length === 0
        ? 'Nenhum pedido aguardando decisão'
        : pendentes.length === 1
            ? '1 pedido aguardando decisão'
            : `${pendentes.length} pedidos aguardando decisão`;

    const quando = (pedido: PontoPedido) =>
        `${formatDateBR(pedido.data_dia)} · ${pedido.turno} · ${getSectorName(pedido.setor_id) ?? 'Sem setor'}`;

    const detalhe = (pedido: PontoPedido) =>
        pedido.tipo === 'atraso'
            ? `Bateu às ${formatHorario(pedido.horario)}, ${formatMinutes(pedido.minutos_atraso ?? 0)} de atraso, desconto de ${formatBRL(Number(pedido.desconto_original ?? 0))}`
            : `Informou que chegou às ${formatHorario(pedido.horario)} · sem GPS`;

    const tipoClass = (tipo: PontoPedido['tipo']) =>
        tipo === 'atraso'
            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
            : 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300';

    return (
        <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl">
            <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight">Pedidos</h1>
            <p className="mt-1 mb-6 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                {loading ? 'Carregando pedidos...' : resumo}
            </p>

            {loadError && (
                <div role="alert" className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-800 dark:text-red-300">
                    Não foi possível carregar os pedidos.{' '}
                    <button type="button" onClick={() => { setLoading(true); carregar(); }} className="font-semibold underline">Tentar novamente</button>
                </div>
            )}

            {!loading && !loadError && pendentes.length === 0 && (
                <p className="mb-8 p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-center text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                    Tudo em dia. Quando um médico justificar um atraso ou pedir um ponto esquecido, o pedido aparece aqui.
                </p>
            )}

            <ul className="space-y-4">
                {pendentes.map(pedido => {
                    const proprio = String(pedido.user_id) === String(currentUser.id);
                    const temFalta = pedido.tipo === 'esquecido' && faltas.has(turnoKey(pedido.user_id, pedido.data_dia, pedido.turno));
                    const ocupado = decidindo === pedido.id;

                    return (
                        <li key={pedido.id} className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-pmp-surface/50 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <p className="text-base font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">{nomeDe(pedido.user_id)}</p>
                                    <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{quando(pedido)}</p>
                                </div>
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${tipoClass(pedido.tipo)}`}>
                                    {TIPO_PEDIDO_LABEL[pedido.tipo]}
                                </span>
                            </div>

                            <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{detalhe(pedido)}</p>

                            <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <p className="text-xs font-semibold uppercase tracking-wider text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Motivo</p>
                                <p className="text-sm text-pmp-text-primary dark:text-dark-pmp-text-primary whitespace-pre-wrap break-words">{pedido.motivo}</p>
                            </div>

                            {temFalta && (
                                <p className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm text-amber-800 dark:text-amber-300">
                                    Um colega registrou falta para este médico neste turno. Se aprovar, a falta vira presença.
                                </p>
                            )}

                            <p className="text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                Pedido feito em {formatDateBR(pedido.criado_em.slice(0, 10))} às {formatTimeBR(pedido.criado_em)}
                            </p>

                            {proprio ? (
                                <p className="text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                    Este pedido é seu. Outro administrador precisa decidir.
                                </p>
                            ) : (
                                <>
                                    <div>
                                        <label htmlFor={`obs-${pedido.id}`} className="block text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary mb-1">
                                            Observação para o médico (opcional)
                                        </label>
                                        <textarea
                                            id={`obs-${pedido.id}`}
                                            rows={2}
                                            maxLength={OBSERVACAO_MAXIMA}
                                            value={observacoes[pedido.id] ?? ''}
                                            onChange={e => setObservacoes(prev => ({ ...prev, [pedido.id]: e.target.value }))}
                                            className="block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm py-2 px-3 outline-none focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20"
                                        />
                                    </div>

                                    {erros[pedido.id] && (
                                        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{erros[pedido.id]}</p>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            disabled={decidindo !== null}
                                            onClick={() => handleDecidir(pedido, false)}
                                            className="min-h-[44px] rounded-lg border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Recusar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={decidindo !== null}
                                            onClick={() => handleDecidir(pedido, true)}
                                            className="min-h-[44px] rounded-lg bg-pmp-primary hover:bg-pmp-primary-dark text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {ocupado ? 'Salvando...' : 'Aprovar'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    );
                })}
            </ul>

            {decididos.length > 0 && (
                <section className="mt-10">
                    <h2 className="text-lg font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mb-3">Já decididos</h2>
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700">
                        {decididos.map(pedido => (
                            <li key={pedido.id} className="p-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">
                                        {nomeDe(pedido.user_id)} · {TIPO_PEDIDO_LABEL[pedido.tipo]}
                                    </p>
                                    <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{quando(pedido)}</p>
                                    <p className="text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary mt-1 break-words">
                                        Decidido por {nomeDe(pedido.decidido_por)}
                                        {pedido.decidido_em ? ` em ${formatDateBR(pedido.decidido_em.slice(0, 10))}` : ''}
                                        {pedido.observacao ? ` · ${pedido.observacao}` : ''}
                                    </p>
                                </div>
                                <PedidoStatus status={pedido.status} />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};

export default Requests;
