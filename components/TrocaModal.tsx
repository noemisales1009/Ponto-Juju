import React, { useEffect, useState } from 'react';
import { Sector, Shift, User } from '../types';
import { DISABLED_SECTORS, SECTOR_ID_MAP } from '../constants';
import { supabase } from '../services/supabaseClient';
import { formatDateISO, getTodayLocal } from '../utils/date';
import { registrarTroca } from '../src/services/trocaService';

interface TrocaModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Chamado depois que o aviso foi gravado */
    onSent: () => void;
    currentUser: User;
}

const SHIFTS: Shift[] = ['Manhã', 'Tarde', 'Noite'];
const SECTORS = (Object.keys(SECTOR_ID_MAP) as Sector[]).filter(sector => !DISABLED_SECTORS.includes(sector));

/** Igual ao banco: de ontem até 60 dias à frente */
const diaRelativo = (dias: number): string => {
    const data = new Date();
    data.setDate(data.getDate() + dias);
    return formatDateISO(data);
};

const optionClass = (selected: boolean) =>
    `flex-1 min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
        selected
            ? 'border-pmp-primary bg-pmp-primary text-white'
            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-pmp-text-primary dark:text-dark-pmp-text-primary hover:border-pmp-primary'
    }`;

const fieldClass = 'block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20 text-sm py-2.5 px-3 outline-none';
const labelClass = 'block text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary mb-2';

const TrocaModal: React.FC<TrocaModalProps> = ({ isOpen, onClose, onSent, currentUser }) => {
    const [colegas, setColegas] = useState<{ id: string; nome: string }[]>([]);
    const [substitutoId, setSubstitutoId] = useState('');
    const [dataDia, setDataDia] = useState(getTodayLocal());
    const [turno, setTurno] = useState<Shift>('Manhã');
    const [setor, setSetor] = useState<Sector>(SECTORS[0]);
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    // Cada abertura começa com o formulário limpo
    useEffect(() => {
        if (!isOpen) return;
        setSubstitutoId('');
        setDataDia(getTodayLocal());
        setTurno('Manhã');
        setSetor(SECTORS[0]);
        setErro(null);
        setEnviando(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || colegas.length > 0) return;
        let cancelled = false;

        supabase.from('usuarios').select('user_id, nome').then(({ data, error }) => {
            if (cancelled) return;
            if (error) {
                console.error('Erro ao buscar colegas:', error);
                setErro('Não foi possível carregar a lista de colegas. Feche e tente de novo.');
                return;
            }
            setColegas(
                (data || [])
                    .filter(u => u.user_id && u.nome && String(u.user_id) !== String(currentUser.id))
                    .map(u => ({ id: u.user_id as string, nome: u.nome as string }))
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
            );
        });

        return () => { cancelled = true; };
    }, [isOpen, colegas.length, currentUser.id]);

    if (!isOpen) return null;

    const podeEnviar = Boolean(substitutoId && dataDia) && !enviando;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!podeEnviar) return;

        setEnviando(true);
        setErro(null);

        const resultado = await registrarTroca({ substitutoId, dataDia, turno, setorId: SECTOR_ID_MAP[setor] });

        setEnviando(false);

        if (resultado.sucesso === false) {
            setErro(resultado.erro);
            return;
        }

        onSent();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-end sm:items-center sm:p-4" aria-modal="true" role="dialog" aria-labelledby="troca-titulo">
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-6 sm:p-8">
                <div className="flex justify-between items-start gap-4 mb-3">
                    <h2 id="troca-titulo" className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">Passei meu plantão e já paguei</h2>
                    <button type="button" onClick={onClose} className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary hover:text-pmp-primary dark:hover:text-dark-pmp-primary p-1 rounded-full" aria-label="Fechar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="mb-5 space-y-2 text-sm leading-relaxed text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                    <p>
                        Use só quando você <strong>já pagou</strong> o colega que vai fazer o plantão no seu lugar.
                        Ele bate o ponto e confirma; o valor do plantão entra no seu pagamento.
                    </p>
                    <p>
                        Se você só passou o plantão, sem pagar, não precisa avisar: o colega bate o ponto e recebe normalmente.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="troca-colega" className={labelClass}>Quem vai fazer o plantão</label>
                        <select id="troca-colega" value={substitutoId} onChange={e => setSubstitutoId(e.target.value)} className={fieldClass} required>
                            <option value="" disabled>Selecione o colega</option>
                            {colegas.map(colega => <option key={colega.id} value={colega.id}>{colega.nome}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="troca-data" className={labelClass}>Dia do plantão</label>
                            <input id="troca-data" type="date" value={dataDia} min={diaRelativo(-1)} max={diaRelativo(60)} onChange={e => setDataDia(e.target.value)} className={fieldClass} required />
                        </div>
                        <div>
                            <label htmlFor="troca-setor" className={labelClass}>Setor</label>
                            <select id="troca-setor" value={setor} onChange={e => setSetor(e.target.value as Sector)} className={fieldClass}>
                                {SECTORS.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <span className={labelClass} id="troca-turno">Turno</span>
                        <div className="flex gap-2" role="group" aria-labelledby="troca-turno">
                            {SHIFTS.map(opcao => (
                                <button key={opcao} type="button" onClick={() => setTurno(opcao)} aria-pressed={turno === opcao} className={optionClass(turno === opcao)}>
                                    {opcao}
                                </button>
                            ))}
                        </div>
                    </div>

                    {erro && (
                        <p role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-800 dark:text-red-300">
                            {erro}
                        </p>
                    )}

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="min-h-[44px] py-2 px-4 rounded-lg text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={!podeEnviar} className="min-h-[44px] py-2 px-5 rounded-lg shadow-sm text-sm font-semibold text-white bg-pmp-primary hover:bg-pmp-primary-dark disabled:bg-gray-300 dark:disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
                            {enviando ? 'Salvando...' : 'Avisar a troca'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TrocaModal;
