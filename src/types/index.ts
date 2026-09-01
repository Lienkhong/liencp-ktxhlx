export type WorkerStatus = 'Đang ở' | 'Đã rời KTX';

export interface Worker {
  id: string;
  name: string;
  dob: string; // YYYY-MM-DD or DD/MM/YYYY
  dorm: number; // 1..N
  room: number; // 1..N
  bed: number; // 1..N
  teamLeader: string;
  status: WorkerStatus;
  empCode: string;
  cccd: string;
  address: string;
  phone: string;
  workplace: string;
  note: string;
  entryDate: string; // YYYY-MM-DD
  exitDate: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  cccdFrontImage?: string;
  cccdBackImage?: string;
}

export type UserRole = 'admin' | 'manager' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password?: string;
  createdAt: string;
  phone?: string;
}

export interface DormConfig {
  numDorms: number; // default 8 (1..100)
  roomsPerDorm: number; // default 20 (1..200)
  maxBedsPerRoom: number; // default 30 (1..200)
  enforceBedControl?: boolean;
  enableBedManagement: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORE' | 'SCALE_CHANGE' | 'LOGIN';
  details: string;
  targetId?: string;
  empCode?: string;
}

export interface ManagerInfo {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface OCRFrontData {
  cccd?: string;
  name?: string;
  dob?: string;
  gender?: string;
  address?: string;
  hometown?: string;
}

export interface OCRBackData {
  issueDate?: string;
  issuePlace?: string;
  identifyingCharacteristics?: string;
}

export interface ImportPreviewRow {
  stt?: number | string;
  dorm: number;
  room: number;
  bed: number;
  teamLeader: string;
  name: string;
  dob: string;
  empCode: string;
  cccd: string;
  address: string;
  phone: string;
  workplace: string;
  status: WorkerStatus;
  note: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  missingPhone: number;
  duplicateEmpCodes: number;
  duplicateCccds: number;
  rows: ImportPreviewRow[];
}

export interface TeamLeaderSummary {
  name: string;
  totalWorkers: number;
  activeWorkers: number;
  rooms: { dorm: number; room: number; count: number }[];
  workplaces: string[];
  contactPhone?: string;
  primaryDorm?: number;
  primaryRoom?: number;
  leaderWorker?: Worker;
  workers: Worker[];
}

