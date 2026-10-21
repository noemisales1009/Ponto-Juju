// Verificar médicos dos plantões de novembro
import { createClient } from '@supabase/supabase-js';

// Credenciais via variaveis de ambiente (nunca fixe chaves no codigo).
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... node verificar-medicos-nov.js
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY antes de executar.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarMedicos() {
    const userIds = ['889dc5d6-b06e-4e1a-aab0-75ea4b9b0cfc', 'b25be447-4f54-41d3-b9aa-5b70c05b1e00'];
    
    console.log('🔍 Verificando médicos de novembro/2025...\n');
    
    for (const userId of userIds) {
        console.log(`\n👤 User ID: ${userId}`);
        
        // Ver na tabela usuarios
        const { data: usuario } = await supabase
            .from('usuarios')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (usuario) {
            console.log('   ✅ Usuarios:', usuario.nome);
        } else {
            console.log('   ❌ Não encontrado em usuarios');
        }
        
        // Ver na tabela medicos_juju
        const { data: medico } = await supabase
            .from('medicos_juju')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (medico) {
            console.log('   ✅ Medicos_juju:', medico.medico);
            console.log('      CPF:', medico.cpf || 'não cadastrado');
            console.log('      Banco:', medico.banco || 'não cadastrado');
        } else {
            console.log('   ❌ Não encontrado em medicos_juju (PROBLEMA!)');
        }
    }
}

verificarMedicos();
