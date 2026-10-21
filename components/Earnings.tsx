
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabaseClient';
import { getCurrentMonthLocal } from '../utils/date';

interface EarningsProps {
  currentUser: User;
}

interface MonthlyEarnings {
  total_plantoes: number;
  total_ganhos: number;
  nome_mes: string;
}

const Earnings: React.FC<EarningsProps> = ({ currentUser }) => {
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthLocal());
    const [monthlyData, setMonthlyData] = useState<MonthlyEarnings | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!selectedMonth) return;

        // Ignora respostas de buscas antigas se o mês mudar enquanto carrega
        let cancelled = false;

        const fetchMonthlyEarnings = async () => {
            setLoading(true);
            setLoadError(false);
            try {
                const [year, month] = selectedMonth.split('-').map(Number);

                const { data, error } = await supabase
                    .from('v_ganhos_mensais_usuario')
                    .select('total_plantoes, total_ganhos, nome_mes')
                    .eq('user_id', currentUser.id)
                    .eq('ano', year)
                    .eq('mes_numero', month)
                    .maybeSingle();

                if (cancelled) return;

                if (error) {
                    console.error('Erro ao buscar ganhos:', error);
                    setLoadError(true);
                    setMonthlyData({ total_plantoes: 0, total_ganhos: 0, nome_mes: '' });
                } else {
                    // Sem linha para o mês = nenhum plantão registrado
                    setMonthlyData(data ?? { total_plantoes: 0, total_ganhos: 0, nome_mes: '' });
                }
            } catch (err) {
                if (cancelled) return;
                console.error('Erro geral ao buscar ganhos:', err);
                setLoadError(true);
                setMonthlyData({ total_plantoes: 0, total_ganhos: 0, nome_mes: '' });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchMonthlyEarnings();
        return () => { cancelled = true; };
    }, [currentUser.id, selectedMonth]);

    const displayTitle = useMemo(() => {
        const currentMonthISO = getCurrentMonthLocal();
        if (selectedMonth === currentMonthISO) {
            return "Meus Ganhos - Mês Atual";
        }
        
        if (!selectedMonth) {
            return "Meus Ganhos";
        }

        const [year, month] = selectedMonth.split('-').map(Number);
        const displayDate = new Date(year, month - 1, 1);
        const monthName = displayDate.toLocaleString('pt-BR', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        
        return `Ganhos de ${capitalizedMonth}/${year}`;
    }, [selectedMonth]);

    const estimatedEarnings = Number(monthlyData?.total_ganhos) || 0;
    const monthlyShifts = Number(monthlyData?.total_plantoes) || 0;


    return (
        <div className="max-w-3xl mx-auto">
             <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                 <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight">Meus Ganhos</h1>
                <div>
                    <label htmlFor="earnings-month" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">
                        Selecione o Mês
                    </label>
                    <input
                        type="month"
                        id="earnings-month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="block w-full sm:w-auto rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium shadow-sm focus:border-pmp-primary dark:focus:border-dark-pmp-primary focus:ring-2 focus:ring-pmp-primary/50 dark:focus:ring-dark-pmp-primary/50 text-base py-2.5 px-4 outline-none transition-all"
                    />
                </div>
            </div>

            {/* ✅ NOVO: Indicador de carregamento */}
            {loading && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-center">
                    <p className="text-blue-700 dark:text-blue-400 text-sm font-medium">Carregando ganhos...</p>
                </div>
            )}

            {loadError && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-center">
                    <p className="text-red-700 dark:text-red-400 text-sm font-medium">Não foi possível carregar seus ganhos. Tente novamente.</p>
                </div>
            )}

            <div className="bg-gradient-to-br from-pmp-primary dark:from-teal-700 via-pmp-primary-dark dark:via-teal-800 to-pmp-secondary dark:to-teal-900 p-5 sm:p-8 rounded-3xl shadow-2xl text-white">
                <div className="text-center mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">{displayTitle}</h2>
                    <p className="text-white/80 mt-2 text-sm sm:text-base">
                        Ganhos baseados nos plantões registrados no banco de dados.
                    </p>
                </div>

                <div className="bg-white/10 dark:bg-black/20 p-5 sm:p-8 rounded-2xl text-center mb-6 backdrop-blur-sm">
                     <h3 className="text-sm sm:text-lg font-medium text-white/80">Ganhos Estimados</h3>
                     <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mt-2 break-words">
                        {estimatedEarnings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                </div>

                <div className="flex items-center justify-center space-x-4 text-center">
                   <div className="flex items-center gap-2">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6 text-pmp-accent dark:text-dark-pmp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                     </svg>
                     <p className="text-base sm:text-lg font-semibold">{monthlyShifts} Plantões no Mês</p>
                   </div>
                </div>
            </div>
        </div>
    );
};

export default Earnings;
