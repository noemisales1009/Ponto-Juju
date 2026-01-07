
import { User, ClockRecord, Sector, Shift, AbsenceRecord, BankingInfo } from '../types';
import { SHIFT_PAY_RATE } from '../constants';

interface MockUser extends User {
    password_cleartext: string;
}

// --- Mock Database ---
const users: MockUser[] = [
    { id: 1, name: 'Dra. Ádilla Stefany', email: 'adilla.stefany@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=1' },
    { id: 2, name: 'Dr. André Vinícius Reis Queiroga', email: 'andre.queiroga@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=2' },
    { id: 3, name: 'Dr. Bruno Pereira', email: 'bruno.pereira@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=3' },
    { id: 4, name: 'Dra. Caroline S. Ramos', email: 'caroline@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=4' },
    { id: 5, name: 'Dr. César Casagranda', email: 'cesar.casagranda@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=5' },
    { id: 6, name: 'Dr. Dowver Cruz', email: 'dowver.cruz@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=6' },
    { id: 7, name: 'Dra. Claudia Holanda', email: 'claudia@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=7' },
    { id: 8, name: 'Dra. Fátima Botentuit', email: 'fatima.botentuit@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=8' },
    { id: 9, name: 'Dr. Garyo Pinheiro', email: 'garyo.pinheiro@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=9' },
    { id: 10, name: 'Dra. Ingrid Eliza', email: 'ingrid.eliza@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=10' },
    { id: 11, name: 'Dra. Ilana de Abreu', email: 'ilana.abreu@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=11' },
    { id: 12, name: 'Dra. Jakeline Freitas Lopes', email: 'jakeline@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=12' },
    { id: 13, name: 'Dr. Leandro C Moura Fé', email: 'leandro.moura@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=13' },
    { id: 14, name: 'Dra. Lélia Braga', email: 'lelia.braga@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=14' },
    { id: 15, name: 'Dra. Lorena Arruda', email: 'lorena.arruda@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=15' },
    { id: 16, name: 'Dra. Luciana Chaga', email: 'luciana@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=16' },
    { id: 17, name: 'Dra. Meirielle Moura', email: 'meire@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=17' },
    { id: 18, name: 'Dra. Nara Monteiro', email: 'nara.monteiro@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=18' },
    { id: 19, name: 'Dra. Nayanna Sales', email: 'nayanna.sales@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=19' },
    { id: 20, name: 'Dra. Naiana Castelo', email: 'naiana.castelo@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=20' },
    { id: 21, name: 'Dra. Maria Karolyna', email: 'maria.karolyna@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=21' },
    { id: 22, name: 'Dra. Priscila Viana', email: 'pricila@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=22' },
    { id: 23, name: 'Dra. Raquel Cordeiro', email: 'raquel.rocha@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=23' },
    { id: 24, name: 'Dra. Rhaissa Santos', email: 'rhaissa.santos@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=24' },
    { id: 25, name: 'Dr. Bruno Eufrasio', email: 'bruno.eufrasio@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=25' },
    { id: 26, name: 'Dra. Sinara Marques', email: 'sinara@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=26' },
    { id: 27, name: 'Dr. Victor Marques', email: 'victor.marques@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=27' },
    { id: 28, name: 'Dra. Renata Costa Cavalcante', email: 'renata.cavalcante@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=28' },
    { id: 29, name: 'Dra. Luelma Savana Soares Rocha', email: 'luelma.rocha@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=29' },
    { id: 30, name: 'Dr. Eduardo da Silva Pereira', email: 'eduardo.pereira@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=30' },
    { id: 31, name: 'Dra. Tâmara Aroucha Matos', email: 'tamara.matos@med.pro', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=31' },
    { id: 32, name: 'Noemi Sales', email: 'ncarvalhosales@gmail.com', password_cleartext: 'senha123', photoUrl: 'https://i.pravatar.cc/150?u=32' },
];

let clockRecords: ClockRecord[] = [];
let nextRecordId = 1;

let absenceRecords: AbsenceRecord[] = [];
let nextAbsenceId = 1;

const bankingData: BankingInfo[] = [
    { userId: 1, bank: 'BB', agency: '0242-9', account: '27962-5', cpf: undefined },
    { userId: 2, bank: 'BB', agency: '1611-x', account: '50492-0', cpf: undefined },
    { userId: 3, bank: 'BB', agency: '3650-1', account: '40575-2', cpf: undefined },
    { userId: 4, bank: 'BB', agency: '1414-1', account: '22303-4', cpf: undefined },
    { userId: 5, bank: 'ITAU341', agency: '5431', account: '26279-8', cpf: '465054231-68' },
    { userId: 6, bank: 'BB', agency: '4445-8', account: '7803-4', cpf: undefined },
    { userId: 7, bank: 'BB', agency: '4445-8', account: '7803-4', cpf: undefined }, // Claudia (assuming same as Dowver based on image)
    { userId: 8, bank: 'BB', agency: '5821-1', account: '70173', cpf: '404912503-04' },
    { userId: 9, bank: 'BB', agency: '1414-1', account: '32560-0', cpf: undefined },
    { userId: 10, bank: 'BB', agency: '5716-9', account: '1628-4', cpf: undefined },
    { userId: 11, bank: 'BB', agency: '5821-1', account: '5428-3', cpf: undefined },
    { userId: 12, bank: 'BB', agency: '4323-0', account: '52917-6', cpf: undefined },
    { userId: 13, bank: 'BB', agency: '442', account: '20011-5', cpf: undefined },
    { userId: 14, bank: 'BB', agency: '8618-5', account: '183360-X', cpf: '46678409353' },
    { userId: 15, bank: 'BB', agency: '1087-1', account: '39942-6', cpf: undefined },
    { userId: 16, bank: 'BB', agency: '1639-X', account: '43249-0', cpf: undefined },
    { userId: 17, bank: 'BB', agency: '96-5', account: '869972-0', cpf: undefined },
    { userId: 18, bank: 'BB', agency: '1611-X', account: '136645-9', cpf: '013417023-75' },
    { userId: 19, bank: 'BB', agency: '1833-3', account: '38059-8', cpf: undefined },
    { userId: 20, bank: 'BB', agency: '3650-1', account: '44924-5', cpf: undefined },
    { userId: 21, bank: 'BB', agency: '96-5', account: '67896-1', cpf: undefined },
    { userId: 22, bank: 'BB', agency: '1611-x', account: '38814-9', cpf: undefined },
    { userId: 23, bank: 'BB', agency: '1611-X', account: '113220-2', cpf: '023.750.323-90' },
    { userId: 24, bank: 'BB', agency: '1618-1', account: '70547-0', cpf: undefined },
    { userId: 25, bank: 'BB', agency: '1611-X', account: '34790-6', cpf: '288520603-91' }, // Note: Sebastiana Vieira in image, mapped to Bruno Eufrasio
    { userId: 26, bank: 'BB', agency: '2972-6', account: '44.596-7', cpf: undefined },
    { userId: 27, bank: 'BB', variation: '51', agency: '5016-4', account: '29245-1', cpf: '62341405304' },
    { userId: 28, bank: 'BB', agency: '5789-4', account: '49435-6', cpf: undefined },
    { userId: 29, bank: 'BB', agency: '596-7', account: '15984-6', cpf: undefined },
    { userId: 30, bank: 'BB', agency: '1598-9', account: '37891-7', cpf: undefined },
    { userId: 31, bank: 'BB', agency: '141124-1', account: '', cpf: undefined },
];


// Initialize with some data for demonstration
const today = new Date();
const yesterday = new Date();
yesterday.setDate(today.getDate() - 1);

const addInitialRecord = (userId: number | string, sector: Sector, shift: Shift, date: Date) => {
    const user = users.find(u => u.id === userId);
    if(user) {
        clockRecords.push({
            id: nextRecordId++,
            userId: user.id,
            userName: user.name,
            sector,
            shift,
            date: date.toISOString().split('T')[0],
        });
    }
}

addInitialRecord(1, 'UTI Ped', 'Manhã', today);
addInitialRecord(2, 'UTI Ped', 'Manhã', today);
addInitialRecord(3, 'Semi 2', 'Manhã', today);
addInitialRecord(4, 'Semi 1', 'Manhã', today);
addInitialRecord(5, 'UTI Ped', 'Tarde', yesterday);
addInitialRecord(6, 'Semi 2', 'Noite', yesterday);

// --- Add mock data for November 2025 for demonstration ---
const addRecordForDate = (userId: number | string, dateStr: string, sector: Sector, shift: Shift) => {
    const user = users.find(u => u.id === userId);
    if (user) {
        clockRecords.push({
            id: nextRecordId++,
            userId: user.id,
            userName: user.name,
            sector,
            shift,
            date: dateStr,
        });
    }
};

addRecordForDate(1, '2025-11-05', 'UTI Ped', 'Manhã');
addRecordForDate(2, '2025-11-03', 'UTI Ped', 'Tarde');
addRecordForDate(2, '2025-11-10', 'UTI Ped', 'Tarde');
addRecordForDate(3, '2025-11-10', 'Semi 2', 'Noite');
addRecordForDate(4, '2025-11-12', 'Semi 1', 'Manhã');
addRecordForDate(5, '2025-11-15', 'UTI Ped', 'Manhã');
addRecordForDate(6, '2025-11-20', 'Semi 2', 'Tarde');
addRecordForDate(8, '2025-11-02', 'UTI Ped', 'Manhã');
addRecordForDate(14, '2025-11-21', 'Semi 1', 'Manhã');
addRecordForDate(5, '2025-11-22', 'UTI Ped', 'Tarde');
addRecordForDate(3, '2025-11-28', 'Semi 2', 'Noite');


// --- Mock API Functions ---

export const mockLogin = (email: string, password_cleartext: string): User | undefined => {
  // Case-insensitive and trims whitespace for easier login
  const formattedEmail = email.trim().toLowerCase();
  const user = users.find(u => u.email.toLowerCase() === formattedEmail);

  if (user && user.password_cleartext === password_cleartext.trim()) {
    // Don't expose password to the rest of the app
    const { password_cleartext, ...userClientData } = user;
    return userClientData;
  }
  return undefined;
};

export const getAllUsers = (): User[] => {
    return users.map(({ password_cleartext, ...userClientData }) => userClientData);
};

export const updateUser = (userId: number | string, updates: { name?: string; photoUrl?: string }): User | null => {
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        return null;
    }

    const updatedUser = { ...users[userIndex], ...updates };
    users[userIndex] = updatedUser;

    // Update userName in existing clock records if name was changed
    if (updates.name) {
      clockRecords = clockRecords.map(record => 
        record.userId === userId ? { ...record, userName: updates.name! } : record
      );
      absenceRecords = absenceRecords.map(record =>
        record.userId === userId ? { ...record, userName: updates.name! } : record
      );
    }
    
    const { password_cleartext, ...userClientData } = updatedUser;
    return userClientData;
};


export const getClockRecords = (filters?: { startDate?: string, endDate?: string }): ClockRecord[] => {
  if (!filters || (!filters.startDate && !filters.endDate)) {
    return [...clockRecords];
  }
  
  return clockRecords.filter(record => {
    const recordDate = new Date(record.date);
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;

    if (startDate && recordDate < startDate) return false;
    if (endDate && recordDate > endDate) return false;

    return true;
  });
};

export const getAbsenceRecords = (filters?: { startDate?: string, endDate?: string }): AbsenceRecord[] => {
  if (!filters || (!filters.startDate && !filters.endDate)) {
    return [...absenceRecords];
  }
  
  return absenceRecords.filter(record => {
    const recordDate = new Date(record.date);
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;

    if (startDate && recordDate < startDate) return false;
    if (endDate && recordDate > endDate) return false;

    return true;
  });
};

export const addClockRecord = (record: Omit<ClockRecord, 'id' | 'userName'>): ClockRecord => {
  // Use strict equality check for ID if both are numbers or strings, or loose if one might be string number
  const user = users.find(u => u.id == record.userId);
  if (!user) {
    // If user not found in mock, assume it's a real user ID and proceed with a placeholder name
    // In a real app, we would fetch from Supabase here
    const newRecord: ClockRecord = {
        ...record,
        id: nextRecordId++,
        userName: 'Usuário (Supabase)', 
    };
    clockRecords.push(newRecord);
    return newRecord;
  }
  const newRecord: ClockRecord = {
    ...record,
    id: nextRecordId++,
    userName: user.name,
  };
  clockRecords.push(newRecord);
  return newRecord;
};

export const addAbsenceRecord = (record: Omit<AbsenceRecord, 'id' | 'userName'>): AbsenceRecord => {
  const user = users.find(u => u.id == record.userId);
  if (!user) {
      const newRecord: AbsenceRecord = {
        ...record,
        id: nextAbsenceId++,
        userName: 'Usuário (Supabase)',
      };
      absenceRecords.push(newRecord);
      return newRecord;
  }
  const newRecord: AbsenceRecord = {
    ...record,
    id: nextAbsenceId++,
    userName: user.name,
  };
  absenceRecords.push(newRecord);
  return newRecord;
};

export const deleteClockRecordsByMonthAndSector = (sector: Sector, month: string): number => {
    const initialLength = clockRecords.length;
    clockRecords = clockRecords.filter(record => {
        const recordMonth = record.date.substring(0, 7); // YYYY-MM
        return !(record.sector === sector && recordMonth === month);
    });
    return initialLength - clockRecords.length;
};


export interface FinancialReportRow {
  userId: number | string;
  userName: string;
  totalShifts: number;
  totalToPay: number;
  bankingInfo?: BankingInfo;
}

export const getFinancialReportData = (month: string): FinancialReportRow[] => {
    // month is "YYYY-MM"
    const recordsInMonth = clockRecords.filter(r => r.date.startsWith(month));

    const shiftsByUser = recordsInMonth.reduce((acc, record) => {
        if (!acc[record.userId]) {
            acc[record.userId] = {
                user: users.find(u => u.id === record.userId),
                shifts: 0
            };
        }
        acc[record.userId].shifts++;
        return acc;
    }, {} as Record<string | number, { user?: MockUser, shifts: number }>);
    
    const report: FinancialReportRow[] = Object.entries(shiftsByUser).map(([userId, data]) => {
        // Try to parse as number for mock data compatibility, else keep string
        const userIdNum = !isNaN(Number(userId)) ? Number(userId) : userId;
        return {
            userId: userIdNum,
            userName: data.user?.name || 'Usuário Desconhecido',
            totalShifts: data.shifts,
            totalToPay: data.shifts * SHIFT_PAY_RATE,
            bankingInfo: bankingData.find(b => b.userId == userIdNum)
        };
    });
    
    // Sort by user name
    return report.sort((a, b) => a.userName.localeCompare(b.userName));
};
