import * as XLSX from 'xlsx';
import { Worker, DormConfig, ImportSummary, ImportPreviewRow, WorkerStatus } from '../types';
import { removeVietnameseTones } from './vietnamese';

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function getTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '-';
  // If format is YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

export function formatDateTimeDisplay(isoStr?: string): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return isoStr;
  }
}

/**
 * OCR Post-processing normalization
 * Replaces O/o -> 0, I/l/L -> 1, strips spaces, truncates to 12 digits
 */
export function normalizeCccdNumber(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.toUpperCase().trim();
  cleaned = cleaned.replace(/[O]/g, '0');
  cleaned = cleaned.replace(/[IL]/g, '1');
  cleaned = cleaned.replace(/[^0-9]/g, '');
  return cleaned.substring(0, 12);
}

export function normalizePersonName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

export function normalizeDateInput(raw: string): string {
  if (!raw) return '';
  raw = raw.trim();
  // If DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }
  return raw;
}

/**
 * Parse Excel files with flexible header aliases
 */
export function parseExcelFile(
  fileData: ArrayBuffer,
  existingWorkers: Worker[],
  config: DormConfig
): ImportSummary {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (jsonData.length < 2) {
    return {
      totalRows: 0,
      validRows: 0,
      missingPhone: 0,
      duplicateEmpCodes: 0,
      duplicateCccds: 0,
      rows: [],
    };
  }

  // Find header row (usually first row or scan for known columns)
  const headerRow = jsonData[0].map((cell: any) => String(cell || '').trim());
  const headerMap: { [key: string]: number } = {};

  headerRow.forEach((col: string, idx: number) => {
    const norm = removeVietnameseTones(col).toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Map column aliases
    if (['stt', 'no', 'order'].includes(norm)) headerMap['stt'] = idx;
    else if (['day', 'dorm', 'dayktx', 'khoiktx', 'khu'].includes(norm)) headerMap['dorm'] = idx;
    else if (['phong', 'room', 'sophong'].includes(norm)) headerMap['room'] = idx;
    else if (['sogiuong', 'giuong', 'bed', 'sovitri'].includes(norm)) headerMap['bed'] = idx;
    else if (['totruong', 'leader', 'teamleader', 'truongphong'].includes(norm)) headerMap['teamLeader'] = idx;
    else if (['hovaten', 'hoten', 'fullname', 'name', 'tencongnhan', 'nhanvien'].includes(norm)) headerMap['name'] = idx;
    else if (['ngaysinh', 'dob', 'namsinh', 'birthdate'].includes(norm)) headerMap['dob'] = idx;
    else if (['manhanvien', 'manv', 'empcode', 'msnv', 'macc', 'staffid'].includes(norm)) headerMap['empCode'] = idx;
    else if (['socccd', 'cccd', 'cmnd', 'socmnd', 'idcard', 'citizenid'].includes(norm)) headerMap['cccd'] = idx;
    else if (['hokhauthuongtru', 'noidangkyhokhauthuongtru', 'thuongtru', 'address', 'diachi', 'quequan'].includes(norm)) headerMap['address'] = idx;
    else if (['sodienthoai', 'sdt', 'phone', 'dienthoai', 'mobile'].includes(norm)) headerMap['phone'] = idx;
    else if (['noilamviec', 'workplace', 'bophan', 'to', 'xuong', 'donvi'].includes(norm)) headerMap['workplace'] = idx;
    else if (['trangthai', 'status', 'tinhtrang'].includes(norm)) headerMap['status'] = idx;
    else if (['ghichu', 'note', 'notes', 'remark'].includes(norm)) headerMap['note'] = idx;
  });

  const existingEmpCodes = new Set(existingWorkers.map((w) => w.empCode.toLowerCase()));
  const existingCccds = new Set(existingWorkers.filter((w) => w.cccd).map((w) => w.cccd));
  
  const parsedRows: ImportPreviewRow[] = [];
  const seenEmpCodes = new Set<string>();
  const seenCccds = new Set<string>();

  let missingPhoneCount = 0;
  let dupEmpCount = 0;
  let dupCccdCount = 0;

  for (let r = 1; r < jsonData.length; r++) {
    const row = jsonData[r];
    if (!row || row.every((c: any) => c === '' || c === undefined)) continue;

    const getValue = (key: string): string => {
      const colIdx = headerMap[key];
      if (colIdx !== undefined && row[colIdx] !== undefined) {
        return String(row[colIdx]).trim();
      }
      return '';
    };

    const stt = getValue('stt') || r;
    const name = getValue('name');
    const empCode = getValue('empCode');
    const cccd = normalizeCccdNumber(getValue('cccd'));
    const phone = getValue('phone');
    const dob = normalizeDateInput(getValue('dob'));
    const address = getValue('address');
    const workplace = getValue('workplace');
    const teamLeader = getValue('teamLeader');
    const note = getValue('note');

    // Parse Dorm, Room, Bed
    let dormNum = parseInt(getValue('dorm').replace(/[^0-9]/g, '') || '1', 10);
    if (isNaN(dormNum) || dormNum <= 0) dormNum = 1;

    let roomNum = parseInt(getValue('room').replace(/[^0-9]/g, '') || '1', 10);
    if (isNaN(roomNum) || roomNum <= 0) roomNum = 1;

    let bedNum = parseInt(getValue('bed').replace(/[^0-9]/g, '') || '1', 10);
    if (isNaN(bedNum) || bedNum <= 0) bedNum = 1;

    // Status
    const rawStatus = getValue('status');
    let status: WorkerStatus = 'Đang ở';
    if (rawStatus && (removeVietnameseTones(rawStatus).includes('roi') || removeVietnameseTones(rawStatus).includes('nghi') || removeVietnameseTones(rawStatus).includes('out'))) {
      status = 'Đã rời KTX';
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name) {
      errors.push('Thiếu họ và tên');
    }
    if (!empCode) {
      errors.push('Thiếu mã nhân viên');
    } else {
      const lowerCode = empCode.toLowerCase();
      if (existingEmpCodes.has(lowerCode)) {
        warnings.push('Mã NV đã tồn tại trong KTX (sẽ ghi đè nếu chọn)');
        dupEmpCount++;
      }
      if (seenEmpCodes.has(lowerCode)) {
        errors.push('Mã NV bị trùng trong file Excel này');
      }
      seenEmpCodes.add(lowerCode);
    }

    if (cccd) {
      if (existingCccds.has(cccd)) {
        warnings.push('CCCD đã tồn tại trên hệ thống');
        dupCccdCount++;
      }
      if (seenCccds.has(cccd)) {
        warnings.push('CCCD bị lặp lại trong file Excel');
      }
      seenCccds.add(cccd);
    }

    if (!phone) {
      warnings.push('Chưa có số điện thoại');
      missingPhoneCount++;
    }

    if (dormNum > config.numDorms) {
      warnings.push(`Dãy ${dormNum} vượt quá cấu hình hiện tại (${config.numDorms} dãy)`);
    }
    if (roomNum > config.roomsPerDorm) {
      warnings.push(`Phòng ${roomNum} vượt quá cấu hình hiện tại (${config.roomsPerDorm} phòng/dãy)`);
    }

    parsedRows.push({
      stt,
      name,
      dob,
      dorm: dormNum,
      room: roomNum,
      bed: bedNum,
      teamLeader,
      status,
      empCode,
      cccd,
      address,
      phone,
      workplace,
      note,
      isValid: errors.length === 0,
      errors,
      warnings,
    });
  }

  const validRows = parsedRows.filter((r) => r.isValid).length;

  return {
    totalRows: parsedRows.length,
    validRows,
    missingPhone: missingPhoneCount,
    duplicateEmpCodes: dupEmpCount,
    duplicateCccds: dupCccdCount,
    rows: parsedRows,
  };
}

/**
 * Async wrapper for parsing File directly
 */
export async function parseWorkersFromExcel(
  file: File,
  existingWorkers: Worker[],
  config: DormConfig = { numDorms: 8, roomsPerDorm: 20, maxBedsPerRoom: 30, enableBedManagement: true }
): Promise<{
  validWorkers: Partial<Worker>[];
  errors: string[];
  totalRows: number;
  missingPhonesCount: number;
  duplicateEmpCodesCount: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const summary = parseExcelFile(arrayBuffer, existingWorkers, config);

  const validWorkers: Partial<Worker>[] = summary.rows
    .filter((r) => r.isValid)
    .map((r) => ({
      name: normalizePersonName(r.name),
      empCode: r.empCode.toUpperCase().trim(),
      cccd: r.cccd,
      phone: r.phone,
      dob: r.dob,
      address: r.address,
      workplace: r.workplace,
      teamLeader: r.teamLeader,
      dorm: r.dorm,
      room: r.room,
      bed: r.bed,
      status: r.status,
      note: r.note,
      entryDate: getTodayStr(),
    }));

  const allErrors: string[] = [];
  summary.rows.forEach((r) => {
    if (r.errors.length > 0) {
      allErrors.push(`[${r.name || r.empCode || 'Dòng ' + r.stt}]: ${r.errors.join(', ')}`);
    }
    if (r.warnings.length > 0) {
      allErrors.push(`[${r.name || r.empCode || 'Dòng ' + r.stt}]: ${r.warnings.join(', ')}`);
    }
  });

  return {
    validWorkers,
    errors: allErrors,
    totalRows: summary.totalRows,
    missingPhonesCount: summary.missingPhone,
    duplicateEmpCodesCount: summary.duplicateEmpCodes,
  };
}

/**
 * Generate Excel file with 2 Sheets
 */
export function exportWorkersToExcel(
  workers: Worker[],
  config: DormConfig,
  customTitle?: string
) {
  // Sheet 1: Danh sách
  const sheet1Data = workers.map((w, index) => ({
    'STT': index + 1,
    'Dãy': `Dãy ${w.dorm}`,
    'Phòng': `Phòng ${String(w.room).padStart(2, '0')}`,
    'Số giường': w.bed ? `Giường ${w.bed}` : '-',
    'Tổ trưởng': w.teamLeader || '-',
    'Họ và tên': w.name,
    'Ngày sinh': formatDateDisplay(w.dob),
    'Mã nhân viên': w.empCode,
    'Số CCCD': w.cccd || '-',
    'Nơi đăng ký hộ khẩu thường trú': w.address || '-',
    'Số điện thoại': w.phone || '-',
    'Nơi làm việc': w.workplace || '-',
    'Trạng thái': w.status,
    'Ngày vào': formatDateDisplay(w.entryDate),
    'Ngày ra': formatDateDisplay(w.exitDate),
    'Ghi chú': w.note || '',
  }));

  // Sheet 2: Tổng quan theo dãy
  const sheet2Data = [];
  for (let d = 1; d <= config.numDorms; d++) {
    const dormWorkers = workers.filter((w) => w.dorm === d && w.status === 'Đang ở');
    const usedRooms = new Set(dormWorkers.map((w) => w.room)).size;
    const capacity = config.roomsPerDorm * config.maxBedsPerRoom;
    const occupancyRate = capacity > 0 ? Math.round((dormWorkers.length / capacity) * 100) : 0;

    sheet2Data.push({
      'Dãy': `Dãy ${d}`,
      'Số phòng sử dụng': `${usedRooms} / ${config.roomsPerDorm}`,
      'Tổng nhân sự': dormWorkers.length,
      'Sức chứa tối đa': capacity,
      'Tỷ lệ lấp đầy (%)': `${occupancyRate}%`,
    });
  }

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
  XLSX.utils.book_append_sheet(wb, ws1, 'Danh sách');

  const ws2 = XLSX.utils.json_to_sheet(sheet2Data);
  XLSX.utils.book_append_sheet(wb, ws2, 'Tổng quan theo dãy');

  // Generate file name
  const today = getTodayStr();
  const fileName = customTitle ? `${customTitle}.xlsx` : `QuanLyKTX_${today}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
