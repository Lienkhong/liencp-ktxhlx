import { Worker } from '../types';

/**
 * Universal extraction of worker records from any JSON backup structure
 * Supports:
 *  1. Direct Array: [ { ... }, { ... } ]
 *  2. Object with workers: { workers: [ ... ] }
 *  3. Object with employees: { employees: [ ... ] }
 *  4. Object with data: { data: [ ... ] }
 *  5. Object with list: { list: [ ... ] }
 *  6. Object with records: { records: [ ... ] }
 */
export function extractRecordsFromBackup(data: any): Worker[] {
  let rawList: any[] | null = null;

  if (Array.isArray(data)) {
    rawList = data;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.workers)) {
      rawList = data.workers;
    } else if (Array.isArray(data.employees)) {
      rawList = data.employees;
    } else if (Array.isArray(data.data)) {
      rawList = data.data;
    } else if (Array.isArray(data.list)) {
      rawList = data.list;
    } else if (Array.isArray(data.records)) {
      rawList = data.records;
    }
  }

  if (!rawList || !Array.isArray(rawList)) {
    throw new Error('File JSON không chứa danh sách hồ sơ công nhân hợp lệ.');
  }

  if (rawList.length === 0) {
    throw new Error('Danh sách công nhân trong file JSON đang trống (0 hồ sơ).');
  }

  // Normalize each record ensuring data integrity & preserving all string values (CCCD, phone, empCode)
  const normalizedWorkers: Worker[] = rawList.map((record: any, index: number) => {
    if (!record || typeof record !== 'object') {
      throw new Error(`Bản ghi thứ ${index + 1} không phải là đối tượng hợp lệ.`);
    }

    // Preserve existing ID if present; only generate if completely missing
    const id = record.id && typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : `w_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;

    // String fields - ensure leading 0s and exact characters are never converted to numbers
    const cccd = record.cccd !== undefined && record.cccd !== null ? String(record.cccd).trim() : '';
    const phone = record.phone !== undefined && record.phone !== null ? String(record.phone).trim() : '';
    const empCode = record.empCode !== undefined && record.empCode !== null ? String(record.empCode).trim() : '';
    const name = record.name !== undefined && record.name !== null ? String(record.name).trim() : '';

    const dob = record.dob !== undefined && record.dob !== null ? String(record.dob).trim() : '';
    const dorm = Number(record.dorm) || 1;
    const room = Number(record.room) || 1;
    const bed = Number(record.bed !== undefined && record.bed !== null ? record.bed : 0);

    const teamLeader = record.teamLeader !== undefined && record.teamLeader !== null ? String(record.teamLeader).trim() : '';
    const status: Worker['status'] =
      record.status === 'Đã chuyển' || record.status === 'Đã ra'
        ? record.status
        : 'Đang ở';

    const address = record.address !== undefined && record.address !== null ? String(record.address).trim() : '';
    const note = record.note !== undefined && record.note !== null ? String(record.note).trim() : '';
    const workplace = record.workplace !== undefined && record.workplace !== null ? String(record.workplace).trim() : '';

    const nowIso = new Date().toISOString();
    const createdAt = record.createdAt ? String(record.createdAt).trim() : nowIso;
    const entryDate = record.entryDate ? String(record.entryDate).trim() : (record.createdAt ? String(record.createdAt).trim() : nowIso);
    const exitDate = record.exitDate ? String(record.exitDate).trim() : '';
    const updatedAt = record.updatedAt ? String(record.updatedAt).trim() : nowIso;
    const createdBy = record.createdBy ? String(record.createdBy).trim() : 'Admin';
    const updatedBy = record.updatedBy ? String(record.updatedBy).trim() : 'Admin';

    return {
      id,
      name,
      dob,
      dorm,
      room,
      bed,
      teamLeader,
      status,
      empCode,
      cccd,
      phone,
      address,
      note,
      workplace,
      createdAt,
      entryDate,
      exitDate,
      updatedAt,
      createdBy,
      updatedBy,
    };
  });

  return normalizedWorkers;
}
