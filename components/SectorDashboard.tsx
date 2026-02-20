import React, { useState, useEffect, useCallback } from 'react';
import { User, Sector, Shift, ClockRecord, AbsenceRecord } from '../types';
import { SECTOR_CONFIG, getSectorSlots, SECTOR_ID_MAP, SHIFT_FULL_NAME_MAP } from '../constants';
import { registrarPonto, buscarHistoricoPontos } from '../src/services/pontoService';
import { supabase } from '../services/supabaseClient';
import AbsenceModal from './AbsenceModal';
import EditPontoModal from './EditPontoModal';

const ShiftCard: React.FC<{
    sector: Sector;
    shift: Shift;
    slots: number;
    currentUser: User;
    records: any[];
    onUpdate: () => void;
    onRegisterAbsence: () => void;
    selectedDate: string;
    onDeletePonto: (pontoId: number) => Promise<void>;
    onEditPonto: (ponto: any) => void;
    isAdmin?: boolean;
}> = ({ sector, shift, slots, currentUser, records, onUpdate, onRegisterAbsence, selectedDate, onDeletePonto, onEditPonto, isAdmin = false }) => {
    // Filtrar registros por turno - aceita qualquer variação do nome do turno
    const possibleShiftNames = SHIFT_FULL_NAME_MAP[shift] || [shift];
    const shiftRecords = records.filter(r => 
        possibleShiftNames.some(name => r.turno === name || r.turno?.includes(shift))
    );
    
    console.log(`🔎 ShiftCard ${shift} - Filtrando:`, {
        turnosPossiveis: possibleShiftNames,
        totalRecords: records.length,
        recordsTurnos: records.map(r => r.turno),
        filtrados: shiftRecords.length,
        filtradosTurnos: shiftRecords.map(r => r.turno)
    });
    
    // Separar presentes e faltas
    const shiftPresences = shiftRecords.filter(r => !r.falta || r.falta !== 'Sim');
    const shiftAbsences = shiftRecords.filter(r => r.falta === 'Sim');
    
    const totalFilled = shiftRecords.length;
    const isFull = totalFilled >= slots;
    const hasClockedIn = shiftPresences.some(r => String(r.user_id) === String(currentUser.id));
    const hasAbsence = shiftAbsences.some(r => String(r.user_id) === String(currentUser.id));
    
    console.log(`🔍 ShiftCard ${shift}:`, {
        currentUserId: currentUser.id,
        currentUserName: currentUser.name,
        recordCount: shiftRecords.length,
        allRecords: records.map(r => ({ user_id: r.user_id, turno: r.turno, medico: r.medico })),
        filteredByShift: shiftRecords.map(r => ({ user_id: r.user_id, turno: r.turno, medico: r.medico })),
        hasClockedIn,
        hasAbsence
    });

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
        
        // Registrar ponto no Supabase
        const resultado = await registrarPonto(
            currentUser.id,
            new Date(selectedDate),
            shift,
            SECTOR_ID_MAP[sector] // ✅ USAR O ID CORRETO DO SETOR
        );

        if (resultado.sucesso) {
            alert(`✅ Ponto batido com sucesso!`);
            // Aguarda um pouco e depois recarrega os dados
            setTimeout(() => {
                console.log('🔄 Recarregando dados após bater ponto...');
                onUpdate();
            }, 1000); 
        } else {
            alert(`❌ ${resultado.erro}`);
        }
    };

    return (
        <div className="bg-gradient-to-br from-slate-50 dark:from-slate-800/40 to-white dark:to-dark-pmp-surface p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/50">
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
                        {shiftPresences.map((rec, idx) => {
                            console.log(`Renderizando presença ${idx}:`, rec);
                            const isOwner = String(rec.created_by) === String(currentUser.id);
                            const canEdit = isOwner || isAdmin;
                            return (
                                <li key={`pres-${rec.id}`} className="flex items-center justify-between group hover:bg-slate-100 dark:hover:bg-slate-700/30 px-2 py-1 rounded transition-colors">
                                    <div className="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-pmp-primary dark:text-dark-pmp-primary" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <span className="font-medium">{rec.medico || 'Desconhecido'}</span>
                                    </div>
                                    {/* ✅ Botões de ação - Para o dono ou admin */}
                                    {canEdit && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onEditPonto(rec)}
                                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded transition-colors"
                                                title="Editar ponto"
                                                aria-label="Editar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => onDeletePonto(rec.id)}
                                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors"
                                                title="Deletar ponto"
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
                        })}
                        {shiftAbsences.map((rec, idx) => {
                            console.log(`Renderizando falta ${idx}:`, rec);
                            const isOwner = String(rec.created_by) === String(currentUser.id);
                            const canEdit = isOwner || isAdmin;
                            return (
                                <li key={`abs-${rec.id}`} className="flex items-center justify-between group hover:bg-red-50 dark:hover:bg-red-500/10 px-2 py-1 rounded transition-colors text-red-500 dark:text-red-400">
                                    <div className="flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <span className="font-medium">{rec.medico || 'Desconhecido'}</span> 
                                        <span className="ml-1 text-[10px] font-bold uppercase">(Falta)</span>
                                    </div>
                                    {/* ✅ Botões de ação para faltas - Para o dono ou admin */}
                                    {canEdit && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => onEditPonto(rec)}
                                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded transition-colors"
                                                title="Editar falta"
                                                aria-label="Editar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => onDeletePonto(rec.id)}
                                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded transition-colors"
                                                title="Deletar falta"
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
                        })}
                    </ul>
                ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 pt-2">Nenhum plantonista.</p>
                )}
            </div>
            <div className="mt-4 flex items-center gap-2">
                <button
                    onClick={handleClockIn}
                    disabled={isFull || hasClockedIn || hasAbsence}
                    className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-pmp-primary dark:bg-dark-pmp-primary hover:bg-pmp-primary-dark dark:hover:bg-dark-pmp-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pmp-primary-light disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:text-gray-500 dark:disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                    title={hasClockedIn ? `Ponto batido por ${currentUser.name}` : ''}
                >
                    {hasClockedIn ? `✓ ${currentUser.name}` : hasAbsence ? 'Falta Registrada' : 'Bater Ponto'}
                </button>
                <button
                    onClick={onRegisterAbsence}
                    className="p-2 border border-red-300 dark:border-red-500/50 text-sm font-medium rounded-md text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                    title="Registrar Falta"
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


interface SectorDashboardProps {
    sector: Sector;
    currentUser: User;
    onBack: () => void;
    isAdmin?: boolean;
}

const SectorDashboard: React.FC<SectorDashboardProps> = ({ sector, currentUser, onBack, isAdmin = false }) => {
    // ✅ FUNÇÃO PARA FORMATAR DATA CORRETAMENTE (YYYY-MM-DD)
    const getTodayFormatted = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        console.log(`📅 Data inicial formatada: ${year}-${month}-${day}`);
        return `${year}-${month}-${day}`;
    };

    const [selectedDate, setSelectedDate] = useState(getTodayFormatted());
    const [recordsForDate, setRecordsForDate] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAbsenceModalOpen, setAbsenceModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ shift: Shift } | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]); // ✅ NOVO: armazenar usuários
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingPonto, setEditingPonto] = useState<any | null>(null);

    const fetchDataForDate = useCallback(async (date: string) => {
        setLoading(true);
        console.log('🔍 === INICIANDO BUSCA DE DADOS ===');
        console.log('  Data selecionada:', date);
        console.log('  Setor:', sector);
        console.log('  Setor ID:', SECTOR_ID_MAP[sector]);
        
        try {
            // Buscar pontos com LOG detalhado
            console.log('🔎 Executando query: SELECT * FROM ponto_juju2 WHERE data_dia =', date, 'AND setor_id =', SECTOR_ID_MAP[sector]);
            const { data: pontos, error: errorPontos } = await supabase
                .from('ponto_juju2')
                .select('*')
                .eq('data_dia', date)
                .eq('setor_id', SECTOR_ID_MAP[sector]); // ✅ FILTRAR POR SETOR

            if (errorPontos) {
                console.error('❌ ERRO na query:', errorPontos);
                console.error('Mensagem:', errorPontos.message);
                setRecordsForDate([]);
                setLoading(false);
                return;
            }

            console.log('✅ Query executada com sucesso');
            console.log('📋 Pontos encontrados:', pontos?.length || 0);
            console.log('📊 Dados brutos:', pontos);

            if (!pontos || pontos.length === 0) {
                console.warn('⚠️ NENHUM PONTO ENCONTRADO para data:', date, 'setor_id:', SECTOR_ID_MAP[sector]);
                console.log('💡 Dica: Verifique se bateu ponto com o setor correto');
                setRecordsForDate([]);
                setLoading(false);
                return;
            }
            
            console.log(`✨ ${pontos.length} registro(s) encontrado(s)!`);
            
            // ✅ LOG: Mostrar qual é o user_id do ponto
            console.log('🔎 USER_IDs ENCONTRADOS NO PONTO:');
            pontos.forEach((p: any) => {
                console.log(`  - Ponto ID ${p.id}: user_id = ${p.user_id}`);
            });

            // Buscar nomes dos médicos separadamente (primeiro tenta medicos_juju, depois usuarios)
            const { data: medicos, error: errorMedicos } = await supabase
                .from('medicos_juju')
                .select('user_id, medico');

            const { data: usuarios, error: errorUsuarios } = await supabase
                .from('usuarios')
                .select('user_id, nome');

            console.log('❌ Erro ao buscar médicos_juju?', errorMedicos?.message);
            console.log('❌ Erro ao buscar usuarios?', errorUsuarios?.message);
            console.log('👨‍⚕️ Médicos (medicos_juju) encontrados:', medicos?.length || 0);
            console.log('  Primeiros 3:', medicos?.slice(0, 3));
            console.log('👤 Usuários (usuarios) encontrados:', usuarios?.length || 0);
            console.log('  Primeiros 3:', usuarios?.slice(0, 3));

            // Criar mapa combinado: primeiro tenta medicos_juju, depois usuarios
            const medicoMap = new Map();
            
            // Adicionar médicos da tabela medicos_juju
            (medicos || []).forEach(m => {
                if (m.medico && m.user_id) {
                    medicoMap.set(m.user_id, m.medico);
                    console.log(`  ✅ Adicionado de medicos_juju: ${m.user_id} -> ${m.medico}`);
                }
            });
            
            // Adicionar usuários da tabela usuarios (fallback)
            (usuarios || []).forEach(u => {
                if (u.nome && u.user_id && !medicoMap.has(u.user_id)) {
                    medicoMap.set(u.user_id, u.nome);
                    console.log(`  ✅ Adicionado de usuarios: ${u.user_id} -> ${u.nome}`);
                }
            });
            
            console.log('📊 Mapa FINAL de nomes:', Array.from(medicoMap.entries()));

            // Combinar dados
            const recordsWithNames = (pontos || []).map((ponto: any) => {
                const nomeDoMedico = medicoMap.get(ponto.user_id);
                console.log(`  🔍 Ponto ID: ${ponto.id}, user_id: ${ponto.user_id}, turno: "${ponto.turno}", nome encontrado: ${nomeDoMedico || '❌ NÃO ENCONTRADO'}`);
                return {
                    ...ponto,
                    medico: nomeDoMedico || ponto.user_id
                };
            });

            console.log('✅ Registros FINAIS com nomes:', recordsWithNames);
            console.log('📋 TODOS OS TURNOS encontrados:', recordsWithNames.map(r => r.turno));
            setRecordsForDate(recordsWithNames);
        } catch (err) {
            console.error('❌ Erro geral:', err);
            setRecordsForDate([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDataForDate(selectedDate);
    }, [selectedDate, fetchDataForDate]);

    // ✅ NOVO: Sincronizar o date input com o estado selectedDate
    useEffect(() => {
        const dateInput = document.getElementById('shift-date') as HTMLInputElement;
        if (dateInput) {
            if (dateInput.value !== selectedDate) {
                console.log(`📅 SINCRONIZANDO date input: "${dateInput.value}" → "${selectedDate}"`);
                dateInput.value = selectedDate;
            }
        }
    }, [selectedDate]);

    // ✅ NOVO: Buscar todos os usuários do banco
    useEffect(() => {
        const fetchAllUsers = async () => {
            try {
                const { data: usuarios, error } = await supabase
                    .from('usuarios')
                    .select('user_id, nome');

                if (error) {
                    console.error('❌ Erro ao buscar usuários:', error);
                    return;
                }

                console.log('👥 Usuários carregados:', usuarios);

                const users: User[] = (usuarios || []).map(u => ({
                    id: u.user_id,
                    name: u.nome,
                    email: '',
                }));

                setAllUsers(users);
            } catch (err) {
                console.error('❌ Erro geral ao buscar usuários:', err);
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

    const handleEditPonto = async (pontoId: number, updates: { data_dia?: string; turno?: string; falta?: boolean }) => {
        try {
            console.log('✏️ Editando ponto ID:', pontoId, 'com updates:', updates);
            
            // Preparar dados para atualizar
            const updateData: any = {
                ...updates
            };
            
            // Se a data foi alterada, também atualizar o timestamp ISO
            if (updates.data_dia) {
                updateData.data = new Date(updates.data_dia).toISOString();
            }
            
            const { error } = await supabase
                .from('ponto_juju2')
                .update(updateData)
                .eq('id', pontoId);

            if (error) {
                console.error('❌ Erro ao editar ponto:', error);
                throw new Error(error.message);
            }

            console.log('✅ Ponto editado com sucesso');
            alert('✅ Ponto atualizado com sucesso!');
            setEditModalOpen(false);
            setEditingPonto(null);
            // Recarrega os dados
            setTimeout(() => fetchDataForDate(selectedDate), 500);
        } catch (err: any) {
            console.error('❌ Erro geral ao editar:', err);
            throw err;
        }
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
            console.log('🗑️ Deletando ponto ID:', pontoId, `(${medico} - ${turno})`);
            const { error } = await supabase
                .from('ponto_juju2')
                .delete()
                .eq('id', pontoId);

            if (error) {
                console.error('❌ Erro ao deletar:', error);
                alert(`❌ Erro ao deletar: ${error.message}`);
            } else {
                console.log('✅ Ponto deletado com sucesso');
                alert(`✅ ${isFalta ? 'Falta' : 'Ponto'} de ${medico} deletado com sucesso!`);
                // Recarrega os dados da data selecionada
                setTimeout(() => fetchDataForDate(selectedDate), 500);
            }
        } catch (err) {
            console.error('❌ Erro geral:', err);
            alert('❌ Erro ao deletar ponto');
        }
    };

    const handleAbsenceSubmit = async (userId: string | number) => {
        if (modalData) {
            try {
                // ✅ Obter usuário autenticado atual (quem está registrando)
                const { data: { user: authenticatedUser } } = await supabase.auth.getUser();
                
                if (!authenticatedUser) {
                    alert('❌ Erro: Usuário não autenticado');
                    return;
                }

                console.log('📝 Registrando falta:', {
                    userId,
                    registradoPor: authenticatedUser.id,
                    sector,
                    shift: modalData.shift,
                    selectedDate,
                    setor_id: SECTOR_ID_MAP[sector]
                });

                const { data, error } = await supabase
                    .from('ponto_juju2')
                    .insert([{
                        user_id: userId,
                        created_by: authenticatedUser.id,  // ✅ QUEM está registrando
                        setor_id: SECTOR_ID_MAP[sector], // ✅ USAR ID CORRETO
                        turno: modalData.shift, // ✅ TURNO será normalizado pelo trigger
                        data: new Date(selectedDate).toISOString(), // ✅ ADICIONAR data timestamp
                        data_dia: selectedDate,
                        falta: 'Sim',
                        turno_preenchido: false
                    }]);

                if (error) {
                    console.error('❌ Erro ao registrar falta:', error);
                    alert(`❌ Erro ao registrar falta: ${error.message}`);
                } else {
                    console.log('✅ Falta registrada:', data);
                    alert(`✅ Falta registrada com sucesso para o turno da ${modalData.shift}.`);
                    handleCloseAbsenceModal();
                    setTimeout(() => fetchDataForDate(selectedDate), 500);
                }
            } catch (err) {
                console.error('❌ Erro geral:', err);
                alert('❌ Erro ao registrar falta');
            }
        }
    };

    const sectorConfig = SECTOR_CONFIG[sector];

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
                            onChange={(e) => {
                                const rawValue = e.target.value;
                                console.log('📅 === DATE PICKER MUDOU ===');
                                console.log('  Valor bruto:', rawValue);
                                console.log('  Tipo:', typeof rawValue);
                                console.log('  Comprimento:', rawValue.length);
                                console.log('  selectedDate ANTES:', selectedDate);
                                setSelectedDate(rawValue);
                                console.log('  selectedDate DEPOIS (state atualizado):', rawValue);
                            }}
                            className="block rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-pmp-primary sm:text-sm p-2.5 outline-none transition-colors [color-scheme:light] dark:[color-scheme:dark]"
                        />
                        {/* ✅ NOVO: Mostrar dia da semana */}
                        <div className="px-3 py-2 bg-pmp-primary/10 dark:bg-dark-pmp-primary/20 rounded-lg border border-pmp-primary/30 dark:border-dark-pmp-primary/30">
                            <p className="text-sm font-semibold text-pmp-primary dark:text-dark-pmp-primary">
                                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { 
                                    weekday: 'long',
                                    timeZone: 'UTC'
                                }).charAt(0).toUpperCase() + 
                                new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { 
                                    weekday: 'long',
                                    timeZone: 'UTC'
                                }).slice(1)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 rounded-2xl shadow-lg max-w-md mx-auto border border-slate-100 dark:border-slate-700/30">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-pmp-text-secondary">Carregando dados...</p>
                    </div>
                ) : (
                    <div className="space-y-4">
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
                    users={allUsers} // ✅ NOVO: passar usuários
                    existingRecords={recordsForDate.filter(r => 
                        SHIFT_FULL_NAME_MAP[modalData.shift]?.some(name => r.turno === name || r.turno?.includes(modalData.shift))
                    )}
                />
            )}
            {/* ✅ NOVO: Modal para editar ponto */}
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