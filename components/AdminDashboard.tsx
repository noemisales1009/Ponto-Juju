import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';
import { escapeHtml, csvCell, PRINT_CSP_META } from '../utils/html';
import { FinanceTotalsRow, formatBRL, getValorAPagar, getValorTotal } from '../utils/finance';

interface MedicoRelatorio extends FinanceTotalsRow {
    user_id: string;
    medico_nome: string;
    banco: string;
    agencia: string;
    conta: string;
    ano: number;
    nome_mes: string;
    total_plantao_realizados: number;
    total_faltas: number;
}

interface AdminDashboardProps {
    currentUser: User;
    onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onBack }) => {
    const [relatorio, setRelatorio] = useState<MedicoRelatorio[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // Garante que só a resposta da busca mais recente atualiza a tela
    const latestRequest = useRef(0);

    useEffect(() => {
        fetchRelatorio();
    }, [selectedMonth, selectedYear]);

    // Mapear meses PT->EN (PostgreSQL usa TO_CHAR que retorna em inglês)
    const mesesMap: Record<string, string> = {
        'Janeiro': 'January',
        'Fevereiro': 'February',
        'Março': 'March',
        'Abril': 'April',
        'Maio': 'May',
        'Junho': 'June',
        'Julho': 'July',
        'Agosto': 'August',
        'Setembro': 'September',
        'Outubro': 'October',
        'Novembro': 'November',
        'Dezembro': 'December'
    };

    const fetchRelatorio = async () => {
        const requestId = ++latestRequest.current;
        setLoading(true);
        try {
            let query = supabase
                .from('nova_total_por_medico_mes')
                .select('*');

            // Filtrar por ano
            if (Number.isInteger(selectedYear)) {
                query = query.eq('ano', selectedYear);
            }

            // Filtrar por mês (converter PT->EN e usar ilike com trim)
            if (selectedMonth) {
                const mesIngles = mesesMap[selectedMonth];
                if (mesIngles) {
                    query = query.ilike('nome_mes', `${mesIngles}%`);
                }
            }

            const { data, error } = await query.order('medico_nome', { ascending: true });

            if (requestId !== latestRequest.current) return;

            if (error) {
                console.error('Erro ao buscar relatório:', error);
                alert('Não foi possível carregar o relatório. Tente novamente.');
            } else {
                // Descarta o CPF assim que os dados chegam: esta tela não precisa dele
                setRelatorio((data || []).map(({ cpf: _cpf, ...row }: any) => row as MedicoRelatorio));
            }
        } catch (err) {
            if (requestId !== latestRequest.current) return;
            console.error('Erro geral ao carregar relatório:', err);
        } finally {
            if (requestId === latestRequest.current) setLoading(false);
        }
    };

    const exportarCSV = () => {
        if (relatorio.length === 0) {
            alert('Nenhum dado para exportar');
            return;
        }

        // Cabeçalhos
        const headers = [
            'Médico',
            'Agência',
            'Conta',
            'Mês/Ano',
            'Plantões',
            'Faltas',
            'Total Valor',
            'Valor com Desconto'
        ];

        // Dados
        const rows = relatorio.map(m => {
            return [
                m.medico_nome,
                m.agencia || '',
                m.conta || '',
                `${m.nome_mes}/${m.ano}`,
                m.total_plantao_realizados,
                m.total_faltas,
                formatBRL(getValorTotal(m)),
                formatBRL(getValorAPagar(m))
            ];
        });

        // Montar CSV (csvCell escapa aspas e bloqueia fórmulas de planilha)
        const csv = [
            headers.map(csvCell).join(','),
            ...rows.map(row => row.map(csvCell).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_medicos_${selectedYear}_${selectedMonth}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportarPDF = () => {
        if (relatorio.length === 0) {
            alert('Nenhum dado para exportar');
            return;
        }

        const periodText = selectedMonth 
            ? `${selectedMonth}/${selectedYear}`
            : `Ano ${selectedYear}`;

        // Gerar HTML do PDF diretamente
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            ${PRINT_CSP_META}
            <title>Relatório Administrativo</title>
            <style>
                @page { size: A4 landscape; margin: 20mm 15mm; }
                body {
                    font-family: 'Arial', sans-serif;
                    color: #000;
                    font-size: 14px;
                }
                h1 {
                    font-size: 22px;
                    font-weight: 800;
                    margin-bottom: 6px;
                }
                h2 {
                    font-size: 15px;
                    font-weight: 500;
                    margin-bottom: 20px;
                    color: #4B5563;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 16px;
                    margin-top: 16px;
                }
                th, td {
                    border: 1px solid #E5E7EB;
                    padding: 12px 16px;
                    text-align: left;
                }
                th {
                    background-color: #F3F4F6;
                    font-weight: 700;
                    font-size: 15px;
                    color: #374151;
                    white-space: nowrap;
                }
                tr:nth-child(even) { background-color: #F9FAFB; }
                .text-center { text-align: center; }
                .text-right  { text-align: right; white-space: nowrap; }
            </style>
        </head>
        <body>
            <h1>Relatório Administrativo - Plantões e Faturamento</h1>
            <h2>Período: ${escapeHtml(periodText)}</h2>
            
            <table>
                <thead>
                    <tr>
                        <th>Médico</th>
                        <th>Banco</th>
                        <th>Agência</th>
                        <th>Conta</th>
                        <th class="text-center">Plantões</th>
                        <th class="text-center">Faltas</th>
                        <th class="text-right">Valor a Pagar</th>
                        <th class="text-right">Valor com Desconto</th>
                    </tr>
                </thead>
                <tbody>
                    ${relatorio.map(medico => {
                        return `
                        <tr>
                            <td>${escapeHtml(medico.medico_nome)}</td>
                            <td>${escapeHtml(medico.banco || '-')}</td>
                            <td>${escapeHtml(medico.agencia || '-')}</td>
                            <td>${escapeHtml(medico.conta || '-')}</td>
                            <td class="text-center">${escapeHtml(medico.total_plantao_realizados)}</td>
                            <td class="text-center">${escapeHtml(medico.total_faltas)}</td>
                            <td class="text-right">${formatBRL(getValorTotal(medico))}</td>
                            <td class="text-right">${formatBRL(getValorAPagar(medico))}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </body>
        </html>
        `;

        // Abrir nova janela e imprimir
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    };

    const totalGeral = relatorio.reduce((sum, m) => sum + getValorTotal(m), 0);
    const totalPlantoes = relatorio.reduce((sum, m) => sum + (m.total_plantao_realizados || 0), 0);
    const totalFaltas = relatorio.reduce((sum, m) => sum + (m.total_faltas || 0), 0);

    return (
        <div>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-pmp-text-primary dark:text-white mb-2">
                            Painel Administrativo
                        </h1>
                        <p className="text-pmp-text-secondary dark:text-gray-400">
                            Relatório de Plantões e Faturamento
                        </p>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        ← Voltar
                    </button>
                </div>

                {/* Filtros */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-8">
                    <h2 className="text-lg font-semibold mb-4 text-pmp-text-primary dark:text-white">
                        Filtros
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Ano
                            </label>
                            <input
                                type="number"
                                value={Number.isNaN(selectedYear) ? '' : selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pmp-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Mês
                            </label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-pmp-primary"
                            >
                                <option value="">Todos os meses</option>
                                <option value="Janeiro">Janeiro</option>
                                <option value="Fevereiro">Fevereiro</option>
                                <option value="Março">Março</option>
                                <option value="Abril">Abril</option>
                                <option value="Maio">Maio</option>
                                <option value="Junho">Junho</option>
                                <option value="Julho">Julho</option>
                                <option value="Agosto">Agosto</option>
                                <option value="Setembro">Setembro</option>
                                <option value="Outubro">Outubro</option>
                                <option value="Novembro">Novembro</option>
                                <option value="Dezembro">Dezembro</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={exportarPDF}
                                disabled={loading || relatorio.length === 0}
                                className="w-full px-4 py-2 bg-pmp-primary hover:bg-pmp-primary-dark disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                            >
                                📄 Exportar PDF
                            </button>
                        </div>
                    </div>
                </div>

                {/* Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 rounded-xl p-4">
                        <p className="text-sm text-teal-600 dark:text-teal-400 font-medium">Total Plantões</p>
                        <p className="text-2xl md:text-xl lg:text-2xl font-bold text-teal-900 dark:text-teal-100">{totalPlantoes}</p>
                    </div>

                    <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4">
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">Total Faltas</p>
                        <p className="text-2xl md:text-xl lg:text-2xl font-bold text-red-900 dark:text-red-100">{totalFaltas}</p>
                    </div>

                    <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4">
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium">Faturamento Total</p>
                        <p className="text-lg md:text-sm lg:text-base xl:text-xl font-bold text-green-900 dark:text-green-100 break-words">
                            {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-500/10 border border-slate-200 dark:border-slate-500/30 rounded-xl p-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Médicos Ativos</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{relatorio.length}</p>
                    </div>
                </div>

                {/* Tabela */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400">Carregando dados...</p>
                        </div>
                    ) : relatorio.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-gray-500 dark:text-gray-400">Nenhum registro encontrado</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-700">
                                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                            Médico
                                        </th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                                            Plantões
                                        </th>
                                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                                            Faltas
                                        </th>
                                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                            Total
                                        </th>
                                        <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                                            Com Desconto
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {relatorio.map((medico, idx) => {
                                        return (
                                        <tr
                                            key={idx}
                                            className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                        >
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                                {medico.medico_nome}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-center text-gray-900 dark:text-white">
                                                {medico.total_plantao_realizados}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-center">
                                                <span className="bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300 px-2 py-1 rounded-full text-xs font-semibold">
                                                    {medico.total_faltas}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-right text-gray-600 dark:text-gray-400">
                                                {formatBRL(getValorTotal(medico))}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-right text-green-600 dark:text-green-400">
                                                {formatBRL(getValorAPagar(medico))}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
