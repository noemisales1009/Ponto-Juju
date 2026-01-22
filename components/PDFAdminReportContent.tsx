import React from 'react';

interface MedicoRelatorio {
    user_id: string;
    medico_nome: string;
    cpf: string;
    banco: string;
    agencia: string;
    conta: string;
    ano: number;
    nome_mes: string;
    total_plantao_realizados: number;
    total_faltas: number;
    total_valor_plantao: number;
}

interface PDFAdminReportContentProps {
    reportData: MedicoRelatorio[];
    periodText: string;
}

const PDFAdminReportContent: React.FC<PDFAdminReportContentProps> = ({ reportData, periodText }) => {
    return (
        <div id="pdf-admin-report-content" className="p-8 bg-white text-black font-sans">
            <style>
                {`
                    #pdf-admin-report-content {
                        font-family: 'Inter', sans-serif;
                        box-sizing: border-box;
                    }
                    #pdf-admin-report-content h1 {
                        font-size: 24px;
                        font-weight: 800;
                        margin-bottom: 8px;
                        page-break-after: avoid;
                    }
                    #pdf-admin-report-content h2 {
                        font-size: 16px;
                        font-weight: 500;
                        margin-bottom: 24px;
                        color: #4B5563;
                        page-break-after: avoid;
                    }
                    #pdf-admin-report-content table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 10px;
                    }
                    #pdf-admin-report-content th, #pdf-admin-report-content td {
                        border: 1px solid #E5E7EB;
                        padding: 8px;
                        text-align: left;
                        vertical-align: top;
                    }
                    #pdf-admin-report-content th {
                        background-color: #F9FAFB;
                        font-weight: 600;
                        color: #374151;
                    }
                    #pdf-admin-report-content tbody tr {
                        page-break-inside: avoid;
                    }
                    #pdf-admin-report-content tr:nth-child(even) {
                        background-color: #F9FAFB;
                    }
                `}
            </style>
            <h1>Relatório Administrativo - Plantões e Faturamento</h1>
            <h2>Período: {periodText}</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Médico</th>
                        <th>Banco</th>
                        <th>Agência</th>
                        <th>Conta</th>
                        <th style={{ textAlign: 'center' }}>Plantões</th>
                        <th style={{ textAlign: 'center' }}>Faltas</th>
                        <th style={{ textAlign: 'right' }}>Valor a Pagar</th>
                        <th style={{ textAlign: 'right' }}>Valor com Desconto</th>
                    </tr>
                </thead>
                <tbody>
                    {reportData.map((medico, idx) => {
                        const valorComDesconto = medico.total_valor_plantao - (medico.total_plantao_realizados * 20);
                        return (
                            <tr key={idx}>
                                <td>{medico.medico_nome}</td>
                                <td>{medico.banco || '-'}</td>
                                <td>{medico.agencia || '-'}</td>
                                <td>{medico.conta || '-'}</td>
                                <td style={{ textAlign: 'center' }}>{medico.total_plantao_realizados}</td>
                                <td style={{ textAlign: 'center' }}>{medico.total_faltas}</td>
                                <td style={{ textAlign: 'right' }}>
                                    {medico.total_valor_plantao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    {valorComDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default PDFAdminReportContent;
