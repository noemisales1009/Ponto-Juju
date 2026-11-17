import React, { useCallback, useEffect, useState } from 'react';
import { PontoTroca, User } from '../types';
import { getSectorName } from '../constants';
import { buscarMinhasTrocas, confirmarTroca } from '../src/services/trocaService';
import { supabase } from '../services/supabaseClient';
import { formatDateBR, getTodayLocal } from '../utils/date';

/** Avisar o lembrete (em qualquer tela) de que uma troca foi confirmada ou cancelada */
export const TROCA_ATUALIZADA = 'troca-atualizada';
export const avisarTrocaAtualizada = () => window.dispatchEvent(new Event(TROCA_ATUALIZADA));

interface TrocaLembreteProps {
    currentUser: User;
}

/**
 * Lembrete para quem foi marcado como responsável por um plantão passado e já pago.
 * Abre no meio da tela toda vez que o médico entra ou volta para o app, até a troca ser
 * confirmada (ou cancelada por quem avisou). "Agora não" fecha só até a próxima vez.
 */
const TrocaLembrete: React.FC<TrocaLembreteProps> = ({ currentUser }) => {
    const [pendentes, setPendentes] = useState<PontoTroca[]>([]);
    const [nomes, setNomes] = useState<Map<string, string>>(new Map());
    const [fechado, setFechado] = useState(false);
    const [ocupada, setOcupada] = useState<number | null>(null);
    const [erros, setErros] = useState<Map<number, string>>(new Map());

    const carregar = useCallback(async () => {
        const lista = (await buscarMinhasTrocas(currentUser.id))
            .filter(t => t.status === 'pendente' && String(t.substituto_id) === String(currentUser.id))
            .sort((a, b) => a.data_dia.localeCompare(b.data_dia));

        const ids = [...new Set(lista.map(t => t.cedente_id))];
        if (ids.length) {
            const { data } = await supabase.from('usuarios').select('user_id, nome').in('user_id', ids);
            setNomes(new Map((data || []).map(u => [u.user_id, u.nome])));
        }
        setPendentes(lista);
    }, [currentUser.id]);

    useEffect(() => {
        carregar();
    }, [carregar]);

    useEffect(() => {
        // Voltou para o app: o lembrete abre de novo
        const aoVoltar = () => {
            if (document.visibilityState !== 'visible') return;
            setFechado(false);
            carregar();
        };
        document.addEventListener('visibilitychange', aoVoltar);
        window.addEventListener(TROCA_ATUALIZADA, carregar);
        return () => {
            document.removeEventListener('visibilitychange', aoVoltar);
            window.removeEventListener(TROCA_ATUALIZADA, carregar);
        };
    }, [carregar]);

    const confirmar = async (troca: PontoTroca, nome: string) => {
        if (!window.confirm(`Confirma que ${nome} já pagou você por este plantão? O valor vai inteiro para ${nome}.`)) return;

        setOcupada(troca.id);
        const resultado = await confirmarTroca(troca.id);
        setOcupada(null);

        if (resultado.sucesso === false) {
            setErros(prev => new Map(prev).set(troca.id, resultado.erro));
            return;
        }
        alert(resultado.troca.ponto_id
            ? `✅ Troca confirmada. O valor deste plantão vai inteiro para ${nome}.`
            : `✅ Troca confirmada. Quando você bater o ponto deste plantão, o valor vai inteiro para ${nome}.`);
        avisarTrocaAtualizada();
    };

    if (!pendentes.length || fechado) return null;

    const hoje = getTodayLocal();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog" aria-labelledby="troca-lembrete-titulo">
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 sm:p-8">
                <h2 id="troca-lembrete-titulo" className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mb-2">
                    Troca de plantão para confirmar
                </h2>
                <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-5">
                    Este aviso aparece toda vez que você abrir o app, até você confirmar.
                </p>

                <ul className="space-y-4">
                    {pendentes.map(troca => {
                        const nome = nomes.get(troca.cedente_id) || 'Um colega';
                        const futuro = troca.data_dia > hoje;
                        const erro = erros.get(troca.id);
                        return (
                            <li key={troca.id} className="p-4 rounded-xl border-2 border-amber-400 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-500/10">
                                <p className="font-bold text-amber-900 dark:text-amber-200">
                                    {formatDateBR(troca.data_dia)} · {troca.turno} · {getSectorName(troca.setor_id) ?? 'Sem setor'}
                                </p>
                                <p className="text-sm text-amber-900 dark:text-amber-100 mt-2">
                                    <strong>{nome}</strong> avisou que passou este plantão para você e que <strong>já pagou</strong>.
                                    Ao confirmar, o valor do plantão vai inteiro para {nome}.
                                </p>
                                <p className="text-sm text-amber-800 dark:text-amber-200/80 mt-2">
                                    {futuro
                                        ? 'Confirme agora. No dia, é só bater o ponto normalmente.'
                                        : 'Confirme agora e não esqueça de bater o ponto deste plantão.'}{' '}
                                    Se você não recebeu o pagamento, não confirme e fale com {nome}.
                                </p>
                                {erro && <p className="text-sm font-semibold text-red-700 dark:text-red-400 mt-2" role="alert">{erro}</p>}
                                <button
                                    type="button"
                                    disabled={ocupada !== null}
                                    onClick={() => confirmar(troca, nome)}
                                    className="mt-3 w-full min-h-[44px] px-5 rounded-lg text-sm font-bold text-white bg-pmp-primary hover:bg-pmp-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {ocupada === troca.id ? 'Salvando...' : 'Confirmar que recebi'}
                                </button>
                            </li>
                        );
                    })}
                </ul>

                <button
                    type="button"
                    onClick={() => setFechado(true)}
                    className="mt-5 w-full min-h-[44px] px-5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 text-pmp-text-primary dark:text-dark-pmp-text-primary hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                >
                    Agora não
                </button>
            </div>
        </div>
    );
};

export default TrocaLembrete;
