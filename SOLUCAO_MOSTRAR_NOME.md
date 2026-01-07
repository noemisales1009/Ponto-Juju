// SOLUÇÃO: Mostrar nome do médico ao bater ponto
// Altere a linha 47 do SectorDashboard.tsx de:
// {hasClockedIn ? 'Ponto Batido' : hasAbsence ? 'Falta Registrada' : 'Bater Ponto'}

// PARA:
// {hasClockedIn ? `✓ ${currentUser.name}` : hasAbsence ? 'Falta Registrada' : 'Bater Ponto'}

// RESULTADO:
// Quando o médico bate ponto, em vez de mostrar "Ponto Batido"
// Vai mostrar: "✓ Dra. Adilla Stefany"

// ============================================
// DADOS QUE ESTÃO APARECENDO SEM REGISTRO:
// ============================================
// Os dados vêm de: mockApi.ts
// Eles são dados DE EXEMPLO (mock data)

// Para ver dados REAIS do Supabase, você precisa:
// 1. Integrar o pontoService.ts com Supabase
// 2. Em vez de usar mockApi, usar:
//    - buscarHistoricoPontos(userId)
//    - registrarPonto(userId, data, turno, setorId)

// ============================================
// EXEMPLO DE INTEGRAÇÃO COM SUPABASE:
// ============================================

import { registrarPonto } from '../services/pontoService';

const handleClockIn = async () => {
    if(isFull) {
        const doctors = [...shiftPresences, ...shiftAbsences].map(r => r.userName).join(', ');
        alert(`Turno completo. Plantonistas/Faltas: ${doctors}`);
        return;
    }
    if(hasClockedIn || hasAbsence) {
        alert('Você já possui um registro (ponto ou falta) neste turno.');
        return;
    }

    // ✅ USAR SUPABASE EM VEZ DE MOCK
    const resultado = await registrarPonto(
        String(currentUser.id),  // userId
        new Date(selectedDate),   // data
        shift,                    // turno (ex: "Manhã Semana")
        1                         // setor_id (ajuste conforme o setor)
    );

    if (resultado.sucesso) {
        onUpdate();
        alert(`Ponto batido com sucesso para ${currentUser.name}!`);
    } else {
        alert(`Erro: ${resultado.erro}`);
    }
};
