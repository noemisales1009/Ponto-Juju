// Corrigir o campo falta de false para null
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekhceddgaxnrhkpxivag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraGNlZGRnYXhucmhrcHhpdmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDU1MDMxMzksImV4cCI6MjAyMTA3OTEzOX0.JAi00zIpygQwqeRzjrm6Tn_Vufsz1q9X6g6uWUzBCQU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function corrigirFalta() {
    const userId = '3ba902c2-c29b-434b-a1b5-955d1cc53019';
    
    console.log('🔧 Corrigindo campo "falta" de false para null...');
    
    const { data, error } = await supabase
        .from('ponto_juju2')
        .update({ falta: null })
        .eq('user_id', userId)
        .eq('falta', false)
        .select();
    
    if (error) {
        console.error('❌ Erro:', error.message);
    } else {
        console.log('✅ Corrigido! Registros atualizados:', data?.length || 0);
        if (data) {
            data.forEach(p => {
                console.log(`   - ${p.data_dia} | ${p.turno} | falta agora é: ${p.falta === null ? 'NULL' : p.falta}`);
            });
        }
    }
    
    // Verificar novamente os ganhos
    console.log('\n💰 Verificando ganhos após correção...');
    const { data: ganhos } = await supabase
        .from('v_ganhos_mensais_usuario')
        .select('*')
        .eq('user_id', userId)
        .eq('ano', 2026)
        .eq('mes_numero', 2);
    
    if (ganhos && ganhos.length > 0) {
        console.log('✅ Ganhos agora aparecem:');
        ganhos.forEach(g => {
            console.log(`   ${g.nome_mes}/${g.ano}: R$ ${g.total_ganhos} (${g.total_plantoes} plantões)`);
        });
    } else {
        console.log('⚠️ Ainda não aparece. Pode precisar recarregar a página.');
    }
}

corrigirFalta();
