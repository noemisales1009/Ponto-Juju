// Verificar dados de novembro 2025
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekhceddgaxnrhkpxivag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraGNlZGRnYXhucmhrcHhpdmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDU1MDMxMzksImV4cCI6MjAyMTA3OTEzOX0.JAi00zIpygQwqeRzjrm6Tn_Vufsz1q9X6g6uWUzBCQU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarNovembro() {
    console.log('🔍 Verificando dados de novembro 2025...\n');
    
    const { data: pontos, error } = await supabase
        .from('ponto_juju2')
        .select('*')
        .gte('data_dia', '2025-11-01')
        .lte('data_dia', '2025-11-30');
    
    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }
    
    console.log('Total de registros:', pontos?.length || 0);
    
    if (pontos && pontos.length > 0) {
        console.log('\nPrimeiros 10 registros:');
        pontos.slice(0, 10).forEach(p => {
            console.log(`- ${p.data_dia} | User: ${p.user_id?.substring(0, 8)}... | Turno: ${p.turno} | Valor: R$ ${p.valor_plantao} | Falta: ${p.falta || 'não'}`);
        });
        
        // Agrupar por usuário
        const porUsuario = pontos.reduce((acc, p) => {
            if (!p.falta) {
                if (!acc[p.user_id]) {
                    acc[p.user_id] = { count: 0, total: 0 };
                }
                acc[p.user_id].count++;
                acc[p.user_id].total += parseFloat(p.valor_plantao) || 0;
            }
            return acc;
        }, {});
        
        console.log('\n📊 Resumo por usuário:');
        for (const [userId, stats] of Object.entries(porUsuario)) {
            console.log(`  ${userId.substring(0, 8)}...: ${stats.count} plantões = R$ ${stats.total.toFixed(2)}`);
        }
    } else {
        console.log('⚠️ Nenhum registro encontrado para novembro/2025');
        console.log('💡 Tente fevereiro/2026 onde sabemos que tem dados');
    }
}

verificarNovembro();
