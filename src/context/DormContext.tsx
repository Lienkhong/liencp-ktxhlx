import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
} from '../types';
import {
  INITIAL_CONFIG,
  INITIAL_MANAGER,
  INITIAL_USERS,
  INITIAL_WORKERS,
  INITIAL_AUDIT_LOGS,
} from '../data/initialData';
import { generateId, getTodayStr } from '../utils/helpers';

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
  
  // Auth
  login: (email: string, pass: string) => { success: boolean; message: string };
  logout: () => void;
  
  // Worker Operations
  addWorker: (
    worker: Omit<Worker, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
    overwriteIfDuplicate?: boolean
  ) => { success: boolean; message: string; duplicateWorker?: Worker };
  updateWorker: (
    id: string,
    updates: Partial<Omit<Worker, 'id' | 'createdAt' | 'createdBy'>>
  ) => { success: boolean; message: string };
  deleteWorker: (id: string) => { success: boolean; message: string };
  deleteWorkerByEmpCode: (empCode: string) => { success: boolean; message: string; deletedWorker?: Worker };
  getWorkerById: (id: string) => Worker | undefined;
  getWorkerByEmpCode: (empCode: string) => Worker | undefined;

  // Management & Config
  updateManagerInfo: (info: Partial<ManagerInfo>) => void;
  updateConfig: (newConfig: DormConfig) => { success: boolean; message: string };
  
  // Import & Export & Backup
  importWorkers: (rows: ImportPreviewRow[], overwriteDuplicates?: boolean) => { success: boolean; importedCount: number; updatedCount: number };
  backupData: () => any;
  restoreData: (jsonData: any, overwrite?: boolean) => { success: boolean; message: string };
  mergeJsonData: (jsonList: any[], conflictStrategy: 'keep_existing' | 'overwrite') => { success: boolean; addedCount: number; updatedCount: number };
  
  // User Management (Admin only)
  addUser: (user: Omit<User, 'id' | 'createdAt'>) => { success: boolean; message: string };
  updateUser: (id: string, updates: Partial<User>) => { success: boolean; message: string };
  deleteUser: (id: string) => { success: boolean; message: string };

  // Reset / Demo
  resetToDemoData: () => void;
  clearAllWorkers: () => void;
  
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
  updateTeamLeaderPhone: (leaderName: string, phone: string) => void;
}

const DormContext = createContext<DormContextType | null>(null);

const STORAGE_KEYS = {
  WORKERS: 'qktx_workers_v1',
  CONFIG: 'qktx_config_v1',
  MANAGER: 'qktx_manager_v1',
  USERS: 'qktx_users_v1',
  CURRENT_USER: 'qktx_current_user_v1',
  AUDIT_LOGS: 'qktx_audit_logs_v1',
  THEME: 'qktx_theme_v1',
  AUTO_SAVE_EXIT: 'qktx_auto_save_json_on_exit_v1',
  EXIT_SNAPSHOT: 'qktx_exit_backup_snapshot_v1',
  LEADER_PHONES: 'qktx_leader_phones_v1',
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
  // Workers State
  const [workers, setWorkers] = useState<Worker[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WORKERS);
      return saved ? JSON.parse(saved) : INITIAL_WORKERS;
    } catch {
      return INITIAL_WORKERS;
    }
  });

  // Config State
  const [config, setConfig] = useState<DormConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      return saved ? JSON.parse(saved) : INITIAL_CONFIG;
    } catch {
      return INITIAL_CONFIG;
    }
  });

  // Manager Info
  const [manager, setManager] = useState<ManagerInfo>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MANAGER);
      return saved ? JSON.parse(saved) : INITIAL_MANAGER;
    } catch {
      return INITIAL_MANAGER;
    }
  });

  // Users State
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed: User[] = JSON.parse(saved);
        // Automatically sync super admin name if needed
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

  // Current User (default to Admin for instant seamless exploration or stored session)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (saved) {
        const parsed: User = JSON.parse(saved);
        if (parsed.email?.toLowerCase() === 'liencp85@gmail.com') {
          return { ...parsed, name: 'Khổng Minh Liên (Admin)' };
        }
        return parsed;
      }
      // Auto login as Admin on first load
      return INITIAL_USERS[0];
    } catch {
      return INITIAL_USERS[0];
    }
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  // Theme State
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      return (saved === 'dark' || saved === 'light') ? saved : 'light';
    } catch {
      return 'light';
    }
  });

  // Auto-Save JSON on Exit preference (defaults to true)
  const [autoSaveJsonOnExit, setAutoSaveJsonOnExitState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE_EXIT);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  // Custom Team Leader Phones storage
  const [leaderPhones, setLeaderPhones] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEADER_PHONES);
      return saved ? { ...DEFAULT_LEADER_PHONES, ...JSON.parse(saved) } : DEFAULT_LEADER_PHONES;
    } catch {
      return DEFAULT_LEADER_PHONES;
    }
  });

  const setAutoSaveJsonOnExit = (val: boolean) => {
    setAutoSaveJsonOnExitState(val);
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE_EXIT, String(val));
    } catch (e) {
      console.warn('Failed to save autoSaveJsonOnExit preference', e);
    }
  };

  // Helper to trigger JSON backup download
  const downloadBackupJson = useCallback((customFileName?: string) => {
    const payload = {
      version: '1.0',
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
    a.download = customFileName || `Sao_Luu_KTX_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [manager, config, users, workers, auditLogs]);

  // Save continuous backup snapshot to local storage
  useEffect(() => {
    try {
      const snapshotPayload = {
        version: '1.0',
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
      console.warn('Failed to save continuous exit snapshot', e);
    }
  }, [workers, config, manager, users, auditLogs]);

  // Retrieve latest exit backup snapshot
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

  // Listen to beforeunload and pagehide to auto save / download JSON when exiting
  useEffect(() => {
    const handleExit = () => {
      // 1. Force update snapshot
      try {
        const snapshotPayload = {
          version: '1.0',
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

      // 2. Trigger auto download if enabled
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

  // Persist to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MANAGER, JSON.stringify(manager));
  }, [manager]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs.slice(0, 300)));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Log Audit helper
  const addAuditLog = useCallback(
    (action: AuditLog['action'], details: string, empCode?: string, targetId?: string) => {
      const newLog: AuditLog = {
        id: generateId('log'),
        timestamp: new Date().toISOString(),
        userName: currentUser?.name || manager.name || 'Hệ thống',
        userEmail: currentUser?.email || 'system@local',
        action,
        details,
        empCode,
        targetId,
      };
      setAuditLogs((prev) => [newLog, ...prev]);
    },
    [currentUser, manager]
  );

  const updateTeamLeaderPhone = useCallback(
    (leaderName: string, phone: string) => {
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
      addAuditLog('UPDATE', `Cập nhật số điện thoại tổ trưởng ${leaderName}: ${phone.trim()}`);
    },
    [addAuditLog]
  );

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Auth
  const login = (email: string, pass: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const foundUser = users.find((u) => u.email.toLowerCase() === trimmedEmail);

    if (!foundUser) {
      return { success: false, message: 'Email này chưa được Admin cấp quyền đăng nhập!' };
    }

    if (foundUser.password && foundUser.password !== pass) {
      return { success: false, message: 'Mật khẩu không chính xác!' };
    }

    setCurrentUser(foundUser);
    addAuditLog('LOGIN', `Người dùng ${foundUser.name} (${foundUser.email}) đã đăng nhập hệ thống`);
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

    // Check if leader phone is saved in leaderPhones or in workers
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

      const primaryDorm = leaderAsWorker?.dorm || (sortedRooms[0]?.dorm);
      const primaryRoom = leaderAsWorker?.room || (sortedRooms[0]?.room);

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

  // Worker CRUD
  const addWorker = (
    workerData: Omit<Worker, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
    overwriteIfDuplicate = false
  ) => {
    const cleanEmpCode = workerData.empCode.trim();
    const existing = workers.find(
      (w) => w.empCode.trim().toLowerCase() === cleanEmpCode.toLowerCase()
    );

    if (existing && !overwriteIfDuplicate) {
      return {
        success: false,
        message: `Mã nhân viên "${cleanEmpCode}" đã tồn tại trên hệ thống!`,
        duplicateWorker: existing,
      };
    }

    // Check room capacity
    if (workerData.status === 'Đang ở') {
      const roomOccupants = workers.filter(
        (w) =>
          w.dorm === workerData.dorm &&
          w.room === workerData.room &&
          w.status === 'Đang ở' &&
          w.id !== existing?.id
      );

      if (roomOccupants.length >= config.maxBedsPerRoom) {
        return {
          success: false,
          message: `Phòng ${workerData.room} (Dãy ${workerData.dorm}) đã đạt sức chứa tối đa (${config.maxBedsPerRoom} người)!`,
        };
      }

      // Check bed conflict
      if (config.enforceBedControl && workerData.bed) {
        const bedTaken = roomOccupants.find((w) => w.bed === workerData.bed);
        if (bedTaken) {
          return {
            success: false,
            message: `Giường số ${workerData.bed} tại Phòng ${workerData.room} (Dãy ${workerData.dorm}) đang có công nhân ${bedTaken.name} (${bedTaken.empCode}) ở!`,
          };
        }
      }
    }

    const today = getTodayStr();
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || manager.name || 'Quản lý';

    // Auto set entry date if active
    let entryDate = workerData.entryDate;
    if (workerData.status === 'Đang ở' && !entryDate) {
      entryDate = today;
    }

    if (existing && overwriteIfDuplicate) {
      // Overwrite existing
      const updatedList = workers.map((w) => {
        if (w.id === existing.id) {
          return {
            ...w,
            ...workerData,
            entryDate,
            updatedAt: nowIso,
            updatedBy: operatorName,
          };
        }
        return w;
      });

      setWorkers(updatedList);
      addAuditLog(
        'UPDATE',
        `Ghi đè thông tin công nhân ${workerData.name} (Mã: ${cleanEmpCode}, Dãy ${workerData.dorm} - P.${workerData.room})`,
        cleanEmpCode,
        existing.id
      );
      return { success: true, message: `Đã ghi đè thành công công nhân ${workerData.name} (${cleanEmpCode})!` };
    }

    // Create new
    const newWorker: Worker = {
      ...workerData,
      id: generateId('w'),
      entryDate,
      exitDate: workerData.status === 'Đã rời KTX' ? (workerData.exitDate || today) : '',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: operatorName,
      updatedBy: operatorName,
    };

    setWorkers((prev) => [newWorker, ...prev]);
    addAuditLog(
      'CREATE',
      `Thêm mới công nhân ${newWorker.name} (Mã: ${newWorker.empCode}, Dãy ${newWorker.dorm} - Phòng ${newWorker.room})`,
      newWorker.empCode,
      newWorker.id
    );

    return { success: true, message: `Đã thêm thành công công nhân ${newWorker.name}!` };
  };

  const updateWorker = (
    id: string,
    updates: Partial<Omit<Worker, 'id' | 'createdAt' | 'createdBy'>>
  ) => {
    const existing = workers.find((w) => w.id === id);
    if (!existing) {
      return { success: false, message: 'Không tìm thấy thông tin công nhân cần cập nhật!' };
    }

    // If changing empCode, check collision
    if (updates.empCode && updates.empCode.trim().toLowerCase() !== existing.empCode.toLowerCase()) {
      const codeCollision = workers.find(
        (w) => w.id !== id && w.empCode.trim().toLowerCase() === updates.empCode!.trim().toLowerCase()
      );
      if (codeCollision) {
        return {
          success: false,
          message: `Mã nhân viên "${updates.empCode}" đã thuộc về công nhân ${codeCollision.name}!`,
        };
      }
    }

    const targetDorm = updates.dorm !== undefined ? updates.dorm : existing.dorm;
    const targetRoom = updates.room !== undefined ? updates.room : existing.room;
    const targetBed = updates.bed !== undefined ? updates.bed : existing.bed;
    const targetStatus = updates.status !== undefined ? updates.status : existing.status;

    // Check room capacity if staying active
    if (targetStatus === 'Đang ở') {
      const otherOccupants = workers.filter(
        (w) => w.id !== id && w.dorm === targetDorm && w.room === targetRoom && w.status === 'Đang ở'
      );
      if (otherOccupants.length >= config.maxBedsPerRoom) {
        return {
          success: false,
          message: `Phòng ${targetRoom} (Dãy ${targetDorm}) đã đầy sức chứa tối đa (${config.maxBedsPerRoom} người)!`,
        };
      }
      if (config.enforceBedControl && targetBed) {
        const bedCollision = otherOccupants.find((w) => w.bed === targetBed);
        if (bedCollision) {
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

    // Status transition tracking
    let newEntryDate = updates.entryDate !== undefined ? updates.entryDate : existing.entryDate;
    let newExitDate = updates.exitDate !== undefined ? updates.exitDate : existing.exitDate;

    if (existing.status !== 'Đang ở' && targetStatus === 'Đang ở') {
      if (!newEntryDate) newEntryDate = today;
      newExitDate = '';
    } else if (existing.status === 'Đang ở' && targetStatus === 'Đã rời KTX') {
      newExitDate = today;
    }

    const updatedWorker: Worker = {
      ...existing,
      ...updates,
      entryDate: newEntryDate,
      exitDate: newExitDate,
      updatedAt: nowIso,
      updatedBy: operatorName,
    };

    setWorkers((prev) => prev.map((w) => (w.id === id ? updatedWorker : w)));
    addAuditLog(
      'UPDATE',
      `Cập nhật công nhân ${updatedWorker.name} (${updatedWorker.empCode}) - Dãy ${updatedWorker.dorm}, P.${updatedWorker.room}`,
      updatedWorker.empCode,
      id
    );

    return { success: true, message: `Đã cập nhật công nhân ${updatedWorker.name} thành công!` };
  };

  const deleteWorker = (id: string) => {
    const target = workers.find((w) => w.id === id);
    if (!target) return { success: false, message: 'Không tìm thấy công nhân cần xóa!' };

    setWorkers((prev) => prev.filter((w) => w.id !== id));
    addAuditLog(
      'DELETE',
      `Xóa công nhân ${target.name} (Mã: ${target.empCode}, Dãy ${target.dorm} - Phòng ${target.room})`,
      target.empCode,
      id
    );
    return { success: true, message: `Đã xóa công nhân ${target.name} (${target.empCode})!` };
  };

  const deleteWorkerByEmpCode = (empCode: string) => {
    const cleanCode = empCode.trim();
    const target = workers.find(
      (w) => w.empCode.trim().toLowerCase() === cleanCode.toLowerCase()
    );
    if (!target) {
      return { success: false, message: `Không tìm thấy công nhân có mã "${cleanCode}"!` };
    }

    setWorkers((prev) => prev.filter((w) => w.id !== target.id));
    addAuditLog(
      'DELETE',
      `Xóa theo mã NV: ${target.name} (Mã: ${target.empCode})`,
      target.empCode,
      target.id
    );
    return { success: true, message: `Đã xóa thành công công nhân ${target.name} (${target.empCode})!`, deletedWorker: target };
  };

  // Manager & Scale Config
  const updateManagerInfo = (info: Partial<ManagerInfo>) => {
    setManager((prev) => {
      const updated = { ...prev, ...info };
      addAuditLog('UPDATE', `Thay đổi thông tin người quản lý thành "${updated.name}"`);
      return updated;
    });
  };

  const updateConfig = (newConfig: DormConfig) => {
    // Check if down-scaling would exclude existing active workers
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

    setConfig(newConfig);
    addAuditLog(
      'SCALE_CHANGE',
      `Thay đổi cấu hình quy mô KTX: ${newConfig.numDorms} dãy, ${newConfig.roomsPerDorm} phòng/dãy, tối đa ${newConfig.maxBedsPerRoom} người/phòng`
    );
    return { success: true, message: 'Đã lưu cấu hình quy mô Ký túc xá thành công!' };
  };

  // Import Workers
  const importWorkers = (rows: ImportPreviewRow[], overwriteDuplicates = true) => {
    const today = getTodayStr();
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || manager.name || 'Quản lý';

    let importedCount = 0;
    let updatedCount = 0;

    const workerMap = new Map<string, Worker>();
    workers.forEach((w) => workerMap.set(w.empCode.toLowerCase(), w));

    rows.forEach((row) => {
      if (!row.isValid) return;

      const codeKey = row.empCode.toLowerCase();
      const existing = workerMap.get(codeKey);

      if (existing) {
        if (overwriteDuplicates) {
          workerMap.set(codeKey, {
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
          });
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
        importedCount++;
      }
    });

    const newWorkerList = Array.from(workerMap.values());
    setWorkers(newWorkerList);
    addAuditLog(
      'IMPORT',
      `Nhập Excel: Thêm mới ${importedCount} công nhân, cập nhật ${updatedCount} công nhân`
    );

    return { success: true, importedCount, updatedCount };
  };

  // Backup & Restore
  const backupData = () => {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      appName: 'QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN',
      manager,
      config,
      users,
      workers,
    };
  };

  const restoreData = (jsonData: any, overwrite = true) => {
    try {
      if (!jsonData || !Array.isArray(jsonData.workers)) {
        return { success: false, message: 'File JSON không hợp lệ hoặc thiếu dữ liệu danh sách công nhân!' };
      }

      if (overwrite) {
        setWorkers(jsonData.workers);
        if (jsonData.config) setConfig(jsonData.config);
        if (jsonData.manager) setManager(jsonData.manager);
        if (Array.isArray(jsonData.users) && jsonData.users.length > 0) setUsers(jsonData.users);
      } else {
        // Append / merge
        const existingCodes = new Set(workers.map((w) => w.empCode.toLowerCase()));
        const toAdd = jsonData.workers.filter(
          (w: Worker) => w.empCode && !existingCodes.has(w.empCode.toLowerCase())
        );
        setWorkers((prev) => [...prev, ...toAdd]);
      }

      addAuditLog('RESTORE', `Khôi phục dữ liệu từ file JSON (${jsonData.workers.length} công nhân)`);
      return { success: true, message: `Khôi phục thành công ${jsonData.workers.length} hồ sơ công nhân!` };
    } catch (e: any) {
      return { success: false, message: `Lỗi khôi phục: ${e.message}` };
    }
  };

  const mergeJsonData = (jsonList: any[], conflictStrategy: 'keep_existing' | 'overwrite') => {
    try {
      let added = 0;
      let updated = 0;
      const workerMap = new Map<string, Worker>();
      workers.forEach((w) => workerMap.set(w.empCode.toLowerCase(), w));

      jsonList.forEach((fileObj) => {
        if (fileObj && Array.isArray(fileObj.workers)) {
          fileObj.workers.forEach((w: Worker) => {
            if (!w.empCode) return;
            const codeKey = w.empCode.toLowerCase();
            if (workerMap.has(codeKey)) {
              if (conflictStrategy === 'overwrite') {
                workerMap.set(codeKey, { ...workerMap.get(codeKey)!, ...w });
                updated++;
              }
            } else {
              workerMap.set(codeKey, w);
              added++;
            }
          });
        }
      });

      setWorkers(Array.from(workerMap.values()));
      addAuditLog('RESTORE', `Gộp ${jsonList.length} file JSON: Thêm ${added}, cập nhật ${updated}`);
      return { success: true, addedCount: added, updatedCount: updated };
    } catch (e: any) {
      return { success: false, addedCount: 0, updatedCount: 0 };
    }
  };

  // User Management (Admin)
  const addUser = (userData: Omit<User, 'id' | 'createdAt'>) => {
    const existing = users.find((u) => u.email.toLowerCase() === userData.email.toLowerCase());
    if (existing) {
      return { success: false, message: 'Email này đã tồn tại trong danh sách tài khoản!' };
    }

    const newUser: User = {
      ...userData,
      id: generateId('user'),
      createdAt: new Date().toISOString(),
    };

    setUsers((prev) => [...prev, newUser]);
    addAuditLog('CREATE', `Admin thêm tài khoản mới: ${newUser.name} (${newUser.email}, quyền: ${newUser.role})`);
    return { success: true, message: `Đã tạo tài khoản ${newUser.name} thành công!` };
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === id) {
          const updated = { ...u, ...updates };
          addAuditLog('UPDATE', `Admin cập nhật tài khoản: ${updated.name} (${updated.email})`);
          return updated;
        }
        return u;
      })
    );
    return { success: true, message: 'Đã cập nhật tài khoản người dùng!' };
  };

  const deleteUser = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return { success: false, message: 'Không tìm thấy tài khoản cần xóa!' };
    if (target.email.toLowerCase() === 'liencp85@gmail.com') {
      return { success: false, message: 'Không thể xóa tài khoản Admin gốc (Liencp85@gmail.com)!' };
    }

    setUsers((prev) => prev.filter((u) => u.id !== id));
    addAuditLog('DELETE', `Admin xóa tài khoản: ${target.name} (${target.email})`);
    return { success: true, message: `Đã xóa tài khoản ${target.name}!` };
  };

  const resetToDemoData = () => {
    setWorkers(INITIAL_WORKERS);
    setConfig(INITIAL_CONFIG);
    setManager(INITIAL_MANAGER);
    setUsers(INITIAL_USERS);
    addAuditLog('RESTORE', 'Đã tải lại dữ liệu mẫu Demo KTX');
  };

  const clearAllWorkers = () => {
    setWorkers([]);
    addAuditLog('DELETE', 'Đã làm trống toàn bộ dữ liệu công nhân (Khởi tạo trắng)');
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
        login,
        logout,
        addWorker,
        updateWorker,
        deleteWorker,
        deleteWorkerByEmpCode,
        getWorkerById,
        getWorkerByEmpCode,
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
