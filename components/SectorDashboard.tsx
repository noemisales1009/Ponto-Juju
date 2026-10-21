import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Sector, Shift, PontoRow } from '../types';
import { SECTOR_CONFIG, getSectorSlots, SECTOR_ID_MAP, matchesShift } from '../constants';
import { registrarPonto } from '../src/services/pontoService';
import { supabase } from '../services/supabaseClient';
import { getTodayLocal, isValidDateISO, toDbTimestamp } from '../utils/date';
import { friendlyError } from '../utils/errors';
import AbsenceModal from './AbsenceModal';
import EditPontoModal from './EditPontoModal';

const RecordItem: React.FC<{
    rec: PontoRow;
    isAbsence: boolean;
    canEdit: boolean;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ rec, isAbsence, canEdit, onEdit, onDelete }) => {
    const kind = isAbsence ? 'falta' : 'ponto';
    return (
        <li className={`flex items-center justify-between group px-2 py-1 rounded transition-colors ${
            isAbsence
                ? 'hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 dark:text-red-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-700/30'
        }`}>
            <div className="flex items-center">
                {isAbsence ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-pmp-primary dark:text-dark-pmp-primary" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                )}
                <span className="font-medium">{rec.medico || 'Desconhecido'}</span>
                {isAbsence && <span className="ml-1 text-[10px] font-bold uppercase">(Falta)</span>}
            </div>
            {/* Botões de ação - Para o dono ou admin. Sempre visíveis no celular (sem hover) */}
            {canEdit && (
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                        onClick={onEdit}
                        className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded transition-colors"
                        title={`Editar ${kind}`}
                        aria-label="Editar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors"
                        title={`Deletar ${kind}`}
                        aria-label="Deletar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            )}
        </li>
    );
};

const ShiftCard: React.FC<{
    sector: Sector;
    shift: Shift;
    slots: number;
    currentUser: User;
    records: PontoRow[];
    onUpdate: () => void;
    onRegisterAbsence: () => void;
    selectedDate: string;
    onDeletePonto: (pontoId: number) => Promise<void>;
    onEditPonto: (ponto: PontoRow) => void;
    isAdmin?: boolean;
}> = ({ sector, shift, slots, currentUser, records, onUpdate, onRegisterAbsence, selectedDate, onDeletePonto, onEditPonto, isAdmin = false }) => {
    const [isSaving, setIsSaving] = useState(false);

    // Filtrar registros por turno - aceita qualquer variação do nome do turno
    const shiftRecords = records.filter(r => matchesShift(r.turno, shift));

    // Separar presentes e faltas
    const shiftPresences = shiftRecords.filter(r => r.falta !== 'Sim');
    const shiftAbsences = shiftRecords.filter(r => r.falta === 'Sim');

    const totalFilled = shiftRecords.length;
    const isFull = totalFilled >= slots;
    const hasClockedIn = shiftPresences.some(r => String(r.user_id) === String(currentUser.id));
    const hasAbsence = shiftAbsences.some(r => String(r.user_id) === String(currentUser.id));

    const canEditRecord = (rec: PontoRow) => String(rec.created_by) === String(currentUser.id) || isAdmin;

    const handleClockIn = async () => {
        if(isFull) {
            const doctors = shiftRecords.map(r => r.medico || 'Desconhecido').join(', ');
            alert(`Turno completo. Plantonistas/Faltas: ${doctors}`);
            return;
        }
        if(hasClockedIn) {
            alert('Você já bateu ponto neste turno.');
            return;
        }
        if(hasAbsence) {
            alert('Você já registrou uma falta neste turno.');
            return;
        }
        if (!isValidDateISO(selectedDate)) {
            alert('Selecione uma data válida.');
            return;
        }

        setIsSaving(true);
        try {
            // Registrar ponto no Supabase
            const resultado = await registrarPonto(
                currentUser.id,
                selectedDate,
                shift,
                SECTOR_ID_MAP[sector]
            );

            if (resultado.sucesso) {
                alert(`✅ Ponto batido com sucesso!`);
                onUpdate();
            } else {
                alert(`❌ ${resultado.erro}`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50">
            <div className="flex justify-between items-center">
                <div className="flex flex-col">
                    <h4 className="font-semibold text-pmp-text-primary dark:text-dark-pmp-text-primary">{shift}</h4>
                    <span className="text-[10px] text-pmp-text-secondary uppercase tracking-wider font-bold">Capacidade: {slots} med.</span>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isFull ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'}`}>
                    {totalFilled}/{slots} Vagas
                </span>
            </div>
            <div className="mt-3 min-h-[60px]">
                {(shiftPresences.length > 0 || shiftAbsences.length > 0) ? (
                    <ul className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary space-y-1.5">
                        {shiftPresences.map(rec => (
                            <RecordItem
                                key={`pres-${rec.id}`}
                                rec={rec}
                                isAbsence={false}
                                canEdit={canEditRecord(rec)}
                                onEdit={() => onEditPonto(rec)}
                                onDelete={() => onDeletePonto(rec.id)}
                            />
                        ))}
                        {shiftAbsences.map(rec => (
                            <RecordItem
                                key={`abs-${rec.id}`}
                                rec={rec}
                                isAbsence={true}
                                canEdit={canEditRecord(rec)}
                                onEdit={() => onEditPonto(rec)}
                                onDelete={() => onDeletePonto(rec.id)}
                            />
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 pt-2">Nenhum plantonista.</p>
                )}
            </div>
            <div className="mt-4 flex items-center gap-2">
                <button
                    onClick={handleClockIn}
                    disabled={isFull || hasClockedIn || hasAbsence || isSaving}
                    className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-pmp-primary dark:bg-dark-pmp-primary hover:bg-pmp-primary-dark dark:hover:bg-dark-pmp-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pmp-primary-light disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title={hasClockedIn ? `Ponto batido por ${currentUser.name}` : ''}
                >
                    {isSaving ? 'Registrando...' : hasClockedIn ? `✓ ${currentUser.name}` : hasAbsence ? 'Falta Registrada' : 'Bater Ponto'}
                </button>
                <button
                    onClick={onRegisterAbsence}
                    disabled={isFull}
                    className="p-2 border border-red-300 dark:border-red-500/50 text-sm font-medium rounded-md text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 dark:disabled:hover:bg-red-500/10"
                    title={isFull ? 'Turno completo' : 'Registrar Falta'}
                    aria-label="Registrar Falta"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};


// Largura e colunas conforme a quantidade de turnos do setor (no celular é sempre 1 coluna)
const SHIFT_GRID: Record<number, string> = {
    1: 'max-w-md',
    2: 'max-w-3xl lg:grid-cols-2',
    3: 'max-w-6xl lg:grid-cols-3',
};

interface SectorDashboardProps {
    sector: Sector;
    currentUser: User;
    onBack: () => void;
    isAdmin?: boolean;
}

const SectorDashboard: React.FC<SectorDashboardProps> = ({ sector, currentUser, onBack, isAdmin = false }) => {
    const [selectedDate, setSelectedDate] = useState(getTodayLocal);
    const [recordsForDate, setRecordsForDate] = useState<PontoRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAbsenceModalOpen, setAbsenceModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ shift: Shift } | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingPonto, setEditingPonto] = useState<PontoRow | null>(null);

    // Garante que só a resposta da busca mais recente atualiza a tela
    const latestRequest = useRef(0);

    const fetchDataForDate = useCallback(async (date: string) => {
        const requestId = ++latestRequest.current;
        const isStale = () => requestId !== latestRequest.current;

        if (!isValidDateISO(date)) {
            setRecordsForDate([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const { data: pontos, error: errorPontos } = await supabase
                .from('ponto_juju2')
                .select('id, user_id, created_by, data_dia, turno, setor_id, falta')
                .eq('data_dia', date)
                .eq('setor_id', SECTOR_ID_MAP[sector]);

            if (isStale()) return;

            if (errorPontos) {
                console.error('Erro ao buscar pontos:', errorPontos);
                setRecordsForDate([]);
                return;
            }

            if (!pontos || pontos.length === 0) {
                setRecordsForDate([]);
                return;
            }

            // Buscar nomes só dos médicos que aparecem nos pontos (primeiro medicos_juju, depois usuarios)
            const userIds = [...new Set(pontos.map(p => p.user_id))];
            const [{ data: medicos }, { data: usuarios }] = await Promise.all([
                supabase.from('medicos_juju').select('user_id, medico').in('user_id', userIds),
                supabase.from('usuarios').select('user_id, nome').in('user_id', userIds),
            ]);

            if (isStale()) return;

            const medicoMap = new Map<string, string>();
            (medicos || []).forEach(m => {
                if (m.medico && m.user_id) medicoMap.set(m.user_id, m.medico);
            });
            (usuarios || []).forEach(u => {
                if (u.nome && u.user_id && !medicoMap.has(u.user_id)) medicoMap.set(u.user_id, u.nome);
            });

            setRecordsForDate(pontos.map(ponto => ({
                ...ponto,
                medico: medicoMap.get(ponto.user_id),
            })));
        } catch (err) {
            if (isStale()) return;
            console.error('Erro ao carregar plantões:', err);
            setRecordsForDate([]);
        } finally {
            if (!isStale()) setLoading(false);
        }
    }, [sector]);

    useEffect(() => {
        fetchDataForDate(selectedDate);
    }, [selectedDate, fetchDataForDate]);

    // Lista de médicos para o modal de falta
    useEffect(() => {
        const fetchAllUsers = async () => {
            try {
                const { data: usuarios, error } = await supabase
                    .from('usuarios')
                    .select('user_id, nome');

                if (error) {
                    console.error('Erro ao buscar usuários:', error);
                    return;
                }

                const users: User[] = (usuarios || []).map(u => ({
                    id: u.user_id,
                    name: u.nome,
                    email: '',
                }));

                setAllUsers(users);
            } catch (err) {
                console.error('Erro geral ao buscar usuários:', err);
            }
        };

        fetchAllUsers();
    }, []);

    const handleOpenAbsenceModal = (shift: Shift) => {
        setModalData({ shift });
        setAbsenceModalOpen(true);
    };

    const handleCloseAbsenceModal = () => {
        setAbsenceModalOpen(false);
        setModalData(null);
    };

    const handleEditPonto = async (pontoId: number, updates: { data_dia?: string; turno?: string; falta?: string | null }) => {
        const updateData: Record<string, unknown> = { ...updates };

        // Se a data foi alterada, também atualizar o timestamp usado pelo trigger
        if (updates.data_dia) {
            updateData.data = toDbTimestamp(updates.data_dia);
        }
        if (updates.falta !== undefined) {
            updateData.turno_preenchido = updates.falta !== 'Sim';
        }

        // .select() é necessário: se a RLS bloquear, o Supabase não retorna erro, apenas 0 linhas
        const { data, error } = await supabase
            .from('ponto_juju2')
            .update(updateData)
            .eq('id', pontoId)
            .select('id');

        if (error) {
            console.error('Erro ao editar ponto:', error);
            throw new Error(friendlyError(error, 'Não foi possível atualizar o registro.'));
        }
        if (!data || data.length === 0) {
            throw new Error('Você não tem permissão para editar este registro.');
        }

        alert('✅ Registro atualizado com sucesso!');
        setEditModalOpen(false);
        setEditingPonto(null);
        fetchDataForDate(selectedDate);
    };

    const handleDeletePonto = async (pontoId: number) => {
        // Encontra o registro que será deletado para mostrar mais contexto
        const recordToDelete = recordsForDate.find(r => r.id === pontoId);
        const medico = recordToDelete?.medico || 'Desconhecido';
        const turno = recordToDelete?.turno || 'Turno desconhecido';
        const isFalta = recordToDelete?.falta === 'Sim';

        const confirmMessage = isFalta
            ? `⚠️ Deletar FALTA de ${medico} em "${turno}"?`
            : `⚠️ Deletar ponto de ${medico} em "${turno}"?`;

        if (!confirm(confirmMessage)) return;

        try {
            // .select() é necessário: se a RLS bloquear, o Supabase não retorna erro, apenas 0 linhas
            const { data, error } = await supabase
                .from('ponto_juju2')
                .delete()
                .eq('id', pontoId)
                .select('id');

            if (error) {
                console.error('Erro ao deletar:', error);
                alert(`❌ ${friendlyError(error, 'Não foi possível deletar o registro.')}`);
                return;
            }
            if (!data || data.length === 0) {
                alert('❌ Você não tem permissão para deletar este registro.');
                return;
            }

            alert(`✅ ${isFalta ? 'Falta' : 'Ponto'} de ${medico} deletado com sucesso!`);
            fetchDataForDate(selectedDate);
        } catch (err) {
            console.error('Erro geral ao deletar:', err);
            alert('❌ Erro ao deletar ponto');
        }
    };

    const handleAbsenceSubmit = async (userId: string | number) => {
        if (!modalData) return;

        if (!isValidDateISO(selectedDate)) {
            alert('Selecione uma data válida.');
            return;
        }

        try {
            // Obter usuário autenticado atual (quem está registrando)
            const { data: { user: authenticatedUser } } = await supabase.auth.getUser();

            if (!authenticatedUser) {
                alert('❌ Sessão expirada. Faça login novamente.');
                return;
            }

            const { error } = await supabase
                .from('ponto_juju2')
                .insert([{
                    user_id: userId,
                    created_by: authenticatedUser.id,  // QUEM está registrando
                    setor_id: SECTOR_ID_MAP[sector],
                    turno: modalData.shift, // turno será normalizado pelo trigger
                    data: toDbTimestamp(selectedDate),
                    data_dia: selectedDate,
                    falta: 'Sim',
                    turno_preenchido: false
                }]);

            if (error) {
                console.error('Erro ao registrar falta:', error);
                alert(`❌ ${friendlyError(error, 'Não foi possível registrar a falta.')}`);
            } else {
                alert(`✅ Falta registrada com sucesso para o turno da ${modalData.shift}.`);
                handleCloseAbsenceModal();
                fetchDataForDate(selectedDate);
            }
        } catch (err) {
            console.error('Erro geral ao registrar falta:', err);
            alert('❌ Erro ao registrar falta');
        }
    };

    const sectorConfig = SECTOR_CONFIG[sector];

    const weekdayLabel = (() => {
        if (!isValidDateISO(selectedDate)) return '';
        const weekday = new Date(`${selectedDate}T12:00:00Z`).toLocaleDateString('pt-BR', {
            weekday: 'long',
            timeZone: 'UTC'
        });
        return weekday.charAt(0).toUpperCase() + weekday.slice(1);
    })();

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-pmp-primary dark:text-dark-pmp-primary hover:text-pmp-primary-dark dark:hover:text-dark-pmp-primary-light p-2 rounded-full hover:bg-pmp-primary/10 dark:hover:bg-dark-pmp-primary/10 transition-colors" aria-label="Voltar para seleção de setor">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight">{sector}</h1>
                </div>
                 <div>
                    <label htmlFor="shift-date" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">
                        Selecione a data para bater o ponto
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="date"
                            id="shift-date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-pmp-primary sm:text-sm p-2.5 outline-none transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                        />
                        {/* Dia da semana */}
                        {weekdayLabel && (
                            <div className="px-3 py-2 bg-pmp-primary/10 dark:bg-dark-pmp-primary/20 rounded-lg border border-pmp-primary/30 dark:border-dark-pmp-primary/30">
                                <p className="text-sm font-semibold text-pmp-primary dark:text-dark-pmp-primary">
                                    {weekdayLabel}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Carregando dados...</p>
                    </div>
                ) : (
                    <div className={`mx-auto grid grid-cols-1 gap-4 items-start ${SHIFT_GRID[sectorConfig.shifts.length] ?? SHIFT_GRID[3]}`}>
                        {sectorConfig.shifts.map(shift => (
                            <ShiftCard
                                key={`${sector}-${shift}`}
                                sector={sector}
                                shift={shift}
                                slots={getSectorSlots(sector, shift, selectedDate)}
                                currentUser={currentUser}
                                records={recordsForDate}
                                onUpdate={() => fetchDataForDate(selectedDate)}
                                onRegisterAbsence={() => handleOpenAbsenceModal(shift)}
                                selectedDate={selectedDate}
                                onDeletePonto={handleDeletePonto}
                                onEditPonto={(ponto) => {
                                    setEditingPonto(ponto);
                                    setEditModalOpen(true);
                                }}
                                isAdmin={isAdmin}
                            />
                        ))}
                    </div>
                )}
            </div>
            {isAbsenceModalOpen && modalData && (
                <AbsenceModal
                    isOpen={isAbsenceModalOpen}
                    onClose={handleCloseAbsenceModal}
                    onSubmit={handleAbsenceSubmit}
                    sector={sector}
                    shift={modalData.shift}
                    date={selectedDate}
                    users={allUsers}
                    existingRecords={recordsForDate.filter(r => matchesShift(r.turno, modalData.shift))}
                />
            )}
            {/* Modal para editar ponto */}
            <EditPontoModal
                isOpen={isEditModalOpen}
                ponto={editingPonto}
                onClose={() => {
                    setEditModalOpen(false);
                    setEditingPonto(null);
                }}
                onSave={handleEditPonto}
            />
        </div>
    );
};

export default SectorDashboard;
