import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface WhatsNewModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** O admin vê quem já viu o aviso */
    isAdmin?: boolean;
}

/**
 * Ao mudar as regras do ponto, mude o texto aqui e troque a versão: o aviso volta a aparecer
 * uma vez para cada médico no próximo acesso.
 */
export const NOVIDADES_VERSAO = '2026-11-13b';

const chave = (userId: string | number) => `pontokids:novidades:${userId}`;

// O "já viu" fica em dois lugares:
//  - no banco (tabela ponto_aviso_visto, sql/adicionar_aviso_visto.sql): vale em qualquer aparelho
//  - no navegador: evita consultar o banco a cada acesso e segura o aviso se o banco falhar

const viuNesteAparelho = (userId: string | number): boolean => {
    try {
        return window.localStorage.getItem(chave(userId)) === NOVIDADES_VERSAO;
    } catch {
        return false;
    }
};

/** Grava no banco que o médico viu. Guarda no navegador que o banco já sabe, para não repetir. */
const gravarNoBanco = (userId: string | number): void => {
    supabase
        .from('ponto_aviso_visto')
        .insert({ user_id: userId, versao: NOVIDADES_VERSAO })
        .then(({ error }) => {
            // 23505 = já estava marcado (viu em outro aparelho ou reabriu pelo "?")
            if (error && error.code !== '23505') {
                console.error('Erro ao gravar o aviso de novidades:', error);
                return;
            }
            try {
                window.localStorage.setItem(`${chave(userId)}:banco`, NOVIDADES_VERSAO);
            } catch {
                // Sem armazenamento: tenta gravar de novo no próximo acesso, sem prejuízo
            }
        });
};

const bancoJaSabe = (userId: string | number): boolean => {
    try {
        return window.localStorage.getItem(`${chave(userId)}:banco`) === NOVIDADES_VERSAO;
    } catch {
        return false;
    }
};

const marcarNesteAparelho = (userId: string | number): void => {
    try {
        window.localStorage.setItem(chave(userId), NOVIDADES_VERSAO);
    } catch {
        // Sem armazenamento (modo privado): vale só a marca do banco
    }
};

/** true = o médico ainda não viu esta versão do aviso e ele deve aparecer */
export const conferirNovidades = async (userId: string | number): Promise<boolean> => {
    if (viuNesteAparelho(userId)) {
        // Quem viu antes de a tabela existir só tem a marca no navegador: avisa o banco agora
        if (!bancoJaSabe(userId)) gravarNoBanco(userId);
        return false;
    }

    const { data, error } = await supabase
        .from('ponto_aviso_visto')
        .select('versao')
        .eq('user_id', userId)
        .eq('versao', NOVIDADES_VERSAO)
        .maybeSingle();

    if (error) {
        // Banco fora do ar ou tabela ainda não criada: melhor mostrar de novo do que nunca mostrar
        console.error('Erro ao conferir o aviso de novidades:', error);
        return true;
    }

    if (data) marcarNesteAparelho(userId);
    return !data;
};

export const marcarNovidadesVistas = (userId: string | number): void => {
    marcarNesteAparelho(userId);
    gravarNoBanco(userId);
};

interface QuemViu {
    viram: { nome: string; vistoEm: string }[];
    faltam: string[];
}

/** Admin: médicos que já viram esta versão do aviso e os que ainda não viram */
const buscarQuemViu = async (): Promise<QuemViu | null> => {
    const [vistos, medicos] = await Promise.all([
        supabase.from('ponto_aviso_visto').select('user_id, visto_em').eq('versao', NOVIDADES_VERSAO),
        supabase.from('medicos_juju').select('user_id, medico'),
    ]);

    if (vistos.error || medicos.error) {
        console.error('Erro ao buscar quem viu o aviso:', vistos.error || medicos.error);
        return null;
    }

    const nomes = new Map<string, string>();
    (medicos.data || []).forEach(m => {
        if (m.user_id && m.medico) nomes.set(m.user_id, m.medico);
    });

    // Quem viu mas não está em medicos_juju (ex.: admin sem cadastro de médico)
    const semNome = (vistos.data || []).map(v => v.user_id).filter(id => !nomes.has(id));
    if (semNome.length) {
        const { data: usuarios } = await supabase.from('usuarios').select('user_id, nome').in('user_id', semNome);
        (usuarios || []).forEach(u => {
            if (u.user_id && u.nome) nomes.set(u.user_id, u.nome);
        });
    }

    const viuIds = new Set((vistos.data || []).map(v => v.user_id));
    const porNome = (a: string, b: string) => a.localeCompare(b, 'pt-BR');

    return {
        viram: (vistos.data || [])
            .map(v => ({ nome: nomes.get(v.user_id) || 'Sem nome', vistoEm: v.visto_em as string }))
            .sort((a, b) => porNome(a.nome, b.nome)),
        faltam: (medicos.data || [])
            .filter(m => m.user_id && m.medico && !viuIds.has(m.user_id))
            .map(m => m.medico as string)
            .sort(porNome),
    };
};

const formatarVistoEm = (timestamp: string): string =>
    new Date(timestamp).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    });

interface Passo {
    titulo: string;
    itens: React.ReactNode[];
}

const PASSOS: Passo[] = [
    {
        titulo: 'O ponto mudou',
        itens: [
            <>A partir de agora o ponto é batido <strong>no dia do plantão, dentro do hospital</strong>.</>,
            <>Não dá mais para lançar plantão com antecedência nem de dias que já passaram.</>,
            <>Veja nas próximas telas o que muda. Leva um minuto.</>,
        ],
    },
    {
        titulo: 'GPS ligado, no hospital',
        itens: [
            <>Deixe a <strong>localização do celular ligada</strong> e permita o acesso quando o app pedir.</>,
            <>O ponto só é aceito <strong>dentro do hospital</strong>. Fora dele, o app mostra a distância e recusa.</>,
            <>A localização é lida só no momento de bater o ponto. Só você e a administração veem.</>,
        ],
    },
    {
        titulo: 'Horário e atraso',
        itens: [
            <>O ponto abre no início do turno: <strong>Manhã 07:00, Tarde 13:00, Noite 19:00</strong>.</>,
            <>Você tem <strong>1 hora de tolerância</strong>. Na Manhã, por exemplo, até 08:00 não há atraso.</>,
            <>Depois disso, os minutos de atraso são <strong>descontados do valor do plantão</strong>. O horário exato fica gravado.</>,
        ],
    },
    {
        titulo: 'Atrasou ou esqueceu?',
        itens: [
            <><strong>Teve um motivo para o atraso?</strong> Em Meus Pontos, toque em "Justificar atraso". Se a administração aprovar, o desconto é retirado.</>,
            <><strong>Não conseguiu bater o ponto?</strong> Em Meus Pontos, toque em "Esqueci de bater o ponto" e informe o plantão e o motivo.</>,
            <>Nos dois casos o prazo é de <strong>até 2 dias depois do plantão</strong>.</>,
            <><strong>Só até 30/11:</strong> pelo "Esqueci de bater o ponto" você também pode pedir plantões de setembro, outubro e novembro que ficaram sem lançar.</>,
        ],
    },
    {
        titulo: 'Passou o plantão?',
        itens: [
            <><strong>Passou e já pagou o colega:</strong> em Meus Pontos, toque em "Passei meu plantão e já paguei". O colega bate o ponto e confirma; o valor entra no seu pagamento.</>,
            <><strong>Só passou, sem pagar:</strong> não precisa fazer nada. O colega bate o ponto e recebe o plantão.</>,
            <>Para rever estas orientações, toque no <strong>?</strong> no alto da tela.</>,
        ],
    },
];

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose, isAdmin = false }) => {
    const [passo, setPasso] = useState(0);
    const [quemViu, setQuemViu] = useState<QuemViu | null>(null);
    const [mostrarQuemViu, setMostrarQuemViu] = useState(false);
    const [erroQuemViu, setErroQuemViu] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setPasso(0);
        setMostrarQuemViu(false);
        setQuemViu(null);
        setErroQuemViu(false);
    }, [isOpen]);

    const abrirQuemViu = async () => {
        setMostrarQuemViu(true);
        setErroQuemViu(false);
        const resultado = await buscarQuemViu();
        setQuemViu(resultado);
        setErroQuemViu(resultado === null);
    };

    if (!isOpen) return null;

    const atual = PASSOS[passo];
    const ultimo = passo === PASSOS.length - 1;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex justify-center items-end sm:items-center sm:p-4" aria-modal="true" role="dialog" aria-labelledby="novidades-titulo">
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-wider text-pmp-primary dark:text-dark-pmp-primary-light mb-2">
                    Novidades · {passo + 1} de {PASSOS.length}
                </p>
                <h2 id="novidades-titulo" className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mb-5">
                    {atual.titulo}
                </h2>

                <ul className="space-y-4 mb-6 min-h-[11rem]">
                    {atual.itens.map((item, i) => (
                        <li key={i} className="flex gap-3 text-sm leading-relaxed text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-pmp-primary dark:bg-dark-pmp-primary" aria-hidden="true"></span>
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>

                <div className="flex justify-center gap-2 mb-6" aria-hidden="true">
                    {PASSOS.map((_, i) => (
                        <span key={i} className={`h-2 rounded-full transition-all ${i === passo ? 'w-6 bg-pmp-primary dark:bg-dark-pmp-primary' : 'w-2 bg-slate-300 dark:bg-slate-600'}`}></span>
                    ))}
                </div>

                {isAdmin && (
                    <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-pmp-surface/50">
                        {!mostrarQuemViu ? (
                            <button type="button" onClick={abrirQuemViu} className="text-sm font-semibold text-pmp-primary dark:text-dark-pmp-primary-light underline">
                                Admin: ver quem já viu este aviso
                            </button>
                        ) : erroQuemViu ? (
                            <p role="alert" className="text-sm text-red-700 dark:text-red-300">Não foi possível carregar a lista.</p>
                        ) : !quemViu ? (
                            <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Carregando...</p>
                        ) : (
                            <div className="space-y-3 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                <div>
                                    <p className="font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mb-1">Já viram ({quemViu.viram.length})</p>
                                    {quemViu.viram.length === 0 ? <p>Ninguém ainda.</p> : (
                                        <ul className="space-y-0.5">
                                            {quemViu.viram.map((v, i) => <li key={i}>{v.nome} · {formatarVistoEm(v.vistoEm)}</li>)}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mb-1">Ainda não viram ({quemViu.faltam.length})</p>
                                    {quemViu.faltam.length === 0 ? <p>Todos os médicos já viram.</p> : (
                                        <ul className="space-y-0.5">
                                            {quemViu.faltam.map((nome, i) => <li key={i}>{nome}</li>)}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setPasso(p => p - 1)}
                        disabled={passo === 0}
                        className="min-h-[44px] py-2 px-4 rounded-lg text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-0 disabled:pointer-events-none transition-colors"
                    >
                        Voltar
                    </button>
                    <button
                        type="button"
                        onClick={() => (ultimo ? onClose() : setPasso(p => p + 1))}
                        className="min-h-[44px] py-2 px-6 rounded-lg shadow-sm text-sm font-semibold text-white bg-pmp-primary hover:bg-pmp-primary-dark transition-colors"
                    >
                        {ultimo ? 'Entendi' : 'Próximo'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WhatsNewModal;
