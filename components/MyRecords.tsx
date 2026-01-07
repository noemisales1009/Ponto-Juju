
import React, { useState, useEffect, useMemo } from 'react';
import { ClockRecord, User } from '../types';
import { supabase } from '../services/supabaseClient';

interface MyRecordsProps {
    currentUser: User;
}

const MyRecords: React.FC<MyRecordsProps> = ({ currentUser }) => {
    const [userRecords, setUserRecords] = useState<any[]>([]);
    const [filterType, setFilterType] = useState<'month' | 'range'>('month');
    const [loading, setLoading] = useState(false);
    
    const today = new Date();
    const currentMonth = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [startDate, setStartDate] = useState(firstDayOfMonth);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

    // ✅ NOVO: Buscar dados do Supabase em tempo real
    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true);
            try {
                const { data: pontos, error } = await supabase
                    .from('ponto_juju2')
                    .select('*')
                    .eq('user_id', currentUser.id)
                    .order('data_dia', { ascending: false });

                if (error) {
                    console.error('❌ Erro ao buscar registros:', error);
                    setUserRecords([]);
                    return;
                }

                console.log('✅ Registros encontrados:', pontos);
                setUserRecords(pontos || []);
            } catch (err) {
                console.error('❌ Erro geral:', err);
                setUserRecords([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRecords();
    }, [currentUser.id]);

    const filteredRecords = useMemo(() => {
        if (filterType === 'month') {
            return userRecords.filter(r => r.data_dia && r.data_dia.startsWith(selectedMonth));
        } else { // 'range'
            return userRecords.filter(r => {
                if (!r.data_dia) return false;
                const recordDate = new Date(r.data_dia);
                const start = new Date(startDate);
                start.setUTCHours(0,0,0,0);
                const end = new Date(endDate);
                end.setUTCHours(23,59,59,999);
                
                return recordDate >= start && recordDate <= end;
            });
        }
    }, [userRecords, filterType, selectedMonth, startDate, endDate]);

    const inputClass = "block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20 sm:text-sm py-2.5 px-3 transition-all outline-none";

    return (
        <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl">
            <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight mb-6">Meus Pontos Registrados</h1>
            
            <div className="p-4 bg-slate-50 dark:bg-dark-pmp-surface/50 border border-slate-200 dark:border-slate-700/50 rounded-xl mb-6 space-y-4">
                <div className="flex items-center gap-6">
                    <span className="text-sm font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Filtrar por:</span>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="filterType" value="month" checked={filterType === 'month'} onChange={() => setFilterType('month')} className="h-4 w-4 text-pmp-primary focus:ring-pmp-primary-light border-gray-300 dark:border-gray-600"/>
                            <span className="text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">Mês</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="filterType" value="range" checked={filterType === 'range'} onChange={() => setFilterType('range')} className="h-4 w-4 text-pmp-primary focus:ring-pmp-primary-light border-gray-300 dark:border-gray-600"/>
                            <span className="text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">Período</span>
                        </label>
                    </div>
                </div>

                {filterType === 'month' ? (
                    <div>
                        <label htmlFor="month" className="sr-only">Mês</label>
                        <input
                            type="month"
                            id="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className={`${inputClass} max-w-xs`}
                        />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="startDate" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Data Inicial</label>
                            <input
                                type="date"
                                id="startDate"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="endDate" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Data Final</label>
                            <input
                                type="date"
                                id="endDate"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* ✅ NOVO: Mostrar estado de carregamento */}
            {loading && (
                <div className="text-center py-8">
                    <p className="text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Carregando registros...</p>
                </div>
            )}

            {!loading && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-dark-pmp-surface/80">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Data</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Turno</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Valor</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-pmp-surface dark:bg-dark-pmp-surface divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredRecords.length > 0 ? filteredRecords.map(record => (
                                <tr key={record.id} className="hover:bg-pmp-primary/5 dark:hover:bg-dark-pmp-primary/10 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                            {new Date(record.data_dia + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                        </div>
                                        <div className="text-xs text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                            {record.dia_semana_calculado}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">{record.turno}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                                        {record.valor_plantao ? `R$ ${record.valor_plantao.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {record.falta === 'Sim' ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 text-xs font-medium">
                                                <span>✗</span> Falta
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 text-xs font-medium">
                                                <span>✓</span> Ponto
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum registro encontrado para o período selecionado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MyRecords;
