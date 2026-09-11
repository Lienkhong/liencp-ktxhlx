import { supabase, isSupabaseConfigured, uploadCccdImageToSupabase, getCccdSignedUrl } from './supabase';
import {
  Worker,
  DormConfig,
  ManagerInfo,
  User,
  AuditLog,
  CheckedOutWorker,
  WorkerStatus,
} from '../types';

/**
 * ============================================================================
 * SUPABASE DATA ACCESS LAYER (DAL) CHO QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN
 * ============================================================================
 */

// Chuyển đổi từ Supabase DB row sang frontend Worker object
export function mapRowToWorker(row: any): Worker {
  return {
    id: row.id,
    name: row.name,
    dob: row.dob || '',
    dorm: Number(row.dorm) || 1,
    room: Number(row.room) || 1,
    bed: Number(row.bed) || 1,
    teamLeader: row.team_leader || '',
    status: (row.status as WorkerStatus) || 'Đang ở',
    empCode: row.emp_code || '',
    cccd: row.cccd || '',
    address: row.address || '',
    phone: row.phone || '',
    workplace: row.workplace || '',
    note: row.note || '',
    entryDate: row.entry_date || '',
    exitDate: row.exit_date || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    createdBy: row.created_by || 'Hệ thống',
    updatedBy: row.updated_by || 'Hệ thống',
    gender: row.gender || 'Nam',
    hometown: row.hometown || '',
    issueDate: row.issue_date || '',
    issuePlace: row.issue_place || '',
  };
}

// Chuyển đổi từ frontend Worker object sang Supabase DB row
export function mapWorkerToRow(worker: Partial<Worker>): any {
  const row: any = {
    name: worker.name,
    dorm: Number(worker.dorm) || 1,
    room: Number(worker.room) || 1,
    bed: Number(worker.bed) || 1,
    status: worker.status || 'Đang ở',
    emp_code: worker.empCode || '',
    updated_at: new Date().toISOString(),
  };

  if (worker.id) row.id = worker.id;
  if (worker.dob !== undefined) row.dob = worker.dob;
  if (worker.teamLeader !== undefined) row.team_leader = worker.teamLeader;
  if (worker.cccd !== undefined) row.cccd = worker.cccd;
  if (worker.address !== undefined) row.address = worker.address;
  if (worker.phone !== undefined) row.phone = worker.phone;
  if (worker.workplace !== undefined) row.workplace = worker.workplace;
  if (worker.note !== undefined) row.note = worker.note;
  if (worker.entryDate !== undefined) row.entry_date = worker.entryDate;
  if (worker.exitDate !== undefined) row.exit_date = worker.exitDate;
  if (worker.gender !== undefined) row.gender = worker.gender;
  if (worker.hometown !== undefined) row.hometown = worker.hometown;
  if (worker.issueDate !== undefined) row.issue_date = worker.issueDate;
  if (worker.issuePlace !== undefined) row.issue_place = worker.issuePlace;
  if (worker.createdBy !== undefined) row.created_by = worker.createdBy;
  if (worker.updatedBy !== undefined) row.updated_by = worker.updatedBy;
  if (worker.createdAt !== undefined) row.created_at = worker.createdAt;

  return row;
}

// Chuyển đổi CheckedOutWorker sang Supabase check_in_out_history row
export function mapCheckedOutToRow(record: CheckedOutWorker): any {
  return {
    id: record.id,
    worker_id: record.workerId || record.originalWorkerId || null,
    name: record.name,
    emp_code: record.empCode,
    dorm: Number(record.dorm) || 1,
    room: Number(record.room) || 1,
    bed: Number(record.bed) || 1,
    team_leader: record.teamLeader || null,
    status: 'Đã check out',
    reason: record.reason || 'Đã check out',
    checked_out_at: record.checkedOutAt || new Date().toISOString(),
    checked_out_by: record.checkedOutBy || record.operatorName || null,
    operator_name: record.operatorName || record.checkedOutBy || null,
    entry_date: record.entryDate || null,
    exit_date: record.exitDate || null,
    dob: record.dob || null,
    cccd: record.cccd || null,
    address: record.address || null,
    phone: record.phone || null,
    workplace: record.workplace || null,
    gender: record.gender || 'Nam',
    hometown: record.hometown || null,
    issue_date: record.issueDate || null,
    issue_place: record.issuePlace || null,
    created_at: new Date().toISOString(),
  };
}

// Chuyển đổi check_in_out_history row sang CheckedOutWorker
export function mapRowToCheckedOut(row: any): CheckedOutWorker {
  return {
    id: row.id,
    workerId: row.worker_id,
    originalWorkerId: row.worker_id,
    name: row.name,
    empCode: row.emp_code,
    dorm: Number(row.dorm) || 1,
    room: Number(row.room) || 1,
    bed: Number(row.bed) || 1,
    teamLeader: row.team_leader || '',
    status: 'Đã check out',
    reason: row.reason || 'Đã check out',
    checkedOutAt: row.checked_out_at || new Date().toISOString(),
    checkedOutBy: row.checked_out_by || row.operator_name || '',
    operatorName: row.operator_name || row.checked_out_by || '',
    entryDate: row.entry_date || '',
    exitDate: row.exit_date || '',
    dob: row.dob || '',
    cccd: row.cccd || '',
    address: row.address || '',
    phone: row.phone || '',
    workplace: row.workplace || '',
    gender: row.gender || 'Nam',
    hometown: row.hometown || '',
    issueDate: row.issue_date || '',
    issuePlace: row.issue_place || '',
  };
}

// ----------------------------------------------------------------------------
// WORKERS OPERATIONS
// ----------------------------------------------------------------------------

export async function fetchAllWorkersFromSupabase(): Promise<Worker[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .order('dorm', { ascending: true })
    .order('room', { ascending: true })
    .order('bed', { ascending: true });

  if (error) {
    console.warn('Lỗi tải danh sách công nhân từ Supabase:', error.message);
    throw error;
  }

  return (data || []).map(mapRowToWorker);
}

export async function insertWorkerToSupabase(worker: Worker): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const row = mapWorkerToRow(worker);
  const { error } = await supabase.from('workers').insert(row);
  if (error) {
    console.error('Lỗi thêm công nhân vào Supabase:', error.message);
    throw error;
  }
  return true;
}

export async function updateWorkerInSupabase(id: string, updates: Partial<Worker>): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const row = mapWorkerToRow(updates);
  delete row.id; // Do not update primary key
  delete row.created_at;

  const { error } = await supabase.from('workers').update(row).eq('id', id);
  if (error) {
    console.error('Lỗi cập nhật công nhân trong Supabase:', error.message);
    throw error;
  }
  return true;
}

export async function deleteWorkerFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase.from('workers').delete().eq('id', id);
  if (error) {
    console.error('Lỗi xóa công nhân khỏi Supabase:', error.message);
    throw error;
  }
  return true;
}

export async function deleteWorkerByEmpCodeFromSupabase(empCode: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase.from('workers').delete().eq('emp_code', empCode);
  if (error) {
    console.error('Lỗi xóa công nhân theo mã NV trong Supabase:', error.message);
    throw error;
  }
  return true;
}

export async function batchUpsertWorkersToSupabase(workersList: Worker[]): Promise<number> {
  if (!isSupabaseConfigured || workersList.length === 0) return 0;

  const batchSize = 100;
  let successCount = 0;

  for (let i = 0; i < workersList.length; i += batchSize) {
    const chunk = workersList.slice(i, i + batchSize);
    const rows = chunk.map(mapWorkerToRow);

    const { error } = await supabase.from('workers').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error('Lỗi nạp lô công nhân vào Supabase:', error.message);
      throw error;
    }
    successCount += rows.length;
  }

  return successCount;
}

// ----------------------------------------------------------------------------
// CHECK-IN / CHECK-OUT ARCHIVE OPERATIONS
// ----------------------------------------------------------------------------

export async function fetchCheckedOutHistoryFromSupabase(): Promise<CheckedOutWorker[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('check_in_out_history')
    .select('*')
    .order('checked_out_at', { ascending: false });

  if (error) {
    console.warn('Lỗi tải danh sách check-out từ Supabase:', error.message);
    throw error;
  }

  return (data || []).map(mapRowToCheckedOut);
}

export async function insertCheckedOutRecordToSupabase(record: CheckedOutWorker): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const row = mapCheckedOutToRow(record);
  const { error } = await supabase.from('check_in_out_history').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('Lỗi lưu bản ghi check-out vào Supabase:', error.message);
    throw error;
  }
  return true;
}

export async function deleteCheckedOutRecordFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { error } = await supabase.from('check_in_out_history').delete().eq('id', id);
  if (error) {
    console.error('Lỗi xóa vĩnh viễn bản ghi check-out khỏi Supabase:', error.message);
    throw error;
  }
  return true;
}

// ----------------------------------------------------------------------------
// SECURE WORKER DOCUMENTS & CCCD IMAGES
// ----------------------------------------------------------------------------

export interface WorkerDocumentData {
  workerId: string;
  frontImage?: string;
  backImage?: string;
  frontImagePath?: string;
  backImagePath?: string;
  uploadedBy?: string;
  updatedAt?: string;
}

export async function fetchSecureWorkerDocumentFromSupabase(workerId: string): Promise<WorkerDocumentData | null> {
  if (!isSupabaseConfigured || !workerId) return null;

  try {
    const { data, error } = await supabase
      .from('worker_documents')
      .select('*')
      .eq('worker_id', workerId)
      .maybeSingle();

    if (error || !data) return null;

    let frontUrl: string | undefined;
    let backUrl: string | undefined;

    if (data.front_image_path) {
      frontUrl = (await getCccdSignedUrl(data.front_image_path)) || undefined;
    }
    if (data.back_image_path) {
      backUrl = (await getCccdSignedUrl(data.back_image_path)) || undefined;
    }

    return {
      workerId,
      frontImage: frontUrl,
      backImage: backUrl,
      frontImagePath: data.front_image_path,
      backImagePath: data.back_image_path,
      uploadedBy: data.uploaded_by,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.warn('Lỗi lấy tài liệu CCCD từ Supabase:', err);
    return null;
  }
}

export async function saveSecureWorkerDocumentToSupabase(
  workerId: string,
  frontImage?: string,
  backImage?: string,
  operatorName = 'Quản lý'
): Promise<boolean> {
  if (!isSupabaseConfigured || !workerId) return false;

  try {
    let frontPath: string | null = null;
    let backPath: string | null = null;

    if (frontImage && frontImage.startsWith('data:image')) {
      const up = await uploadCccdImageToSupabase(workerId, 'front', frontImage);
      if (up) frontPath = up.path;
    }

    if (backImage && backImage.startsWith('data:image')) {
      const up = await uploadCccdImageToSupabase(workerId, 'back', backImage);
      if (up) backPath = up.path;
    }

    const payload: any = {
      id: workerId,
      worker_id: workerId,
      storage_path: `worker-documents/${workerId}/`,
      uploaded_by: operatorName,
      updated_at: new Date().toISOString(),
    };

    if (frontPath) {
      payload.front_image_path = frontPath;
      payload.front_uploaded_at = new Date().toISOString();
    }
    if (backPath) {
      payload.back_image_path = backPath;
      payload.back_uploaded_at = new Date().toISOString();
    }

    const { error } = await supabase.from('worker_documents').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Lỗi lưu worker_documents vào Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Lỗi upload ảnh CCCD bảo mật:', err);
    return false;
  }
}

export async function deleteSecureWorkerDocumentFromSupabase(workerId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !workerId) return false;

  try {
    // Delete files in Storage bucket
    const { data: files } = await supabase.storage.from('worker-documents').list(workerId);
    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${workerId}/${f.name}`);
      await supabase.storage.from('worker-documents').remove(filePaths);
    }

    // Delete DB record
    await supabase.from('worker_documents').delete().eq('worker_id', workerId);
    return true;
  } catch (err) {
    console.warn('Lỗi xóa tài liệu CCCD khỏi Supabase:', err);
    return false;
  }
}

// ----------------------------------------------------------------------------
// APP SETTINGS (DormConfig & ManagerInfo)
// ----------------------------------------------------------------------------

export async function fetchAppSettingFromSupabase<T>(key: string): Promise<T | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error || !data) return null;
    return data.value as T;
  } catch (err) {
    console.warn(`Lỗi lấy cài đặt "${key}" từ Supabase:`, err);
    return null;
  }
}

export async function saveAppSettingToSupabase<T>(key: string, value: T, updatedBy = 'Hệ thống'): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from('app_settings').upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: 'key' }
    );
    if (error) {
      console.warn(`Lỗi lưu cài đặt "${key}" vào Supabase:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Lỗi ghi setting "${key}":`, err);
    return false;
  }
}

// ----------------------------------------------------------------------------
// PROFILES & USERS
// ----------------------------------------------------------------------------

export async function fetchProfilesFromSupabase(): Promise<User[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      phone: row.phone || '',
      assignedDorms: row.assigned_dorms || [],
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.warn('Lỗi lấy danh sách tài khoản từ Supabase:', err);
    return [];
  }
}

export async function saveProfileToSupabase(user: User): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone || null,
      assigned_dorms: user.assignedDorms || [],
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    return !error;
  } catch (err) {
    console.warn('Lỗi lưu hồ sơ người dùng vào Supabase:', err);
    return false;
  }
}

export async function deleteProfileFromSupabase(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    return !error;
  } catch (err) {
    console.warn('Lỗi xóa hồ sơ người dùng khỏi Supabase:', err);
    return false;
  }
}

// ----------------------------------------------------------------------------
// AUDIT LOGS
// ----------------------------------------------------------------------------

export async function fetchAuditLogsFromSupabase(limitCount = 150): Promise<AuditLog[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limitCount);

    if (error || !data) return [];
    return data.map((row) => {
      const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};
      return {
        id: row.id,
        timestamp: row.timestamp,
        userName: row.user_name,
        userEmail: row.user_email,
        role: row.role,
        action: row.action,
        details: row.details,
        targetId: row.target_id || undefined,
        empCode: row.emp_code || undefined,
        status: row.status || 'SUCCESS',
        fileName: meta.fileName || row.file_name || undefined,
        scope: meta.scope || row.scope || undefined,
        totalCount: meta.totalCount ?? row.total_count ?? (Array.isArray(meta.items) ? meta.items.length : undefined),
        items: Array.isArray(meta.items) ? meta.items : undefined,
        metadata: meta,
      };
    });
  } catch (err) {
    console.warn('Lỗi lấy nhật ký từ Supabase:', err);
    return [];
  }
}

export async function insertAuditLogInSupabase(log: AuditLog): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const metaPayload: Record<string, any> = {
      ...(log.metadata || {}),
    };
    if (log.fileName) metaPayload.fileName = log.fileName;
    if (log.scope) metaPayload.scope = log.scope;
    if (log.totalCount !== undefined) metaPayload.totalCount = log.totalCount;
    if (log.items && log.items.length > 0) metaPayload.items = log.items;

    const payload: any = {
      id: log.id,
      timestamp: log.timestamp || new Date().toISOString(),
      user_name: log.userName,
      user_email: log.userEmail,
      role: log.role || 'manager',
      action: log.action,
      details: log.details,
      target_id: log.targetId || null,
      emp_code: log.empCode || null,
      status: log.status || 'SUCCESS',
      metadata: Object.keys(metaPayload).length > 0 ? metaPayload : {},
    };
    let { error } = await supabase.from('audit_logs').insert(payload);
    // Nếu bảng trên Supabase chưa tạo cột metadata, fallback ghi không kèm metadata
    if (error && error.message?.includes('metadata')) {
      delete payload.metadata;
      const fallbackRes = await supabase.from('audit_logs').insert(payload);
      return !fallbackRes.error;
    }
    return !error;
  } catch (err) {
    console.warn('Lỗi lưu audit log vào Supabase:', err);
    return false;
  }
}
