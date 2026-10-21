
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import PDFReportContent from './PDFReportContent';
import { getCurrentMonthLocal } from '../utils/date';
import { getValorAPagar, getValorTotal, maskCpf } from '../utils/finance';

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
    totalComDesconto: number;
}

const FinancialReport: React.FC = () => {
    const [reportData, setReportData] = useState<FinancialReportRow[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthLocal());
    const [isLoading, setIsLoading] = useState(true);
    const [isPrinting, setIsPrinting] = useState(false);
    const [showCpf, setShowCpf] = useState(false);

    // Garante que só a resposta da busca mais recente atualiza a tela
    const latestRequest = useRef(0);

    const fetchData = async (monthYear: string) => {
        const requestId = ++latestRequest.current;
        setIsLoading(true);
        try {
            const [year, monthNum] = monthYear.split('-');
            const monthName = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
                .toLocaleString('en-US', { month: 'long' });

            // Usar a view pronta nova_total_por_medico_mes
            const { data, error } = await supabase
                .from('nova_total_por_medico_mes')
                .select('*')
                .eq('ano', parseInt(year))
                .eq('nome_mes', monthName);

            if (requestId !== latestRequest.current) return;

            if (error) {
                console.error('Erro ao buscar dados da view:', error);
                setReportData([]);
                return;
            }

            // Mapear dados da view para o formato do componente
            const mappedData: FinancialReportRow[] = (data || []).map((row: any) => ({
                userId: row.user_id,
                userName: row.medico_nome || `Usuário ${row.user_id?.substring(0, 8)}`,
                bankingInfo: {
                    cpf: row.cpf || null,
                    bank: row.banco || null,
                    agency: row.agencia || null,
                    variation: row.variacao || null,
                    account: row.conta || null
                },
                totalShifts: row.total_plantao_realizados || 0,
                totalToPay: getValorTotal(row),
                totalComDesconto: getValorAPagar(row)
            }));

            setReportData(mappedData);
        } catch (err) {
            if (requestId !== latestRequest.current) return;
            console.error('Erro ao buscar relatório financeiro:', err);
            setReportData([]);
        } finally {
            if (requestId === latestRequest.current) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedMonth);
    }, [selectedMonth]);
    
    const handleSearch = () => {
        fetchData(selectedMonth);
    };

    const handlePrint = () => {
        // As bibliotecas vêm de CDN; se não carregarem, avisa em vez de quebrar
        const jsPDF = (window as any).jspdf?.jsPDF;
        const html2canvas = (window as any).html2canvas;

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
            scale: 2,
            useCORS: true,
            windowWidth: 1200,
        }).then((canvas: HTMLCanvasElement) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            
            const imgWidth = pdfWidth - (margin * 2);
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const pageHeight = pdfHeight - (margin * 2);
            
            let heightLeft = imgHeight;
            let position = 0;

            // Primeira página
            pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Adiciona páginas adicionais se necessário
            while (heightLeft > 0) {
                position = -(imgHeight - heightLeft);
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, position + margin, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`relatorio-financeiro-${selectedMonth}.pdf`);
            setIsPrinting(false);
        }).catch((err: unknown) => {
            console.error("Erro ao gerar PDF:", err);
            alert("Ocorreu um erro ao gerar o PDF.");
            setIsPrinting(false);
        });
    };
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const displayDate = new Date(Date.UTC(year, month - 1, 1));
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
                        <div className="self-end">
                            <label className="flex items-center gap-2 text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showCpf}
                                    onChange={(e) => setShowCpf(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-pmp-primary focus:ring-pmp-primary-light"
                                />
                                Mostrar CPF completo na tela
                            </label>
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-pmp-text-secondary dark:text-dark-pmp-text-secondary">{showCpf ? (row.bankingInfo?.cpf || '-') : maskCpf(row.bankingInfo?.cpf)}</td>
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
