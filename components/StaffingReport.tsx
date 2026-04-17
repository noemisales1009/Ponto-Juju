
import React, { useState, useEffect, useMemo } from 'react';
import { Sector, Shift, ClockRecord, AbsenceRecord } from '../types';
import { SECTOR_CONFIG, getSectorSlots, SECTOR_ID_MAP, SHIFT_FULL_NAME_MAP } from '../constants';
import { supabase } from '../services/supabaseClient';

interface DailyStatus {
    date: string;
    dayOfWeek: string;
    shifts: {
        shiftName: Shift;
        status: 'Completo' | 'Faltando';
        missing: number;
    }[];
}

const StaffingReport: React.FC = () => {
    const [selectedSector, setSelectedSector] = useState<Sector>('UTI Ped');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [monthlyData, setMonthlyData] = useState<DailyStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);

    useEffect(() => {
        const processReportData = async () => {
            if (!selectedMonth || !selectedSector) return;
            setIsLoading(true);

            const [year, month] = selectedMonth.split('-').map(Number);
            const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
            const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
            
            const startDate = firstDayOfMonth.toISOString().split('T')[0];
            const endDate = lastDayOfMonth.toISOString().split('T')[0];

            // Buscar pontos do Supabase
            const { data: pontos, error } = await supabase
                .from('ponto_juju2')
                .select('id, data_dia, turno, falta, setor_id')
                .gte('data_dia', startDate)
                .lte('data_dia', endDate);

            if (error) {
                console.error('❌ Erro ao buscar pontos:', error);
                setMonthlyData([]);
                setIsLoading(false);
                return;
            }

            console.log('✅ Pontos carregados:', pontos?.length);

            const sectorConfig = SECTOR_CONFIG[selectedSector];
            if (!sectorConfig) {
                setMonthlyData([]);
                setIsLoading(false);
                return;
            }

            // Usar o mapeamento correto de setor_id de constants.ts
            const sectorId = SECTOR_ID_MAP[selectedSector];

            const daysInMonth = lastDayOfMonth.getUTCDate();
            const newMonthlyData: DailyStatus[] = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(Date.UTC(year, month - 1, day));
                const dateString = currentDate.toISOString().split('T')[0];
                
                const dayOfWeek = currentDate.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
                const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

                const dailyShiftsStatus = sectorConfig.shifts.map(shift => {
                    const requiredSlots = getSectorSlots(selectedSector, shift, dateString);
                    
                    // Usar SHIFT_FULL_NAME_MAP para encontrar todas as variações do nome do turno
                    const shiftVariations = SHIFT_FULL_NAME_MAP[shift] || [shift];
                    
                    // Contar quantos bateram ponto nesse dia/setor/turno (incluindo variações do nome)
                    const totalFilled = (pontos || []).filter(p => 
                        p.data_dia === dateString && 
                        p.setor_id === sectorId && 
                        shiftVariations.includes(p.turno)
                    ).length;
                    
                    const missing = Math.max(0, requiredSlots - totalFilled);

                    return {
                        shiftName: shift,
                        status: missing === 0 ? 'Completo' as const : 'Faltando' as const,
                        missing: missing,
                    };
                });

                newMonthlyData.push({
                    date: currentDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
                    dayOfWeek: capitalizedDay,
                    shifts: dailyShiftsStatus,
                });
            }
            setMonthlyData(newMonthlyData);
            setIsLoading(false);
        };
        
        processReportData();
    }, [selectedSector, selectedMonth]);

    const handlePrint = () => {
        // @ts-ignore
        const { jsPDF } = window.jspdf;

        if (!jsPDF) {
            alert('Erro ao carregar a biblioteca de PDF. Tente novamente.');
            return;
        }

        setIsPrinting(true);

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Descobrir quais turnos o setor tem
            const shiftColumns = monthlyData.length > 0
                ? monthlyData[0].shifts.map(s => s.shiftName)
                : [];

            // Cabeçalho da tabela
            const head = [['Data', 'Dia da Semana', ...shiftColumns]];

            // Corpo da tabela
            const body = monthlyData.map(day => {
                const row: any[] = [day.date, day.dayOfWeek];
                shiftColumns.forEach(shiftName => {
                    const s = day.shifts.find(x => x.shiftName === shiftName);
                    if (!s) {
                        row.push('-');
                    } else if (s.status === 'Completo') {
                        row.push({ content: 'Completo', styles: { textColor: [5, 150, 105] } });
                    } else {
                        row.push({ content: `Faltando: ${s.missing}`, styles: { textColor: [217, 119, 6] } });
                    }
                });
                return row;
            });

            // Resumo: totais por turno
            const totals: Record<string, { completos: number; faltas: number }> = {};
            shiftColumns.forEach(shift => {
                totals[shift] = { completos: 0, faltas: 0 };
            });
            monthlyData.forEach(day => {
                day.shifts.forEach(s => {
                    if (!totals[s.shiftName]) return;
                    if (s.status === 'Completo') totals[s.shiftName].completos += 1;
                    else totals[s.shiftName].faltas += s.missing;
                });
            });

            // @ts-ignore - plugin autotable adiciona método na instância
            pdf.autoTable({
                head,
                body,
                startY: 28,
                margin: { top: 22, bottom: 16, left: 10, right: 10 },
                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [249, 250, 251] },
                didDrawPage: () => {
                    // Cabeçalho em todas as páginas
                    pdf.setFontSize(16);
                    pdf.setFont('helvetica', 'bold');
                    pdf.setTextColor(30, 41, 59);
                    pdf.text('Relatório de Escala', 10, 12);

                    pdf.setFontSize(10);
                    pdf.setFont('helvetica', 'normal');
                    pdf.setTextColor(75, 85, 99);
                    pdf.text(`Setor: ${selectedSector}  |  Período: ${periodText}`, 10, 18);

                    // Rodapé com número da página
                    // @ts-ignore
                    const pageNumber = pdf.internal.getNumberOfPages();
                    pdf.setFontSize(8);
                    pdf.setTextColor(107, 114, 128);
                    pdf.text(
                        `Página ${pageNumber}`,
                        pageWidth - 10,
                        pageHeight - 8,
                        { align: 'right' }
                    );
                    pdf.text(
                        `Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
                        10,
                        pageHeight - 8
                    );
                },
            });

            // Resumo ao final
            // @ts-ignore
            let finalY = pdf.lastAutoTable.finalY || 28;
            if (finalY + 40 > pageHeight - 16) {
                pdf.addPage();
                finalY = 28;
            }

            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 41, 59);
            pdf.text('Resumo do Período', 10, finalY + 10);

            const summaryBody = shiftColumns.map(shift => [
                shift,
                String(totals[shift].completos),
                String(totals[shift].faltas),
            ]);

            // @ts-ignore
            pdf.autoTable({
                head: [['Turno', 'Dias Completos', 'Total de Faltas']],
                body: summaryBody,
                startY: finalY + 14,
                margin: { left: 10, right: 10 },
                styles: { fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold' },
                theme: 'grid',
            });

            // Detalhamento: dias com faltas
            const daysWithAbsences = monthlyData.filter(day =>
                day.shifts.some(s => s.status === 'Faltando')
            );

            if (daysWithAbsences.length > 0) {
                const formatMissingShifts = (shifts: { shiftName: string; missing: number }[]) => {
                    if (shifts.length === 1) {
                        const s = shifts[0];
                        const verb = s.missing === 1 ? 'Falta' : 'Faltam';
                        const profWord = s.missing === 1 ? 'profissional' : 'profissionais';
                        return `${verb} ${s.missing} ${profWord} no turno da ${s.shiftName}.`;
                    }
                    const names = shifts.map(s => s.shiftName);
                    const shiftsText = names.length === 2
                        ? `da ${names[0]} e da ${names[1]}`
                        : names.slice(0, -1).map(n => `da ${n}`).join(', ') + ` e da ${names[names.length - 1]}`;
                    const totalMissing = shifts.reduce((sum, s) => sum + s.missing, 0);
                    return `Faltam ${totalMissing} profissionais nos turnos ${shiftsText}.`;
                };

                const absenceDetails = daysWithAbsences.map(day => {
                    const missingShifts = day.shifts.filter(s => s.status === 'Faltando');
                    const shortDate = day.date.slice(0, 5);
                    return `${shortDate} (${day.dayOfWeek}): ${formatMissingShifts(missingShifts)}`;
                });

                // @ts-ignore
                let afterSummaryY = pdf.lastAutoTable.finalY + 10;
                if (afterSummaryY + 20 > pageHeight - 16) {
                    pdf.addPage();
                    afterSummaryY = 28;
                }

                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(30, 41, 59);
                pdf.text(`Dias com Faltas (${daysWithAbsences.length})`, 10, afterSummaryY);

                // @ts-ignore
                pdf.autoTable({
                    body: absenceDetails.map(text => [text]),
                    startY: afterSummaryY + 4,
                    margin: { left: 10, right: 10 },
                    styles: { fontSize: 9, cellPadding: 2, textColor: [55, 65, 81] },
                    theme: 'plain',
                });
            }

            const safeFileName = selectedSector.replace(/\s+/g, '_');
            pdf.save(`relatorio-escala-${safeFileName}-${selectedMonth}.pdf`);
            setIsPrinting(false);
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            alert('Ocorreu um erro ao gerar o PDF.');
            setIsPrinting(false);
        }
    };

    const periodText = useMemo(() => {
        if (!selectedMonth) return '';
        const [year, month] = selectedMonth.split('-').map(Number);
        const displayDate = new Date(Date.UTC(year, month - 1, 1));
        const monthName = displayDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        return `${capitalizedMonth} de ${year}`;
    }, [selectedMonth]);

    // Consistent input style
    const inputClass = "mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20 sm:text-sm py-2.5 px-3 transition-all outline-none [color-scheme:light] dark:[color-scheme:dark]";

    return (
        <>
            <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl w-full">
                <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight mb-6">Relatório de Escala</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 p-4 bg-slate-50 dark:bg-dark-pmp-surface/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <div className="lg:col-span-1">
                        <label htmlFor="sector-select" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">
                            Selecione o Setor
                        </label>
                        <select
                            id="sector-select"
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value as Sector)}
                            className={inputClass}
                        >
                            {(Object.keys(SECTOR_CONFIG) as Sector[]).map(sector => (
                                <option key={sector} value={sector}>{sector}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-1">
                        <label htmlFor="month-select" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-1">
                            Selecione o Mês
                        </label>
                        <input
                            type="month"
                            id="month-select"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div className="self-end lg:col-span-2">
                        <button
                            onClick={handlePrint}
                            disabled={isPrinting}
                            className="w-full md:w-auto md:float-right justify-center py-2.5 px-4 border border-pmp-primary dark:border-dark-pmp-primary-light rounded-lg shadow-sm text-sm font-medium text-pmp-primary dark:text-dark-pmp-primary-light bg-transparent hover:bg-pmp-primary/10 dark:hover:bg-dark-pmp-primary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pmp-primary-light transition-colors disabled:opacity-50"
                        >
                            {isPrinting ? 'Gerando PDF...' : 'Gerar PDF'}
                        </button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-center py-10 text-pmp-text-secondary dark:text-dark-pmp-text-secondary">
                        Carregando dados...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {monthlyData.map(day => (
                            <div key={day.date} className="bg-slate-50 dark:bg-dark-pmp-surface/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700/50">
                                <h3 className="font-bold text-lg text-pmp-text-primary dark:text-dark-pmp-text-primary">{day.date}</h3>
                                <p className="text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary mb-3">{day.dayOfWeek}</p>
                                <div className="space-y-2">
                                    {day.shifts.map(s => (
                                        <div key={s.shiftName} className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{s.shiftName}:</span>
                                            {s.status === 'Completo' ? (
                                                <span className="font-semibold text-green-600 dark:text-green-400">Completo</span>
                                            ) : (
                                                <span className="font-semibold text-amber-600 dark:text-amber-400">Faltando: {s.missing}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default StaffingReport;
