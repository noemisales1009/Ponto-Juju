import React, { useState } from 'react';
import { Sector } from '../types';
import { SECTOR_CONFIG, SECTOR_ID_MAP } from '../constants';
import { supabase } from '../services/supabaseClient';
import { getCurrentMonthLocal, getMonthRange, isValidMonth } from '../utils/date';
import { friendlyError } from '../utils/errors';

const CONFIRMATION_WORD = 'APAGAR';

const DataManagement: React.FC = () => {
    const [selectedSector, setSelectedSector] = useState<Sector>('UTI Ped');
    // Começa no mês atual (um mês fixo antigo como padrão é perigoso numa tela que apaga dados)
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthLocal());
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!selectedSector || !selectedMonth) {
            alert("Por favor, selecione um setor e um mês.");
            return;
        }

        // Validação de entrada: setor e mês precisam ser valores conhecidos
        const setorId = SECTOR_ID_MAP[selectedSector];
        if (!setorId || !isValidMonth(selectedMonth)) {
            alert("Setor ou mês inválido.");
            return;
        }

        const [year, month] = selectedMonth.split('-').map(Number);
        const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        // Confirmação forte: é preciso digitar a palavra, um OK acidental não basta
        const typed = window.prompt(
            `Você vai apagar TODOS os registros de ponto do setor "${selectedSector}" de ${capitalizedMonth} de ${year}.\n\nESTA AÇÃO É IRREVERSÍVEL.\n\nPara confirmar, digite ${CONFIRMATION_WORD}:`
        );

        if (typed === null) return;
        if (typed.trim().toUpperCase() !== CONFIRMATION_WORD) {
            alert('Confirmação incorreta. Nada foi apagado.');
            return;
        }

        setIsDeleting(true);

        try {
            // Primeiro e último dia do mês (sem conversão de fuso)
            const { start: startDate, end: endDate } = getMonthRange(selectedMonth);

            // Deletar registros do Supabase
            const { error, count } = await supabase
                .from('ponto_juju2')
                .delete({ count: 'exact' })
                .eq('setor_id', setorId)
                .gte('data_dia', startDate)
                .lte('data_dia', endDate);

            if (error) {
                console.error('Erro ao deletar registros:', error);
                alert(`Erro ao apagar registros: ${friendlyError(error, 'Não foi possível apagar os registros.')}`);
                return;
            }

            if (!count) {
                alert('Nenhum registro foi apagado (não havia registros ou você não tem permissão).');
                return;
            }

            alert(`✅ ${count} registro(s) apagado(s) com sucesso.`);

        } catch (error) {
            console.error('Erro geral ao apagar registros:', error);
            alert('Ocorreu um erro ao apagar os registros.');
        } finally {
            setIsDeleting(false);
        }
    };

    const inputStyles = "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-800 text-white dark:bg-gray-700 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-pmp-primary sm:text-sm p-2.5 [color-scheme:dark]";

    return (
        <div className="max-w-xl mx-auto">
            <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight mb-2 text-center">Gerenciamento de Dados</h1>
            <p className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-8 text-center">
                Esta seção permite a exclusão em massa de registros de ponto. Use com cuidado, pois esta ação é irreversível.
            </p>

            <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
                 <div>
                    <label htmlFor="sector-select" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">
                        Selecione o Setor
                    </label>
                    <select
                        id="sector-select"
                        value={selectedSector}
                        onChange={(e) => setSelectedSector(e.target.value as Sector)}
                        className={inputStyles}
                    >
                        {(Object.keys(SECTOR_CONFIG) as Sector[]).map(sector => (
                            <option key={sector} value={sector}>{sector}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="month-select" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">
                        Selecione o Mês
                    </label>
                    <input
                        type="month"
                        id="month-select"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className={inputStyles}
                    />
                </div>

                <div className="!mt-8 p-4 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-start gap-4">
                    <div className="flex-shrink-0 pt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 011 1v3a1 1 0 11-2 0V6a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-md font-bold text-red-800 dark:text-red-300">Ação Irreversível</h3>
                        <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                            Tenha certeza absoluta antes de prosseguir. Todos os dados de ponto para o setor e mês selecionados serão permanentemente apagados.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting || !selectedSector || !selectedMonth}
                        className="justify-center py-2.5 px-6 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-400 dark:disabled:bg-red-800 disabled:cursor-not-allowed transition-colors"
                    >
                        {isDeleting ? 'Apagando...' : 'Deletar Dados'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataManagement;
