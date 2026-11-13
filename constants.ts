
import { Sector, SectorConfig, Shift } from './types';

export const SECTOR_CONFIG: Record<Sector, SectorConfig> = {
  'UTI Ped': {
    shifts: ['Manhã', 'Tarde', 'Noite'],
    slots: 4, // Default/Fallback value
  },
  'Semi 2': {
    shifts: ['Manhã', 'Tarde', 'Noite'],
    slots: 1,
  },
  'Semi 1': {
    shifts: ['Manhã'],
    slots: 1,
  },
};

/**
 * Setores temporariamente desativados: aparecem na tela de seleção,
 * mas não podem ser abertos. Remova o setor da lista para reativá-lo.
 */
export const DISABLED_SECTORS: Sector[] = ['Semi 1'];

/**
 * Mapa de setores para seus IDs no banco de dados
 */
export const SECTOR_ID_MAP: Record<Sector, number> = {
  'Semi 1': 1,
  'Semi 2': 2,
  'UTI Ped': 3,
};

/**
 * Mapa de turnos curtos para nomes completos no banco de dados
 * O app usa "Manhã", "Tarde", "Noite"
 * Mas o banco pode ter "Manhã Semana (07h - 13h)", "Tarde Semana (13h - 19h)", etc
 */
export const SHIFT_FULL_NAME_MAP: Record<string, string[]> = {
  'Manhã': [
    'Manhã',
    'Manhã Semana (07h - 13h)',
    'Manhã Final de Semana (07h - 13h)',
  ],
  'Tarde': [
    'Tarde',
    'Tarde Semana (13h - 19h)',
    'Tarde Final de Semana (13h - 19h)',
  ],
  'Noite': [
    'Noite',
    'Noite Semana (19h - 07h)',
    'Noite Final de Semana (19h - 07h)',
    'Quinta noite (19h - 07h)',    // ✅ ADICIONADO
    'Sexta noite (19h - 07h)',     // ✅ ADICIONADO
  ],
};

/**
 * Retorna a quantidade de vagas (slots) para um determinado setor, turno e data.
 * Regras para UTI Ped:
 * - Semana (Seg a Sex): Manhã 5, Tarde 4, Noite 3
 * - Fim de Semana (Sáb, Dom): Manhã 4, Tarde 3, Noite 3
 * - Exceção histórica: até maio/2026 a Quinta à noite exigia 4 plantonistas;
 *   a partir de junho/2026 passou a exigir 3 como os demais dias.
 */
export const getSectorSlots = (sector: Sector, shift: Shift, dateStr: string): number => {
  if (sector !== 'UTI Ped') {
    return SECTOR_CONFIG[sector].slots;
  }

  // Usar T00:00:00 para garantir que o dia da semana seja interpretado corretamente no fuso local
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay(); // 0 = Domingo, 1 = Segunda, ..., 4 = Quinta, 6 = Sábado
  const isWeekend = day === 0 || day === 6;
  const isThursday = day === 4;
  // Quinta à noite exigia 4 plantonistas até maio/2026
  const thursdayNightHas4 = isThursday && date < new Date('2026-06-01T00:00:00');

  if (isWeekend) {
    if (shift === 'Manhã') return 4;
    if (shift === 'Tarde') return 3;
    if (shift === 'Noite') return 3;
  } else {
    // Dias de semana
    if (shift === 'Manhã') return 5;
    if (shift === 'Tarde') return 4;
    if (shift === 'Noite') return thursdayNightHas4 ? 4 : 3;
  }

  return SECTOR_CONFIG[sector].slots;
};

/**
 * Indica se o turno salvo no banco pertence ao turno curto do app.
 * Ex.: "Quinta noite (19h - 07h)" e "Noite Semana (19h - 07h)" pertencem a "Noite".
 */
export const matchesShift = (recordTurno: string | null | undefined, shift: Shift): boolean => {
  if (!recordTurno) return false;
  const variations = SHIFT_FULL_NAME_MAP[shift] || [shift];
  return variations.includes(recordTurno) || recordTurno.toLowerCase().includes(shift.toLowerCase());
};

/** Converte o turno salvo no banco ("Manhã Semana (07h - 13h)") para o nome curto do app ("Manhã"). */
export const getShortShift = (recordTurno: string | null | undefined): Shift | undefined =>
  (Object.keys(SHIFT_FULL_NAME_MAP) as Shift[]).find(shift => matchesShift(recordTurno, shift));

/**
 * Hora de início de cada turno. O ponto só pode ser batido na data de hoje, a partir deste horário.
 * Ao mudar estes valores, mudar também em sql/adicionar_atraso_ponto.sql
 */
export const SHIFT_START_HOUR: Record<Shift, number> = {
  'Manhã': 7,
  'Tarde': 13,
  'Noite': 19,
};

/**
 * Único local onde o ponto pode ser batido: o GPS precisa indicar uma posição dentro do raio.
 * Raio: cerca de 55 m do centro até a borda do hospital + folga para o erro do GPS em ambiente fechado.
 * Ao mudar estes valores, mudar também em sql/adicionar_localizacao_ponto.sql (função registrar_presenca)
 */
export const LOCAL_PONTO = {
  nome: 'Hospital Infantil Dr. Juvêncio Mattos',
  latitude: -2.53614,
  longitude: -44.297487,
  raioMetros: 150,
};

/** Nome do setor a partir do id do banco (setor_juju) */
export const getSectorName = (setorId: number): Sector | undefined =>
  (Object.keys(SECTOR_ID_MAP) as Sector[]).find(sector => SECTOR_ID_MAP[sector] === setorId);

/**
 * PROVISÓRIO (13/11/2026): iPhones não entregavam a localização ao navegador e os médicos ficaram
 * sem bater ponto. Com false, o app tenta ler a localização, mas nunca recusa o ponto por causa
 * dela: sem posição ou fora do raio, o ponto entra marcado como "sem GPS" para o admin
 * (função registrar_presenca_sem_gps, sql/adicionar_ponto_sem_gps.sql). Também some o pedido
 * "Ative o GPS" ao entrar. Para voltar a exigir o GPS, troque para true e publique.
 */
export const GPS_OBRIGATORIO = false;

/**
 * PROVISÓRIO (13/11/2026): o tutorial de novidades diz que o GPS é obrigatório. Fica desligado
 * (não aparece sozinho e o botão "?" some) até a regra do GPS voltar. Troque para true e publique.
 */
export const MOSTRAR_NOVIDADES = false;
