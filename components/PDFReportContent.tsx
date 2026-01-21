import React from 'react';

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

interface PDFReportContentProps {
    reportData: FinancialReportRow[];
    periodText: string;
}

const PDFReportContent: React.FC<PDFReportContentProps> = ({ reportData, periodText }) => {
    return (
        <div id="pdf-report-content" className="p-8 bg-white text-black font-sans">
            <style>
                {`
                    #pdf-report-content {
                        font-family: 'Inter', sans-serif;
                        box-sizing: border-box;
                    }
                    #pdf-report-content h1 {
                        font-size: 24px;
                        font-weight: 800;
                        margin-bottom: 8px;
                        page-break-after: avoid;
                    }
                    #pdf-report-content h2 {
                        font-size: 16px;
                        font-weight: 500;
                        margin-bottom: 24px;
                        color: #4B5563;
                        page-break-after: avoid;
                    }
                    #pdf-report-content table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10px;
                    }
                    #pdf-report-content th, #pdf-report-content td {
                        border: 1px solid #E5E7EB;
                        padding: 8px;
                        text-align: left;
                        vertical-align: top;
                    }
                    #pdf-report-content th {
                        background-color: #F9FAFB;
                        font-weight: 600;
                        color: #374151;
                    }
                    #pdf-report-content tbody tr {
                        page-break-inside: avoid;
                    }
                    #pdf-report-content tr:nth-child(even) {
                        background-color: #F9FAFB;
                    }
                `}
            </style>
            <h1>Relatório Financeiro de Pagamentos</h1>
            <h2>Mês de Referência: {periodText}</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Médico</th>
                        <th>CPF</th>
                        <th>Banco</th>
                        <th>Agência</th>
                        <th>Conta</th>
                        <th style={{ textAlign: 'center' }}>Plantões</th>
                        <th style={{ textAlign: 'right' }}>Valor a Pagar</th>
                        <th style={{ textAlign: 'right' }}>Valor com Desconto</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.map(row => (
                        <tr key={row.userId}>
                            <td>{row.userName}</td>
                            <td>{row.bankingInfo?.cpf || '-'}</td>
                            <td>{`${row.bankingInfo?.bank || ''}${row.bankingInfo?.variation ? `.${row.bankingInfo.variation}` : ''}`}</td>
                            <td>{row.bankingInfo?.agency || '-'}</td>
                            <td>{row.bankingInfo?.account || '-'}</td>
                            <td style={{ textAlign: 'center' }}>{row.totalShifts}</td>
                            <td style={{ textAlign: 'right' }}>{row.totalToPay.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td style={{ textAlign: 'right' }}>{row.totalComDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default PDFReportContent;
