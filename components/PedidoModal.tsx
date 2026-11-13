import React, { useEffect, useMemo, useState } from 'react';
import { Sector, Shift } from '../types';
import { DISABLED_SECTORS, SECTOR_ID_MAP, getShortShift } from '../constants';
import { formatDateBR, formatDateISO, formatMinutes, getTodayLocal } from '../utils/date';
import { formatBRL } from '../utils/finance';
import { PRAZO_PEDIDO_DIAS, TRANSICAO_FIM, emTransicao, getPrimeiroDiaPontoEsquecido, pedirAbonoAtraso, pedirPontoEsquecido } from '../src/services/pedidoService';

/** Ponto com desconto por atraso que o médico quer justificar */
export interface PontoAtrasado {
    id: number;
    data_dia: string;
    turno: string;
    minutos_atraso: number;
    desconto_atraso: number | string;
}

interface PedidoModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Chamado depois que o pedido foi gravado */
    onSent: () => void;
    /** Com um ponto: justificar o atraso dele. Sem ponto: pedir um ponto esquecido. */
    pontoAtrasado?: PontoAtrasado | null;
}

const MOTIVO_MINIMO = 10;
const MOTIVO_MAXIMO = 1000;
const SHIFTS: Shift[] = ['Manhã', 'Tarde', 'Noite'];
const SECTORS = (Object.keys(SECTOR_ID_MAP) as Sector[]).filter(sector => !DISABLED_SECTORS.includes(sector));
const DIA_LABEL = ['Hoje', 'Ontem', 'Anteontem'];

const optionClass = (selected: boolean) =>
    `flex-1 min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
        selected
            ? 'border-pmp-primary bg-pmp-primary text-white'
            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-pmp-text-primary dark:text-dark-pmp-text-primary hover:border-pmp-primary'
    }`;

const fieldClass = 'block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20 text-sm py-2.5 px-3 outline-none';
const labelClass = 'block text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary mb-2';

const PedidoModal: React.FC<PedidoModalProps> = ({ isOpen, onClose, onSent, pontoAtrasado }) => {
    // Dias dentro do prazo: hoje e os dias anteriores permitidos
    const dias = useMemo(() => {
        if (!isOpen) return [];
        return Array.from({ length: PRAZO_PEDIDO_DIAS + 1 }, (_, i) => {
            const data = new Date();
            data.setDate(data.getDate() - i);
            return formatDateISO(data);
        });
    }, [isOpen]);

    const [dataDia, setDataDia] = useState('');
    const [turno, setTurno] = useState<Shift>('Manhã');
    const [setor, setSetor] = useState<Sector>(SECTORS[0]);
    const [horario, setHorario] = useState('');
    const [motivo, setMotivo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    // Cada abertura começa com o formulário limpo
    useEffect(() => {
        if (!isOpen) return;
        setDataDia(dias[0] ?? '');
        setTurno('Manhã');
        setSetor(SECTORS[0]);
        setHorario('');
        setMotivo('');
        setErro(null);
        setEnviando(false);
    }, [isOpen, dias]);

    if (!isOpen) return null;

    const motivoLimpo = motivo.trim();
    const podeEnviar = motivoLimpo.length >= MOTIVO_MINIMO && (pontoAtrasado ? true : Boolean(dataDia && horario)) && !enviando;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!podeEnviar) return;

        setEnviando(true);
        setErro(null);

        const resultado = pontoAtrasado
            ? await pedirAbonoAtraso(pontoAtrasado.id, motivoLimpo)
            : await pedirPontoEsquecido({
                dataDia,
                turno,
                setorId: SECTOR_ID_MAP[setor],
                horario,
                motivo: motivoLimpo,
            });

        setEnviando(false);

        if (resultado.sucesso === false) {
            setErro(resultado.erro);
            return;
        }

        onSent();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-end sm:items-center sm:p-4" aria-modal="true" role="dialog" aria-labelledby="pedido-titulo">
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] overflow-y-auto p-6 sm:p-8">
                <div className="flex justify-between items-start gap-4 mb-3">
                    <h2 id="pedido-titulo" className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">
                        {pontoAtrasado ? 'Justificar atraso' : 'Esqueci de bater o ponto'}
                    </h2>
                    <button type="button" onClick={onClose} className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary hover:text-pmp-primary dark:hover:text-dark-pmp-primary p-1 rounded-full" aria-label="Fechar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {pontoAtrasado ? (
                    <div className="mb-5 space-y-1 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                        <p>
                            <strong>{formatDateBR(pontoAtrasado.data_dia)} · {getShortShift(pontoAtrasado.turno) ?? pontoAtrasado.turno}</strong>
                        </p>
                        <p>
                            {formatMinutes(pontoAtrasado.minutos_atraso)} de atraso, desconto de {formatBRL(Number(pontoAtrasado.desconto_atraso))}.
                        </p>
                        <p>Se a administração aprovar, o desconto é retirado.</p>
                    </div>
                ) : (
                    <p className="mb-5 text-sm leading-relaxed text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                        Use quando não conseguiu bater o ponto: esqueceu, o GPS falhou ou chegou na Noite depois da meia-noite.
                        O pedido vale para plantões de até {PRAZO_PEDIDO_DIAS} dias atrás e a administração aprova ou recusa.
                        {emTransicao() && (
                            <strong className="block mt-2 text-pmp-text-primary dark:text-dark-pmp-text-primary">
                                Até {formatDateBR(TRANSICAO_FIM).slice(0, 5)}, você também pode pedir plantões de setembro, outubro e novembro que ficaram sem lançar.
                            </strong>
                        )}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {!pontoAtrasado && (
                        <>
                            <div>
                                <span className={labelClass} id="pedido-dia">Dia do plantão</span>
                                <div className="flex gap-2" role="group" aria-labelledby="pedido-dia">
                                    {dias.map((dia, i) => (
                                        <button key={dia} type="button" onClick={() => setDataDia(dia)} aria-pressed={dataDia === dia} className={optionClass(dataDia === dia)}>
                                            {formatDateBR(dia).slice(0, 5)}
                                            <span className="block text-[11px] font-normal opacity-80">{DIA_LABEL[i] ?? ''}</span>
                                        </button>
                                    ))}
                                </div>
                                {emTransicao() && (
                                    <div className="mt-3">
                                        <label htmlFor="pedido-outra-data" className="block text-xs font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">
                                            Ou escolha outra data, a partir de {formatDateBR(getPrimeiroDiaPontoEsquecido())}
                                        </label>
                                        <input
                                            id="pedido-outra-data"
                                            type="date"
                                            value={dataDia}
                                            min={getPrimeiroDiaPontoEsquecido()}
                                            max={getTodayLocal()}
                                            onChange={e => setDataDia(e.target.value)}
                                            className={fieldClass}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <span className={labelClass} id="pedido-turno">Turno</span>
                                <div className="flex gap-2" role="group" aria-labelledby="pedido-turno">
                                    {SHIFTS.map(opcao => (
                                        <button key={opcao} type="button" onClick={() => setTurno(opcao)} aria-pressed={turno === opcao} className={optionClass(turno === opcao)}>
                                            {opcao}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="pedido-setor" className={labelClass}>Setor</label>
                                    <select id="pedido-setor" value={setor} onChange={e => setSetor(e.target.value as Sector)} className={fieldClass}>
                                        {SECTORS.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="pedido-horario" className={labelClass}>Horário que chegou</label>
                                    <input id="pedido-horario" type="time" value={horario} onChange={e => setHorario(e.target.value)} className={fieldClass} required />
                                </div>
                            </div>
                        </>
                    )}

                    <div>
                        <label htmlFor="pedido-motivo" className={labelClass}>Motivo</label>
                        <textarea
                            id="pedido-motivo"
                            rows={4}
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            maxLength={MOTIVO_MAXIMO}
                            placeholder={pontoAtrasado ? 'Ex.: fiquei parado no trânsito por causa de um acidente' : 'Ex.: o GPS do celular não funcionou na hora de bater'}
                            className={fieldClass}
                            required
                        />
                        <p className="mt-1 text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                            Pelo menos {MOTIVO_MINIMO} letras. Só você e a administração veem o motivo.
                        </p>
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
                            {enviando ? 'Enviando...' : 'Enviar pedido'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PedidoModal;
