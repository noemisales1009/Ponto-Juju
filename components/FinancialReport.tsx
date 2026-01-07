
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import PDFReportContent from './PDFReportContent';

interface FinancialReportRow {
    userId: string;
    userName: string;
    bankingInfo: {
        cpf: string | null;
        bank: string | null;
        agency: string | null;
        variation: string | null;
        account: string | null;
    };
    totalShifts: number;
    totalToPay: number;
}

const FinancialReport: React.FC = () => {
    const [reportData, setReportData] = useState<FinancialReportRow[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [isLoading, setIsLoading] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);

    const fetchData = async (monthYear: string) => {
        setIsLoading(true);
        try {
            const [year, monthNum] = monthYear.split('-');

            console.log('🔍 Buscando financeiro:', { ano: parseInt(year), mes: parseInt(monthNum) });

            const firstDay = `${year}-${monthNum.padStart(2, '0')}-01`;
            const lastDay = `${year}-${monthNum.padStart(2, '0')}-31`;

            // Buscar pontos do mês
            const { data: pontos, error: pontoError } = await supabase
                .from('ponto_juju2')
                .select('id, data_dia, user_id, falta, valor_plantao')
                .gte('data_dia', firstDay)
                .lte('data_dia', lastDay);

            if (pontoError) {
                console.error('❌ Erro ao buscar pontos:', pontoError);
                setReportData([]);
                setIsLoading(false);
                return;
            }

            // Buscar médicos
            const userIds = [...new Set((pontos || []).map(p => p.user_id))];
            const { data: medicos, error: medicoError } = await supabase
                .from('medicos_juju')
                .select('user_id, medico, cpf, banco, agencia, variacao, conta')
                .in('user_id', userIds);

            if (medicoError) {
                console.error('❌ Erro ao buscar médicos:', medicoError);
                setReportData([]);
                setIsLoading(false);
                return;
            }

            console.log('✅ Pontos:', pontos?.length, 'Médicos:', medicos?.length);

            // Criar mapa de médicos
            const medicoMap = new Map((medicos || []).map(m => [m.user_id, m]));

            // Agrupar por médico
            const grouped = (pontos || []).reduce((acc: any, ponto: any) => {
                const userId = ponto.user_id;
                const medico = medicoMap.get(userId);
                
                if (!acc[userId]) {
                    acc[userId] = {
                        userId: userId,
                        userName: medico?.medico || 'Sem nome',
                        bankingInfo: {
                            cpf: medico?.cpf || null,
                            bank: medico?.banco || null,
                            agency: medico?.agencia || null,
                            variation: medico?.variacao || null,
                            account: medico?.conta || null
                        },
                        totalShifts: 0,
                        totalToPay: 0
                    };
                }
                
                if (!ponto.falta) {
                    acc[userId].totalShifts++;
                    acc[userId].totalToPay += ponto.valor_plantao || 1900;
                }
                
                return acc;
            }, {});

            const mappedData: FinancialReportRow[] = Object.values(grouped);
            setReportData(mappedData);
        } catch (err) {
            console.error('❌ Erro ao buscar relatório financeiro:', err);
            setReportData([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedMonth);
    }, []);
    
    const handleSearch = () => {
        fetchData(selectedMonth);
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

        const input = document.getElementById('pdf-report-content');
        if (!input) {
            alert('Elemento do relatório não encontrado para gerar o PDF.');
            return;
        }
        
        setIsPrinting(true);

        html2canvas(input, {
            scale: 2, // Higher scale for better quality
            useCORS: true,
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); // Portrait orientation
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            const canvasAspectRatio = canvas.height / canvas.width;
            const imgHeight = pdfWidth * canvasAspectRatio;

            let heightLeft = imgHeight;
            let position = 0;

            // Add a margin
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
                    pdf.addImage(imgData, 'PNG', margin, position + margin, contentWidth, imgHeight);
                    heightLeft -= contentHeight;
                }
            }

            pdf.save(`relatorio-financeiro-${selectedMonth}.pdf`);
            setIsPrinting(false);
        }).catch(err => {
            console.error("Erro ao gerar PDF:", err);
            alert("Ocorreu um erro ao gerar o PDF.");
            setIsPrinting(false);
        });
    };
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const displayDate = new Date(year, month - 1, 1);
    const monthName = displayDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    const periodText = `${capitalizedMonth} de ${year}`;

    // Consistent input style
    const inputClass = "mt-1 block w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-pmp-primary focus:ring-2 focus:ring-pmp-primary/20 sm:text-sm py-2.5 px-3 transition-all outline-none";

    return (
        <>
            {/* Hidden component for PDF generation */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm' }}>
              <PDFReportContent reportData={reportData} periodText={periodText} />
            </div>

            <div className="bg-pmp-surface dark:bg-dark-pmp-surface p-6 sm:p-8 rounded-2xl shadow-xl">
                <div className="report-filters">
                    <h1 className="text-3xl font-extrabold text-pmp-text-primary dark:text-dark-pmp-text-primary tracking-tight mb-6">Relatório Financeiro</h1>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 dark:bg-dark-pmp-surface/50 rounded-xl border border-slate-200 dark:border-slate-700/50">
                        <div>
                            <label htmlFor="month" className="block text-sm font-medium text-pmp-text-secondary dark:text-dark-pmp-text-secondary">Mês de Referência</label>
                            <input
                                type="month"
                                id="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className={inputClass}
                            />
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
                                {isPrinting ? 'Gerando PDF...' : 'Gerar PDF'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-dark-pmp-surface/80">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Médico</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">CPF</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Banco</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Agência</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Conta</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Plantões</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-pmp-text-secondary dark:text-dark-pmp-text-secondary uppercase tracking-wider">Valor a Pagar</th>
                            </tr>
                        </thead>
                        <tbody className="bg-pmp-surface dark:bg-dark-pmp-surface divide-y divide-slate-200 dark:divide-slate-700">
                            {reportData.length > 0 ? reportData.map(row => (
                                <tr key={row.userId} className="hover:bg-pmp-primary/5 dark:hover:bg-dark-pmp-primary/10 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-pmp-text-primary dark:text-dark-pmp-text-primary">{row.userName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{row.bankingInfo?.cpf || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{`${row.bankingInfo?.bank || ''}${row.bankingInfo?.variation ? `.${row.bankingInfo.variation}` : ''}`}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{row.bankingInfo?.agency || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{row.bankingInfo?.account || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{row.totalShifts}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-pmp-primary dark:text-dark-pmp-primary-light">{row.totalToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                        {isLoading ? 'Carregando...' : 'Nenhum registro de plantão encontrado para este mês.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

export default FinancialReport;
