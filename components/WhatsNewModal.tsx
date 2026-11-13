import React, { useEffect, useState } from 'react';

interface WhatsNewModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Ao mudar as regras do ponto, mude o texto aqui e troque a versão: o aviso volta a aparecer
 * uma vez para cada médico no próximo acesso.
 */
export const NOVIDADES_VERSAO = '2026-11-13';

const chave = (userId: string | number) => `pontokids:novidades:${userId}`;

export const jaViuNovidades = (userId: string | number): boolean => {
    try {
        return window.localStorage.getItem(chave(userId)) === NOVIDADES_VERSAO;
    } catch {
        // Sem acesso ao armazenamento (modo privado): melhor mostrar de novo do que nunca mostrar
        return false;
    }
};

export const marcarNovidadesVistas = (userId: string | number): void => {
    try {
        window.localStorage.setItem(chave(userId), NOVIDADES_VERSAO);
    } catch {
        // Sem armazenamento: o aviso aparece de novo no próximo acesso
    }
};

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

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
    const [passo, setPasso] = useState(0);

    useEffect(() => {
        if (isOpen) setPasso(0);
    }, [isOpen]);

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
