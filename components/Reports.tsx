
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { SECTOR_CONFIG, SECTOR_ID_MAP } from '../constants';

interface ReportRecord {
    id: number;
    data_dia: string;
    usuario_nome: string;
    turno: string;
    setor: string;
    falta: string | null;
    valor_plantao: number;
}

const getShiftOrder = (shift: string): number => {
    if (shift?.includes('Manhã')) return 1;
    if (shift?.includes('Tarde')) return 2;
    if (shift?.includes('Noite')) return 3;
    return 4;
};

const Reports: React.FC = () => {
    const [allRecords, setAllRecords] = useState<ReportRecord[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSector, setSelectedSector] = useState<string>('all');
    const [isPrinting, setIsPrinting] = useState(false);
    const [filterType, setFilterType] = useState<'range' | 'month'>('month');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(false);

    const inputClass = "mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20 sm:text-sm py-2.5 px-3 transition-all outline-none hover:border-slate-400 dark:hover:border-slate-500";

    const fetchData = async (filters?: { startDate?: string, endDate?: string, setorId?: number }) => {
        setLoading(true);
        try {
            console.log('📥 Buscando relatório do Supabase com filtros:', filters);

            let query = supabase
                .from('ponto_juju2')
                .select(`
                    id,
                    data_dia,
                    turno,
                    falta,
                    valor_plantao,
                    user_id,
                    setor_id
                `);

            // Aplicar filtros de data
            if (filters?.startDate) {
                query = query.gte('data_dia', filters.startDate);
            }
            if (filters?.endDate) {
                query = query.lte('data_dia', filters.endDate);
            }
            // Aplicar filtro de setor
            if (filters?.setorId) {
                query = query.eq('setor_id', filters.setorId);
            }

            const { data, error } = await query.order('data_dia', { ascending: true });

            if (error) {
                console.error('❌ Erro ao buscar relatório:', error);
                setAllRecords([]);
                return;
            }

            // Buscar nomes de médicos e setores separadamente
            const userIds = [...new Set((data || []).map(r => r.user_id))];
            const setorIds = [...new Set((data || []).map(r => r.setor_id))];

            const { data: medicos } = await supabase
                .from('medicos_juju')
                .select('user_id, medico')
                .in('user_id', userIds);

            const { data: setores } = await supabase
                .from('setor_juju')
                .select('id, nome_setor')
                .in('id', setorIds);

            const medicoMap = new Map((medicos || []).map(m => [m.user_id, m.medico]));
            const setorMap = new Map((setores || []).map(s => [s.id, s.nome_setor]));

            // Mapear dados para o formato esperado
            const mappedRecords: ReportRecord[] = (data || []).map((record: any) => ({
                id: record.id,
                data_dia: record.data_dia,
                usuario_nome: medicoMap.get(record.user_id) || 'Desconhecido',
                turno: record.turno,
                setor: setorMap.get(record.setor_id) || 'Sem setor',
                falta: record.falta,
                valor_plantao: record.valor_plantao || 0
            }));

            // Ordenar por data (crescente) e depois por turno (Manhã → Tarde → Noite)
            mappedRecords.sort((a, b) => {
                // Primeiro compara DATA (da menor para a maior)
                const dateA = new Date(a.data_dia).getTime();
                const dateB = new Date(b.data_dia).getTime();
                if (dateA !== dateB) return dateA - dateB;

                // Se mesma data, compara TURNO (Manhã=1, Tarde=2, Noite=3)
                const shiftA = getShiftOrder(a.turno);
                const shiftB = getShiftOrder(b.turno);
                if (shiftA !== shiftB) return shiftA - shiftB;

                // Se mesma data e turno, compara MÉDICO (A-Z)
                return a.usuario_nome.localeCompare(b.usuario_nome);
            });

            console.log('✅ Relatório carregado:', mappedRecords.length, 'registros');
            setAllRecords(mappedRecords);
        } catch (err) {
            console.error('❌ Erro geral:', err);
            setAllRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSearch = () => {
        console.log('🔎 handleSearch chamado!');
        console.log('filterType:', filterType);
        console.log('selectedMonth:', selectedMonth);
        console.log('startDate:', startDate);
        console.log('endDate:', endDate);
        console.log('selectedSector:', selectedSector);

        let filters: { startDate?: string; endDate?: string; setorId?: number } = {};

        // Filtros de data
        if (filterType === 'month' && selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            // Primeiro dia do mês
            const firstDay = new Date(year, month - 1, 1);
            // Último dia do mês (dia 0 do próximo mês = último dia do mês atual)
            const lastDay = new Date(year, month, 0);
            
            filters.startDate = firstDay.toISOString().split('T')[0];
            filters.endDate = lastDay.toISOString().split('T')[0];
            console.log('✅ Filtro de mês aplicado:', filters);
        } else if (filterType === 'range') {
            filters.startDate = startDate || undefined;
            filters.endDate = endDate || undefined;
            console.log('✅ Filtro de período aplicado:', filters);
        }

        // Filtro de setor
        if (selectedSector !== 'all') {
            const setorId = SECTOR_ID_MAP[selectedSector as keyof typeof SECTOR_ID_MAP];
            console.log('🏥 Setor selecionado:', selectedSector, '→ ID:', setorId);
            filters.setorId = setorId;
        }

        console.log('🔍 Filtros finais que serão passados:', filters);
        fetchData(filters);
    };

    const handlePrint = () => {
        // @ts-ignore
        const { jsPDF } = window.jspdf;
        // @ts-ignore
        const html2canvas = window.html2canvas;

        if (!jsPDF || !html2canvas) {
            alert('Erro ao carregar bibliotecas de PDF. Tente novamente.');
            return;
        }
        
        const input = document.getElementById('points-report-content');
        if (!input) {
            alert('Elemento do relatório não encontrado.');
            return;
        }

        setIsPrinting(true);

        html2canvas(input, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: input.scrollWidth,
            height: input.scrollHeight,
            onclone: (document) => {
                document.documentElement.classList.remove('dark');
                const filters = document.querySelector('.report-filters');
                if (filters) (filters as HTMLElement).style.display = 'none';
                const printHeader = document.querySelector('.print-header');
                if (printHeader) {
                    (printHeader as HTMLElement).style.display = 'block';
                    (printHeader as HTMLElement).style.marginBottom = '16px';
                    (printHeader as HTMLElement).style.paddingBottom = '12px';
                    (printHeader as HTMLElement).style.borderBottom = '2px solid #e5e7eb';
                }
                const tableContainer = document.querySelector('.overflow-x-auto');
                if (tableContainer) {
                    (tableContainer as HTMLElement).style.overflow = 'visible';
                    (tableContainer as HTMLElement).style.width = '100%';
                }
                const table = document.querySelector('table');
                if (table) {
                    (table as HTMLElement).style.width = '100%';
                    (table as HTMLElement).style.fontSize = '8px';
                    (table as HTMLElement).style.tableLayout = 'auto';
                }
                // Forçar mostrar TODAS as colunas no PDF (incluindo Turno)
                const hiddenElements = document.querySelectorAll('.hidden, .sm\\:table-cell');
                hiddenElements.forEach(el => {
                    (el as HTMLElement).style.display = 'table-cell';
                    (el as HTMLElement).classList.remove('hidden');
                });
                // Ajustar padding das células e remover truncate
                const cells = document.querySelectorAll('th, td');
                cells.forEach(cell => {
                    (cell as HTMLElement).style.padding = '4px 6px';
                    (cell as HTMLElement).style.whiteSpace = 'nowrap';
                    (cell as HTMLElement).style.maxWidth = 'none';
                    (cell as HTMLElement).classList.remove('truncate');
                    (cell as HTMLElement).style.overflow = 'visible';
                });
                // Ajustar badges de status
                const badges = document.querySelectorAll('.inline-flex');
                badges.forEach(badge => {
                    (badge as HTMLElement).style.fontSize = '7px';
                    (badge as HTMLElement).style.padding = '2px 6px';
                });
            }
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
            const pdfWidth = pdf.internal.pageSize.getWidth() - 20; // 10mm margem de cada lado
            const pdfHeight = pdf.internal.pageSize.getHeight() - 20;
            
            const canvasAspectRatio = canvas.height / canvas.width;
            const imgHeight = pdfWidth * canvasAspectRatio;

            let heightLeft = imgHeight;
            let position = 10; // Margem superior

            pdf.addImage(imgData, 'PNG', 10, position, pdfWidth, imgHeight); // 10mm margem esquerda
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = -(imgHeight - heightLeft) + 10; // Mantém margem superior
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 10, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            const fileName = `relatorio-pontos-${new Date().toISOString().slice(0, 10)}.pdf`;
            pdf.save(fileName);
            setIsPrinting(false);
        }).catch(err => {
            console.error("Erro ao gerar PDF:", err);
            alert("Ocorreu um erro ao gerar o PDF.");
            setIsPrinting(false);
        });
    };

    const periodText = useMemo(() => {
        if (filterType === 'month' && selectedMonth) {
            const [year, month] = selectedMonth.split('-').map(Number);
            const displayDate = new Date(Date.UTC(year, month - 1, 1));
            const monthName = displayDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
            return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
        }

        if (startDate && endDate) {
            return `${new Date(startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a ${new Date(endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
        }
        if (startDate) {
            return `A partir de ${new Date(startDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
        }
        if (endDate) {
            return `Até ${new Date(endDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
        }
        return 'Todas as datas';
    }, [filterType, selectedMonth, startDate, endDate]);

    const sectorText = selectedSector === 'all' ? 'Todos os Setores' : selectedSector;

    // Os dados já vêm filtrados do Supabase, não precisa filtrar novamente
    const displayedRecords = allRecords;

    return (
        <div id="points-report-content" className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl report-card printable-area">
            <div className="print-header hidden">
                <h1 className="text-2xl font-bold text-black mb-3">Relatório de Pontos</h1>
                <p className="text-sm text-black mb-1">
                    <strong>Período:</strong> {periodText}
                </p>
                <p className="text-sm text-black mb-3">
                    <strong>Setor:</strong> {sectorText}
                </p>
            </div>

            <div className="report-filters">
                <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight mb-6">Relatório de Pontos</h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 dark:bg-dark-pmp-surface/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="md:col-span-2 lg:col-span-4">
                        <fieldset className="flex items-center gap-6">
                            <legend className="text-sm font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Filtrar por:</legend>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="filterType" value="range" checked={filterType === 'range'} onChange={() => setFilterType('range')} className="h-4 w-4 text-pmp-primary focus:ring-pmp-primary-light border-gray-300 dark:border-gray-600"/>
                                    <span className="text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">Período</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="filterType" value="month" checked={filterType === 'month'} onChange={() => setFilterType('month')} className="h-4 w-4 text-pmp-primary focus:ring-pmp-primary-light border-gray-300 dark:border-gray-600"/>
                                    <span className="text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">Mês</span>
                                </label>
                            </div>
                        </fieldset>
                    </div>

                    {filterType === 'range' ? (
                        <>
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
                        </>
                    ) : (
                        <div className="lg:col-span-2">
                            <label htmlFor="month" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Mês</label>
                            <input
                                type="month"
                                id="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="sector" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">Setor</label>
                        <select
                            id="sector"
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            className={inputClass}
                        >
                            <option value="all">Todos os Setores</option>
                            {(Object.keys(SECTOR_CONFIG) as Sector[]).map(sector => (
                                <option key={sector} value={sector}>{sector}</option>
                            ))}
                        </select>
                    </div>
                    <div className="self-end grid grid-cols-2 gap-2">
                        <button
                            onClick={handleSearch}
                            className="w-full justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-pmp-primary hover:bg-pmp-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pmp-primary-light transition-colors"
                        >
                            Pesquisar
                        </button>
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="w-full justify-center py-2.5 px-4 border border-pmp-primary dark:border-dark-pmp-primary-light rounded-lg shadow-sm text-sm font-medium text-pmp-primary dark:text-dark-pmp-primary-light bg-transparent hover:bg-pmp-primary/10 dark:hover:bg-dark-pmp-primary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pmp-primary-light transition-colors disabled:opacity-50"
                        >
                            {isPrinting ? 'Gerando...' : 'Gerar PDF'}
                        </button>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-center">
                    <p className="text-blue-700 dark:text-blue-400 text-sm font-medium">Carregando relatório...</p>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-dark-pmp-surface/80">
                        <tr>
                            <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Data</th>
                            <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Médico</th>
                            <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Setor</th>
                            <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider hidden sm:table-cell">Turno</th>
                            <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-pmp-surface dark:bg-dark-pmp-surface divide-y divide-slate-200 dark:divide-slate-700">
                        {displayedRecords.length > 0 ? displayedRecords.map(record => (
                            <tr key={record.id} className="hover:bg-pmp-primary/5 dark:hover:bg-dark-pmp-primary/10 transition-colors">
                                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                                    {new Date(record.data_dia + 'T00:00:00').toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                </td>
                                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary max-w-[120px] sm:max-w-none truncate">{record.usuario_nome}</td>
                                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary max-w-[80px] sm:max-w-none truncate">{record.setor}</td>
                                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary hidden sm:table-cell">{record.turno}</td>
                                <td className="px-3 sm:px-6 py-4 text-xs sm:text-sm">
                                    <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        record.falta === 'Sim'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300'
                                        : 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                                    }`}>
                                        {record.falta === 'Sim' ? 'Falta' : 'Presente'}
                                    </span>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Nenhum registro encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Reports;
