
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
 * - Semana (Seg, Ter, Qua, Sex): Manhã 5, Tarde 4, Noite 3
 * - Quinta-feira: Manhã 5, Tarde 4, Noite 4 (Exceção)
 * - Fim de Semana (Sáb, Dom): Manhã 4, Tarde 3, Noite 3
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

  if (isWeekend) {
    if (shift === 'Manhã') return 4;
    if (shift === 'Tarde') return 3;
    if (shift === 'Noite') return 3;
  } else {
    // Dias de semana
    if (shift === 'Manhã') return 5;
    if (shift === 'Tarde') return 4;
    if (shift === 'Noite') return isThursday ? 4 : 3;
  }

  return SECTOR_CONFIG[sector].slots;
};

export const SHIFT_PAY_RATE = 500; // Mock value in BRL
