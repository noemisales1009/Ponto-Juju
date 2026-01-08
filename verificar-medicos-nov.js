// Verificar médicos dos plantões de novembro
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ekhceddgaxnrhkpxivag.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVraGNlZGRnYXhucmhrcHhpdmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDU1MDMxMzksImV4cCI6MjAyMTA3OTEzOX0.JAi00zIpygQwqeRzjrm6Tn_Vufsz1q9X6g6uWUzBCQU';

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
