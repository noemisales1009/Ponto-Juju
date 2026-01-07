import React from 'react';
import { Sector, Shift } from '../types';

// Re-using the DailyStatus type definition locally for this component
interface DailyStatus {
    date: string;
    dayOfWeek: string;
    shifts: {
        shiftName: Shift;
        status: 'Completo' | 'Faltando';
        missing: number;
    }[];
}

interface PDFStaffingReportContentProps {
    monthlyData: DailyStatus[];
    periodText: string;
    sectorText: Sector;
}

const PDFStaffingReportContent: React.FC<PDFStaffingReportContentProps> = ({ monthlyData, periodText, sectorText }) => {
    // Determine the columns based on the shifts available for the sector
    const allPossibleShifts: Shift[] = ['Manhã', 'Tarde', 'Noite'];
    const sectorShifts = monthlyData.length > 0 ? monthlyData[0].shifts.map(s => s.shiftName) : [];
    
    const columns = allPossibleShifts.filter(shift => sectorShifts.includes(shift));

    return (
        <div id="pdf-staffing-report-content" className="p-8 bg-white text-black font-sans">
            <style>
                {`
                    #pdf-staffing-report-content {
                        font-family: 'Inter', sans-serif;
                    }
                    #pdf-staffing-report-content h1 {
                        font-size: 24px;
                        font-weight: 800;
                        margin-bottom: 8px;
                    }
                    #pdf-staffing-report-content h2 {
                        font-size: 16px;
                        font-weight: 500;
                        margin-bottom: 24px;
                        color: #4B5563;
                    }
                    #pdf-staffing-report-content table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10px;
                    }
                    #pdf-staffing-report-content th, #pdf-staffing-report-content td {
                        border: 1px solid #E5E7EB;
                        padding: 8px;
                        text-align: left;
                    }
                    #pdf-staffing-report-content th {
                        background-color: #F3F4F6;
                        font-weight: 600;
                        color: #374151;
                    }
                    #pdf-staffing-report-content tr:nth-child(even) {
                        background-color: #F9FAFB;
                    }
                    .status-completo {
                        color: #059669;
                        font-weight: 500;
                    }
                    .status-faltando {
                        color: #D97706;
                        font-weight: 500;
                    }
                `}
            </style>
            <h1>Relatório de Escala</h1>
            <h2>Setor: {sectorText} | Período: {periodText}</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Dia da Semana</th>
                        {columns.map(shift => <th key={shift}>{shift}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {monthlyData.map(day => (
                        <tr key={day.date}>
                            <td>{day.date}</td>
                            <td>{day.dayOfWeek}</td>
                            {columns.map(shiftName => {
                                const shiftData = day.shifts.find(s => s.shiftName === shiftName);
                                if (!shiftData) return <td key={shiftName}>-</td>;

                                return (
                                    <td key={shiftName}>
                                        {shiftData.status === 'Completo' ? (
                                            <span className="status-completo">Completo</span>
                                        ) : (
                                            <span className="status-faltando">Faltando: {shiftData.missing}</span>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PDFStaffingReportContent;
