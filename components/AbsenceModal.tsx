import React, { useState, useEffect } from 'react';
import { User, Sector, Shift, PontoRow } from '../types';
import { formatDateBR } from '../utils/date';

interface AbsenceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (userId: string | number) => void;
    sector: Sector;
    shift: Shift;
    date: string;
    users: User[];
    existingRecords: PontoRow[];
}

const AbsenceModal: React.FC<AbsenceModalProps> = ({ isOpen, onClose, onSubmit, sector, shift, date, users, existingRecords }) => {
    const [selectedUserId, setSelectedUserId] = useState<string>('');

    // Nomes dos registros existentes que já são falta
    const usersWithAbsence = existingRecords
        .filter(rec => rec.falta === 'Sim')
        .map(rec => rec.medico || 'Desconhecido');

    // Filtra usuários que já têm ponto ou falta batido no dia/turno
    const availableUsers = users.filter(user =>
        !existingRecords.some(rec => String(rec.user_id) === String(user.id))
    );

    useEffect(() => {
        if (isOpen && availableUsers.length > 0) {
            setSelectedUserId(String(availableUsers[0].id));
        } else if (isOpen) {
            setSelectedUserId('');
        }
    }, [isOpen, users, existingRecords]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Só aceita um médico que realmente está na lista de disponíveis
        if (selectedUserId && availableUsers.some(u => String(u.id) === selectedUserId)) {
            onSubmit(selectedUserId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity" aria-modal="true" role="dialog">
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8 transform transition-all">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary">Registrar Falta</h2>
                    <button onClick={onClose} className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary hover:text-pmp-primary dark:hover:text-dark-pmp-primary p-1 rounded-full" aria-label="Fechar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="mb-6 space-y-2 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                    <p><strong>Setor:</strong> {sector}</p>
                    <p><strong>Turno:</strong> {shift}</p>
                    <p><strong>Data:</strong> {formatDateBR(date)}</p>
                </div>

                {/* Mostrar quem já tem falta registrada */}
                {usersWithAbsence.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">
                            <strong>⚠️ Faltas já registradas:</strong>
                        </p>
                        <ul className="text-sm text-red-700 dark:text-red-400 mt-2 space-y-1">
                            {usersWithAbsence.map((name, idx) => (
                                <li key={idx} className="flex items-center">
                                    <span className="text-red-500 mr-2 font-bold">✗</span>
                                    {name}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="doctor-select" className="block text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary mb-2">
                            Selecione o Médico para Registrar Falta
                        </label>
                        <select
                            id="doctor-select"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-pmp-text-primary dark:text-white shadow-sm focus:border-pmp-primary focus:ring-pmp-primary sm:text-sm p-2.5"
                            required
                        >
                            <option value="" disabled>Selecione um profissional</option>
                            {availableUsers.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name || `Usuário ${user.id}`}
                                </option>
                            ))}
                        </select>
                         {availableUsers.length === 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                ⚠️ Todos os médicos já possuem um registro (ponto ou falta) neste turno.
                            </p>
                         )}
                    </div>
                    <div className="flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="py-2 px-4 rounded-md text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedUserId}
                            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-300 dark:disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                        >
                            Confirmar Falta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AbsenceModal;
