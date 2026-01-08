// Verificar dados do usuário logado
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekhceddgaxnrhkpxivag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraGNlZGRnYXhucmhrcHhpdmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDU1MDMxMzksImV4cCI6MjAyMTA3OTEzOX0.JAi00zIpygQwqeRzjrm6Tn_Vufsz1q9X6g6uWUzBCQU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarUsuario() {
    const email = 'ns.cucacriativa@gmail.com';
    
    console.log('🔍 Buscando usuário:', email);
    console.log('─'.repeat(50));
    
    // 1. Buscar na tabela usuarios
    const { data: usuario } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .single();
    
    if (!usuario) {
        console.log('❌ Usuário não encontrado na tabela usuarios');
        console.log('📝 Você precisa criar este usuário primeiro!');
        return;
    }
    
    console.log('✅ Usuário encontrado:');
    console.log('   Nome:', usuario.nome);
    console.log('   ID:', usuario.user_id);
    console.log('   Role:', usuario.role || 'user');
    console.log('   Setor:', usuario.setor);
    
    // 2. Verificar pontos
    console.log('\n🕐 Verificando pontos registrados...');
    const { data: pontos, count } = await supabase
        .from('ponto_juju2')
        .select('*', { count: 'exact' })
        .eq('user_id', usuario.user_id);
    
    console.log('   Total de pontos:', count || 0);
    
    if (pontos && pontos.length > 0) {
        console.log('   Últimos registros:');
        pontos.slice(0, 3).forEach(p => {
            console.log(`   - ${p.data_dia} | ${p.turno} | Setor: ${p.setor_id}`);
        });
    }
    
    // 3. Verificar ganhos
    console.log('\n💰 Verificando ganhos...');
    const { data: ganhos } = await supabase
        .from('v_ganhos_mensais_usuario')
        .select('*')
        .eq('user_id', usuario.user_id);
    
    if (ganhos && ganhos.length > 0) {
        console.log('   Ganhos encontrados:');
        ganhos.forEach(g => {
            console.log(`   - ${g.nome_mes}/${g.ano}: R$ ${g.total_ganhos} (${g.total_plantoes} plantões)`);
        });
    } else {
        console.log('   ❌ Nenhum ganho registrado');
        console.log('   💡 Você precisa bater ponto primeiro!');
    }
    
    console.log('\n' + '─'.repeat(50));
}

verificarUsuario();
