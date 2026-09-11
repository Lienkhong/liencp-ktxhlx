export type SyncStatus = 'synced' | 'syncing' | 'saving' | 'offline' | 'error' | 'quota_exceeded';

export interface CloudErrorInfo {
  isQuotaExceeded: boolean;
  message: string;
  code?: string;
  consoleUrl?: string;
  resetInfo?: string;
}

export type WorkerStatus = 'Đang ở' | 'Đã check out' | 'Đã rời KTX';

export interface CheckedOutWorker {
  id: string;
  workerId?: string;
  originalWorkerId?: string;
  name: string;
  dob?: string;
  dorm: number;
  room: number;
  bed?: number;
  teamLeader?: string;
  status?: 'Đã check out';
  empCode: string;
  cccd?: string;
  address?: string;
  phone?: string;
  workplace?: string;
  note?: string;
  entryDate?: string;
  exitDate?: string;
  checkedOutAt: string; // ISO string with date & time for sorting
  checkedOutBy?: string;
  reason: 'Check out khỏi phòng' | 'Đã xóa khỏi KTX' | 'Đã check out';
  operatorName?: string;
  gender?: string;
  hometown?: string;
  issueDate?: string;
  issuePlace?: string;
  cccdFrontImage?: string;
  cccdBackImage?: string;
}

export interface CccdDocumentMeta {
  hasFront: boolean;
  hasBack: boolean;
  storagePath?: string;
  frontUploadedAt?: string;
  backUploadedAt?: string;
  lastAccessedAt?: string;
  lastAccessedBy?: string;
}

export interface Worker {
  id: string;
  name: string;
  dob?: string; // DD/MM/YYYY
  dorm: number; // 1..N
  room: number; // 1..N
  bed?: number; // 1..N
  teamLeader?: string;
  status: WorkerStatus;
  empCode: string;
  cccd?: string;
  address?: string;
  phone?: string;
  workplace?: string;
  note?: string;
  entryDate?: string; // YYYY-MM-DD
  exitDate?: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  gender?: string;
  hometown?: string;
  issueDate?: string;
  issuePlace?: string;
  cccdDocument?: CccdDocumentMeta;
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
  assignedDorms?: number[]; // Scope for managers (e.g. [1, 2, 3])
}

export interface CccdRetentionPolicy {
  enabled: boolean;
  retentionDaysAfterExit: number; // e.g. 30, 90, 365, or 0 = immediate
  autoDeleteExitWorkerPhotos: boolean;
}

export interface DormConfig {
  numDorms: number; // default 8 (1..100)
  roomsPerDorm: number; // default 20 (1..200)
  maxBedsPerRoom: number; // default 30 (1..200)
  enforceBedControl?: boolean;
  enableBedManagement: boolean;
  cccdRetention?: CccdRetentionPolicy;
}

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'IMPORT'
  | 'RESTORE'
  | 'SCALE_CHANGE'
  | 'LOGIN'
  | 'CAPTURE_CCCD'
  | 'UPLOAD_CCCD'
  | 'VIEW_CCCD'
  | 'DOWNLOAD_CCCD'
  | 'DELETE_CCCD'
  | 'UPDATE_CCCD'
  | 'IMPORT_EXCEL'
  | 'EXPORT_EXCEL'
  | 'EXPORT_BACKUP'
  | 'RESTORE_DATA'
  | 'MERGE_DATA'
  | 'SYSTEM_CONFIG'
  | 'UPDATE_PROFILE'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'CHECK_OUT';

export interface AuditItemRecord {
  empCode: string;
  name: string;
  dorm?: number;
  room?: number;
  bed?: number;
  status?: string;
  actionType?: 'Thêm mới' | 'Cập nhật' | 'Xuất file' | 'Xóa' | 'Phục hồi' | 'Ghép' | string;
  phone?: string;
  cccd?: string;
  gender?: string;
  workplace?: string;
  entryDate?: string;
  note?: string;
}

export interface AuditLogOptions {
  empCode?: string;
  targetId?: string;
  status?: 'SUCCESS' | 'FAILED' | 'DENIED';
  fileName?: string;
  scope?: string;
  totalCount?: number;
  items?: AuditItemRecord[];
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userEmail: string;
  action: AuditAction | string;
  details: string;
  targetId?: string;
  empCode?: string;
  role?: UserRole;
  status?: 'SUCCESS' | 'FAILED' | 'DENIED';
  fileName?: string;
  scope?: string;
  totalCount?: number;
  items?: AuditItemRecord[];
  metadata?: Record<string, any>;
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
  gender?: string;
  hometown?: string;
  entryDate?: string;
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

export interface AiAssistantAction {
  actionType: 'FILTER_ROOMS' | 'FILTER_WORKERS' | 'SYSTEM_AUDIT' | 'OPEN_MODAL';
  modal?: 'cccd_scan' | 'duplicate_checker' | 'active_rooms' | 'team_leaders' | 'export_excel' | 'settings';
  targetRooms?: number[];
  targetDorm?: number;
  targetEmpCodes?: string[];
  filterText?: string;
  summary?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  action?: AiAssistantAction;
  diagnostics?: {
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
  };
}

export interface DormAiContext {
  managerName: string;
  totalWorkers: number;
  totalOccupants: number;
  totalExited: number;
  vacantBeds: number;
  totalRooms: number;
  occupiedRoomsCount: number;
  config: DormConfig;
  roomSummaries: {
    dorm: number;
    room: number;
    roomNumber: number; // e.g. 101, 302
    roomName: string;
    capacity: number;
    occupants: number;
    vacant: number;
    status: 'EMPTY' | 'PARTIAL' | 'FULL' | 'OVERLOAD';
    workers: {
      id: string;
      name: string;
      empCode: string;
      gender?: string;
      teamLeader?: string;
      hasCccdImage: boolean;
    }[];
  }[];
  missingCccdWorkers: {
    id: string;
    name: string;
    empCode: string;
    dorm: number;
    room: number;
    hasFront: boolean;
    hasBack: boolean;
  }[];
  duplicateEmpCodes: {
    empCode: string;
    count: number;
    names: string[];
    rooms: string[];
  }[];
  diagnostics: {
    id: string;
    type: 'DUPLICATE_EMP_CODE' | 'ROOM_OVERLOAD' | 'UNASSIGNED_WORKER' | 'MISSING_CCCD' | 'MISSING_INFO' | 'INFO';
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    title: string;
    description: string;
    count: number;
    actionType?: 'FILTER_ROOMS' | 'FILTER_WORKERS' | 'OPEN_MODAL';
    modal?: 'cccd_scan' | 'duplicate_checker' | 'active_rooms' | 'team_leaders' | 'export_excel';
    targetEmpCodes?: string[];
    targetRooms?: number[];
  }[];
  teamLeaders: TeamLeaderSummary[];
}

