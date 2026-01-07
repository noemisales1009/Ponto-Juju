import supabase from './supabaseService';

/**
 * ⚡ REAL-TIME: Listen para mudanças em ponto_juju2
 * Quando um novo ponto é inserido, atualiza em tempo real
 */
export const escutarMudancasPontos = (
  userId: string,
  callback: (ponto: any) => void
) => {
  const subscription = supabase
    .channel(`ponto-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'ponto_juju2',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('🔔 Mudança detectada em ponto:', payload);
        callback(payload.new || payload.old);
      }
    )
    .subscribe((status) => {
      console.log('Status real-time:', status);
    });

  return subscription;
};

/**
 * ⚡ REAL-TIME: Listen para mudanças em falta_medico
 */
export const escutarMudancasFaltas = (
  userId: string,
  callback: (falta: any) => void
) => {
  const subscription = supabase
    .channel(`falta-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'falta_medico',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('🔔 Mudança detectada em falta:', payload);
        callback(payload.new || payload.old);
      }
    )
    .subscribe();

  return subscription;
};

/**
 * ⚡ REAL-TIME: Listen para mudanças em medicos_juju
 */
export const escutarMudancasMedicos = (
  userId: string,
  callback: (medico: any) => void
) => {
  const subscription = supabase
    .channel(`medico-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'medicos_juju',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('🔔 Mudança detectada em médico:', payload);
        callback(payload.new || payload.old);
      }
    )
    .subscribe();

  return subscription;
};

/**
 * ⚡ REAL-TIME: Listen para mudanças em usuarios
 */
export const escutarMudancasUsuarios = (
  userId: string,
  callback: (usuario: any) => void
) => {
  const subscription = supabase
    .channel(`usuario-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'usuarios',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        console.log('🔔 Mudança detectada em usuário:', payload);
        callback(payload.new || payload.old);
      }
    )
    .subscribe();

  return subscription;
};

/**
 * 🛑 Desconectar listener
 */
export const pararDEscutar = (subscription: any) => {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
};

export default {
  escutarMudancasPontos,
  escutarMudancasFaltas,
  escutarMudancasMedicos,
  escutarMudancasUsuarios,
  pararDEscutar,
};
