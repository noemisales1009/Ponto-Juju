import React, { useState, useEffect } from 'react';

interface PontoRecord {
    id: number;
    data_dia: string;
    turno: string;
    falta: boolean;
    medico?: string;
}

interface EditPontoModalProps {
    isOpen: boolean;
    ponto: PontoRecord | null;
    onClose: () => void;
    onSave: (pontoId: number, updates: { data_dia?: string; turno?: string; falta?: boolean }) => Promise<void>;
}

const EditPontoModal: React.FC<EditPontoModalProps> = ({ isOpen, ponto, onClose, onSave }) => {
    const [formData, setFormData] = useState<{
        data_dia: string;
        turno: string;
        falta: boolean;
    }>({
        data_dia: '',
        turno: '',
        falta: false
    });
    
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (ponto) {
            setFormData({
                data_dia: ponto.data_dia,
                turno: ponto.turno,
                falta: ponto.falta || false
            });
            setError('');
        }
    }, [ponto, isOpen]);

    if (!isOpen || !ponto) return null;

    const handleSave = async () => {
        setError('');
        
        // Validações
        if (!formData.data_dia) {
            setError('Data é obrigatória');
            return;
        }
        if (!formData.turno) {
            setError('Turno é obrigatório');
            return;
        }

        setIsSaving(true);
        try {
            await onSave(ponto.id, formData);
            setIsSaving(false);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar');
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setError('');
        onClose();
    };

    return (
        <>
            {/* Overlay */}
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
                onClick={handleCancel}
            />
            
            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            ✏️ Editar Ponto
                        </h2>
                        <button
                            onClick={handleCancel}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4">
                        {/* Exibir nome do profissional */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                👤 Profissional
                            </label>
                            <div className="text-base font-medium text-gray-900 dark:text-white">
                                {ponto.medico || 'Desconhecido'}
                            </div>
                        </div>

                        {/* Data */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                📅 Data
                            </label>
                            <input
                                type="date"
                                value={formData.data_dia}
                                onChange={(e) => setFormData({ ...formData, data_dia: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                           bg-white dark:bg-slate-700 text-gray-900 dark:text-white
                                           focus:outline-none focus:ring-2 focus:ring-pmp-primary"
                            />
                        </div>

                        {/* Turno */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                ⏰ Turno
                            </label>
                            <select
                                value={formData.turno}
                                onChange={(e) => setFormData({ ...formData, turno: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                           bg-white dark:bg-slate-700 text-gray-900 dark:text-white
                                           focus:outline-none focus:ring-2 focus:ring-pmp-primary"
                            >
                                <option value="">Selecione um turno</option>
                                <option value="Manhã">Manhã</option>
                                <option value="Tarde">Tarde</option>
                                <option value="Noite">Noite</option>
                            </select>
                        </div>

                        {/* Status Falta */}
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="falta"
                                checked={formData.falta}
                                onChange={(e) => setFormData({ ...formData, falta: e.target.checked })}
                                className="h-4 w-4 text-pmp-primary dark:text-dark-pmp-primary rounded 
                                           border-gray-300 dark:border-gray-600 focus:ring-pmp-primary"
                            />
                            <label htmlFor="falta" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                ❌ Registrar como Falta
                            </label>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 rounded-md">
                                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700/50">
                        <button
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-600 
                                       border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 
                                       dark:hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 text-white bg-pmp-primary dark:bg-dark-pmp-primary 
                                       hover:bg-pmp-primary-dark dark:hover:bg-dark-pmp-primary-dark 
                                       disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                        >
                            {isSaving ? '💾 Salvando...' : '✅ Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default EditPontoModal;
