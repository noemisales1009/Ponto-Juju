// Debug detalhado dos ganhos
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekhceddgaxnrhkpxivag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraGNlZGRnYXhucmhrcHhpdmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDU1MDMxMzksImV4cCI6MjAyMTA3OTEzOX0.JAi00zIpygQwqeRzjrm6Tn_Vufsz1q9X6g6uWUzBCQU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugGanhos() {
    const userId = '3ba902c2-c29b-434b-a1b5-955d1cc53019'; // ID da Noemi
    
    console.log('🔍 DEBUG: Investigando ganhos de fevereiro/2026');
    console.log('═'.repeat(60));
    
    // 1. Verificar os pontos direto na tabela
    console.log('\n1️⃣ Pontos registrados em fevereiro/2026:');
    const { data: pontos } = await supabase
        .from('ponto_juju2')
        .select('*')
        .eq('user_id', userId)
        .gte('data_dia', '2026-02-01')
        .lte('data_dia', '2026-02-28');
    
    console.log('   Total:', pontos?.length || 0);
    if (pontos && pontos.length > 0) {
        pontos.forEach(p => {
            console.log(`   - ${p.data_dia} | ${p.turno} | Valor: R$ ${p.valor_plantao || 'NULL'} | Falta: ${p.falta || 'não'}`);
        });
    }
    
    // 2. Verificar a view v_ganhos_usuario (detalhada)
    console.log('\n2️⃣ View v_ganhos_usuario (fevereiro/2026):');
    const { data: viewGanhos } = await supabase
        .from('v_ganhos_usuario')
        .select('*')
        .eq('user_id', userId)
        .eq('ano', 2026)
        .eq('mes_numero', 2);
    
    console.log('   Total:', viewGanhos?.length || 0);
    if (viewGanhos && viewGanhos.length > 0) {
        viewGanhos.forEach(g => {
            console.log(`   - ${g.data} | ${g.turno} | Valor: R$ ${g.valor_plantao}`);
        });
    } else {
        console.log('   ⚠️ PROBLEMA: View vazia!');
    }
    
    // 3. Verificar a view agregada v_ganhos_mensais_usuario
    console.log('\n3️⃣ View v_ganhos_mensais_usuario (resumo):');
    const { data: viewMensal } = await supabase
        .from('v_ganhos_mensais_usuario')
        .select('*')
        .eq('user_id', userId)
        .eq('ano', 2026)
        .eq('mes_numero', 2);
    
    if (viewMensal && viewMensal.length > 0) {
        viewMensal.forEach(g => {
            console.log(`   ✅ ${g.nome_mes}/${g.ano}: R$ ${g.total_ganhos} (${g.total_plantoes} plantões)`);
        });
    } else {
        console.log('   ❌ PROBLEMA: View mensal vazia!');
    }
    
    // 4. Teste direto com SQL
    console.log('\n4️⃣ Teste com query SQL direta:');
    const { data: sqlTest, error } = await supabase.rpc('execute_sql', {
        query: `
            SELECT 
                COUNT(*) as total_plantoes,
                SUM(COALESCE(valor_plantao, 0)) as total_ganhos
            FROM ponto_juju2
            WHERE user_id = '${userId}'
                AND EXTRACT(YEAR FROM data_dia) = 2026
                AND EXTRACT(MONTH FROM data_dia) = 2
                AND falta IS NULL
        `
    });
    
    if (error) {
        console.log('   ⚠️ RPC não disponível (isso é normal)');
        
        // Query alternativa manual
        const pontosFev = pontos || [];
        const semFalta = pontosFev.filter(p => !p.falta);
        const totalGanhos = semFalta.reduce((sum, p) => sum + (parseFloat(p.valor_plantao) || 0), 0);
        
        console.log(`   📊 Cálculo manual:`);
        console.log(`      Plantões: ${semFalta.length}`);
        console.log(`      Total: R$ ${totalGanhos.toFixed(2)}`);
    }
    
    console.log('\n' + '═'.repeat(60));
}

debugGanhos();
