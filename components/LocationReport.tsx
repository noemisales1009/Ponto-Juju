import React, { useEffect, useMemo, useState } from 'react';
import { Sector } from '../types';
import { DISABLED_SECTORS, LOCAL_PONTO, SECTOR_ID_MAP, getSectorName, getShortShift } from '../constants';
import { supabase } from '../services/supabaseClient';
import { formatTimeBR, getTodayLocal, isValidDateISO } from '../utils/date';

/**
 * Tela do admin: onde cada ponto do dia foi batido.
 * A posição fica em ponto_localizacao (sql/adicionar_localizacao_ponto.sql); a RLS só entrega
 * todas as linhas ao admin. Nada sai do app: o desenho é feito aqui, sem serviço de mapa externo.
 */

interface Linha {
    pontoId: number;
    nome: string;
    turno: string;
    setor: string;
    batidoEm: string | null;
    /** Sem posição: ponto esquecido aprovado, lançado pelo admin ou anterior à regra do GPS */
    local: { latitude: number; longitude: number; precisao: number | null; distancia: number } | null;
}

const SECTORS = (Object.keys(SECTOR_ID_MAP) as Sector[]).filter(sector => !DISABLED_SECTORS.includes(sector));
const TURNO_ORDEM: Record<string, number> = { 'Manhã': 0, 'Tarde': 1, 'Noite': 2 };

// Desenho: metros em volta do hospital. O raio permitido cabe inteiro, com folga.
const ALCANCE = Math.round(LOCAL_PONTO.raioMetros * 1.25);

/** Posição em metros em relação ao centro do hospital (x para leste, y para norte) */
const emMetros = (latitude: number, longitude: number) => ({
    x: (longitude - LOCAL_PONTO.longitude) * 111320 * Math.cos((LOCAL_PONTO.latitude * Math.PI) / 180),
    y: (latitude - LOCAL_PONTO.latitude) * 110540,
});

const LocationReport: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState(getTodayLocal());
    const [selectedSector, setSelectedSector] = useState<Sector | 'all'>('all');
    const [linhas, setLinhas] = useState<Linha[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!isValidDateISO(selectedDate)) return;
        // Ignora respostas de buscas antigas se a data/setor mudar enquanto carrega
        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            setLoadError(false);

            try {
                let query = supabase
                    .from('ponto_juju2')
                    .select('id, user_id, turno, setor_id, batido_em')
                    .eq('data_dia', selectedDate)
                    .is('falta', null);

                if (selectedSector !== 'all') {
                    query = query.eq('setor_id', SECTOR_ID_MAP[selectedSector]);
                }

                const { data: pontos, error } = await query.order('id', { ascending: true });
                if (cancelled) return;
                if (error) throw error;

                const pontoIds = (pontos || []).map(p => p.id);
                const userIds = [...new Set((pontos || []).map(p => p.user_id))];

                const [locais, medicos, usuarios] = await Promise.all([
                    pontoIds.length
                        ? supabase.from('ponto_localizacao').select('ponto_id, latitude, longitude, precisao_metros, distancia_metros').in('ponto_id', pontoIds)
                        : Promise.resolve({ data: [], error: null }),
                    userIds.length
                        ? supabase.from('medicos_juju').select('user_id, medico').in('user_id', userIds)
                        : Promise.resolve({ data: [], error: null }),
                    userIds.length
                        ? supabase.from('usuarios').select('user_id, nome').in('user_id', userIds)
                        : Promise.resolve({ data: [], error: null }),
                ]);

                if (cancelled) return;
                if (locais.error) throw locais.error;

                // Mesmo critério da tela de plantões: medicos_juju primeiro, usuarios como alternativa
                const nomes = new Map<string, string>();
                ((medicos.data || []) as { user_id: string; medico: string }[]).forEach(m => {
                    if (m.user_id && m.medico) nomes.set(m.user_id, m.medico);
                });
                ((usuarios.data || []) as { user_id: string; nome: string }[]).forEach(u => {
                    if (u.user_id && u.nome && !nomes.has(u.user_id)) nomes.set(u.user_id, u.nome);
                });

                const porPonto = new Map(
                    ((locais.data || []) as { ponto_id: number; latitude: number; longitude: number; precisao_metros: number | null; distancia_metros: number }[])
                        .map(l => [l.ponto_id, l])
                );

                const resultado: Linha[] = (pontos || []).map(p => {
                    const local = porPonto.get(p.id);
                    return {
                        pontoId: p.id,
                        nome: nomes.get(p.user_id) || 'Médico não identificado',
                        turno: getShortShift(p.turno) ?? p.turno,
                        setor: getSectorName(p.setor_id) ?? 'Sem setor',
                        batidoEm: p.batido_em,
                        local: local
                            ? { latitude: local.latitude, longitude: local.longitude, precisao: local.precisao_metros, distancia: local.distancia_metros }
                            : null,
                    };
                });

                resultado.sort((a, b) =>
                    (TURNO_ORDEM[a.turno] ?? 9) - (TURNO_ORDEM[b.turno] ?? 9) || a.nome.localeCompare(b.nome, 'pt-BR'));

                setLinhas(resultado);
            } catch (err) {
                if (cancelled) return;
                console.error('Erro ao buscar localizações:', err);
                setLoadError(true);
                setLinhas([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();
        return () => { cancelled = true; };
    }, [selectedDate, selectedSector]);

    // Numeração só dos pontos com posição: o número da tabela é o mesmo do desenho
    const numeros = useMemo(() => {
        const mapa = new Map<number, number>();
        linhas.filter(l => l.local).forEach((l, i) => mapa.set(l.pontoId, i + 1));
        return mapa;
    }, [linhas]);

    const comLocal = linhas.filter(l => l.local);
    const semLocal = linhas.length - comLocal.length;

    const inputClass = 'block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20 sm:text-sm py-2.5 px-3 outline-none';
    const thClass = 'px-4 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider';
    const tdClass = 'px-4 py-3 whitespace-nowrap text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary';

    return (
        <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl">
            <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight">Localização</h1>
            <p className="mt-1 mb-6 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                Onde cada ponto foi batido. A posição é lida só no momento do ponto.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 mb-6 bg-slate-50 dark:bg-dark-pmp-surface/50 border border-slate-200 dark:border-slate-700/50 rounded-xl">
                <div>
                    <label htmlFor="loc-data" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Data</label>
                    <input id="loc-data" type="date" value={selectedDate} max={getTodayLocal()} onChange={e => setSelectedDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label htmlFor="loc-setor" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Setor</label>
                    <select id="loc-setor" value={selectedSector} onChange={e => setSelectedSector(e.target.value as Sector | 'all')} className={inputClass}>
                        <option value="all">Todos</option>
                        {SECTORS.map(sector => <option key={sector} value={sector}>{sector}</option>)}
                    </select>
                </div>
            </div>

            {loading && <p className="py-8 text-center text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Carregando...</p>}

            {loadError && (
                <p role="alert" className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-800 dark:text-red-300">
                    Não foi possível carregar as localizações. Tente novamente.
                </p>
            )}

            {!loading && !loadError && linhas.length === 0 && (
                <p className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-center text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                    Nenhum ponto de presença nesta data.
                </p>
            )}

            {!loading && !loadError && linhas.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6 items-start">
                    <figure className="m-0 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-dark-pmp-surface/50">
                        <svg
                            viewBox={`${-ALCANCE} ${-ALCANCE} ${ALCANCE * 2} ${ALCANCE * 2}`}
                            width="100%"
                            role="img"
                            aria-label={`Desenho da área do hospital com ${comLocal.length} ponto(s) do dia`}
                        >
                            <circle cx={0} cy={0} r={LOCAL_PONTO.raioMetros} className="text-pmp-primary dark:text-dark-pmp-primary" fill="currentColor" fillOpacity={0.08} stroke="currentColor" strokeWidth={1.5} strokeDasharray="6 5" />
                            <circle cx={0} cy={0} r={LOCAL_PONTO.raioMetros / 3} className="text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth={0.75} strokeDasharray="3 5" />
                            <rect x={-9} y={-9} width={18} height={18} rx={3} className="text-slate-500 dark:text-slate-400" fill="currentColor" />
                            <path d="M-5 0h10M0 -5v10" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
                            {comLocal.map(linha => {
                                const { x, y } = emMetros(linha.local!.latitude, linha.local!.longitude);
                                // Fora do alcance do desenho: fica na borda, na direção certa
                                const fator = Math.min(1, (ALCANCE - 10) / Math.max(Math.hypot(x, y), 1));
                                return (
                                    <g key={linha.pontoId} transform={`translate(${x * fator} ${-y * fator})`}>
                                        <circle r={10} className="text-pmp-primary dark:text-dark-pmp-primary" fill="currentColor" stroke="#fff" strokeWidth={2} />
                                        <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#fff">{numeros.get(linha.pontoId)}</text>
                                    </g>
                                );
                            })}
                        </svg>
                        <figcaption className="mt-3 text-xs leading-relaxed text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                            O quadrado é o centro do hospital. A linha tracejada é o limite de {LOCAL_PONTO.raioMetros} m; o círculo de dentro marca {Math.round(LOCAL_PONTO.raioMetros / 3)} m. Norte para cima.
                        </figcaption>
                    </figure>

                    <div>
                        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
                            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                <thead className="bg-slate-50 dark:bg-dark-pmp-surface/80">
                                    <tr>
                                        <th scope="col" className={thClass}>Nº</th>
                                        <th scope="col" className={thClass}>Médico</th>
                                        <th scope="col" className={thClass}>Turno</th>
                                        <th scope="col" className={thClass}>Setor</th>
                                        <th scope="col" className={thClass}>Horário</th>
                                        <th scope="col" className={thClass}>Distância</th>
                                        <th scope="col" className={thClass}>Precisão do GPS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {linhas.map(linha => (
                                        <tr key={linha.pontoId}>
                                            <td className={tdClass}>
                                                {linha.local ? (
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pmp-primary dark:bg-dark-pmp-primary text-white text-xs font-bold">{numeros.get(linha.pontoId)}</span>
                                                ) : '-'}
                                            </td>
                                            <td className={`${tdClass} font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary`}>{linha.nome}</td>
                                            <td className={tdClass}>{linha.turno}</td>
                                            <td className={tdClass}>{linha.setor}</td>
                                            <td className={tdClass}>{linha.batidoEm ? formatTimeBR(linha.batidoEm) : '-'}</td>
                                            <td className={tdClass}>{linha.local ? `${Math.round(linha.local.distancia)} m do centro` : 'Sem GPS'}</td>
                                            <td className={tdClass}>{linha.local?.precisao != null ? `± ${Math.round(linha.local.precisao)} m` : '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {semLocal > 0 && (
                            <p className="mt-3 text-xs leading-relaxed text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                {semLocal === 1 ? '1 ponto sem GPS' : `${semLocal} pontos sem GPS`}: ponto esquecido aprovado pela administração, lançado pelo admin ou registrado antes da regra do GPS.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocationReport;
