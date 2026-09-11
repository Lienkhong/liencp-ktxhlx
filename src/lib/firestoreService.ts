import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db, cleanFirestoreDoc } from './firebase';
import {
  Worker,
  User,
  DormConfig,
  ManagerInfo,
  AuditLog,
  CheckedOutWorker,
} from '../types';
import { syncMonitor } from './syncMonitor';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code || '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Free daily read units per project')
  );
}

const QUOTA_STORAGE_KEY = 'qktx_firestore_quota_exceeded_until';

export function isQuotaCircuitBreakerActive(): boolean {
  try {
    const until = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!until) return false;
    const untilMs = Number(until);
    if (Date.now() < untilMs) {
      return true;
    }
    localStorage.removeItem(QUOTA_STORAGE_KEY);
    return false;
  } catch {
    return false;
  }
}

export function activateQuotaCircuitBreaker(cooldownMinutes = 60): void {
  try {
    const untilMs = Date.now() + cooldownMinutes * 60 * 1000;
    localStorage.setItem(QUOTA_STORAGE_KEY, String(untilMs));
  } catch {}
}

export function resetQuotaCircuitBreaker(): void {
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {}
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isQuota = isQuotaExceededError(error);

  if (isQuota) {
    activateQuotaCircuitBreaker(60);
    console.warn(
      `[Firestore Quota Notice] Dự án đạt hạn mức đọc miễn phí trong ngày của Firebase (50.000 READs/ngày). Ứng dụng tự động kích hoạt chế độ Offline-First với LocalStorage/IndexedDB an toàn 100%. Path: ${path || 'unknown'}`
    );
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
}

// ============================================================================
// 0. METADATA & CHANGE DETECTION (TỐI ƯU HÓA ĐỒNG BỘ 2 PHÚT)
// ============================================================================

export interface SyncMetadata {
  lastUpdatedAt: string; // ISO String mốc cập nhật mới nhất toàn hệ thống
  workersUpdatedAt?: string;
  configUpdatedAt?: string;
  managerUpdatedAt?: string;
  usersUpdatedAt?: string;
  checkedOutUpdatedAt?: string;
  deletedWorkerIds?: string[];
  lastMutationSource?: string;
  version?: number;
}

/**
 * Đọc tài liệu metadata đồng bộ: CHỈ TỐN ĐÚNG 1 LẦN READ
 * Giúp kiểm tra xem có thay đổi nào giữa điện thoại Manager và web Admin không.
 */
export async function fetchSyncMetadata(forceBypassBreaker = false): Promise<SyncMetadata | null> {
  if (!forceBypassBreaker && isQuotaCircuitBreakerActive()) {
    return null;
  }

  try {
    const docRef = doc(db, 'system_config', 'sync_status');
    const snap = await getDoc(docRef);
    syncMonitor.recordRead('system_config/sync_status', 1, 'Kiểm tra chu kỳ đồng bộ metadata 1 phút');
    if (snap.exists()) {
      return snap.data() as SyncMetadata;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'system_config/sync_status');
    if (isQuotaExceededError(err)) {
      return null;
    }
    throw err;
  }
}

/**
 * Ghi nhận mốc thay đổi vào metadata (chỉ 1 doc ghi nhận)
 */
export async function touchSyncMetadata(partial: Partial<SyncMetadata>): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const docRef = doc(db, 'system_config', 'sync_status');
    const updateData: Partial<SyncMetadata> = {
      ...partial,
      lastUpdatedAt: nowIso,
    };
    await setDoc(docRef, cleanFirestoreDoc(updateData), { merge: true });
    syncMonitor.recordWrite('system_config/sync_status', 1, 'Cập nhật mốc thay đổi metadata');
  } catch (err) {
    console.warn('Lưu ý không thể cập nhật sync_metadata:', err);
  }
}

// ============================================================================
// 1. WORKERS (DELTA QUERY & FULL FETCH WITH MONITORING)
// ============================================================================

/**
 * Truy vấn Delta: Chỉ lấy các công nhân có thay đổi (updatedAt > sinceIso)
 * Tiết kiệm tối đa số READ, không tải lại toàn bộ database
 */
export async function fetchChangedWorkers(sinceIso: string, forceBypassBreaker = false): Promise<Worker[]> {
  if (!forceBypassBreaker && isQuotaCircuitBreakerActive()) {
    return [];
  }
  try {
    const colRef = collection(db, 'workers');
    const q = query(colRef, where('updatedAt', '>', sinceIso));
    const snapshot = await getDocs(q);
    syncMonitor.recordRead('workers (delta)', snapshot.size, `Chỉ lấy ${snapshot.size} công nhân thay đổi từ ${sinceIso}`);
    const list: Worker[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Worker;
      list.push({
        ...data,
        id: data.id || docSnap.id,
      });
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'workers/delta');
    if (isQuotaExceededError(err)) {
      return [];
    }
    throw err;
  }
}

/**
 * Tải toàn bộ danh sách công nhân từ Cloud Firestore (khi khởi tạo hoặc Full Sync)
 */
export async function fetchAllWorkersFromFirestore(forceBypassBreaker = false): Promise<Worker[]> {
  if (!forceBypassBreaker && isQuotaCircuitBreakerActive()) {
    return [];
  }
  try {
    const colRef = collection(db, 'workers');
    const snapshot = await getDocs(colRef);
    syncMonitor.recordRead('workers', snapshot.size, 'Tải toàn bộ danh sách công nhân');
    const list: Worker[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Worker;
      list.push({
        ...data,
        id: data.id || docSnap.id,
      });
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'workers');
    return [];
  }
}

/**
 * Lưu hoặc cập nhật một công nhân lên Cloud Firestore
 * Tự động gắn updatedAt và cập nhật metadata đồng bộ
 */
export async function saveWorkerToFirestore(worker: Worker): Promise<void> {
  if (isQuotaCircuitBreakerActive()) {
    return;
  }
  const targetId = worker.id || worker.empCode;
  const docRef = doc(db, 'workers', targetId);
  try {
    const nowIso = new Date().toISOString();
    const workerToSave: Partial<Worker> = {
      ...worker,
      updatedAt: worker.updatedAt || nowIso,
      cccdFrontImage: worker.cccdFrontImage && worker.cccdFrontImage.length > 50000 ? undefined : worker.cccdFrontImage,
      cccdBackImage: worker.cccdBackImage && worker.cccdBackImage.length > 50000 ? undefined : worker.cccdBackImage,
    };
    await setDoc(docRef, cleanFirestoreDoc(workerToSave), { merge: true });
    syncMonitor.recordWrite(`workers/${targetId}`, 1, 'Lưu hồ sơ công nhân');

    // Cập nhật metadata để các máy/nick khác phát hiện ngay trong chu kỳ 1 phút
    await touchSyncMetadata({
      workersUpdatedAt: nowIso,
      lastMutationSource: `SAVE_${targetId}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `workers/${targetId}`);
    if (isQuotaExceededError(err)) {
      return;
    }
    throw err;
  }
}

/**
 * Xóa công nhân khỏi Cloud Firestore
 * Ghi nhận ID đã xóa vào metadata để các client khác xóa khỏi local cache mà không cần fetch lại
 */
export async function deleteWorkerFromFirestore(workerId: string): Promise<void> {
  if (isQuotaCircuitBreakerActive()) {
    return;
  }
  const docRef = doc(db, 'workers', workerId);
  try {
    const nowIso = new Date().toISOString();
    await deleteDoc(docRef);
    syncMonitor.recordWrite(`workers/${workerId}`, 1, 'Xóa hồ sơ công nhân');

    await touchSyncMetadata({
      workersUpdatedAt: nowIso,
      deletedWorkerIds: [workerId],
      lastMutationSource: `DELETE_${workerId}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workers/${workerId}`);
    if (isQuotaExceededError(err)) {
      return;
    }
    throw err;
  }
}

/**
 * Nạp hàng loạt công nhân lên Cloud Firestore theo từng lô 450 documents
 */
export async function batchUpsertWorkersToFirestore(workers: Worker[]): Promise<void> {
  if (isQuotaCircuitBreakerActive() || !workers || workers.length === 0) return;

  const nowIso = new Date().toISOString();
  const CHUNK_SIZE = 450;
  for (let i = 0; i < workers.length; i += CHUNK_SIZE) {
    const chunk = workers.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((worker) => {
      const targetId = worker.id || worker.empCode;
      const docRef = doc(db, 'workers', targetId);
      const workerToSave: Partial<Worker> = {
        ...worker,
        updatedAt: worker.updatedAt || nowIso,
        cccdFrontImage: worker.cccdFrontImage && worker.cccdFrontImage.length > 50000 ? undefined : worker.cccdFrontImage,
        cccdBackImage: worker.cccdBackImage && worker.cccdBackImage.length > 50000 ? undefined : worker.cccdBackImage,
      };
      batch.set(docRef, cleanFirestoreDoc(workerToSave), { merge: true });
    });

    try {
      await batch.commit();
      syncMonitor.recordWrite('workers (batch)', chunk.length, `Ghi lô ${chunk.length} công nhân`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'workers (batch)');
      if (isQuotaExceededError(err)) {
        return;
      }
      throw err;
    }
  }

  await touchSyncMetadata({
    workersUpdatedAt: nowIso,
    lastMutationSource: `BATCH_UPSERT_${workers.length}`,
  });
}

/**
 * Xóa toàn bộ công nhân trong KTX khỏi Firestore
 */
export async function clearAllWorkersFromFirestore(): Promise<void> {
  try {
    const colRef = collection(db, 'workers');
    const snapshot = await getDocs(colRef);
    const docs = snapshot.docs;

    const CHUNK_SIZE = 450;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    syncMonitor.recordWrite('workers (clearAll)', docs.length, 'Xóa sạch danh sách công nhân');
    await touchSyncMetadata({
      workersUpdatedAt: new Date().toISOString(),
      lastMutationSource: 'CLEAR_ALL',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'workers (clearAll)');
  }
}

// ============================================================================
// 2. CHECKED-OUT WORKERS ARCHIVE (LƯU TRỮ ĐÃ CHECK-OUT / ĐÃ XÓA)
// ============================================================================

export async function fetchCheckedOutHistoryFromFirestore(forceBypassBreaker = false): Promise<CheckedOutWorker[]> {
  if (!forceBypassBreaker && isQuotaCircuitBreakerActive()) {
    return [];
  }
  try {
    const colRef = collection(db, 'checked_out_workers');
    const snapshot = await getDocs(colRef);
    syncMonitor.recordRead('checked_out_workers', snapshot.size, 'Tải danh sách đã check-out');
    const list: CheckedOutWorker[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as CheckedOutWorker;
      list.push({
        ...data,
        id: data.id || docSnap.id,
      });
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'checked_out_workers');
    return [];
  }
}

export async function insertCheckedOutRecordToFirestore(record: CheckedOutWorker): Promise<void> {
  if (isQuotaCircuitBreakerActive()) return;
  const docRef = doc(db, 'checked_out_workers', record.id);
  try {
    const nowIso = new Date().toISOString();
    await setDoc(docRef, cleanFirestoreDoc(record), { merge: true });
    syncMonitor.recordWrite(`checked_out_workers/${record.id}`, 1, 'Lưu hồ sơ check-out');
    await touchSyncMetadata({
      checkedOutUpdatedAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `checked_out_workers/${record.id}`);
  }
}

export async function deleteCheckedOutRecordFromFirestore(recordId: string): Promise<void> {
  if (isQuotaCircuitBreakerActive()) return;
  const docRef = doc(db, 'checked_out_workers', recordId);
  try {
    await deleteDoc(docRef);
    syncMonitor.recordWrite(`checked_out_workers/${recordId}`, 1, 'Xóa hồ sơ check-out');
    await touchSyncMetadata({
      checkedOutUpdatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `checked_out_workers/${recordId}`);
  }
}

// ============================================================================
// 3. SYSTEM CONFIG & MANAGER INFO
// ============================================================================

export async function fetchSystemConfigFromFirestore(forceBypassBreaker = false): Promise<DormConfig | null> {
  if (!forceBypassBreaker && isQuotaCircuitBreakerActive()) {
    return null;
  }
  try {
    const docRef = doc(db, 'system_config', 'current');
    const snap = await getDoc(docRef);
    syncMonitor.recordRead('system_config/current', 1, 'Tải cấu hình KTX');
    if (snap.exists()) {
      return snap.data() as DormConfig;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'system_config/current');
    return null;
  }
}

export async function saveSystemConfigToFirestore(config: DormConfig): Promise<void> {
  if (isQuotaCircuitBreakerActive()) return;
  const docRef = doc(db, 'system_config', 'current');
  try {
    const nowIso = new Date().toISOString();
    await setDoc(docRef, cleanFirestoreDoc(config), { merge: true });
    syncMonitor.recordWrite('system_config/current', 1, 'Lưu cấu hình KTX');
    await touchSyncMetadata({
      configUpdatedAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'system_config/current');
  }
}

export async function fetchManagerInfoFromFirestore(forceBypassBreaker = false): Promise<ManagerInfo | null> {
  if (!forceBypassBreaker && isQuotaCircuitBreakerActive()) {
    return null;
  }
  try {
    const docRef = doc(db, 'manager_info', 'current');
    const snap = await getDoc(docRef);
    syncMonitor.recordRead('manager_info/current', 1, 'Tải thông tin quản lý');
    if (snap.exists()) {
      return snap.data() as ManagerInfo;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'manager_info/current');
    return null;
  }
}

export async function saveManagerInfoToFirestore(info: ManagerInfo): Promise<void> {
  if (isQuotaCircuitBreakerActive()) return;
  const docRef = doc(db, 'manager_info', 'current');
  try {
    const nowIso = new Date().toISOString();
    await setDoc(docRef, cleanFirestoreDoc(info), { merge: true });
    syncMonitor.recordWrite('manager_info/current', 1, 'Lưu thông tin quản lý');
    await touchSyncMetadata({
      managerUpdatedAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'manager_info/current');
  }
}

// ============================================================================
// 4. USERS & PROFILES (RBAC)
// ============================================================================

export async function fetchUsersFromFirestore(forceBypassBreaker = false): Promise<User[]> {
  if (!forceBypassBreaker && isQuotaCircuitBreakerActive()) {
    return [];
  }
  try {
    const colRef = collection(db, 'users');
    const snapshot = await getDocs(colRef);
    syncMonitor.recordRead('users', snapshot.size, 'Tải danh sách tài khoản');
    const list: User[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as User;
      list.push({
        ...data,
        id: data.id || docSnap.id,
      });
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'users');
    return [];
  }
}

export async function saveUserToFirestore(user: User): Promise<void> {
  if (isQuotaCircuitBreakerActive()) return;
  const docRef = doc(db, 'users', user.id);
  try {
    const nowIso = new Date().toISOString();
    await setDoc(docRef, cleanFirestoreDoc(user), { merge: true });
    syncMonitor.recordWrite(`users/${user.id}`, 1, 'Lưu tài khoản người dùng');
    await touchSyncMetadata({
      usersUpdatedAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  if (isQuotaCircuitBreakerActive()) return;
  const docRef = doc(db, 'users', userId);
  try {
    await deleteDoc(docRef);
    syncMonitor.recordWrite(`users/${userId}`, 1, 'Xóa tài khoản người dùng');
    await touchSyncMetadata({
      usersUpdatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
  }
}

// ============================================================================
// 5. AUDIT LOGS (LAZY LOADED)
// ============================================================================

export async function insertAuditLogInFirestore(log: AuditLog): Promise<void> {
  if (isQuotaCircuitBreakerActive()) return;
  const docRef = doc(db, 'activity_logs', log.id);
  try {
    await setDoc(docRef, cleanFirestoreDoc(log));
    syncMonitor.recordWrite(`activity_logs/${log.id}`, 1, 'Ghi nhật ký hoạt động');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `activity_logs/${log.id}`);
  }
}

export async function fetchAuditLogsFromFirestore(maxLogs = 100, forceBypassBreaker = false): Promise<AuditLog[]> {
  if (!forceBypassBreaker && isQuotaCircuitBreakerActive()) {
    return [];
  }
  try {
    const colRef = collection(db, 'activity_logs');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxLogs));
    const snapshot = await getDocs(q);
    syncMonitor.recordRead('activity_logs', snapshot.size, `Tải ${snapshot.size} nhật ký hoạt động gần nhất`);
    const list: AuditLog[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as AuditLog);
    });
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'activity_logs');
    return [];
  }
}
