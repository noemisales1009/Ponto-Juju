
export interface User {
  id: number | string;
  name: string;
  email: string;
  photoUrl?: string;
  role?: string;
}

export type Sector = 'UTI Ped' | 'Semi 2' | 'Semi 1';
export type Shift = 'Manhã' | 'Tarde' | 'Noite';
export type View = 'dashboard' | 'reports' | 'earnings' | 'my-records' | 'profile' | 'financial' | 'management' | 'staffing' | 'admin' | 'absence-distribution';

export interface ClockRecord {
  id: number | string;
  userId: number | string;
  userName: string;
  sector: Sector;
  shift: Shift;
  date: string; // ISO string date
  // Campos vindos direto do banco (ponto_juju2)
  falta?: string | null;
  medico?: string;
  user_id?: number | string;
}

export interface AbsenceRecord {
  id: number | string;
  userId: number | string;
  userName: string;
  sector: Sector;
  shift: Shift;
  date: string; // ISO string date
}

/** Linha da tabela ponto_juju2, com o nome do médico já resolvido pelo app. */
export interface PontoRow {
  id: number;
  user_id: string;
  created_by?: string | null;
  data_dia: string;
  turno: string;
  setor_id: number;
  falta?: string | null;
  medico?: string;
}

export interface SectorConfig {
  shifts: Shift[];
  slots: number;
}

export interface BankingInfo {
  userId: number | string;
  bank: string;
  variation?: string;
  agency: string;
  account: string;
  cpf?: string;
}
