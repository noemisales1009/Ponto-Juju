// Script para testar conexão com Supabase e verificar tabelas
import { createClient } from '@supabase/supabase-js';

// Credenciais via variaveis de ambiente (nunca fixe chaves no codigo).
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... node test-supabase.js
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY antes de executar.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarConexao() {
    console.log('🔍 Testando conexão com Supabase...\n');
    
    // 1. Verificar tabelas
    console.log('1️⃣ Verificando tabela usuarios...');
    const { data: usuarios, error: errUsuarios } = await supabase
        .from('usuarios')
        .select('*')
        .limit(5);
    console.log('Usuários encontrados:', usuarios?.length || 0);
    if (errUsuarios) console.error('❌ Erro:', errUsuarios.message);
    
    // 2. Verificar médicos
    console.log('\n2️⃣ Verificando tabela medicos_juju...');
    const { data: medicos, error: errMedicos } = await supabase
        .from('medicos_juju')
        .select('*')
        .limit(5);
    console.log('Médicos encontrados:', medicos?.length || 0);
    if (errMedicos) console.error('❌ Erro:', errMedicos.message);
    
    // 3. Verificar pontos
    console.log('\n3️⃣ Verificando tabela ponto_juju2...');
    const { data: pontos, error: errPontos } = await supabase
        .from('ponto_juju2')
        .select('*')
        .limit(5);
    console.log('Registros de ponto encontrados:', pontos?.length || 0);
    if (errPontos) console.error('❌ Erro:', errPontos.message);
    
    // 4. Verificar view de ganhos
    console.log('\n4️⃣ Verificando view v_ganhos_mensais_usuario...');
    const { data: ganhos, error: errGanhos } = await supabase
        .from('v_ganhos_mensais_usuario')
        .select('*')
        .limit(5);
    console.log('Registros de ganhos encontrados:', ganhos?.length || 0);
    if (errGanhos) console.error('❌ Erro:', errGanhos.message);
    
    // 5. Verificar setores
    console.log('\n5️⃣ Verificando tabela setor_juju...');
    const { data: setores, error: errSetores } = await supabase
        .from('setor_juju')
        .select('*');
    console.log('Setores encontrados:', setores?.length || 0);
    if (errSetores) console.error('❌ Erro:', errSetores.message);
    
    console.log('\n✅ Teste concluído!');
}

testarConexao();
