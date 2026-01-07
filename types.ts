
export interface User {
  id: number | string;
  name: string;
  email: string;
  photoUrl?: string;
  role?: string;
}

export type Sector = 'UTI Ped' | 'Semi 2' | 'Semi 1';
export type Shift = 'Manhã' | 'Tarde' | 'Noite';
export type View = 'dashboard' | 'reports' | 'earnings' | 'my-records' | 'profile' | 'financial' | 'management' | 'staffing' | 'admin';

export interface ClockRecord {
  id: number | string;
  userId: number | string;
  userName: string;
  sector: Sector;
  shift: Shift;
  date: string; // ISO string date
}

export interface AbsenceRecord {
  id: number | string;
  userId: number | string;
  userName: string;
  sector: Sector;
  shift: Shift;
  date: string; // ISO string date
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
