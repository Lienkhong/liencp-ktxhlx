import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Worker,
  User,
  DormConfig,
  ManagerInfo,
  AuditLog,
  UserRole,
  WorkerStatus,
  ImportPreviewRow,
  TeamLeaderSummary,
  SyncStatus,
} from '../types';
import {
  INITIAL_CONFIG,
  INITIAL_MANAGER,
  INITIAL_USERS,
  INITIAL_WORKERS,
  INITIAL_AUDIT_LOGS,
} from '../data/initialData';
import { generateId, getTodayStr } from '../utils/helpers';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  limit,
  testFirestoreConnection,
  saveSecureWorkerDocument,
  getSecureWorkerDocument,
  deleteSecureWorkerDocument,
} from '../lib/firebase';

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
  forceSyncNow: () => Promise<void>;
  
  // Auth
  login: (email: string, pass: string) => { success: boolean; message: string };
  logout: () => void;
  
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
    empCode?: string,
    targetId?: string,
    status?: 'SUCCESS' | 'FAILED' | 'DENIED'
  ) => Promise<void>;

  // Management & Config
  updateManagerInfo: (info: Partial<ManagerInfo>) => Promise<void>;
  updateConfig: (newConfig: DormConfig) => Promise<{ success: boolean; message: string }>;
  
  // Import & Export & Backup
  importWorkers: (rows: ImportPreviewRow[], overwriteDuplicates?: boolean) => Promise<{ success: boolean; importedCount: number; updatedCount: number }>;
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
}

const DormContext = createContext<DormContextType | null>(null);

const STORAGE_KEYS = {
  WORKERS_CACHE: 'qktx_workers_cache_v2',
  CONFIG_CACHE: 'qktx_config_cache_v2',
  MANAGER_CACHE: 'qktx_manager_cache_v2',
  USERS_CACHE: 'qktx_users_cache_v2',
  CURRENT_USER: 'qktx_current_user_v2',
  AUDIT_LOGS_CACHE: 'qktx_audit_logs_cache_v2',
  THEME: 'qktx_theme_v2',
  AUTO_SAVE_EXIT: 'qktx_auto_save_json_on_exit_v2',
  EXIT_SNAPSHOT: 'qktx_exit_backup_snapshot_v2',
  LEADER_PHONES: 'qktx_leader_phones_v2',
};

const DEFAULT_LEADER_PHONES: Record<string, string> = {
  'phạm minh tuấn': '0988 332 211',
  'hoàng văn nam': '0912 667 889',
  'đỗ hùng dũng': '0903 556 778',
  'vũ trọng phụng': '0977 889 900',
  'trần văn thái': '0933 445 566',
  'nguyễn văn a': '0912 345 678',
};

export const DormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Sync Status State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const isInitialSeededRef = useRef(false);

  // Workers State (Local cache initialized, then populated from Firestore live stream)
  const [workers, setWorkers] = useState<Worker[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORKERS_CACHE);
      return saved ? JSON.parse(saved) : INITIAL_WORKERS;
    } catch {
      return INITIAL_WORKERS;
    }
  });

  // Config State
  const [config, setConfig] = useState<DormConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG_CACHE);
      return saved ? JSON.parse(saved) : INITIAL_CONFIG;
    } catch {
      return INITIAL_CONFIG;
    }
  });

  // Manager Info
  const [manager, setManager] = useState<ManagerInfo>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MANAGER_CACHE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name === 'Lê Văn Quyết') return INITIAL_MANAGER;
        return parsed;
      }
      return INITIAL_MANAGER;
    } catch {
      return INITIAL_MANAGER;
    }
  });

  // Users State
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS_CACHE);
      if (saved) {
        const parsed: User[] = JSON.parse(saved);
        return parsed.map((u) => {
          if (u.email?.toLowerCase() === 'liencp85@gmail.com') {
            return { ...u, name: 'Khổng Minh Liên (Admin)' };
          }
          return u;
        });
      }
      return INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

  // Current User (Session / URL link)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const portal = (params.get('portal') || params.get('role') || params.get('login'))?.toLowerCase();
        if (portal === 'manager' || portal === 'quanly') {
          const mgr = INITIAL_USERS.find((u) => u.role === 'manager') || INITIAL_USERS[1];
          return mgr;
        }
        if (portal === 'viewer' || portal === 'xem') {
          const v = INITIAL_USERS.find((u) => u.role === 'viewer') || INITIAL_USERS[2];
          return v;
        }
        if (portal === 'admin') {
          return INITIAL_USERS[0];
        }
      }

      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (saved) {
        const parsed: User = JSON.parse(saved);
        if (parsed.email?.toLowerCase() === 'liencp85@gmail.com') {
          return { ...parsed, name: 'Khổng Minh Liên (Admin)' };
        }
        return parsed;
      }
      return INITIAL_USERS[0];
    } catch {
      return INITIAL_USERS[0];
    }
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS_CACHE);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  // Theme State
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      return saved === 'dark' || saved === 'light' ? saved : 'light';
    } catch {
      return 'light';
    }
  });

  // Auto-Save JSON on Exit preference
  const [autoSaveJsonOnExit, setAutoSaveJsonOnExitState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE_EXIT);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Custom Leader Phones
  const [leaderPhones, setLeaderPhones] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEADER_PHONES);
      return saved ? { ...DEFAULT_LEADER_PHONES, ...JSON.parse(saved) } : DEFAULT_LEADER_PHONES;
    } catch {
      return DEFAULT_LEADER_PHONES;
    }
  });

  // Online / Offline Detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('syncing');
      testFirestoreConnection().then(() => {
        setSyncStatus('synced');
        setLastSyncTime(new Date());
      });
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

  // Update theme class
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Persist Current User session
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  // ----------------------------------------------------
  // REAL-TIME FIRESTORE SYNCHRONIZATION & AUTO-SEED
  // ----------------------------------------------------
  useEffect(() => {
    let isSubscribed = true;
    setSyncStatus('syncing');

    // 1. Listen to Workers Collection
    const unsubscribeWorkers = onSnapshot(
      collection(db, 'workers'),
      (snapshot) => {
        if (!isSubscribed) return;
        if (snapshot.empty && !isInitialSeededRef.current) {
          // If Firestore is completely empty on first boot, trigger seed
          seedInitialFirestoreData();
          return;
        }

        const cloudWorkers: Worker[] = [];
        snapshot.forEach((docSnap) => {
          cloudWorkers.push(docSnap.data() as Worker);
        });

        if (cloudWorkers.length > 0) {
          // Sort by dorm, room, bed or createdAt
          cloudWorkers.sort((a, b) => {
            if (a.dorm !== b.dorm) return a.dorm - b.dorm;
            if (a.room !== b.room) return a.room - b.room;
            return (a.bed || 0) - (b.bed || 0);
          });
          setWorkers(cloudWorkers);
          localStorage.setItem(STORAGE_KEYS.WORKERS_CACHE, JSON.stringify(cloudWorkers));
        }

        setSyncStatus('synced');
        setLastSyncTime(new Date());
      },
      (error) => {
        console.warn('Firestore workers sync error:', error);
        if (!navigator.onLine) {
          setSyncStatus('offline');
        } else {
          setSyncStatus('error');
        }
      }
    );

    // 2. Listen to System Config Doc
    const unsubscribeConfig = onSnapshot(
      doc(db, 'system_config', 'main'),
      (docSnap) => {
        if (!isSubscribed) return;
        if (docSnap.exists()) {
          const cloudConfig = docSnap.data() as DormConfig;
          setConfig(cloudConfig);
          localStorage.setItem(STORAGE_KEYS.CONFIG_CACHE, JSON.stringify(cloudConfig));
        }
      },
      (error) => console.warn('Config sync error:', error)
    );

    // 3. Listen to Manager Info Doc
    const unsubscribeManager = onSnapshot(
      doc(db, 'manager_info', 'current'),
      (docSnap) => {
        if (!isSubscribed) return;
        if (docSnap.exists()) {
          const cloudManager = docSnap.data() as ManagerInfo;
          setManager(cloudManager);
          localStorage.setItem(STORAGE_KEYS.MANAGER_CACHE, JSON.stringify(cloudManager));
        }
      },
      (error) => console.warn('Manager sync error:', error)
    );

    // 4. Listen to Users Collection
    const unsubscribeUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        if (!isSubscribed) return;
        if (!snapshot.empty) {
          const cloudUsers: User[] = [];
          snapshot.forEach((d) => cloudUsers.push(d.data() as User));
          setUsers(cloudUsers);
          localStorage.setItem(STORAGE_KEYS.USERS_CACHE, JSON.stringify(cloudUsers));
        }
      },
      (error) => console.warn('Users sync error:', error)
    );

    // 5. Listen to Activity Logs Collection
    const unsubscribeLogs = onSnapshot(
      query(collection(db, 'activity_logs'), limit(150)),
      (snapshot) => {
        if (!isSubscribed) return;
        if (!snapshot.empty) {
          const cloudLogs: AuditLog[] = [];
          snapshot.forEach((d) => cloudLogs.push(d.data() as AuditLog));
          cloudLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setAuditLogs(cloudLogs);
          localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS_CACHE, JSON.stringify(cloudLogs));
        }
      },
      (error) => console.warn('Logs sync error:', error)
    );

    return () => {
      isSubscribed = false;
      unsubscribeWorkers();
      unsubscribeConfig();
      unsubscribeManager();
      unsubscribeUsers();
      unsubscribeLogs();
    };
  }, []);

  // Helper to Seed initial dataset to Cloud Firestore if brand new database
  const seedInitialFirestoreData = async () => {
    if (isInitialSeededRef.current) return;
    isInitialSeededRef.current = true;
    try {
      setSyncStatus('saving');
      console.log('Seeding initial dataset to Firestore Cloud Database...');

      // 1. Seed Config
      await setDoc(doc(db, 'system_config', 'main'), INITIAL_CONFIG);

      // 2. Seed Manager
      await setDoc(doc(db, 'manager_info', 'current'), INITIAL_MANAGER);

      // 3. Seed Users
      const userBatch = writeBatch(db);
      INITIAL_USERS.forEach((u) => {
        userBatch.set(doc(db, 'users', u.id), u);
      });
      await userBatch.commit();

      // 4. Seed Workers in batch
      const workerBatch = writeBatch(db);
      INITIAL_WORKERS.forEach((w) => {
        workerBatch.set(doc(db, 'workers', w.id), w);
      });
      await workerBatch.commit();

      // 5. Seed initial logs
      const logBatch = writeBatch(db);
      INITIAL_AUDIT_LOGS.forEach((log) => {
        logBatch.set(doc(db, 'activity_logs', log.id), log);
      });
      await logBatch.commit();

      setSyncStatus('synced');
      setLastSyncTime(new Date());
      console.log('Seeding initial dataset to Firestore completed successfully!');
    } catch (e) {
      console.error('Error seeding initial data to Firestore:', e);
      setSyncStatus('error');
    }
  };

  // Add Real-time Audit Log helper to Cloud Firestore
  const addAuditLog = useCallback(
    async (
      action: AuditLog['action'],
      details: string,
      empCode?: string,
      targetId?: string,
      status: 'SUCCESS' | 'FAILED' | 'DENIED' = 'SUCCESS'
    ) => {
      const newLog: AuditLog = {
        id: generateId('log'),
        timestamp: new Date().toISOString(),
        userName: currentUser?.name || manager.name || 'Quản lý',
        userEmail: currentUser?.email || 'manager@qktx.cloud',
        role: currentUser?.role || 'manager',
        action,
        details,
        empCode,
        targetId,
        status,
      };

      // Optimistic local update
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 200)]);

      try {
        await setDoc(doc(db, 'activity_logs', newLog.id), newLog);
      } catch (e) {
        console.warn('Failed to push audit log to Firestore:', e);
      }
    },
    [currentUser, manager]
  );

  // Helper check if current user can view CCCD of a worker
  const canViewCccd = useCallback(
    (worker?: Worker): boolean => {
      if (!currentUser) return false;
      if (currentUser.role === 'admin') return true;
      if (currentUser.role === 'manager') {
        if (!worker) return true;
        if (!currentUser.assignedDorms || currentUser.assignedDorms.length === 0) return true;
        return currentUser.assignedDorms.includes(worker.dorm);
      }
      return false;
    },
    [currentUser]
  );

  // Securely fetch CCCD images from Private Cloud Firestore /worker_documents/{workerId}
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
        const secureDoc = await getSecureWorkerDocument(workerId);
        if (secureDoc && (secureDoc.frontImage || secureDoc.backImage)) {
          await addAuditLog(
            'VIEW_CCCD',
            `Xem ảnh CCCD bảo mật của công nhân ${targetWorker?.name || workerId} (Mã: ${targetWorker?.empCode || '-'})`,
            targetWorker?.empCode,
            workerId,
            'SUCCESS'
          );
          return { frontImage: secureDoc.frontImage, backImage: secureDoc.backImage };
        }

        // Fallback to in-memory if available
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

  // Securely delete CCCD images from Private Cloud Firestore
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

      await deleteSecureWorkerDocument(workerId);
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

  // Manual Force Sync function
  const forceSyncNow = async () => {
    setSyncStatus('syncing');
    try {
      const snap = await getDocs(collection(db, 'workers'));
      const cloudWorkers: Worker[] = [];
      snap.forEach((d) => cloudWorkers.push(d.data() as Worker));
      if (cloudWorkers.length > 0) {
        setWorkers(cloudWorkers);
      }
      setSyncStatus('synced');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Force sync error:', e);
      setSyncStatus('error');
    }
  };

  const setAutoSaveJsonOnExit = (val: boolean) => {
    setAutoSaveJsonOnExitState(val);
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE_EXIT, String(val));
    } catch (e) {
      console.warn('Failed to save autoSaveJsonOnExit preference', e);
    }
  };

  const downloadBackupJson = useCallback(
    (customFileName?: string) => {
      const payload = {
        version: '2.0',
        cloudSource: 'Firebase Firestore Realtime',
        exportedAt: new Date().toISOString(),
        appName: 'QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN',
        manager,
        config,
        users,
        workers,
        auditLogs: auditLogs.slice(0, 500),
      };
      const jsonString = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = customFileName || `Sao_Luu_KTX_Cloud_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [manager, config, users, workers, auditLogs]
  );

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

  // Exit backup handler
  useEffect(() => {
    const handleExit = () => {
      try {
        const snapshotPayload = {
          version: '2.0',
          exportedAt: new Date().toISOString(),
          appName: 'QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN',
          manager,
          config,
          users,
          workers,
          auditLogs: auditLogs.slice(0, 200),
        };
        localStorage.setItem(STORAGE_KEYS.EXIT_SNAPSHOT, JSON.stringify(snapshotPayload));
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

  // Auth Operations
  const login = (email: string, pass: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const foundUser = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (!foundUser) {
      return { success: false, message: 'Email này chưa được Admin cấp quyền trên Cloud!' };
    }

    if (foundUser.password && foundUser.password !== pass) {
      return { success: false, message: 'Mật khẩu không chính xác!' };
    }

    setCurrentUser(foundUser);
    addAuditLog('LOGIN', `Người dùng ${foundUser.name} (${foundUser.email}) đăng nhập hệ thống Cloud`);
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
  };

  // Helper Queries
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
    return workers.filter((w) => w.exitDate === today && w.status === 'Đã rời KTX').length;
  }, [workers]);

  const getTeamLeadersSummary = useCallback((): TeamLeaderSummary[] => {
    const leaderMap = new Map<string, {
      name: string;
      workers: Worker[];
      roomsMap: Map<string, { dorm: number; room: number; count: number }>;
      workplacesSet: Set<string>;
      contactPhone?: string;
    }>();

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

    leaderMap.forEach((entry, leaderKey) => {
      if (leaderPhones[leaderKey]) {
        entry.contactPhone = leaderPhones[leaderKey];
      } else {
        const leaderAsWorker = workers.find(
          (w) => w.name.trim().toLowerCase() === leaderKey
        );
        if (leaderAsWorker && leaderAsWorker.phone) {
          entry.contactPhone = leaderAsWorker.phone;
        }
      }
    });

    const result: TeamLeaderSummary[] = Array.from(leaderMap.values()).map((entry) => {
      const activeCount = entry.workers.filter((w) => w.status === 'Đang ở').length;
      const sortedRooms = Array.from(entry.roomsMap.values()).sort(
        (a, b) => a.dorm - b.dorm || a.room - b.room
      );

      const leaderAsWorker = workers.find(
        (w) => w.name.trim().toLowerCase() === entry.name.trim().toLowerCase()
      );

      const primaryDorm = leaderAsWorker?.dorm || sortedRooms[0]?.dorm;
      const primaryRoom = leaderAsWorker?.room || sortedRooms[0]?.room;

      return {
        name: entry.name,
        totalWorkers: entry.workers.length,
        activeWorkers: activeCount,
        rooms: sortedRooms,
        workplaces: Array.from(entry.workplacesSet),
        contactPhone: entry.contactPhone,
        primaryDorm,
        primaryRoom,
        leaderWorker: leaderAsWorker,
        workers: entry.workers,
      };
    });

    return result.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [workers, leaderPhones]);

  const getTeamLeadersCount = useCallback(() => {
    const activeWorkers = workers.filter((w) => w.status === 'Đang ở');
    const set = new Set<string>();
    activeWorkers.forEach((w) => {
      const leader = (w.teamLeader || '').trim();
      if (leader) set.add(leader.toLowerCase());
    });
    if (set.size === 0) {
      workers.forEach((w) => {
        const leader = (w.teamLeader || '').trim();
        if (leader) set.add(leader.toLowerCase());
      });
    }
    return set.size;
  }, [workers]);

  const getWorkerById = (id: string) => workers.find((w) => w.id === id);
  const getWorkerByEmpCode = (empCode: string) =>
    workers.find((w) => w.empCode.trim().toLowerCase() === empCode.trim().toLowerCase());

  const updateTeamLeaderPhone = useCallback(
    async (leaderName: string, phone: string) => {
      const key = leaderName.trim().toLowerCase();
      setLeaderPhones((prev) => {
        const updated = { ...prev, [key]: phone.trim() };
        try {
          localStorage.setItem(STORAGE_KEYS.LEADER_PHONES, JSON.stringify(updated));
        } catch (e) {
          console.warn('Failed to save leader phone', e);
        }
        return updated;
      });
      await addAuditLog('UPDATE', `Cập nhật số điện thoại tổ trưởng ${leaderName}: ${phone.trim()}`);
    },
    [addAuditLog]
  );

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // ----------------------------------------------------
  // WORKER CRUD OPERATIONS (CLOUD FIRESTORE)
  // ----------------------------------------------------
  const addWorker = async (
    workerData: Partial<Worker>,
    overwriteIfDuplicate = false
  ) => {
    setSyncStatus('saving');
    const autoCode = `NV${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanEmpCode = (workerData.empCode && workerData.empCode.trim()) ? workerData.empCode.trim() : autoCode;
    const cleanName = (workerData.name && workerData.name.trim()) ? workerData.name.trim() : 'Công nhân mới';
    const cleanDorm = workerData.dorm && workerData.dorm > 0 ? workerData.dorm : 1;
    const cleanRoom = workerData.room && workerData.room > 0 ? workerData.room : 1;
    const cleanBed = workerData.bed && workerData.bed > 0 ? workerData.bed : 1;
    const cleanStatus = workerData.status || 'Đang ở';

    const existing = workers.find(
      (w) => w.empCode.trim().toLowerCase() === cleanEmpCode.toLowerCase()
    );

    if (existing && !overwriteIfDuplicate) {
      setSyncStatus('synced');
      return {
        success: false,
        message: `Mã nhân viên "${cleanEmpCode}" đã tồn tại trên Cloud Database!`,
        duplicateWorker: existing,
      };
    }

    // Capacity checks
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

      if (config.enforceBedControl && cleanBed) {
        const bedTaken = roomOccupants.find((w) => w.bed === cleanBed);
        if (bedTaken) {
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
        entryDate,
        updatedAt: nowIso,
        updatedBy: operatorName,
        cccdDocument: {
          hasFront: hasFront || Boolean(existing.cccdDocument?.hasFront),
          hasBack: hasBack || Boolean(existing.cccdDocument?.hasBack),
          storagePath: `worker_documents/${existing.id}/`,
          frontUploadedAt: hasFront ? nowIso : existing.cccdDocument?.frontUploadedAt,
          backUploadedAt: hasBack ? nowIso : existing.cccdDocument?.backUploadedAt,
        },
      };

      try {
        if (hasFront || hasBack) {
          await saveSecureWorkerDocument(
            existing.id,
            workerData.cccdFrontImage || existing.cccdFrontImage,
            workerData.cccdBackImage || existing.cccdBackImage,
            operatorName
          );
          await addAuditLog(
            'UPLOAD_CCCD',
            `Lưu ảnh CCCD vào Private Storage cho công nhân ${cleanName} (Mã: ${cleanEmpCode})`,
            cleanEmpCode,
            existing.id
          );
        }

        await setDoc(doc(db, 'workers', existing.id), updatedWorker);
        await addAuditLog(
          'UPDATE',
          `Ghi đè thông tin công nhân ${cleanName} (Mã: ${cleanEmpCode}, Dãy ${cleanDorm} - P.${cleanRoom})`,
          cleanEmpCode,
          existing.id
        );
        setSyncStatus('synced');
        setLastSyncTime(new Date());
        return { success: true, message: `Đã ghi đè thành công lên Cloud: ${cleanName} (${cleanEmpCode})!` };
      } catch (e: any) {
        console.error('Error saving worker to Firestore:', e);
        setSyncStatus('error');
        return { success: false, message: `Lỗi lưu Cloud: ${e.message}` };
      }
    }

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
      gender: workerData.gender || '',
      hometown: workerData.hometown || '',
      issueDate: workerData.issueDate || '',
      issuePlace: workerData.issuePlace || '',
      entryDate,
      exitDate: cleanStatus === 'Đã rời KTX' ? workerData.exitDate || today : '',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: operatorName,
      updatedBy: operatorName,
      cccdDocument: {
        hasFront,
        hasBack,
        storagePath: (hasFront || hasBack) ? `worker_documents/${workerId}/` : undefined,
        frontUploadedAt: hasFront ? nowIso : undefined,
        backUploadedAt: hasBack ? nowIso : undefined,
      },
    };

    try {
      if (hasFront || hasBack) {
        await saveSecureWorkerDocument(
          workerId,
          workerData.cccdFrontImage,
          workerData.cccdBackImage,
          operatorName
        );
        await addAuditLog(
          'UPLOAD_CCCD',
          `Lưu an toàn ảnh CCCD vào Private Cloud Storage cho công nhân ${cleanName} (Mã: ${cleanEmpCode})`,
          cleanEmpCode,
          workerId
        );
      }

      await setDoc(doc(db, 'workers', newWorker.id), newWorker);
      await addAuditLog(
        'CREATE',
        `Thêm mới công nhân ${newWorker.name} (Mã: ${newWorker.empCode}, Dãy ${newWorker.dorm} - Phòng ${newWorker.room})`,
        newWorker.empCode,
        newWorker.id
      );
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: `Đã lưu công nhân ${newWorker.name} lên Cloud Database thành công!` };
    } catch (e: any) {
      console.error('Error saving new worker to Firestore:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi lưu Cloud: ${e.message}` };
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

    // Check empCode collision
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
    const targetBed = updates.bed !== undefined ? updates.bed : existing.bed;
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
          setSyncStatus('synced');
          return {
            success: false,
            message: `Giường số ${targetBed} tại Phòng ${targetRoom} đang có công nhân ${bedCollision.name} (${bedCollision.empCode}) ở!`,
          };
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
    } else if (existing.status === 'Đang ở' && targetStatus === 'Đã rời KTX') {
      newExitDate = today;
    }

    // Check if new CCCD photos are provided
    const hasNewFront = updates.cccdFrontImage !== undefined;
    const hasNewBack = updates.cccdBackImage !== undefined;
    const updatedFront = hasNewFront ? updates.cccdFrontImage : existing.cccdFrontImage;
    const updatedBack = hasNewBack ? updates.cccdBackImage : existing.cccdBackImage;

    const updatedWorker: Worker = {
      ...existing,
      ...updates,
      entryDate: newEntryDate,
      exitDate: newExitDate,
      updatedAt: nowIso,
      updatedBy: operatorName,
      cccdDocument: {
        hasFront: Boolean(updatedFront),
        hasBack: Boolean(updatedBack),
        storagePath: (updatedFront || updatedBack) ? `worker_documents/${id}/` : undefined,
        frontUploadedAt: hasNewFront && updatedFront ? nowIso : existing.cccdDocument?.frontUploadedAt,
        backUploadedAt: hasNewBack && updatedBack ? nowIso : existing.cccdDocument?.backUploadedAt,
      },
    };

    try {
      if (hasNewFront || hasNewBack) {
        if (updatedFront || updatedBack) {
          await saveSecureWorkerDocument(id, updatedFront, updatedBack, operatorName);
          await addAuditLog(
            'UPDATE_CCCD',
            `Cập nhật ảnh CCCD trong Private Storage cho công nhân ${updatedWorker.name} (${updatedWorker.empCode})`,
            updatedWorker.empCode,
            id
          );
        } else {
          await deleteSecureWorkerDocument(id);
        }
      }

      await setDoc(doc(db, 'workers', id), updatedWorker);

      // Check if room transfer happened
      const isTransferred = existing.dorm !== updatedWorker.dorm || existing.room !== updatedWorker.room;
      const transferDetail = isTransferred
        ? ` (Chuyển từ Dãy ${existing.dorm}-P.${existing.room} sang Dãy ${updatedWorker.dorm}-P.${updatedWorker.room})`
        : '';

      await addAuditLog(
        'UPDATE',
        `Cập nhật công nhân ${updatedWorker.name} (${updatedWorker.empCode}) - Dãy ${updatedWorker.dorm}, P.${updatedWorker.room}${transferDetail}`,
        updatedWorker.empCode,
        id
      );

      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: `Đã cập nhật công nhân ${updatedWorker.name} thành công trên Cloud!` };
    } catch (e: any) {
      console.error('Error updating worker in Firestore:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi cập nhật Cloud: ${e.message}` };
    }
  };

  const deleteWorker = async (id: string) => {
    setSyncStatus('saving');
    const target = workers.find((w) => w.id === id);
    if (!target) {
      setSyncStatus('synced');
      return { success: false, message: 'Không tìm thấy công nhân cần xóa!' };
    }

    try {
      // 1. Delete document from private worker_documents storage
      await deleteSecureWorkerDocument(id);

      // 2. Delete worker record from workers collection
      await deleteDoc(doc(db, 'workers', id));

      await addAuditLog(
        'DELETE_CCCD',
        `Đã tự động xóa tài liệu ảnh CCCD trong Private Storage khi xóa công nhân ${target.name} (Mã: ${target.empCode})`,
        target.empCode,
        id
      );

      await addAuditLog(
        'DELETE',
        `Xóa công nhân ${target.name} (Mã: ${target.empCode}, Dãy ${target.dorm} - Phòng ${target.room})`,
        target.empCode,
        id
      );
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: `Đã xóa công nhân ${target.name} (${target.empCode}) khỏi Cloud Database!` };
    } catch (e: any) {
      console.error('Error deleting worker from Firestore:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi xóa Cloud: ${e.message}` };
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

    try {
      await deleteDoc(doc(db, 'workers', target.id));
      await addAuditLog(
        'DELETE',
        `Xóa theo mã NV: ${target.name} (Mã: ${target.empCode})`,
        target.empCode,
        target.id
      );
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: `Đã xóa thành công công nhân ${target.name} (${target.empCode}) khỏi Cloud!`, deletedWorker: target };
    } catch (e: any) {
      console.error('Error deleting worker by empCode from Firestore:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi xóa Cloud: ${e.message}` };
    }
  };

  // ----------------------------------------------------
  // CONFIG & MANAGER (CLOUD FIRESTORE)
  // ----------------------------------------------------
  const updateManagerInfo = async (info: Partial<ManagerInfo>) => {
    setSyncStatus('saving');
    const updated = { ...manager, ...info };
    try {
      await setDoc(doc(db, 'manager_info', 'current'), updated);
      await addAuditLog('UPDATE', `Thay đổi thông tin người quản lý thành "${updated.name}"`);
      setSyncStatus('synced');
      setLastSyncTime(new Date());
    } catch (e) {
      console.warn('Error updating manager info to Cloud:', e);
      setSyncStatus('error');
    }
  };

  const updateConfig = async (newConfig: DormConfig) => {
    const activeWorkers = workers.filter((w) => w.status === 'Đang ở');

    const invalidDorm = activeWorkers.find((w) => w.dorm > newConfig.numDorms);
    if (invalidDorm) {
      return {
        success: false,
        message: `Không thể giảm quy mô: Công nhân ${invalidDorm.name} (${invalidDorm.empCode}) đang ở Dãy ${invalidDorm.dorm}, vượt quá cấu hình mới (${newConfig.numDorms} dãy)!`,
      };
    }

    const invalidRoom = activeWorkers.find((w) => w.room > newConfig.roomsPerDorm);
    if (invalidRoom) {
      return {
        success: false,
        message: `Không thể giảm quy mô: Công nhân ${invalidRoom.name} (${invalidRoom.empCode}) đang ở Phòng ${invalidRoom.room}, vượt quá cấu hình mới (${newConfig.roomsPerDorm} phòng/dãy)!`,
      };
    }

    const invalidBed = activeWorkers.find((w) => w.bed > newConfig.maxBedsPerRoom);
    if (invalidBed) {
      return {
        success: false,
        message: `Không thể giảm quy mô: Công nhân ${invalidBed.name} (${invalidBed.empCode}) đang ở Giường ${invalidBed.bed}, vượt quá cấu hình mới (${newConfig.maxBedsPerRoom} giường/phòng)!`,
      };
    }

    setSyncStatus('saving');
    try {
      await setDoc(doc(db, 'system_config', 'main'), newConfig);
      await addAuditLog(
        'SCALE_CHANGE',
        `Thay đổi cấu hình quy mô KTX: ${newConfig.numDorms} dãy, ${newConfig.roomsPerDorm} phòng/dãy, tối đa ${newConfig.maxBedsPerRoom} người/phòng`
      );
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: 'Đã lưu cấu hình quy mô Ký túc xá lên Cloud thành công!' };
    } catch (e: any) {
      console.error('Error updating config in Firestore:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi cập nhật cấu hình: ${e.message}` };
    }
  };

  // ----------------------------------------------------
  // EXCEL IMPORT / RESTORE (BATCH WRITES TO CLOUD)
  // ----------------------------------------------------
  const importWorkers = async (rows: ImportPreviewRow[], overwriteDuplicates = true) => {
    setSyncStatus('saving');
    const today = getTodayStr();
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || manager.name || 'Quản lý';

    let importedCount = 0;
    let updatedCount = 0;

    const workerMap = new Map<string, Worker>();
    workers.forEach((w) => workerMap.set(w.empCode.toLowerCase(), w));

    const toWriteList: Worker[] = [];

    rows.forEach((row) => {
      if (!row.isValid) return;

      const codeKey = row.empCode.toLowerCase();
      const existing = workerMap.get(codeKey);

      if (existing) {
        if (overwriteDuplicates) {
          const updated: Worker = {
            ...existing,
            name: row.name,
            dob: row.dob || existing.dob,
            dorm: row.dorm,
            room: row.room,
            bed: row.bed,
            teamLeader: row.teamLeader || existing.teamLeader,
            status: row.status,
            cccd: row.cccd || existing.cccd,
            address: row.address || existing.address,
            phone: row.phone || existing.phone,
            workplace: row.workplace || existing.workplace,
            note: row.note || existing.note,
            updatedAt: nowIso,
            updatedBy: operatorName,
          };
          workerMap.set(codeKey, updated);
          toWriteList.push(updated);
          updatedCount++;
        }
      } else {
        const newWorker: Worker = {
          id: generateId('w_imp'),
          name: row.name,
          dob: row.dob || '',
          dorm: row.dorm,
          room: row.room,
          bed: row.bed,
          teamLeader: row.teamLeader || '',
          status: row.status,
          empCode: row.empCode,
          cccd: row.cccd || '',
          address: row.address || '',
          phone: row.phone || '',
          workplace: row.workplace || '',
          note: row.note || '',
          entryDate: row.status === 'Đang ở' ? today : '',
          exitDate: row.status === 'Đã rời KTX' ? today : '',
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: operatorName,
          updatedBy: operatorName,
        };
        workerMap.set(codeKey, newWorker);
        toWriteList.push(newWorker);
        importedCount++;
      }
    });

    try {
      // Chunk writes into Firestore batches (max 400 per batch)
      const chunkSize = 400;
      for (let i = 0; i < toWriteList.length; i += chunkSize) {
        const chunk = toWriteList.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          batch.set(doc(db, 'workers', item.id), item);
        });
        await batch.commit();
      }

      await addAuditLog(
        'IMPORT',
        `Nhập Excel lên Cloud: Thêm mới ${importedCount} công nhân, cập nhật ${updatedCount} công nhân`
      );

      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, importedCount, updatedCount };
    } catch (e) {
      console.error('Error importing workers to Firestore:', e);
      setSyncStatus('error');
      return { success: false, importedCount: 0, updatedCount: 0 };
    }
  };

  const backupData = () => {
    return {
      version: '2.0',
      cloudSource: 'Firebase Firestore Realtime',
      exportedAt: new Date().toISOString(),
      appName: 'QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN',
      manager,
      config,
      users,
      workers,
    };
  };

  const restoreData = async (jsonData: any, overwrite = true) => {
    setSyncStatus('saving');
    try {
      if (!jsonData || !Array.isArray(jsonData.workers)) {
        setSyncStatus('synced');
        return { success: false, message: 'File JSON không hợp lệ hoặc thiếu dữ liệu danh sách công nhân!' };
      }

      if (overwrite) {
        // Clear old and write new in batches
        const oldSnapshot = await getDocs(collection(db, 'workers'));
        const deleteBatch = writeBatch(db);
        oldSnapshot.forEach((d) => deleteBatch.delete(d.ref));
        await deleteBatch.commit();

        const insertWorkers: Worker[] = jsonData.workers;
        for (let i = 0; i < insertWorkers.length; i += 400) {
          const chunk = insertWorkers.slice(i, i + 400);
          const b = writeBatch(db);
          chunk.forEach((w) => b.set(doc(db, 'workers', w.id || generateId('w')), w));
          await b.commit();
        }

        if (jsonData.config) await setDoc(doc(db, 'system_config', 'main'), jsonData.config);
        if (jsonData.manager) await setDoc(doc(db, 'manager_info', 'current'), jsonData.manager);
        if (Array.isArray(jsonData.users) && jsonData.users.length > 0) {
          const userBatch = writeBatch(db);
          jsonData.users.forEach((u: User) => userBatch.set(doc(db, 'users', u.id), u));
          await userBatch.commit();
        }
      } else {
        const existingCodes = new Set(workers.map((w) => w.empCode.toLowerCase()));
        const toAdd = jsonData.workers.filter(
          (w: Worker) => w.empCode && !existingCodes.has(w.empCode.toLowerCase())
        );
        for (let i = 0; i < toAdd.length; i += 400) {
          const chunk = toAdd.slice(i, i + 400);
          const b = writeBatch(db);
          chunk.forEach((w: Worker) => b.set(doc(db, 'workers', w.id || generateId('w')), w));
          await b.commit();
        }
      }

      await addAuditLog('RESTORE', `Khôi phục dữ liệu lên Cloud từ file JSON (${jsonData.workers.length} công nhân)`);
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: `Khôi phục thành công ${jsonData.workers.length} hồ sơ công nhân lên Cloud!` };
    } catch (e: any) {
      console.error('Restore data error:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi khôi phục: ${e.message}` };
    }
  };

  const mergeJsonData = async (jsonList: any[], conflictStrategy: 'keep_existing' | 'overwrite') => {
    setSyncStatus('saving');
    try {
      let added = 0;
      let updated = 0;
      const workerMap = new Map<string, Worker>();
      workers.forEach((w) => workerMap.set(w.empCode.toLowerCase(), w));

      const toWriteList: Worker[] = [];

      jsonList.forEach((fileObj) => {
        if (fileObj && Array.isArray(fileObj.workers)) {
          fileObj.workers.forEach((w: Worker) => {
            if (!w.empCode) return;
            const codeKey = w.empCode.toLowerCase();
            if (workerMap.has(codeKey)) {
              if (conflictStrategy === 'overwrite') {
                const combined = { ...workerMap.get(codeKey)!, ...w };
                workerMap.set(codeKey, combined);
                toWriteList.push(combined);
                updated++;
              }
            } else {
              const newW = { ...w, id: w.id || generateId('w_mrg') };
              workerMap.set(codeKey, newW);
              toWriteList.push(newW);
              added++;
            }
          });
        }
      });

      for (let i = 0; i < toWriteList.length; i += 400) {
        const chunk = toWriteList.slice(i, i + 400);
        const b = writeBatch(db);
        chunk.forEach((item) => b.set(doc(db, 'workers', item.id), item));
        await b.commit();
      }

      await addAuditLog('RESTORE', `Gộp ${jsonList.length} file JSON lên Cloud: Thêm ${added}, cập nhật ${updated}`);
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, addedCount: added, updatedCount: updated };
    } catch (e: any) {
      console.error('Merge JSON error:', e);
      setSyncStatus('error');
      return { success: false, addedCount: 0, updatedCount: 0 };
    }
  };

  // ----------------------------------------------------
  // USER MANAGEMENT (CLOUD FIRESTORE)
  // ----------------------------------------------------
  const addUser = async (userData: Omit<User, 'id' | 'createdAt'>) => {
    const existing = users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      return { success: false, message: 'Email này đã tồn tại trong danh sách tài khoản!' };
    }

    setSyncStatus('saving');
    const newUser: User = {
      ...userData,
      id: generateId('user'),
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'users', newUser.id), newUser);
      await addAuditLog('CREATE', `Admin thêm tài khoản mới: ${newUser.name} (${newUser.email}, quyền: ${newUser.role})`);
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: `Đã tạo tài khoản ${newUser.name} trên Cloud thành công!` };
    } catch (e: any) {
      console.error('Error adding user to Firestore:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi tạo tài khoản: ${e.message}` };
    }
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    setSyncStatus('saving');
    const existing = users.find((u) => u.id === id);
    if (!existing) {
      setSyncStatus('synced');
      return { success: false, message: 'Không tìm thấy người dùng!' };
    }

    const updated = { ...existing, ...updates };
    try {
      await setDoc(doc(db, 'users', id), updated);
      await addAuditLog('UPDATE', `Admin cập nhật tài khoản: ${updated.name} (${updated.email})`);
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: 'Đã cập nhật tài khoản người dùng trên Cloud!' };
    } catch (e: any) {
      console.error('Error updating user in Firestore:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi cập nhật: ${e.message}` };
    }
  };

  const deleteUser = async (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'Không tìm thấy tài khoản cần xóa!' };
    if (target.email.toLowerCase() === 'liencp85@gmail.com') {
      return { success: false, message: 'Không thể xóa tài khoản Admin gốc (Liencp85@gmail.com)!' };
    }

    setSyncStatus('saving');
    try {
      await deleteDoc(doc(db, 'users', id));
      await addAuditLog('DELETE', `Admin xóa tài khoản: ${target.name} (${target.email})`);
      setSyncStatus('synced');
      setLastSyncTime(new Date());
      return { success: true, message: `Đã xóa tài khoản ${target.name} trên Cloud!` };
    } catch (e: any) {
      console.error('Error deleting user from Firestore:', e);
      setSyncStatus('error');
      return { success: false, message: `Lỗi xóa tài khoản: ${e.message}` };
    }
  };

  const resetToDemoData = async () => {
    await seedInitialFirestoreData();
    await addAuditLog('RESTORE', 'Đã tải lại dữ liệu mẫu Demo KTX lên Cloud');
  };

  const clearAllWorkers = async () => {
    setSyncStatus('saving');
    try {
      const snap = await getDocs(collection(db, 'workers'));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await addAuditLog('DELETE', 'Đã làm trống toàn bộ dữ liệu công nhân trên Cloud (Khởi tạo trắng)');
      setSyncStatus('synced');
      setLastSyncTime(new Date());
    } catch (e) {
      console.error('Error clearing workers in Firestore:', e);
      setSyncStatus('error');
    }
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
        forceSyncNow,
        login,
        logout,
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
        updateConfig,
        importWorkers,
        backupData,
        restoreData,
        mergeJsonData,
        autoSaveJsonOnExit,
        setAutoSaveJsonOnExit,
        downloadBackupJson,
        getLatestExitBackup,
        addUser,
        updateUser,
        deleteUser,
        resetToDemoData,
        clearAllWorkers,
        getWorkersInRoom,
        getOccupiedRoomsCount,
        getTotalOccupants,
        getTodayEntriesCount,
        getTodayExitsCount,
        getTeamLeadersSummary,
        getTeamLeadersCount,
        updateTeamLeaderPhone,
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
