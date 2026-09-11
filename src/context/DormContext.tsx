import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Worker,
  User,
  DormConfig,
  ManagerInfo,
  AuditLog,
  AuditItemRecord,
  AuditLogOptions,
  UserRole,
  WorkerStatus,
  CheckedOutWorker,
  ImportPreviewRow,
  TeamLeaderSummary,
  SyncStatus,
  CloudErrorInfo,
} from '../types';
import {
  INITIAL_CONFIG,
  INITIAL_MANAGER,
  INITIAL_USERS,
  INITIAL_WORKERS,
  INITIAL_AUDIT_LOGS,
} from '../data/initialData';
import { generateId, getTodayStr } from '../utils/helpers';
import { extractRecordsFromBackup } from '../utils/jsonBackup';

// Firebase Firestore Modules (Primary Cloud Real-time Database)
import {
  fetchSyncMetadata,
  touchSyncMetadata,
  fetchChangedWorkers,
  fetchAllWorkersFromFirestore,
  saveWorkerToFirestore,
  deleteWorkerFromFirestore,
  batchUpsertWorkersToFirestore,
  clearAllWorkersFromFirestore,
  fetchCheckedOutHistoryFromFirestore,
  insertCheckedOutRecordToFirestore,
  deleteCheckedOutRecordFromFirestore,
  fetchSystemConfigFromFirestore,
  saveSystemConfigToFirestore,
  fetchManagerInfoFromFirestore,
  saveManagerInfoToFirestore,
  fetchUsersFromFirestore,
  saveUserToFirestore,
  deleteUserFromFirestore,
  fetchAuditLogsFromFirestore,
  insertAuditLogInFirestore,
  SyncMetadata,
  isQuotaCircuitBreakerActive,
  activateQuotaCircuitBreaker,
  resetQuotaCircuitBreaker,
  isQuotaExceededError,
} from '../lib/firestoreService';
import { syncMonitor } from '../lib/syncMonitor';
import {
  saveSecureWorkerDocument,
  getSecureWorkerDocument,
  deleteSecureWorkerDocument,
  testFirestoreConnection,
} from '../lib/firebase';

// Supabase Integration Modules (Optional Secondary / Dual-sync)
import { supabase, isSupabaseConfigured, testSupabaseConnection, isServiceRoleDetected } from '../lib/supabase';
import {
  mapRowToWorker,
  mapWorkerToRow,
  fetchAllWorkersFromSupabase,
  insertWorkerToSupabase,
  updateWorkerInSupabase,
  deleteWorkerFromSupabase,
  deleteWorkerByEmpCodeFromSupabase,
  batchUpsertWorkersToSupabase,
  fetchCheckedOutHistoryFromSupabase,
  insertCheckedOutRecordToSupabase,
  deleteCheckedOutRecordFromSupabase,
  fetchSecureWorkerDocumentFromSupabase,
  saveSecureWorkerDocumentToSupabase,
  deleteSecureWorkerDocumentFromSupabase,
  fetchAppSettingFromSupabase,
  saveAppSettingToSupabase,
  fetchProfilesFromSupabase,
  saveProfileToSupabase,
  deleteProfileFromSupabase,
  fetchAuditLogsFromSupabase,
  insertAuditLogInSupabase,
} from '../lib/supabaseService';

export const SUPABASE_DASHBOARD_URL = 'https://supabase.com/dashboard';
export const FIRESTORE_CONSOLE_URL = 'https://console.firebase.google.com/project/basic-tribute-rt8c4/firestore';

interface DormContextType {
  workers: Worker[];
  config: DormConfig;
  manager: ManagerInfo;
  currentUser: User | null;
  users: User[];
  auditLogs: AuditLog[];
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

  // Real-time Cloud Sync state
  syncStatus: SyncStatus;
  isOnline: boolean;
  lastSyncTime: Date | null;
  cloudErrorInfo: CloudErrorInfo | null;
  forceSyncNow: () => Promise<void>;
  dismissCloudError: () => void;

  // Auth
  login: (email: string, pass: string) => { success: boolean; message: string };
  logout: () => void;
  switchUser: (userIdOrRole: string) => void;

  // Worker Operations (Real-time Cloud Sync)
  addWorker: (
    worker: Partial<Worker>,
    overwriteIfDuplicate?: boolean
  ) => Promise<{ success: boolean; message: string; duplicateWorker?: Worker }>;
  updateWorker: (
    id: string,
    updates: Partial<Omit<Worker, 'id' | 'createdAt' | 'createdBy'>>
  ) => Promise<{ success: boolean; message: string }>;
  deleteWorker: (id: string) => Promise<{ success: boolean; message: string }>;
  deleteWorkerByEmpCode: (empCode: string) => Promise<{ success: boolean; message: string; deletedWorker?: Worker }>;
  getWorkerById: (id: string) => Worker | undefined;
  getWorkerByEmpCode: (empCode: string) => Worker | undefined;

  // Secure CCCD Photo & Document Operations
  canViewCccd: (worker?: Worker) => boolean;
  fetchSecureCccdImages: (workerId: string) => Promise<{ frontImage?: string; backImage?: string } | null>;
  deleteSecureCccdImages: (workerId: string) => Promise<{ success: boolean; message: string }>;
  addAuditLog: (
    action: AuditLog['action'],
    details: string,
    empCodeOrOptions?: string | AuditLogOptions,
    targetId?: string,
    status?: 'SUCCESS' | 'FAILED' | 'DENIED',
    extraOptions?: Partial<AuditLog>
  ) => Promise<void>;

  // Management & Config
  updateManagerInfo: (info: Partial<ManagerInfo>) => Promise<void>;
  updateManager: (info: Partial<ManagerInfo>) => Promise<void>;
  updateConfig: (newConfig: DormConfig) => Promise<{ success: boolean; message: string }>;

  // Import & Export & Backup
  importWorkers: (
    rows: ImportPreviewRow[],
    overwriteDuplicates?: boolean,
    fileName?: string,
    targetDorm?: number
  ) => Promise<{ success: boolean; importedCount: number; updatedCount: number }>;
  backupData: () => any;
  restoreData: (jsonData: any, overwrite?: boolean) => Promise<{ success: boolean; message: string }>;
  mergeJsonData: (jsonList: any[], conflictStrategy: 'keep_existing' | 'overwrite') => Promise<{ success: boolean; addedCount: number; updatedCount: number }>;

  // User Management (Admin only)
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => Promise<{ success: boolean; message: string }>;
  updateUser: (id: string, updates: Partial<User>) => Promise<{ success: boolean; message: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; message: string }>;

  // Reset / Demo
  resetToDemoData: () => Promise<void>;
  clearAllWorkers: () => Promise<void>;

  // Auto-Save on Exit & Backup
  autoSaveJsonOnExit: boolean;
  setAutoSaveJsonOnExit: (val: boolean) => void;
  downloadBackupJson: (customFileName?: string) => void;
  getLatestExitBackup: () => { timestamp: string; workersCount: number; data: any } | null;

  // Helper queries
  getWorkersInRoom: (dorm: number, room: number) => Worker[];
  getOccupiedRoomsCount: () => number;
  getTotalOccupants: () => number;
  getTodayEntriesCount: () => number;
  getTodayExitsCount: () => number;
  getTeamLeadersSummary: () => TeamLeaderSummary[];
  getTeamLeadersCount: () => number;
  updateTeamLeaderPhone: (leaderName: string, phone: string) => Promise<void>;

  // Checked Out & Deleted Workers Archive
  checkedOutWorkers: CheckedOutWorker[];
  getTotalCheckedOutCount: () => number;
  restoreCheckedOutWorker: (
    record: CheckedOutWorker,
    targetDorm?: number,
    targetRoom?: number,
    targetBed?: number
  ) => Promise<{ success: boolean; message: string }>;
  deleteCheckedOutPermanent: (recordId: string) => Promise<{ success: boolean; message: string }>;
}

const DormContext = createContext<DormContextType | null>(null);

const STORAGE_KEYS = {
  WORKERS_CACHE: 'qktx_workers_cache_v2',
  CHECKED_OUT_CACHE: 'qktx_checked_out_archive_v2',
  CONFIG_CACHE: 'qktx_config_cache_v2',
  MANAGER_CACHE: 'qktx_manager_cache_v2',
  USERS_CACHE: 'qktx_users_cache_v2',
  CURRENT_USER: 'qktx_current_user_v2',
  AUDIT_LOGS_CACHE: 'qktx_audit_logs_cache_v2',
  THEME: 'qktx_theme_v2',
  AUTO_SAVE_EXIT: 'qktx_auto_save_json_on_exit_v2',
  EXIT_SNAPSHOT: 'qktx_exit_backup_snapshot_v2',
  LEADER_PHONES: 'qktx_leader_phones_v2',
  LAST_SYNCED_AT: 'qktx_last_synced_at_v2',
  LAST_CLOUD_CHECK: 'qktx_last_cloud_check_v2',
};

const DEFAULT_LEADER_PHONES: Record<string, string> = {
  'phạm minh tuấn': '0988 332 211',
  'hoàng văn nam': '0912 667 889',
  'đỗ hùng dũng': '0903 556 778',
  'vũ trọng phụng': '0977 889 900',
  'trần văn thái': '0933 445 566',
  'nguyễn văn a': '0912 345 678',
};

const safeSetLocalStorage = (key: string, value: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`[LocalStorage] Quota warning for "${key}":`, err?.message || err);
    try {
      localStorage.removeItem(STORAGE_KEYS.EXIT_SNAPSHOT);
      localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS_CACHE);
      localStorage.setItem(key, value);
      return true;
    } catch {
      if (key === STORAGE_KEYS.WORKERS_CACHE) {
        try {
          localStorage.removeItem(STORAGE_KEYS.WORKERS_CACHE);
        } catch {}
      }
    }
    return false;
  }
};

const sanitizeWorkersForCache = (workersList: Worker[]): Worker[] => {
  return workersList.map((w) => {
    if (!w.cccdFrontImage && !w.cccdBackImage) return w;
    return {
      ...w,
      cccdFrontImage: undefined,
      cccdBackImage: undefined,
      cccdDocument: w.cccdDocument || {
        hasFront: Boolean(w.cccdFrontImage),
        hasBack: Boolean(w.cccdBackImage),
        storagePath: `worker-documents/${w.id}/`,
      },
    };
  });
};

export const DormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initial State from Local Storage (Offline-First Instant Load)
  const [workers, setWorkers] = useState<Worker[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.WORKERS_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_WORKERS;
  });

  const [checkedOutRecords, setCheckedOutRecords] = useState<CheckedOutWorker[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CHECKED_OUT_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [config, setConfig] = useState<DormConfig>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CONFIG_CACHE);
      if (cached) return JSON.parse(cached);
    } catch {}
    return INITIAL_CONFIG;
  });

  const [manager, setManager] = useState<ManagerInfo>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.MANAGER_CACHE);
      if (cached) return JSON.parse(cached);
    } catch {}
    return INITIAL_MANAGER;
  });

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.USERS_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (cached) return JSON.parse(cached);
    } catch {}
    return INITIAL_USERS[0] || null;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_AUDIT_LOGS;
  });

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

  const [autoSaveJsonOnExit, setAutoSaveJsonOnExitState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.AUTO_SAVE_EXIT) === 'true';
    } catch {}
    return false;
  });

  const [leaderPhones, setLeaderPhones] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEYS.LEADER_PHONES);
      if (cached) return { ...DEFAULT_LEADER_PHONES, ...JSON.parse(cached) };
    } catch {}
    return DEFAULT_LEADER_PHONES;
  });

  // Cloud Sync States
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [cloudErrorInfo, setCloudErrorInfo] = useState<CloudErrorInfo | null>(null);

  const isInitialLoadDone = useRef(false);

  // Refs to avoid infinite re-render loops in cloud sync callbacks
  const workersRef = useRef(workers);
  workersRef.current = workers;
  const configRef = useRef(config);
  configRef.current = config;
  const managerRef = useRef(manager);
  managerRef.current = manager;

  // Mốc thời gian đồng bộ thành công gần nhất (ISO String)
  const lastSyncIsoRef = useRef<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_SYNCED_AT) || '';
    } catch {
      return '';
    }
  });

  // Kênh phát thông báo đa tab (Cross-Tab Broadcast) giúp các tab khác trên máy cập nhật ngay mà không tốn READ
  const postCrossTabMessage = useCallback((data: any) => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('qktx_sync_channel');
        ch.postMessage({ ...data, timestamp: Date.now() });
        ch.close();
      }
    } catch (e) {
      // Trình duyệt không hỗ trợ hoặc hạn chế sandbox
    }
  }, []);

  // Helper to persist workers cache safely & broadcast to other tabs
  const cacheWorkersLocally = useCallback(
    (list: Worker[]) => {
      try {
        const sanitized = sanitizeWorkersForCache(list);
        safeSetLocalStorage(STORAGE_KEYS.WORKERS_CACHE, JSON.stringify(sanitized));
        postCrossTabMessage({ type: 'WORKERS_UPDATED', workers: sanitized });
      } catch (e) {
        console.warn('Could not cache workers', e);
      }
    },
    [postCrossTabMessage]
  );

  // Theme Sync
  const setTheme = useCallback((newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    safeSetLocalStorage(STORAGE_KEYS.THEME, newTheme);
    if (typeof document !== 'undefined') {
      if (newTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  // Network Status Monitor
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      forceSyncNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ----------------------------------------------------------------------------
  // AUDIT LOGGING HELPER
  // ----------------------------------------------------------------------------
  const addAuditLog = useCallback(
    async (
      action: AuditLog['action'],
      details: string,
      empCodeOrOptions?: string | AuditLogOptions,
      targetId?: string,
      status: 'SUCCESS' | 'FAILED' | 'DENIED' = 'SUCCESS',
      extraOptions?: Partial<AuditLog>
    ) => {
      const nowIso = new Date().toISOString();
      const operatorName = currentUser?.name || manager.name || 'Quản lý';
      const operatorEmail = currentUser?.email || 'manager@qktx.cloud';
      const operatorRole = currentUser?.role || 'manager';

      let empCode: string | undefined;
      let finalTargetId = targetId;
      let finalStatus = status;
      let fileName: string | undefined;
      let scope: string | undefined;
      let totalCount: number | undefined;
      let items: AuditItemRecord[] | undefined;
      let metadata: Record<string, any> | undefined;

      if (typeof empCodeOrOptions === 'object' && empCodeOrOptions !== null) {
        empCode = empCodeOrOptions.empCode;
        finalTargetId = empCodeOrOptions.targetId || targetId;
        finalStatus = empCodeOrOptions.status || status;
        fileName = empCodeOrOptions.fileName;
        scope = empCodeOrOptions.scope;
        totalCount = empCodeOrOptions.totalCount;
        items = empCodeOrOptions.items;
        metadata = empCodeOrOptions.metadata;
      } else {
        empCode = typeof empCodeOrOptions === 'string' ? empCodeOrOptions : undefined;
        if (extraOptions) {
          fileName = extraOptions.fileName;
          scope = extraOptions.scope;
          totalCount = extraOptions.totalCount;
          items = extraOptions.items;
          metadata = extraOptions.metadata;
        }
      }

      const newLog: AuditLog = {
        id: generateId('log'),
        timestamp: nowIso,
        userName: operatorName,
        userEmail: operatorEmail,
        role: operatorRole,
        action,
        details,
        empCode,
        targetId: finalTargetId,
        status: finalStatus,
        fileName,
        scope,
        totalCount: totalCount ?? (items && items.length > 0 ? items.length : undefined),
        items,
        metadata,
      };

      setAuditLogs((prev) => {
        const next = [newLog, ...prev.slice(0, 300)];
        safeSetLocalStorage(STORAGE_KEYS.AUDIT_LOGS_CACHE, JSON.stringify(next));
        return next;
      });

      try {
        await insertAuditLogInFirestore(newLog);
      } catch (e) {
        console.warn('Lỗi ghi audit log vào Firestore:', e);
      }

      if (isSupabaseConfigured) {
        try {
          await insertAuditLogInSupabase(newLog);
        } catch (e) {
          console.warn('Lỗi ghi audit log vào Supabase:', e);
        }
      }
    },
    [currentUser, manager]
  );

  // ----------------------------------------------------------------------------
  // SMART CLOUD SYNC & 2-MINUTE POLLING ARCHITECTURE (MAX 50K READS/DAY)
  // ----------------------------------------------------------------------------
  const smartSyncCheck = useCallback(
    async (isManual = false, forceFull = false) => {
      // 1. Kiểm tra trạng thái mạng trước khi thực hiện bất kỳ lệnh nào
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        setSyncStatus('offline');
        return;
      }

      // 1.1 Kiểm tra Circuit Breaker hạn ngạch Quota Firestore
      if (!isManual && isQuotaCircuitBreakerActive()) {
        setSyncStatus('quota_exceeded');
        setCloudErrorInfo({
          isQuotaExceeded: true,
          message:
            'Hệ thống đang tạm thời đạt hạn ngạch đọc miễn phí hàng ngày của Google Cloud Firestore (Free daily read units per project). Toàn bộ dữ liệu của bạn được lưu an toàn 100% trên bộ nhớ máy tính (Offline-First).',
          consoleUrl: FIRESTORE_CONSOLE_URL,
        });
        return;
      }

      if (isManual) {
        resetQuotaCircuitBreaker();
      }

      // 2. Điều phối đa tab (Cross-Tab Coordination):
      // Nếu không phải bấm nút thủ công, kiểm tra xem có tab nào trong cùng trình duyệt đã check trong vòng 45s qua không
      const nowMs = Date.now();
      if (!isManual && !forceFull) {
        try {
          const lastCloudCheck = Number(localStorage.getItem(STORAGE_KEYS.LAST_CLOUD_CHECK) || '0');
          if (nowMs - lastCloudCheck < 45 * 1000) {
            // Tab khác vừa kiểm tra Cloud trong vòng 45 giây qua! Bỏ qua để tiết kiệm 100% quota
            return;
          }
        } catch {}
      }

      try {
        localStorage.setItem(STORAGE_KEYS.LAST_CLOUD_CHECK, String(nowMs));
      } catch {}

      setSyncStatus('syncing');

      try {
        // 3. Đọc 1 tài liệu metadata duy nhất: TỐN ĐÚNG 1 READ
        const metadata = await fetchSyncMetadata(isManual);
        const localLastSynced =
          typeof lastSyncIsoRef.current === 'function'
            ? (lastSyncIsoRef.current as any)()
            : lastSyncIsoRef.current || localStorage.getItem(STORAGE_KEYS.LAST_SYNCED_AT) || '';
        const nextSyncIsoTime = new Date(Date.now() + 60 * 1000).toLocaleTimeString('vi-VN');

        // Trường hợp A: Metadata chưa tồn tại trên Firestore hoặc gặp Quota Circuit Breaker
        if (!metadata) {
          if (isQuotaCircuitBreakerActive()) {
            setSyncStatus('quota_exceeded');
            setCloudErrorInfo({
              isQuotaExceeded: true,
              message:
                'Hệ thống đạt hạn ngạch đọc miễn phí hàng ngày của Google Cloud Firestore (Free daily read units per project). Dữ liệu của bạn được lưu an toàn 100% trên bộ nhớ máy tính (Offline-First).',
              consoleUrl: FIRESTORE_CONSOLE_URL,
            });
            return;
          }

          const nowIso = new Date().toISOString();
          const initialMeta: SyncMetadata = {
            lastUpdatedAt: nowIso,
            workersUpdatedAt: nowIso,
            configUpdatedAt: nowIso,
            managerUpdatedAt: nowIso,
            usersUpdatedAt: nowIso,
            checkedOutUpdatedAt: nowIso,
            version: 1,
          };
          await touchSyncMetadata(initialMeta);

          // Bootstrap dữ liệu khởi tạo nếu cần
          const cloudWorkers = await fetchAllWorkersFromFirestore(isManual);
          if (cloudWorkers.length > 0) {
            setWorkers(cloudWorkers);
            cacheWorkersLocally(cloudWorkers);
            postCrossTabMessage({ type: 'WORKERS_UPDATED', workers: cloudWorkers });
          } else if (workersRef.current.length > 0) {
            await batchUpsertWorkersToFirestore(workersRef.current);
          } else {
            await batchUpsertWorkersToFirestore(INITIAL_WORKERS);
            setWorkers(INITIAL_WORKERS);
            cacheWorkersLocally(INITIAL_WORKERS);
          }

          lastSyncIsoRef.current = nowIso;
          safeSetLocalStorage(STORAGE_KEYS.LAST_SYNCED_AT, nowIso);
          setSyncStatus('synced');
          setLastSyncTime(new Date());
          setCloudErrorInfo(null);
          syncMonitor.recordSyncEvent({
            lastSyncAt: new Date().toLocaleTimeString('vi-VN'),
            nextSyncAt: nextSyncIsoTime,
            result: 'FULL_SYNCED',
            readsUsed: 1 + (cloudWorkers?.length || 0),
          });
          return;
        }

        const remoteLastUpdated = metadata.lastUpdatedAt || '';

        // Trường hợp B: KHÔNG CÓ BẤT KỲ THAY ĐỔI NÀO TỪ CLOUD (databaseUpdatedAt <= lastSyncedAt)
        // và không yêu cầu Full Sync cưỡng bức
        if (!forceFull && localLastSynced && remoteLastUpdated && remoteLastUpdated <= localLastSynced) {
          // TUYỆT ĐỐI KHÔNG ĐỌC BẤT KỲ COLLECTION NÀO KHÁC!
          // Giữ nguyên 100% cache client. Tốn đúng 1 READ!
          setSyncStatus('synced');
          setLastSyncTime(new Date());
          setCloudErrorInfo(null);
          syncMonitor.recordSyncEvent({
            lastSyncAt: new Date().toLocaleTimeString('vi-VN'),
            nextSyncAt: nextSyncIsoTime,
            result: 'NO_CHANGE',
            readsUsed: 1,
          });
          return;
        }

        // Trường hợp C: PHÁT HIỆN CÓ THAY ĐỔI TỪ MÁY KHÁC / NICK KHÁC (databaseUpdatedAt > lastSyncedAt)
        let readsUsedThisCheck = 1; // 1 read metadata

        // C.1: Đồng bộ công nhân (Chỉ lấy phần thay đổi nếu có thể)
        const workersNeedUpdate =
          forceFull ||
          !localLastSynced ||
          (metadata.workersUpdatedAt && metadata.workersUpdatedAt > localLastSynced);
        if (workersNeedUpdate) {
          if (!forceFull && localLastSynced && workersRef.current.length > 0) {
            // TRUY VẤN DELTA: Chỉ lấy đúng các công nhân được thêm/sửa từ thời điểm localLastSynced
            const changedWorkers = await fetchChangedWorkers(localLastSynced);
            readsUsedThisCheck += changedWorkers.length;

            setWorkers((prev) => {
              let next = [...prev];

              // Xóa các công nhân nếu có trong danh sách deletedWorkerIds của metadata
              if (metadata.deletedWorkerIds && metadata.deletedWorkerIds.length > 0) {
                const delSet = new Set(metadata.deletedWorkerIds);
                next = next.filter((w) => !delSet.has(w.id) && !delSet.has(w.empCode));
              }

              // Cập nhật hoặc chèn công nhân mới
              changedWorkers.forEach((cw) => {
                const idx = next.findIndex(
                  (w) => (w.id && w.id === cw.id) || (w.empCode && w.empCode === cw.empCode)
                );
                if (idx >= 0) {
                  next[idx] = { ...next[idx], ...cw };
                } else {
                  next.unshift(cw);
                }
              });

              cacheWorkersLocally(next);
              postCrossTabMessage({ type: 'WORKERS_UPDATED', workers: next });
              return next;
            });
          } else {
            // Full fetch khi khởi tạo thiết bị mới hoặc forceFull
            const cloudWorkers = await fetchAllWorkersFromFirestore();
            readsUsedThisCheck += cloudWorkers.length;
            if (cloudWorkers.length > 0) {
              setWorkers(cloudWorkers);
              cacheWorkersLocally(cloudWorkers);
              postCrossTabMessage({ type: 'WORKERS_UPDATED', workers: cloudWorkers });
            } else if (workersRef.current.length > 0) {
              await batchUpsertWorkersToFirestore(workersRef.current);
            }
          }
        }

        // C.2: Đồng bộ Cấu hình KTX (Chỉ đọc khi configUpdatedAt > localLastSynced)
        const configNeedsUpdate =
          forceFull ||
          !localLastSynced ||
          (metadata.configUpdatedAt && metadata.configUpdatedAt > localLastSynced);
        if (configNeedsUpdate) {
          const cloudConfig = await fetchSystemConfigFromFirestore();
          readsUsedThisCheck += 1;
          if (cloudConfig) {
            setConfig(cloudConfig);
            safeSetLocalStorage(STORAGE_KEYS.CONFIG_CACHE, JSON.stringify(cloudConfig));
            postCrossTabMessage({ type: 'CONFIG_UPDATED', config: cloudConfig });
          }
        }

        // C.3: Đồng bộ Thông tin Quản lý (Chỉ đọc khi managerUpdatedAt > localLastSynced)
        const managerNeedsUpdate =
          forceFull ||
          !localLastSynced ||
          (metadata.managerUpdatedAt && metadata.managerUpdatedAt > localLastSynced);
        if (managerNeedsUpdate) {
          const cloudManager = await fetchManagerInfoFromFirestore();
          readsUsedThisCheck += 1;
          if (cloudManager) {
            setManager(cloudManager);
            safeSetLocalStorage(STORAGE_KEYS.MANAGER_CACHE, JSON.stringify(cloudManager));
            postCrossTabMessage({ type: 'MANAGER_UPDATED', manager: cloudManager });
          }
        }

        // C.4: Đồng bộ Tài khoản người dùng (Chỉ đọc khi usersUpdatedAt > localLastSynced)
        const usersNeedUpdate =
          forceFull ||
          !localLastSynced ||
          (metadata.usersUpdatedAt && metadata.usersUpdatedAt > localLastSynced);
        if (usersNeedUpdate) {
          const cloudUsers = await fetchUsersFromFirestore();
          readsUsedThisCheck += cloudUsers.length;
          if (cloudUsers.length > 0) {
            setUsers(cloudUsers);
            safeSetLocalStorage(STORAGE_KEYS.USERS_CACHE, JSON.stringify(cloudUsers));
            postCrossTabMessage({ type: 'USERS_UPDATED', users: cloudUsers });
          }
        }

        // C.5: Đồng bộ Hồ sơ Check-out đã lưu trữ
        const checkedOutNeedUpdate =
          forceFull ||
          (metadata.checkedOutUpdatedAt && metadata.checkedOutUpdatedAt > localLastSynced);
        if (checkedOutNeedUpdate) {
          const cloudCheckedOut = await fetchCheckedOutHistoryFromFirestore();
          readsUsedThisCheck += cloudCheckedOut.length;
          if (cloudCheckedOut.length > 0) {
            setCheckedOutRecords(cloudCheckedOut);
            safeSetLocalStorage(STORAGE_KEYS.CHECKED_OUT_CACHE, JSON.stringify(cloudCheckedOut));
          }
        }

        // Cập nhật mốc thời gian đồng bộ thành công mới nhất
        const newSyncIso = remoteLastUpdated || new Date().toISOString();
        lastSyncIsoRef.current = newSyncIso;
        safeSetLocalStorage(STORAGE_KEYS.LAST_SYNCED_AT, newSyncIso);

        setSyncStatus('synced');
        setLastSyncTime(new Date());
        setCloudErrorInfo(null);

        syncMonitor.recordSyncEvent({
          lastSyncAt: new Date().toLocaleTimeString('vi-VN'),
          nextSyncAt: nextSyncIsoTime,
          result: 'DELTA_SYNCED',
          readsUsed: readsUsedThisCheck,
        });
      } catch (err: any) {
        console.warn('Thông báo đồng bộ Firestore (Handled):', err?.message || err);
        const isQuota = isQuotaExceededError(err);
        if (isQuota) {
          activateQuotaCircuitBreaker(60);
        }
        setSyncStatus(isQuota ? 'quota_exceeded' : 'error');
        setCloudErrorInfo({
          isQuotaExceeded: isQuota,
          message: isQuota
            ? 'Hệ thống đạt hạn ngạch đọc miễn phí hàng ngày của Google Cloud Firestore (Free daily read units per project). Dữ liệu của bạn được lưu an toàn 100% trên bộ nhớ máy tính (Offline-First). Bạn có thể xuất file Excel/JSON sao lưu bất kỳ lúc nào.'
            : err?.message || 'Lỗi kết nối đồng bộ Cloud Database',
          consoleUrl: FIRESTORE_CONSOLE_URL,
        });
      }
    },
    [cacheWorkersLocally, postCrossTabMessage]
  );

  // Nút "Đồng bộ ngay" (Manual Sync)
  const forceSyncNow = useCallback(
    async (fullSync = false) => {
      try {
        resetQuotaCircuitBreaker();
        await smartSyncCheck(true, fullSync);
      } catch (e) {
        console.warn('Manual sync notice:', e);
      }
    },
    [smartSyncCheck]
  );

  // Chu kỳ đồng bộ 1 phút (1-Minute Smart Polling Interval with Exponential Backoff & Visibility Control)
  useEffect(() => {
    let isMounted = true;
    let intervalId: any = null;
    let currentDelayMs = 60 * 1000; // 1 phút

    const runCheck = async (isManual = false) => {
      if (!isMounted) return;
      if (!isManual && isQuotaCircuitBreakerActive()) {
        setSyncStatus('quota_exceeded');
        return;
      }
      try {
        await smartSyncCheck(isManual);
        currentDelayMs = 60 * 1000; // Reset về 1 phút khi thành công
      } catch (err: any) {
        if (!isMounted) return;
        // Exponential backoff: 1m -> 2m -> 4m (tối đa 15m) để bảo vệ quota khi có lỗi
        currentDelayMs = Math.min(currentDelayMs * 2, 15 * 60 * 1000);
      }
    };

    // 1. Kiểm tra 1 lần khi ứng dụng mở (Cache-first: chỉ tốn 1 READ nếu cache hợp lệ)
    runCheck(false);

    // 2. Thiết lập chu kỳ 1 phút
    intervalId = setInterval(() => {
      // Chỉ chạy kiểm tra khi tab đang hiển thị và máy đang online
      if (typeof document !== 'undefined' && !document.hidden && navigator.onLine) {
        runCheck(false);
      }
    }, 60 * 1000);

    // 3. Quản lý trạng thái tab (Tab Visibility):
    // Khi người dùng quay lại tab (sau khi làm việc ở tab khác hoặc mở lại app), kiểm tra nếu đã quá 1 phút
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && navigator.onLine) {
        const lastCheck = Number(localStorage.getItem(STORAGE_KEYS.LAST_CLOUD_CHECK) || '0');
        if (Date.now() - lastCheck > 55 * 1000) {
          runCheck(false);
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // 4. Lắng nghe thông điệp Đa Tab qua BroadcastChannel (Đồng bộ tức thì 0 read)
    const channel =
      typeof window !== 'undefined' && 'BroadcastChannel' in window
        ? new BroadcastChannel('qktx_sync_channel')
        : null;

    if (channel) {
      channel.onmessage = (event) => {
        if (!isMounted || !event.data) return;
        const { type, workers, config, manager, users } = event.data;
        if (type === 'WORKERS_UPDATED' && Array.isArray(workers)) {
          setWorkers(workers);
          cacheWorkersLocally(workers);
          setLastSyncTime(new Date());
        } else if (type === 'CONFIG_UPDATED' && config) {
          setConfig(config);
          safeSetLocalStorage(STORAGE_KEYS.CONFIG_CACHE, JSON.stringify(config));
        } else if (type === 'MANAGER_UPDATED' && manager) {
          setManager(manager);
          safeSetLocalStorage(STORAGE_KEYS.MANAGER_CACHE, JSON.stringify(manager));
        } else if (type === 'USERS_UPDATED' && Array.isArray(users)) {
          setUsers(users);
          safeSetLocalStorage(STORAGE_KEYS.USERS_CACHE, JSON.stringify(users));
        }
      };
    }

    // 5. Kênh Supabase phụ (nếu có cấu hình)
    let cleanupSupabase: (() => void) | undefined;
    if (isSupabaseConfigured) {
      const supaChannel = supabase
        .channel('qktx_realtime_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, (payload) => {
          if (!isMounted) return;
          if (payload.eventType === 'INSERT') {
            const newWorker = mapRowToWorker(payload.new);
            setWorkers((prev) => {
              if (prev.some((w) => w.id === newWorker.id)) return prev;
              const next = [newWorker, ...prev];
              cacheWorkersLocally(next);
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedWorker = mapRowToWorker(payload.new);
            setWorkers((prev) => {
              const next = prev.map((w) => (w.id === updatedWorker.id ? { ...w, ...updatedWorker } : w));
              cacheWorkersLocally(next);
              return next;
            });
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any)?.id;
            if (deletedId) {
              setWorkers((prev) => {
                const next = prev.filter((w) => w.id !== deletedId);
                cacheWorkersLocally(next);
                return next;
              });
            }
          }
          setLastSyncTime(new Date());
        })
        .subscribe();

      cleanupSupabase = () => {
        supabase.removeChannel(supaChannel);
      };
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      channel?.close();
      if (cleanupSupabase) cleanupSupabase();
    };
  }, [smartSyncCheck, cacheWorkersLocally]);

  const dismissCloudError = () => {
    setCloudErrorInfo(null);
  };

  // ----------------------------------------------------------------------------
  // AUTH & USER OPERATIONS
  // ----------------------------------------------------------------------------
  const login = (email: string, pass: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const foundUser = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (!foundUser) {
      return { success: false, message: 'Email này chưa được cấp quyền trên hệ thống!' };
    }

    if (foundUser.password && foundUser.password !== pass) {
      return { success: false, message: 'Mật khẩu không chính xác!' };
    }

    setCurrentUser(foundUser);
    safeSetLocalStorage(STORAGE_KEYS.CURRENT_USER, JSON.stringify(foundUser));
    addAuditLog('LOGIN', `Người dùng ${foundUser.name} (${foundUser.email}) đăng nhập hệ thống`);
    return { success: true, message: `Đăng nhập thành công! Chào mừng ${foundUser.name}` };
  };

  const logout = () => {
    if (autoSaveJsonOnExit && workers.length > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      downloadBackupJson(`Sao_Luu_Tu_Dong_Dang_Xuat_KTX_${todayStr}.json`);
    }
    if (currentUser) {
      addAuditLog('LOGIN', `Người dùng ${currentUser.name} đã đăng xuất`);
    }
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  const switchUser = (userIdOrRole: string) => {
    const key = userIdOrRole.trim().toLowerCase();
    const target =
      users.find((u) => u.id === userIdOrRole) ||
      users.find((u) => u.role.toLowerCase() === key) ||
      users.find((u) => u.name.toLowerCase().includes(key)) ||
      users.find((u) => u.email.toLowerCase().includes(key));

    if (target) {
      setCurrentUser(target);
      safeSetLocalStorage(STORAGE_KEYS.CURRENT_USER, JSON.stringify(target));
      addAuditLog('LOGIN', `Chuyển sang tài khoản: ${target.name} (${target.role})`);
    }
  };

  // ----------------------------------------------------------------------------
  // PERMISSIONS
  // ----------------------------------------------------------------------------
  const canViewCccd = useCallback(
    (targetWorker?: Worker) => {
      if (!currentUser) return false;
      const role = currentUser.role;
      if (role === 'admin' || role === 'manager') return true;
      if (role === 'staff' || role === 'security') {
        if (!targetWorker) return true;
        if (!currentUser.assignedDorms || currentUser.assignedDorms.length === 0) return true;
        return currentUser.assignedDorms.includes(targetWorker.dorm);
      }
      return false;
    },
    [currentUser]
  );

  // ----------------------------------------------------------------------------
  // SECURE CCCD & STORAGE OPERATIONS
  // ----------------------------------------------------------------------------
  const fetchSecureCccdImages = useCallback(
    async (workerId: string) => {
      const targetWorker = workers.find((w) => w.id === workerId);
      if (!canViewCccd(targetWorker)) {
        await addAuditLog(
          'VIEW_CCCD',
          `Từ chối xem ảnh CCCD của công nhân (ID: ${workerId}) - Không đủ quyền hạn`,
          targetWorker?.empCode,
          workerId,
          'DENIED'
        );
        return null;
      }

      try {
        // 1. Fetch from Firestore Worker Document
        const fireDoc = await getSecureWorkerDocument(workerId);
        if (fireDoc && (fireDoc.frontImage || fireDoc.backImage)) {
          await addAuditLog(
            'VIEW_CCCD',
            `Xem ảnh CCCD bảo mật của công nhân ${targetWorker?.name || workerId} (Mã: ${targetWorker?.empCode || '-'})`,
            targetWorker?.empCode,
            workerId,
            'SUCCESS'
          );
          return { frontImage: fireDoc.frontImage, backImage: fireDoc.backImage };
        }

        // 2. Fetch from Supabase if configured
        if (isSupabaseConfigured) {
          const docData = await fetchSecureWorkerDocumentFromSupabase(workerId);
          if (docData && (docData.frontImage || docData.backImage)) {
            await addAuditLog(
              'VIEW_CCCD',
              `Xem ảnh CCCD bảo mật của công nhân ${targetWorker?.name || workerId} (Mã: ${targetWorker?.empCode || '-'})`,
              targetWorker?.empCode,
              workerId,
              'SUCCESS'
            );
            return { frontImage: docData.frontImage, backImage: docData.backImage };
          }
        }

        // 3. Fallback to in-memory if available
        if (targetWorker?.cccdFrontImage || targetWorker?.cccdBackImage) {
          await addAuditLog(
            'VIEW_CCCD',
            `Xem ảnh CCCD bảo mật của công nhân ${targetWorker.name}`,
            targetWorker.empCode,
            workerId,
            'SUCCESS'
          );
          return {
            frontImage: targetWorker.cccdFrontImage,
            backImage: targetWorker.cccdBackImage,
          };
        }

        return null;
      } catch (err) {
        console.error('Error in fetchSecureCccdImages:', err);
        return null;
      }
    },
    [workers, canViewCccd, addAuditLog]
  );

  const deleteSecureCccdImages = useCallback(
    async (workerId: string) => {
      const targetWorker = workers.find((w) => w.id === workerId);
      if (!canViewCccd(targetWorker)) {
        await addAuditLog(
          'DELETE_CCCD',
          `Từ chối xóa ảnh CCCD của công nhân ${workerId} - Không đủ quyền`,
          targetWorker?.empCode,
          workerId,
          'DENIED'
        );
        return { success: false, message: 'Bạn không có quyền xóa ảnh CCCD của công nhân này!' };
      }

      // Xóa trong Firestore
      try {
        await deleteSecureWorkerDocument(workerId);
      } catch (e) {
        console.warn('Lỗi xóa CCCD Firestore:', e);
      }

      if (isSupabaseConfigured) {
        await deleteSecureWorkerDocumentFromSupabase(workerId);
      }

      await updateWorker(workerId, {
        cccdFrontImage: '',
        cccdBackImage: '',
        cccdDocument: {
          hasFront: false,
          hasBack: false,
          storagePath: '',
        },
      });

      await addAuditLog(
        'DELETE_CCCD',
        `Xóa an toàn ảnh CCCD khỏi Cloud Storage cho công nhân ${targetWorker?.name || workerId}`,
        targetWorker?.empCode,
        workerId,
        'SUCCESS'
      );
      return { success: true, message: 'Đã xóa an toàn ảnh CCCD khỏi hệ thống lưu trữ bảo mật!' };
    },
    [workers, canViewCccd, addAuditLog]
  );

  // ----------------------------------------------------------------------------
  // WORKER CRUD OPERATIONS
  // ----------------------------------------------------------------------------
  const getWorkerById = (id: string) => workers.find((w) => w.id === id);
  const getWorkerByEmpCode = (empCode: string) => {
    const clean = empCode.trim().toLowerCase();
    return workers.find((w) => w.empCode.trim().toLowerCase() === clean);
  };

  const addWorker = async (workerData: Partial<Worker>, overwriteIfDuplicate = false) => {
    setSyncStatus('saving');

    let cleanEmpCode = workerData.empCode && workerData.empCode.trim() ? workerData.empCode.trim().toUpperCase() : '';
    if (!cleanEmpCode) {
      let candidate = `NV${Math.floor(1000 + Math.random() * 9000)}`;
      while (workers.some((w) => w.empCode.toLowerCase() === candidate.toLowerCase())) {
        candidate = `NV${Math.floor(1000 + Math.random() * 9000)}`;
      }
      cleanEmpCode = candidate;
    }

    const cleanName = workerData.name && workerData.name.trim() ? workerData.name.trim() : 'Công nhân mới';
    const cleanDorm = workerData.dorm && workerData.dorm > 0 ? workerData.dorm : 1;
    const cleanRoom = workerData.room && workerData.room > 0 ? workerData.room : 1;
    const cleanStatus = workerData.status || 'Đang ở';

    const existing = workers.find(
      (w) => w.empCode.trim().toLowerCase() === cleanEmpCode.toLowerCase()
    );

    if (existing && !overwriteIfDuplicate) {
      setSyncStatus('synced');
      return {
        success: false,
        message: `Mã nhân viên "${cleanEmpCode}" đã tồn tại trên hệ thống!`,
        duplicateWorker: existing,
      };
    }

    // Capacity & Bed checks
    let cleanBed = workerData.bed && workerData.bed > 0 ? workerData.bed : 1;
    if (cleanStatus === 'Đang ở') {
      const roomOccupants = workers.filter(
        (w) =>
          w.dorm === cleanDorm &&
          w.room === cleanRoom &&
          w.status === 'Đang ở' &&
          w.id !== existing?.id
      );

      if (roomOccupants.length >= config.maxBedsPerRoom) {
        setSyncStatus('synced');
        return {
          success: false,
          message: `Phòng ${cleanRoom} (Dãy ${cleanDorm}) đã đạt sức chứa tối đa (${config.maxBedsPerRoom} người)!`,
        };
      }

      const bedTaken = roomOccupants.find((w) => w.bed === cleanBed);
      if (bedTaken) {
        const freeBed = Array.from({ length: config.maxBedsPerRoom }, (_, i) => i + 1).find(
          (b) => !roomOccupants.some((w) => w.bed === b)
        );
        if (freeBed) {
          cleanBed = freeBed;
        } else if (config.enforceBedControl) {
          setSyncStatus('synced');
          return {
            success: false,
            message: `Giường số ${cleanBed} tại Phòng ${cleanRoom} (Dãy ${cleanDorm}) đang có công nhân ${bedTaken.name} (${bedTaken.empCode}) ở!`,
          };
        }
      }
    }

    const today = getTodayStr();
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || manager.name || 'Quản lý';

    let entryDate = workerData.entryDate;
    if (cleanStatus === 'Đang ở' && !entryDate) {
      entryDate = today;
    }

    const hasFront = Boolean(workerData.cccdFrontImage);
    const hasBack = Boolean(workerData.cccdBackImage);

    // Case 1: Overwrite existing worker
    if (existing && overwriteIfDuplicate) {
      const updatedWorker: Worker = {
        ...existing,
        ...workerData,
        name: cleanName,
        empCode: cleanEmpCode,
        dorm: cleanDorm,
        room: cleanRoom,
        bed: cleanBed,
        status: cleanStatus,
        entryDate: entryDate || existing.entryDate || today,
        updatedAt: nowIso,
        updatedBy: operatorName,
        cccdFrontImage: workerData.cccdFrontImage || existing.cccdFrontImage,
        cccdBackImage: workerData.cccdBackImage || existing.cccdBackImage,
        cccdDocument: {
          hasFront: hasFront || Boolean(existing.cccdDocument?.hasFront),
          hasBack: hasBack || Boolean(existing.cccdDocument?.hasBack),
          storagePath: `worker-documents/${existing.id}/`,
          frontUploadedAt: hasFront ? nowIso : existing.cccdDocument?.frontUploadedAt || '',
          backUploadedAt: hasBack ? nowIso : existing.cccdDocument?.backUploadedAt || '',
        },
      };

      // Optimistic state & cache
      setWorkers((prev) => {
        const next = prev.map((w) => (w.id === existing.id ? updatedWorker : w));
        cacheWorkersLocally(next);
        return next;
      });

      try {
        // 1. Lưu vào Cloud Firestore
        await saveWorkerToFirestore(updatedWorker);
        if (hasFront || hasBack) {
          await saveSecureWorkerDocument(
            existing.id,
            workerData.cccdFrontImage || existing.cccdFrontImage,
            workerData.cccdBackImage || existing.cccdBackImage,
            operatorName
          );
        }

        // 2. Đồng bộ Supabase nếu có
        if (isSupabaseConfigured) {
          if (hasFront || hasBack) {
            await saveSecureWorkerDocumentToSupabase(
              existing.id,
              workerData.cccdFrontImage || existing.cccdFrontImage,
              workerData.cccdBackImage || existing.cccdBackImage,
              operatorName
            );
          }
          await updateWorkerInSupabase(existing.id, updatedWorker);
        }

        await addAuditLog(
          'UPDATE',
          `Ghi đè thông tin công nhân ${cleanName} (Mã: ${cleanEmpCode}, Dãy ${cleanDorm} - P.${cleanRoom})`,
          cleanEmpCode,
          existing.id
        );
        setSyncStatus('synced');
        setCloudErrorInfo(null);
        setLastSyncTime(new Date());
        return { success: true, message: `Đã ghi đè thành công công nhân: ${cleanName} (${cleanEmpCode})!` };
      } catch (err: any) {
        console.warn('Lỗi lưu worker vào Cloud:', err);
        setSyncStatus('synced');
        return { success: true, message: `Đã lưu công nhân ${cleanName} vào máy (Đang chạy Offline-First).` };
      }
    }

    // Case 2: Insert new worker
    const workerId = generateId('w');
    const newWorker: Worker = {
      id: workerId,
      name: cleanName,
      empCode: cleanEmpCode,
      dorm: cleanDorm,
      room: cleanRoom,
      bed: cleanBed,
      dob: workerData.dob || '',
      teamLeader: workerData.teamLeader || '',
      status: cleanStatus,
      cccd: workerData.cccd || '',
      address: workerData.address || '',
      phone: workerData.phone || '',
      workplace: workerData.workplace || '',
      note: workerData.note || '',
      gender: workerData.gender || 'Nam',
      hometown: workerData.hometown || '',
      issueDate: workerData.issueDate || '',
      issuePlace: workerData.issuePlace || '',
      entryDate: entryDate || '',
      exitDate: cleanStatus === 'Đã check out' ? workerData.exitDate || today : '',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: operatorName,
      updatedBy: operatorName,
      cccdFrontImage: workerData.cccdFrontImage,
      cccdBackImage: workerData.cccdBackImage,
      cccdDocument: {
        hasFront,
        hasBack,
        storagePath: hasFront || hasBack ? `worker-documents/${workerId}/` : '',
        frontUploadedAt: hasFront ? nowIso : '',
        backUploadedAt: hasBack ? nowIso : '',
      },
    };

    // Optimistic UI state & cache
    setWorkers((prev) => {
      const next = [newWorker, ...prev.filter((w) => w.id !== newWorker.id)];
      cacheWorkersLocally(next);
      return next;
    });

    try {
      // 1. Lưu vào Cloud Firestore
      await saveWorkerToFirestore(newWorker);
      if (hasFront || hasBack) {
        await saveSecureWorkerDocument(
          workerId,
          workerData.cccdFrontImage,
          workerData.cccdBackImage,
          operatorName
        );
      }

      // 2. Đồng bộ Supabase nếu có
      if (isSupabaseConfigured) {
        if (hasFront || hasBack) {
          await saveSecureWorkerDocumentToSupabase(
            workerId,
            workerData.cccdFrontImage,
            workerData.cccdBackImage,
            operatorName
          );
        }
        await insertWorkerToSupabase(newWorker);
      }

      await addAuditLog(
        'CREATE',
        `Thêm mới công nhân ${newWorker.name} (Mã: ${newWorker.empCode}, Dãy ${newWorker.dorm} - Phòng ${newWorker.room})`,
        newWorker.empCode,
        newWorker.id
      );
      setSyncStatus('synced');
      setCloudErrorInfo(null);
      setLastSyncTime(new Date());
      return { success: true, message: `Đã lưu công nhân ${newWorker.name} thành công!` };
    } catch (err: any) {
      console.warn('Lỗi ghi công nhân mới lên Cloud:', err);
      setSyncStatus('synced');
      return { success: true, message: `Đã lưu công nhân ${newWorker.name} vào máy an toàn!` };
    }
  };

  const updateWorker = async (
    id: string,
    updates: Partial<Omit<Worker, 'id' | 'createdAt' | 'createdBy'>>
  ) => {
    setSyncStatus('saving');
    const existing = workers.find((w) => w.id === id);
    if (!existing) {
      setSyncStatus('synced');
      return { success: false, message: 'Không tìm thấy thông tin công nhân trên hệ thống!' };
    }

    if (updates.empCode && updates.empCode.trim().toLowerCase() !== existing.empCode.toLowerCase()) {
      const collision = workers.find(
        (w) => w.id !== id && w.empCode.trim().toLowerCase() === updates.empCode!.trim().toLowerCase()
      );
      if (collision) {
        setSyncStatus('synced');
        return {
          success: false,
          message: `Mã nhân viên "${updates.empCode}" đã thuộc về công nhân ${collision.name}!`,
        };
      }
    }

    const targetDorm = updates.dorm !== undefined ? updates.dorm : existing.dorm;
    const targetRoom = updates.room !== undefined ? updates.room : existing.room;
    let targetBed = updates.bed !== undefined ? updates.bed : existing.bed;
    const targetStatus = updates.status !== undefined ? updates.status : existing.status;

    if (targetStatus === 'Đang ở') {
      const otherOccupants = workers.filter(
        (w) => w.id !== id && w.dorm === targetDorm && w.room === targetRoom && w.status === 'Đang ở'
      );
      if (otherOccupants.length >= config.maxBedsPerRoom) {
        setSyncStatus('synced');
        return {
          success: false,
          message: `Phòng ${targetRoom} (Dãy ${targetDorm}) đã đầy sức chứa tối đa (${config.maxBedsPerRoom} người)!`,
        };
      }
      if (config.enforceBedControl && targetBed) {
        const bedCollision = otherOccupants.find((w) => w.bed === targetBed);
        if (bedCollision) {
          const nextFree = Array.from({ length: config.maxBedsPerRoom }, (_, i) => i + 1).find(
            (b) => !otherOccupants.some((w) => w.bed === b)
          );
          if (nextFree) {
            targetBed = nextFree;
          } else {
            setSyncStatus('synced');
            return {
              success: false,
              message: `Giường số ${targetBed} tại Phòng ${targetRoom} đang có công nhân ${bedCollision.name} (${bedCollision.empCode}) ở!`,
            };
          }
        }
      }
    }

    const today = getTodayStr();
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || manager.name || 'Quản lý';

    let newEntryDate = updates.entryDate !== undefined ? updates.entryDate : existing.entryDate;
    let newExitDate = updates.exitDate !== undefined ? updates.exitDate : existing.exitDate;

    if (existing.status !== 'Đang ở' && targetStatus === 'Đang ở') {
      if (!newEntryDate) newEntryDate = today;
      newExitDate = '';
    } else if (existing.status === 'Đang ở' && (targetStatus === 'Đã check out' || (targetStatus as any) === 'Đã rời KTX')) {
      newExitDate = today;
    }

    const hasNewFront = updates.cccdFrontImage !== undefined;
    const hasNewBack = updates.cccdBackImage !== undefined;
    const updatedFront = hasNewFront ? updates.cccdFrontImage : existing.cccdFrontImage;
    const updatedBack = hasNewBack ? updates.cccdBackImage : existing.cccdBackImage;

    const normalizedStatus: WorkerStatus = (targetStatus as any) === 'Đã rời KTX' ? 'Đã check out' : targetStatus;

    const updatedWorker: Worker = {
      ...existing,
      ...updates,
      status: normalizedStatus,
      bed: targetBed,
      entryDate: newEntryDate || '',
      exitDate: newExitDate || '',
      updatedAt: nowIso,
      updatedBy: operatorName,
      cccdFrontImage: updatedFront,
      cccdBackImage: updatedBack,
      cccdDocument: {
        hasFront: Boolean(updatedFront),
        hasBack: Boolean(updatedBack),
        storagePath: updatedFront || updatedBack ? `worker-documents/${id}/` : '',
        frontUploadedAt: hasNewFront && updatedFront ? nowIso : existing.cccdDocument?.frontUploadedAt || '',
        backUploadedAt: hasNewBack && updatedBack ? nowIso : existing.cccdDocument?.backUploadedAt || '',
      },
    };

    setWorkers((prev) => {
      const next = prev.map((w) => (w.id === id ? updatedWorker : w));
      cacheWorkersLocally(next);
      return next;
    });

    try {
      // 1. Lưu cập nhật vào Cloud Firestore
      await saveWorkerToFirestore(updatedWorker);
      if (hasNewFront || hasNewBack) {
        if (updatedFront || updatedBack) {
          await saveSecureWorkerDocument(id, updatedFront, updatedBack, operatorName);
        } else {
          await deleteSecureWorkerDocument(id);
        }
      }

      if (normalizedStatus === 'Đã check out') {
        const coRecord: CheckedOutWorker = {
          id: `co_${id}`,
          originalWorkerId: id,
          workerId: id,
          name: updatedWorker.name,
          empCode: updatedWorker.empCode,
          dorm: updatedWorker.dorm,
          room: updatedWorker.room,
          bed: updatedWorker.bed,
          teamLeader: updatedWorker.teamLeader || '',
          phone: updatedWorker.phone || '',
          cccd: updatedWorker.cccd || '',
          dob: updatedWorker.dob || '',
          gender: updatedWorker.gender || 'Nam',
          hometown: updatedWorker.hometown || '',
          workplace: updatedWorker.workplace || '',
          entryDate: updatedWorker.entryDate || '',
          exitDate: updatedWorker.exitDate || today,
          checkedOutAt: nowIso,
          checkedOutBy: operatorName,
          operatorName,
          reason: 'Check out khỏi phòng',
          note: updatedWorker.note || '',
        };
        await insertCheckedOutRecordToFirestore(coRecord);
        if (isSupabaseConfigured) {
          await insertCheckedOutRecordToSupabase(coRecord);
        }
        setCheckedOutRecords((prev) => [coRecord, ...prev.filter((r) => r.id !== coRecord.id)]);
      }

      // 2. Đồng bộ Supabase nếu có
      if (isSupabaseConfigured) {
        if (hasNewFront || hasNewBack) {
          if (updatedFront || updatedBack) {
            await saveSecureWorkerDocumentToSupabase(id, updatedFront, updatedBack, operatorName);
          } else {
            await deleteSecureWorkerDocumentFromSupabase(id);
          }
        }
        await updateWorkerInSupabase(id, updatedWorker);
      }

      await addAuditLog(
        'UPDATE',
        `Cập nhật công nhân ${updatedWorker.name} (${updatedWorker.empCode}) - Dãy ${updatedWorker.dorm}, P.${updatedWorker.room}`,
        updatedWorker.empCode,
        id
      );

      setSyncStatus('synced');
      setCloudErrorInfo(null);
      setLastSyncTime(new Date());
      return { success: true, message: `Đã cập nhật công nhân ${updatedWorker.name} thành công!` };
    } catch (err: any) {
      console.warn('Lỗi cập nhật Cloud:', err);
      setSyncStatus('synced');
      return { success: true, message: `Đã cập nhật công nhân ${updatedWorker.name} trên máy an toàn!` };
    }
  };

  const deleteWorker = async (id: string) => {
    setSyncStatus('saving');
    const target = workers.find((w) => w.id === id);
    if (!target) {
      setSyncStatus('synced');
      return { success: false, message: 'Không tìm thấy công nhân cần xóa!' };
    }

    const nowIso = new Date().toISOString();
    const today = getTodayStr();
    const operatorName = currentUser?.name || manager.name || 'Quản lý';

    const checkedOutRecord: CheckedOutWorker = {
      id: generateId('co'),
      originalWorkerId: target.id,
      workerId: target.id,
      name: target.name,
      empCode: target.empCode,
      dorm: target.dorm,
      room: target.room,
      bed: target.bed,
      teamLeader: target.teamLeader || '',
      phone: target.phone || '',
      cccd: target.cccd || '',
      dob: target.dob || '',
      gender: target.gender || 'Nam',
      hometown: target.hometown || '',
      workplace: target.workplace || '',
      entryDate: target.entryDate || '',
      exitDate: target.exitDate || today,
      checkedOutAt: nowIso,
      checkedOutBy: operatorName,
      operatorName,
      reason: 'Đã xóa khỏi KTX',
      note: target.note || '',
    };

    // Optimistic update
    setWorkers((prev) => {
      const next = prev.filter((w) => w.id !== id);
      cacheWorkersLocally(next);
      return next;
    });

    setCheckedOutRecords((prev) => [checkedOutRecord, ...prev.filter((r) => r.empCode !== target.empCode)]);

    try {
      // 1. Xóa trong Cloud Firestore & lưu vào hồ sơ check-out Firestore
      await deleteWorkerFromFirestore(id);
      await deleteSecureWorkerDocument(id);
      await insertCheckedOutRecordToFirestore(checkedOutRecord);

      // 2. Đồng bộ Supabase nếu có
      if (isSupabaseConfigured) {
        await deleteSecureWorkerDocumentFromSupabase(id);
        await deleteWorkerFromSupabase(id);
        await insertCheckedOutRecordToSupabase(checkedOutRecord);
      }

      await addAuditLog(
        'DELETE',
        `Xóa và lưu vào danh sách đã check out: ${target.name} (Mã: ${target.empCode}, Dãy ${target.dorm} - Phòng ${target.room})`,
        target.empCode,
        id
      );

      setSyncStatus('synced');
      setCloudErrorInfo(null);
      setLastSyncTime(new Date());
      return { success: true, message: `Đã xóa công nhân ${target.name} (${target.empCode}) và lưu vào danh sách đã check out!` };
    } catch (err: any) {
      console.warn('Lỗi xóa worker trên Cloud:', err);
      setSyncStatus('synced');
      return { success: true, message: `Đã xóa trong bộ nhớ máy an toàn!` };
    }
  };

  const deleteWorkerByEmpCode = async (empCode: string) => {
    setSyncStatus('saving');
    const cleanCode = empCode.trim();
    const target = workers.find(
      (w) => w.empCode.trim().toLowerCase() === cleanCode.toLowerCase()
    );
    if (!target) {
      setSyncStatus('synced');
      return { success: false, message: `Không tìm thấy công nhân có mã "${cleanCode}"!` };
    }

    const res = await deleteWorker(target.id);
    return { ...res, deletedWorker: target };
  };

  // ----------------------------------------------------------------------------
  // CHECK-IN / CHECK-OUT ARCHIVE RESTORE & PURGE
  // ----------------------------------------------------------------------------
  const checkedOutWorkers = useMemo(() => {
    const list: CheckedOutWorker[] = [...checkedOutRecords];
    const seenEmpCodes = new Set(list.map((r) => r.empCode.toLowerCase().trim()));

    workers.forEach((w) => {
      const isOut = w.status === 'Đã check out' || (w.status as any) === 'Đã rời KTX';
      const cleanCode = (w.empCode || '').toLowerCase().trim();
      if (isOut && !seenEmpCodes.has(cleanCode)) {
        seenEmpCodes.add(cleanCode);
        list.push({
          id: `w_co_${w.id}`,
          originalWorkerId: w.id,
          workerId: w.id,
          name: w.name,
          empCode: w.empCode,
          dorm: w.dorm,
          room: w.room,
          bed: w.bed,
          teamLeader: w.teamLeader || '',
          phone: w.phone || '',
          cccd: w.cccd || '',
          dob: w.dob || '',
          gender: w.gender || 'Nam',
          hometown: w.hometown || '',
          workplace: w.workplace || '',
          entryDate: w.entryDate || '',
          exitDate: w.exitDate || getTodayStr(),
          checkedOutAt: w.updatedAt || w.exitDate || new Date().toISOString(),
          checkedOutBy: w.updatedBy || 'Hệ thống',
          operatorName: w.updatedBy || 'Hệ thống',
          reason: 'Check out khỏi phòng',
          note: w.note || '',
        });
      }
    });

    list.sort((a, b) => {
      const timeA = new Date(a.checkedOutAt || a.exitDate || 0).getTime();
      const timeB = new Date(b.checkedOutAt || b.exitDate || 0).getTime();
      return timeB - timeA;
    });

    return list;
  }, [checkedOutRecords, workers]);

  const getTotalCheckedOutCount = useCallback(() => checkedOutWorkers.length, [checkedOutWorkers]);

  const restoreCheckedOutWorker = async (
    record: CheckedOutWorker,
    targetDorm?: number,
    targetRoom?: number,
    targetBed?: number
  ) => {
    const dorm = targetDorm || record.dorm || 1;
    const room = targetRoom || record.room || 1;
    let bed = targetBed || record.bed || 1;

    const roomOccupants = workers.filter(
      (w) => w.dorm === dorm && w.room === room && w.status === 'Đang ở'
    );
    if (roomOccupants.length >= config.maxBedsPerRoom) {
      return {
        success: false,
        message: `Phòng ${room} (Dãy ${dorm}) đã đạt sức chứa tối đa (${config.maxBedsPerRoom} người)!`,
      };
    }

    const bedTaken = roomOccupants.find((w) => w.bed === bed);
    if (bedTaken) {
      const freeBed = Array.from({ length: config.maxBedsPerRoom }, (_, i) => i + 1).find(
        (b) => !roomOccupants.some((w) => w.bed === b)
      );
      if (freeBed) {
        bed = freeBed;
      }
    }

    const restoredWorker: Worker = {
      id: record.workerId || record.originalWorkerId || generateId('w'),
      name: record.name,
      empCode: record.empCode,
      dorm,
      room,
      bed,
      dob: record.dob || '',
      teamLeader: record.teamLeader || '',
      status: 'Đang ở',
      cccd: record.cccd || '',
      address: record.address || '',
      phone: record.phone || '',
      workplace: record.workplace || '',
      note: record.note || `Khôi phục từ hồ sơ check-out ngày ${record.exitDate || ''}`,
      gender: record.gender || 'Nam',
      hometown: record.hometown || '',
      issueDate: record.issueDate || '',
      issuePlace: record.issuePlace || '',
      entryDate: getTodayStr(),
      exitDate: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: currentUser?.name || manager.name || 'Quản lý',
      updatedBy: currentUser?.name || manager.name || 'Quản lý',
    };

    // Remove from checked-out archive
    setCheckedOutRecords((prev) => prev.filter((r) => r.id !== record.id && r.empCode !== record.empCode));
    // Add to active workers
    setWorkers((prev) => {
      const next = [restoredWorker, ...prev.filter((w) => w.empCode !== record.empCode)];
      cacheWorkersLocally(next);
      return next;
    });

    // 1. Lưu lên Cloud Firestore
    try {
      await deleteCheckedOutRecordFromFirestore(record.id);
      await saveWorkerToFirestore(restoredWorker);
    } catch (err) {
      console.warn('Lỗi restore lên Cloud Firestore:', err);
    }

    // 2. Đồng bộ Supabase nếu có
    if (isSupabaseConfigured) {
      try {
        await deleteCheckedOutRecordFromSupabase(record.id);
        await insertWorkerToSupabase(restoredWorker);
      } catch (err) {
        console.warn('Lỗi restore lên Supabase:', err);
      }
    }

    await addAuditLog(
      'UPDATE',
      `Khôi phục công nhân ${record.name} (${record.empCode}) vào Dãy ${dorm} - Phòng ${room} (Giường ${bed})`,
      record.empCode,
      restoredWorker.id
    );

    return {
      success: true,
      message: `Đã khôi phục công nhân ${record.name} vào Dãy ${dorm} - Phòng ${room} thành công!`,
    };
  };

  const deleteCheckedOutPermanent = async (recordId: string) => {
    const target = checkedOutRecords.find((r) => r.id === recordId);
    setCheckedOutRecords((prev) => prev.filter((r) => r.id !== recordId));

    // 1. Xóa vĩnh viễn trên Cloud Firestore
    try {
      await deleteCheckedOutRecordFromFirestore(recordId);
    } catch (err) {
      console.warn('Lỗi xóa vĩnh viễn trên Firestore:', err);
    }

    // 2. Đồng bộ Supabase nếu có
    if (isSupabaseConfigured) {
      try {
        await deleteCheckedOutRecordFromSupabase(recordId);
      } catch (err) {
        console.warn('Lỗi xóa vĩnh viễn trên Supabase:', err);
      }
    }

    if (target) {
      await addAuditLog(
        'DELETE',
        `Xóa vĩnh viễn hồ sơ đã check out: ${target.name} (${target.empCode})`,
        target.empCode,
        recordId
      );
    }

    return { success: true, message: 'Đã xóa vĩnh viễn bản ghi khỏi lịch sử!' };
  };

  // ----------------------------------------------------------------------------
  // SYSTEM CONFIG & MANAGER INFO
  // ----------------------------------------------------------------------------
  const updateConfig = async (newConfig: DormConfig) => {
    setConfig(newConfig);
    safeSetLocalStorage(STORAGE_KEYS.CONFIG_CACHE, JSON.stringify(newConfig));

    try {
      await saveSystemConfigToFirestore(newConfig);
    } catch (e) {
      console.warn('Lỗi lưu cấu hình Firestore:', e);
    }

    if (isSupabaseConfigured) {
      await saveAppSettingToSupabase('system_config', newConfig, currentUser?.name || manager.name);
    }

    await addAuditLog('SYSTEM_CONFIG', `Cập nhật cấu hình hệ thống KTX (${newConfig.numDorms} dãy, ${newConfig.roomsPerDorm} phòng/dãy)`);
    return { success: true, message: 'Cập nhật cấu hình KTX thành công!' };
  };

  const updateManagerInfo = async (info: Partial<ManagerInfo>) => {
    const updated = { ...manager, ...info };
    setManager(updated);
    safeSetLocalStorage(STORAGE_KEYS.MANAGER_CACHE, JSON.stringify(updated));

    try {
      await saveManagerInfoToFirestore(updated);
    } catch (e) {
      console.warn('Lỗi lưu thông tin quản lý Firestore:', e);
    }

    if (isSupabaseConfigured) {
      await saveAppSettingToSupabase('manager_info', updated, currentUser?.name || manager.name);
    }

    await addAuditLog('UPDATE_PROFILE', `Cập nhật thông tin Ban quản lý KTX (${updated.name})`);
  };

  const updateManager = updateManagerInfo;

  // ----------------------------------------------------------------------------
  // USER MANAGEMENT
  // ----------------------------------------------------------------------------
  const addUser = async (userData: Omit<User, 'id' | 'createdAt'>) => {
    const newUser: User = {
      ...userData,
      id: generateId('u'),
      createdAt: new Date().toISOString(),
    };
    const nextUsers = [...users, newUser];
    setUsers(nextUsers);
    safeSetLocalStorage(STORAGE_KEYS.USERS_CACHE, JSON.stringify(nextUsers));

    try {
      await saveUserToFirestore(newUser);
    } catch (e) {
      console.warn('Lỗi lưu user Firestore:', e);
    }

    if (isSupabaseConfigured) {
      await saveProfileToSupabase(newUser);
    }

    await addAuditLog('CREATE_USER', `Tạo tài khoản mới: ${newUser.name} (${newUser.email} - Vai trò: ${newUser.role})`);
    return { success: true, message: `Đã tạo tài khoản cho ${newUser.name} thành công!` };
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'Không tìm thấy tài khoản!' };

    const updatedUser = { ...target, ...updates };
    const nextUsers = users.map((u) => (u.id === id ? updatedUser : u));
    setUsers(nextUsers);
    safeSetLocalStorage(STORAGE_KEYS.USERS_CACHE, JSON.stringify(nextUsers));

    if (currentUser?.id === id) {
      setCurrentUser(updatedUser);
      safeSetLocalStorage(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    }

    try {
      await saveUserToFirestore(updatedUser);
    } catch (e) {
      console.warn('Lỗi cập nhật user Firestore:', e);
    }

    if (isSupabaseConfigured) {
      await saveProfileToSupabase(updatedUser);
    }

    await addAuditLog('UPDATE_USER', `Cập nhật tài khoản: ${updatedUser.name} (${updatedUser.role})`);
    return { success: true, message: `Cập nhật tài khoản ${updatedUser.name} thành công!` };
  };

  const deleteUser = async (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'Không tìm thấy người dùng!' };

    if (users.length <= 1) {
      return { success: false, message: 'Không thể xóa tài khoản quản trị duy nhất còn lại!' };
    }

    const nextUsers = users.filter((u) => u.id !== id);
    setUsers(nextUsers);
    safeSetLocalStorage(STORAGE_KEYS.USERS_CACHE, JSON.stringify(nextUsers));

    try {
      await deleteUserFromFirestore(id);
    } catch (e) {
      console.warn('Lỗi xóa user Firestore:', e);
    }

    if (isSupabaseConfigured) {
      await deleteProfileFromSupabase(id);
    }

    await addAuditLog('DELETE_USER', `Xóa tài khoản người dùng: ${target.name} (${target.email})`);
    return { success: true, message: `Đã xóa tài khoản ${target.name} thành công!` };
  };

  // ----------------------------------------------------------------------------
  // IMPORT & EXPORT & BACKUP
  // ----------------------------------------------------------------------------
  const importWorkers = async (
    rows: ImportPreviewRow[],
    overwriteDuplicates = false,
    fileName?: string,
    targetDorm?: number
  ) => {
    let imported = 0;
    let updated = 0;
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || manager.name || 'Quản lý';
    const newWorkersList: Worker[] = [];
    const importItems: AuditItemRecord[] = [];

    const existingMap = new Map<string, Worker>();
    workers.forEach((w) => existingMap.set(w.empCode.toLowerCase().trim(), w));

    rows.forEach((row) => {
      const code = row.empCode.toLowerCase().trim();
      const existing = existingMap.get(code);

      if (existing) {
        if (overwriteDuplicates) {
          const up: Worker = {
            ...existing,
            name: row.name || existing.name,
            dob: row.dob || existing.dob,
            dorm: row.dorm || existing.dorm,
            room: row.room || existing.room,
            bed: row.bed || existing.bed,
            teamLeader: row.teamLeader || existing.teamLeader,
            status: row.status || existing.status,
            cccd: row.cccd || existing.cccd,
            address: row.address || existing.address,
            phone: row.phone || existing.phone,
            workplace: row.workplace || existing.workplace,
            gender: row.gender || existing.gender,
            hometown: row.hometown || existing.hometown,
            entryDate: row.entryDate || existing.entryDate,
            updatedAt: nowIso,
            updatedBy: operatorName,
          };
          newWorkersList.push(up);
          importItems.push({
            empCode: up.empCode,
            name: up.name,
            dorm: up.dorm,
            room: up.room,
            bed: up.bed,
            status: up.status,
            actionType: 'Cập nhật',
            phone: up.phone,
            cccd: up.cccd,
            workplace: up.workplace,
            gender: up.gender,
            entryDate: up.entryDate,
          });
          updated++;
        }
      } else {
        const nw: Worker = {
          id: generateId('w'),
          name: row.name,
          empCode: row.empCode.toUpperCase().trim(),
          dorm: row.dorm || 1,
          room: row.room || 1,
          bed: row.bed || 1,
          dob: row.dob || '',
          teamLeader: row.teamLeader || '',
          status: row.status || 'Đang ở',
          cccd: row.cccd || '',
          address: row.address || '',
          phone: row.phone || '',
          workplace: row.workplace || '',
          note: row.note || '',
          gender: row.gender || 'Nam',
          hometown: row.hometown || '',
          issueDate: '',
          issuePlace: '',
          entryDate: row.entryDate || getTodayStr(),
          exitDate: '',
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: operatorName,
          updatedBy: operatorName,
        };
        newWorkersList.push(nw);
        importItems.push({
          empCode: nw.empCode,
          name: nw.name,
          dorm: nw.dorm,
          room: nw.room,
          bed: nw.bed,
          status: nw.status,
          actionType: 'Thêm mới',
          phone: nw.phone,
          cccd: nw.cccd,
          workplace: nw.workplace,
          gender: nw.gender,
          entryDate: nw.entryDate,
        });
        imported++;
      }
    });

    // Merge into local workers
    const mergedWorkers = [
      ...newWorkersList,
      ...workers.filter((w) => !newWorkersList.some((nw) => nw.id === w.id || nw.empCode.toLowerCase() === w.empCode.toLowerCase())),
    ];
    setWorkers(mergedWorkers);
    cacheWorkersLocally(mergedWorkers);

    // 1. Lưu lô công nhân lên Cloud Firestore
    if (newWorkersList.length > 0) {
      try {
        await batchUpsertWorkersToFirestore(newWorkersList);
      } catch (err) {
        console.warn('Lỗi nạp lô Excel lên Firestore:', err);
      }
    }

    // 2. Đồng bộ Supabase nếu có
    if (isSupabaseConfigured && newWorkersList.length > 0) {
      try {
        await batchUpsertWorkersToSupabase(newWorkersList);
      } catch (err) {
        console.warn('Lỗi nạp lô Excel lên Supabase:', err);
      }
    }

    const dormScope = targetDorm ? `Dãy ${targetDorm}` : 'Toàn bộ KTX';
    const detailMsg = fileName
      ? `Nhập danh sách từ Excel "${fileName}": Thêm mới ${imported} công nhân, Cập nhật ${updated} công nhân (${dormScope})`
      : `Nhập danh sách từ Excel: Thêm mới ${imported} công nhân, Cập nhật ${updated} công nhân (${dormScope})`;

    await addAuditLog(
      'IMPORT_EXCEL',
      detailMsg,
      {
        fileName: fileName || 'Danh_Sach_Import.xlsx',
        scope: dormScope,
        totalCount: imported + updated,
        items: importItems,
      }
    );

    return { success: true, importedCount: imported, updatedCount: updated };
  };

  const backupData = useCallback(() => {
    return {
      version: '3.0',
      cloudBackend: 'Firebase Cloud Firestore & Supabase',
      exportedAt: new Date().toISOString(),
      appName: 'QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN',
      manager,
      config,
      users,
      workers,
      checkedOutWorkers,
      auditLogs: auditLogs.slice(0, 500),
    };
  }, [manager, config, users, workers, checkedOutWorkers, auditLogs]);

  const downloadBackupJson = useCallback(
    async (customFileName?: string) => {
      const payload = backupData();
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const actualFileName = customFileName || `Sao_Luu_KTX_Cloud_${dateStr}.json`;
      a.download = actualFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const backupItems: AuditItemRecord[] = workers.map((w) => ({
        empCode: w.empCode,
        name: w.name,
        dorm: w.dorm,
        room: w.room,
        bed: w.bed,
        status: w.status,
        actionType: 'Xuất file',
        phone: w.phone,
        workplace: w.workplace,
      }));

      await addAuditLog(
        'EXPORT_BACKUP',
        `Tải xuống file sao lưu JSON "${actualFileName}": ${workers.length} hồ sơ công nhân hiện tại, ${checkedOutWorkers.length} hồ sơ check-out`,
        {
          fileName: actualFileName,
          scope: 'Toàn bộ KTX & Hệ thống',
          totalCount: workers.length,
          items: backupItems,
        }
      );
    },
    [backupData, workers, checkedOutWorkers, addAuditLog]
  );

  const restoreData = async (jsonData: any, overwrite = false, fileName?: string) => {
    try {
      const extractedWorkers = extractRecordsFromBackup(jsonData);
      if (!extractedWorkers || extractedWorkers.length === 0) {
        return { success: false, message: 'Tệp JSON không chứa dữ liệu hồ sơ công nhân hợp lệ!' };
      }

      let nextWorkers: Worker[];
      if (overwrite) {
        nextWorkers = extractedWorkers;
      } else {
        const existingMap = new Map(workers.map((w) => [w.empCode.toLowerCase().trim(), w]));
        const newItems = extractedWorkers.filter((w) => !existingMap.has(w.empCode.toLowerCase().trim()));
        nextWorkers = [...newItems, ...workers];
      }

      setWorkers(nextWorkers);
      cacheWorkersLocally(nextWorkers);

      if (jsonData && typeof jsonData === 'object') {
        if (jsonData.config) {
          setConfig(jsonData.config);
          safeSetLocalStorage(STORAGE_KEYS.CONFIG_CACHE, JSON.stringify(jsonData.config));
          saveSystemConfigToFirestore(jsonData.config).catch(() => {});
        }
        if (jsonData.manager) {
          setManager(jsonData.manager);
          safeSetLocalStorage(STORAGE_KEYS.MANAGER_CACHE, JSON.stringify(jsonData.manager));
          saveManagerInfoToFirestore(jsonData.manager).catch(() => {});
        }
      }

      // 1. Phục hồi lên Cloud Firestore
      try {
        if (overwrite) {
          await clearAllWorkersFromFirestore();
        }
        await batchUpsertWorkersToFirestore(nextWorkers);
      } catch (err) {
        console.warn('Lỗi phục hồi Firestore:', err);
      }

      // 2. Phục hồi lên Supabase nếu có
      if (isSupabaseConfigured) {
        try {
          await batchUpsertWorkersToSupabase(nextWorkers);
        } catch (err) {
          console.warn('Lỗi nạp phục hồi lên Supabase:', err);
        }
      }

      const restoreItems: AuditItemRecord[] = extractedWorkers.map((w) => ({
        empCode: w.empCode,
        name: w.name,
        dorm: w.dorm,
        room: w.room,
        bed: w.bed,
        status: w.status,
        actionType: overwrite ? 'Ghi đè' : 'Phục hồi',
        phone: w.phone,
        workplace: w.workplace,
      }));

      const restoreFileName = fileName || (jsonData && typeof jsonData === 'object' && jsonData.fileName) || 'Sao_Luu.json';

      await addAuditLog(
        'RESTORE_DATA',
        `Phục hồi dữ liệu từ file JSON "${restoreFileName}": Khôi phục ${extractedWorkers.length} công nhân (${overwrite ? 'Ghi đè toàn bộ' : 'Ghép thêm vào danh sách'})`,
        {
          fileName: restoreFileName,
          scope: 'Toàn bộ KTX',
          totalCount: extractedWorkers.length,
          items: restoreItems,
        }
      );

      return {
        success: true,
        message: `Phục hồi thành công ${extractedWorkers.length} hồ sơ công nhân!`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Lỗi khi đọc và phục hồi tệp JSON!',
      };
    }
  };

  const mergeJsonData = async (jsonList: any[], conflictStrategy: 'keep_existing' | 'overwrite') => {
    let added = 0;
    let updated = 0;
    const workerMap = new Map<string, Worker>();
    workers.forEach((w) => workerMap.set(w.empCode.toLowerCase().trim(), { ...w }));
    const mergedItems: AuditItemRecord[] = [];

    jsonList.forEach((raw) => {
      try {
        const extracted = extractRecordsFromBackup(raw);
        if (Array.isArray(extracted)) {
          extracted.forEach((w) => {
            const code = w.empCode.toLowerCase().trim();
            if (workerMap.has(code)) {
              if (conflictStrategy === 'overwrite') {
                workerMap.set(code, { ...workerMap.get(code)!, ...w });
                mergedItems.push({
                  empCode: w.empCode,
                  name: w.name,
                  dorm: w.dorm,
                  room: w.room,
                  bed: w.bed,
                  status: w.status,
                  actionType: 'Cập nhật',
                  phone: w.phone,
                  workplace: w.workplace,
                });
                updated++;
              }
            } else {
              workerMap.set(code, w);
              mergedItems.push({
                empCode: w.empCode,
                name: w.name,
                dorm: w.dorm,
                room: w.room,
                bed: w.bed,
                status: w.status,
                actionType: 'Thêm mới',
                phone: w.phone,
                workplace: w.workplace,
              });
              added++;
            }
          });
        }
      } catch (e) {
        console.warn('Bỏ qua tệp JSON lỗi cấu trúc:', e);
      }
    });

    const nextWorkers = Array.from(workerMap.values());
    setWorkers(nextWorkers);
    cacheWorkersLocally(nextWorkers);

    // 1. Lưu merge lên Cloud Firestore
    try {
      await batchUpsertWorkersToFirestore(nextWorkers);
    } catch (err) {
      console.warn('Lỗi merge JSON lên Firestore:', err);
    }

    // 2. Lưu lên Supabase nếu có
    if (isSupabaseConfigured) {
      try {
        await batchUpsertWorkersToSupabase(nextWorkers);
      } catch (err) {
        console.warn('Lỗi merge JSON lên Supabase:', err);
      }
    }

    await addAuditLog(
      'MERGE_DATA',
      `Ghép dữ liệu JSON: Thêm ${added} hồ sơ mới, Cập nhật ${updated} hồ sơ`,
      {
        scope: 'Toàn bộ KTX',
        totalCount: added + updated,
        items: mergedItems,
      }
    );
    return { success: true, addedCount: added, updatedCount: updated };
  };

  const resetToDemoData = async () => {
    setWorkers(INITIAL_WORKERS);
    cacheWorkersLocally(INITIAL_WORKERS);
    setConfig(INITIAL_CONFIG);
    setManager(INITIAL_MANAGER);
    setUsers(INITIAL_USERS);
    setCheckedOutRecords([]);

    safeSetLocalStorage(STORAGE_KEYS.CONFIG_CACHE, JSON.stringify(INITIAL_CONFIG));
    safeSetLocalStorage(STORAGE_KEYS.MANAGER_CACHE, JSON.stringify(INITIAL_MANAGER));
    safeSetLocalStorage(STORAGE_KEYS.USERS_CACHE, JSON.stringify(INITIAL_USERS));
    safeSetLocalStorage(STORAGE_KEYS.CHECKED_OUT_CACHE, JSON.stringify([]));

    // 1. Reset Cloud Firestore
    try {
      await clearAllWorkersFromFirestore();
      await batchUpsertWorkersToFirestore(INITIAL_WORKERS);
      await saveSystemConfigToFirestore(INITIAL_CONFIG);
      await saveManagerInfoToFirestore(INITIAL_MANAGER);
    } catch (err) {
      console.warn('Lỗi reset demo lên Firestore:', err);
    }

    // 2. Reset Supabase nếu có
    if (isSupabaseConfigured) {
      try {
        await batchUpsertWorkersToSupabase(INITIAL_WORKERS);
      } catch (err) {
        console.warn('Lỗi reset demo lên Supabase:', err);
      }
    }

    await addAuditLog('SYSTEM_CONFIG', 'Đặt lại toàn bộ dữ liệu KTX về trạng thái mẫu ban đầu');
  };

  const clearAllWorkers = async () => {
    setWorkers([]);
    cacheWorkersLocally([]);

    // 1. Xóa trong Cloud Firestore
    try {
      await clearAllWorkersFromFirestore();
    } catch (err) {
      console.warn('Lỗi clearAllWorkers Firestore:', err);
    }

    // 2. Xóa trên Supabase nếu có
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('workers').delete().neq('id', 'placeholder_keep_schema');
        if (error) console.warn('Lỗi xóa tất cả trên Supabase:', error);
      } catch (err) {
        console.warn('Lỗi clearAllWorkers Supabase:', err);
      }
    }

    await addAuditLog('DELETE', 'Xóa toàn bộ danh sách công nhân trong ký túc xá');
  };

  const setAutoSaveJsonOnExit = (val: boolean) => {
    setAutoSaveJsonOnExitState(val);
    safeSetLocalStorage(STORAGE_KEYS.AUTO_SAVE_EXIT, String(val));
  };

  const getLatestExitBackup = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EXIT_SNAPSHOT);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        timestamp: parsed.exportedAt || new Date().toISOString(),
        workersCount: Array.isArray(parsed.workers) ? parsed.workers.length : 0,
        data: parsed,
      };
    } catch {
      return null;
    }
  }, []);

  // Exit backup snapshot
  useEffect(() => {
    const handleExit = () => {
      try {
        const snapshotPayload = {
          version: '3.0',
          exportedAt: new Date().toISOString(),
          appName: 'QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN',
          manager,
          config,
          users,
          workers: sanitizeWorkersForCache(workers),
          auditLogs: auditLogs.slice(0, 100),
        };
        safeSetLocalStorage(STORAGE_KEYS.EXIT_SNAPSHOT, JSON.stringify(snapshotPayload));
      } catch (e) {
        console.warn('Exit snapshot failed', e);
      }

      if (autoSaveJsonOnExit && workers.length > 0) {
        const todayStr = new Date().toISOString().split('T')[0];
        downloadBackupJson(`Sao_Luu_Tu_Dong_Khi_Thoat_KTX_${todayStr}.json`);
      }
    };

    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('pagehide', handleExit);

    return () => {
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('pagehide', handleExit);
    };
  }, [autoSaveJsonOnExit, workers, manager, config, users, auditLogs, downloadBackupJson]);

  // ----------------------------------------------------------------------------
  // HELPER QUERIES & TEAM LEADERS
  // ----------------------------------------------------------------------------
  const getWorkersInRoom = useCallback(
    (dorm: number, room: number) => {
      return workers.filter((w) => w.dorm === dorm && w.room === room && w.status === 'Đang ở');
    },
    [workers]
  );

  const getOccupiedRoomsCount = useCallback(() => {
    const activeWorkers = workers.filter((w) => w.status === 'Đang ở');
    const set = new Set<string>();
    activeWorkers.forEach((w) => set.add(`${w.dorm}_${w.room}`));
    return set.size;
  }, [workers]);

  const getTotalOccupants = useCallback(() => {
    return workers.filter((w) => w.status === 'Đang ở').length;
  }, [workers]);

  const getTodayEntriesCount = useCallback(() => {
    const today = getTodayStr();
    return workers.filter((w) => w.entryDate === today && w.status === 'Đang ở').length;
  }, [workers]);

  const getTodayExitsCount = useCallback(() => {
    const today = getTodayStr();
    return checkedOutWorkers.filter((w) => {
      const exitMatches = w.exitDate === today;
      const checkedOutMatches = Boolean(w.checkedOutAt && w.checkedOutAt.startsWith(today));
      return exitMatches || checkedOutMatches;
    }).length;
  }, [checkedOutWorkers]);

  const getTeamLeadersSummary = useCallback((): TeamLeaderSummary[] => {
    const leaderMap = new Map<
      string,
      {
        name: string;
        workers: Worker[];
        roomsMap: Map<string, { dorm: number; room: number; count: number }>;
        workplacesSet: Set<string>;
        contactPhone?: string;
      }
    >();

    workers.forEach((w) => {
      const leaderName = (w.teamLeader || '').trim();
      if (!leaderName) return;

      const leaderKey = leaderName.toLowerCase();
      let entry = leaderMap.get(leaderKey);
      if (!entry) {
        entry = {
          name: leaderName,
          workers: [],
          roomsMap: new Map(),
          workplacesSet: new Set(),
          contactPhone: undefined,
        };
        leaderMap.set(leaderKey, entry);
      }

      entry.workers.push(w);
      if (w.workplace) {
        entry.workplacesSet.add(w.workplace);
      }

      if (w.status === 'Đang ở') {
        const roomKey = `${w.dorm}_${w.room}`;
        const roomEntry = entry.roomsMap.get(roomKey);
        if (roomEntry) {
          roomEntry.count += 1;
        } else {
          entry.roomsMap.set(roomKey, { dorm: w.dorm, room: w.room, count: 1 });
        }
      }
    });

    const result: TeamLeaderSummary[] = [];

    leaderMap.forEach((entry, key) => {
      const totalWorkers = entry.workers.length;
      const activeWorkers = entry.workers.filter((w) => w.status === 'Đang ở').length;
      const checkedOutWorkersCount = totalWorkers - activeWorkers;

      const rooms = Array.from(entry.roomsMap.values()).map((r) => ({
        dorm: r.dorm,
        room: r.room,
        count: r.count,
      }));

      const workplaces = Array.from(entry.workplacesSet);
      const contactPhone = leaderPhones[key] || entry.contactPhone;
      const leaderWorker = entry.workers.find(
        (w) => w.name.trim().toLowerCase() === entry.name.toLowerCase()
      );
      const primaryDorm = leaderWorker?.dorm || rooms[0]?.dorm;
      const primaryRoom = leaderWorker?.room || rooms[0]?.room;

      result.push({
        name: entry.name,
        totalWorkers,
        activeWorkers,
        rooms,
        workplaces,
        contactPhone,
        primaryDorm,
        primaryRoom,
        leaderWorker,
        workers: entry.workers,
      });
    });

    result.sort((a, b) => b.activeWorkers - a.activeWorkers);
    return result;
  }, [workers, leaderPhones]);

  const getTeamLeadersCount = useCallback(() => {
    return getTeamLeadersSummary().length;
  }, [getTeamLeadersSummary]);

  const updateTeamLeaderPhone = async (leaderName: string, phone: string) => {
    const key = leaderName.trim().toLowerCase();
    const updated = { ...leaderPhones, [key]: phone.trim() };
    setLeaderPhones(updated);
    safeSetLocalStorage(STORAGE_KEYS.LEADER_PHONES, JSON.stringify(updated));
  };

  return (
    <DormContext.Provider
      value={{
        workers,
        config,
        manager,
        currentUser,
        users,
        auditLogs,
        theme,
        setTheme,
        toggleTheme,

        syncStatus,
        isOnline,
        lastSyncTime,
        cloudErrorInfo,
        forceSyncNow,
        dismissCloudError,

        login,
        logout,
        switchUser,

        addWorker,
        updateWorker,
        deleteWorker,
        deleteWorkerByEmpCode,
        getWorkerById,
        getWorkerByEmpCode,

        canViewCccd,
        fetchSecureCccdImages,
        deleteSecureCccdImages,
        addAuditLog,

        updateManagerInfo,
        updateManager,
        updateConfig,

        importWorkers,
        backupData,
        restoreData,
        mergeJsonData,

        addUser,
        updateUser,
        deleteUser,

        resetToDemoData,
        clearAllWorkers,

        autoSaveJsonOnExit,
        setAutoSaveJsonOnExit,
        downloadBackupJson,
        getLatestExitBackup,

        getWorkersInRoom,
        getOccupiedRoomsCount,
        getTotalOccupants,
        getTodayEntriesCount,
        getTodayExitsCount,
        getTeamLeadersSummary,
        getTeamLeadersCount,
        updateTeamLeaderPhone,

        checkedOutWorkers,
        getTotalCheckedOutCount,
        restoreCheckedOutWorker,
        deleteCheckedOutPermanent,
      }}
    >
      {children}
    </DormContext.Provider>
  );
};

export const useDorm = () => {
  const context = useContext(DormContext);
  if (!context) {
    throw new Error('useDorm must be used within a DormProvider');
  }
  return context;
};
