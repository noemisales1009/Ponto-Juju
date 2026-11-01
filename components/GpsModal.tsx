import React, { useState, useEffect } from 'react';
import { verificarGps } from '../src/services/pontoService';

interface GpsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GpsModal: React.FC<GpsModalProps> = ({ isOpen, onClose }) => {
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // É este pedido que faz o aparelho perguntar se libera a localização para o app
    const checkGps = async () => {
        setIsChecking(true);
        setError(null);
        const { ativo, erro } = await verificarGps();
        setIsChecking(false);
        if (ativo) {
            onClose();
        } else {
            setError(erro || null);
        }
    };

    useEffect(() => {
        if (isOpen) checkGps();
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 transition-opacity" aria-modal="true" role="dialog">
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8 transform transition-all">
                <h2 className="text-2xl font-bold text-pmp-text-primary dark:text-dark-pmp-text-primary mb-4">Ative o GPS</h2>

                <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-6">
                    O ponto só pode ser batido com a localização ligada, dentro do hospital.
                </p>

                {isChecking && (
                    <p className="flex items-center text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary mb-6" role="status">
                        <svg className="animate-spin mr-3 h-5 w-5 text-pmp-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verificando sua localização...
                    </p>
                )}

                {error && (
                    <p className="mb-6 p-3 text-sm font-medium text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg" role="alert">
                        {error}
                    </p>
                )}

                <div className="flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="py-2 px-4 rounded-md text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors">
                        Agora não
                    </button>
                    <button
                        type="button"
                        onClick={checkGps}
                        disabled={isChecking}
                        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pmp-primary hover:bg-pmp-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pmp-primary-light disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                    >
                        Tentar de novo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GpsModal;
