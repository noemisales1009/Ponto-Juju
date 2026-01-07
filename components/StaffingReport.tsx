
import React, { useState, useEffect, useMemo } from 'react';
import { Sector, Shift, ClockRecord, AbsenceRecord } from '../types';
import { SECTOR_CONFIG, getSectorSlots } from '../constants';
import { getClockRecords, getAbsenceRecords } from '../services/mockApi';
import PDFStaffingReportContent from './PDFStaffingReportContent';

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
    const [selectedMonth, setSelectedMonth] = useState('2025-11');
    const [monthlyData, setMonthlyData] = useState<DailyStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);

    useEffect(() => {
        const processReportData = () => {
            if (!selectedMonth || !selectedSector) return;
            setIsLoading(true);

            const [year, month] = selectedMonth.split('-').map(Number);
            const firstDayOfMonth = new Date(Date.UTC(year, month - 1, 1));
            const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
            
            const clockRecords = getClockRecords({ 
                startDate: firstDayOfMonth.toISOString().split('T')[0], 
                endDate: lastDayOfMonth.toISOString().split('T')[0] 
            });
            const absenceRecords = getAbsenceRecords({ 
                startDate: firstDayOfMonth.toISOString().split('T')[0], 
                endDate: lastDayOfMonth.toISOString().split('T')[0] 
            });

            const sectorConfig = SECTOR_CONFIG[selectedSector];
            if (!sectorConfig) {
                setMonthlyData([]);
                setIsLoading(false);
                return;
            }

            const daysInMonth = lastDayOfMonth.getUTCDate();
            const newMonthlyData: DailyStatus[] = [];

            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(Date.UTC(year, month - 1, day));
                const dateString = currentDate.toISOString().split('T')[0];
                
                const dayOfWeek = currentDate.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
                const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

                const dailyShiftsStatus = sectorConfig.shifts.map(shift => {
                    const requiredSlots = getSectorSlots(selectedSector, shift, dateString);
                    const presences = clockRecords.filter(r => r.date === dateString && r.sector === selectedSector && r.shift === shift);
                    const absences = absenceRecords.filter(r => r.date === dateString && r.sector === selectedSector && r.shift === shift);
                    
                    const totalFilled = presences.length + absences.length;
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
        // @ts-ignore
        const html2canvas = window.html2canvas;

        if (!jsPDF || !html2canvas) {
            alert('Erro ao carregar bibliotecas de PDF. Tente novamente.');
            return;
        }

        const input = document.getElementById('pdf-staffing-report-content');
        if (!input) {
            alert('Elemento do relatório não encontrado para gerar o PDF.');
            return;
        }
        
        setIsPrinting(true);

        html2canvas(input, {
            scale: 2,
            useCORS: true,
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const canvasAspectRatio = canvas.height / canvas.width;
            const imgHeight = pdfWidth * canvasAspectRatio;

            let heightLeft = imgHeight;
            let position = 0;
            const margin = 10;
            const contentWidth = pdfWidth - (margin * 2);
            const contentHeight = pdfHeight - (margin * 2);

            if (imgHeight < contentHeight) {
                 pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight * (contentWidth / pdfWidth));
            } else {
                pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
                heightLeft -= contentHeight;

                while (heightLeft > 0) {
                    position -= contentHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', margin, position + margin, contentWidth, contentHeight);
                    heightLeft -= contentHeight;
                }
            }
            
            pdf.save(`relatorio-escala-${selectedSector}-${selectedMonth}.pdf`);
            setIsPrinting(false);
        }).catch(err => {
            console.error("Erro ao gerar PDF:", err);
            alert("Ocorreu um erro ao gerar o PDF.");
            setIsPrinting(false);
        });
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
            {/* Hidden component for PDF generation */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm' }}>
                <PDFStaffingReportContent 
                    monthlyData={monthlyData}
                    periodText={periodText}
                    sectorText={selectedSector}
                />
            </div>
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
