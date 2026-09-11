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

export function formatToDmy(raw?: any): string {
  if (!raw && raw !== 0) return '';
  if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) {
      const d = String(raw.getDate()).padStart(2, '0');
      const m = String(raw.getMonth() + 1).padStart(2, '0');
      const y = raw.getFullYear();
      return `${d}/${m}/${y}`;
    }
  }

  let str = String(raw).trim();
  if (!str) return '';

  // Remove time suffixes like " 00:00:00" or "T00:00:00.000Z"
  str = str.replace(/[T\s]\d{1,2}:\d{2}(:\d{2})?.*$/, '').trim();

  // Case 0: 4-digit year only (e.g. 1985, 1992, 2003) - DO NOT treat as Excel serial!
  if (/^(19\d{2}|20\d{2})$/.test(str)) {
    return str;
  }

  // Case 1: Excel numeric serial (usually between 10000 and 65000 for dates 1927-2078)
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num >= 10000 && num <= 65000) {
      const dateInfo = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(dateInfo.getTime())) {
        const d = String(dateInfo.getUTCDate()).padStart(2, '0');
        const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
        const y = dateInfo.getUTCFullYear();
        return `${d}/${m}/${y}`;
      }
    }
  }

  // Case 2: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY or D-M-YYYY (e.g. 17-4-1972, 2-6-1982)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${d}/${m}/${y}`;
  }

  // Case 3: DD-MM-YY or D-M-YY (2 digit year)
  const dmyShortMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (dmyShortMatch) {
    const d = dmyShortMatch[1].padStart(2, '0');
    const m = dmyShortMatch[2].padStart(2, '0');
    const rawY = parseInt(dmyShortMatch[3], 10);
    const y = rawY > 40 ? 1900 + rawY : 2000 + rawY;
    return `${d}/${m}/${y}`;
  }

  // Case 4: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (e.g. 1995-04-12)
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // Case 5: Raw 8 digits DDMMYYYY (e.g. 15081996)
  const raw8Match = str.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (raw8Match) {
    return `${raw8Match[1]}/${raw8Match[2]}/${raw8Match[3]}`;
  }

  return str;
}

export function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '-';
  const formatted = formatToDmy(dateStr);
  return formatted || dateStr;
}

/**
 * Hỗ trợ định dạng khi người dùng gõ ngày sinh:
 * - Giữ lại các số và dấu gạch chéo
 * - Tự động chèn dấu / khi gõ đủ ngày (2 số) và tháng (2 số) nếu gõ liền số
 * - Cho phép dán định dạng YYYY-MM-DD tự động chuyển thành DD/MM/YYYY
 */
export function formatDateInputMask(input: string): string {
  if (!input) return '';

  // If pasted YYYY-MM-DD
  const isoMatch = input.trim().match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // Filter only digits and slashes
  const cleaned = input.replace(/[^\d\/]/g, '');

  // If user is typing digits without slashes, e.g. 15081996
  if (!cleaned.includes('/')) {
    if (cleaned.length > 8) {
      const trimmed = cleaned.slice(0, 8);
      return `${trimmed.slice(0, 2)}/${trimmed.slice(2, 4)}/${trimmed.slice(4)}`;
    }
    if (cleaned.length > 4) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
    }
    if (cleaned.length > 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  }

  // If user entered slashes, ensure max 2 slashes and 10 chars
  const parts = cleaned.split('/');
  if (parts.length > 3) {
    return parts.slice(0, 3).join('/');
  }
  return cleaned.slice(0, 10);
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
 * Mask CCCD number for privacy & security: e.g. 0010******123
 */
export function maskCccdNumber(raw?: string): string {
  if (!raw) return '-';
  const clean = raw.trim();
  if (clean.length < 8) return clean;
  const start = clean.slice(0, 4);
  const end = clean.slice(-3);
  const stars = '*'.repeat(Math.max(4, clean.length - 7));
  return `${start}${stars}${end}`;
}

/**
 * OCR Post-processing normalization
 * Replaces O/o -> 0, I/l/L -> 1, strips spaces, truncates to 12 digits
 */
export function normalizeCccdNumber(raw: any): string {
  if (!raw && raw !== 0) return '';
  let str = String(raw).trim();
  if (typeof raw === 'number' || /^\d+(\.\d+)?e\+\d+$/i.test(str)) {
    try {
      str = BigInt(Math.round(Number(raw))).toString();
    } catch {
      // ignore
    }
  }
  let cleaned = str.toUpperCase().trim();
  cleaned = cleaned.replace(/[O]/g, '0');
  cleaned = cleaned.replace(/[IL]/g, '1');
  cleaned = cleaned.replace(/[^0-9]/g, '');
  // CCCD standard is 12 digits (or 9 digits for old CMND).
  // If 11 digits because Excel stripped leading 0, prepend '0'
  if (cleaned.length === 11) {
    cleaned = '0' + cleaned;
  } else if (cleaned.length === 8) {
    cleaned = '0' + cleaned;
  }
  return cleaned.substring(0, 12);
}

export function normalizePhoneNumber(raw: any): string {
  if (!raw && raw !== 0) return '';
  let str = String(raw).trim();
  if (typeof raw === 'number' || /^\d+(\.\d+)?e\+\d+$/i.test(str)) {
    try {
      str = BigInt(Math.round(Number(raw))).toString();
    } catch {
      // ignore
    }
  }
  let cleaned = str.replace(/[^0-9+]/g, '');
  // If 9 digits starting with 3, 5, 7, 8, 9 (Excel stripped leading 0)
  if (/^[35789]\d{8}$/.test(cleaned)) {
    cleaned = '0' + cleaned;
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.substring(2);
  } else if (cleaned.startsWith('+84') && cleaned.length === 12) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
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
  return formatToDmy(raw);
}

/**
 * Chuẩn hóa nơi thường trú thành định dạng ngắn gọn: Xã/phường, Tỉnh
 * Ví dụ: "Cẩm Phả, Quảng Ninh", "Quảng Trạch, Quảng Bình", "Hải Hậu, Nam Định"
 * Tự động loại bỏ thông tin số nhà, ngõ ngách, thôn, xóm, tổ dân phố...
 */
export function simplifyAddress(raw?: string): string {
  if (!raw) return '';
  let str = String(raw).trim();
  if (!str) return '';

  // Clean quotes and multiple whitespace
  str = str.replace(/["“”'']/g, '').replace(/\s+/g, ' ');

  // Split by comma, semicolon, or newline
  const segments = str.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return '';

  // Helper to remove admin level prefixes
  const cleanAdminPrefix = (part: string): string => {
    return part
      .replace(
        /^(tỉnh|thành\s*phố|thành\s*pho|tp\.?|huyện|huyen|quận|quan|thị\s*xã|thị\s*xa|tx\.?|xã|xa|phường|phuong|thị\s*trấn|tt\.?)\s+/i,
        ''
      )
      .trim();
  };

  // Helper to test if a segment is a micro-level entity (house number, street, alley, hamlet, team, cluster...)
  const isMicroLevel = (part: string): boolean => {
    const lower = part.toLowerCase();
    return (
      /^(số\s*nhà|số|sn|ngõ|ngách|hẻm|đường|phố|thôn|xóm|tổ\s*dân\s*phố|tổ|khu\s*dân\s*cư|kdc|khu\s*phố|khu|ấp|bản|buôn|đội|cụm)\b/i.test(
        lower
      ) || /^\d+\s+[a-zA-Zà-ỹÀ-Ỹ]/.test(lower)
    );
  };

  // Filter out micro-level parts
  const macroSegments = segments.filter((s) => !isMicroLevel(s));
  const candidateList = macroSegments.length > 0 ? macroSegments : segments;

  const capitalizeWords = (s: string) => {
    return s
      .toLowerCase()
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ');
  };

  if (candidateList.length === 1) {
    return capitalizeWords(cleanAdminPrefix(candidateList[0]));
  }

  // Province is the last segment
  const rawProvince = candidateList[candidateList.length - 1];
  const province = capitalizeWords(cleanAdminPrefix(rawProvince));

  // The local unit (Xã/phường or Huyện/Thị xã/Thành phố)
  let local = '';
  if (candidateList.length === 2) {
    local = cleanAdminPrefix(candidateList[0]);
  } else {
    // 3 or more items, e.g. [Phường Cẩm Bình, Thành phố Cẩm Phả, Tỉnh Quảng Ninh] or [Xã Phú Nghĩa, Huyện Chương Mỹ, TP Hà Nội]
    // The penultimate is usually the District / City (e.g. Cẩm Phả or Quảng Trạch or Chương Mỹ)
    const penultimate = cleanAdminPrefix(candidateList[candidateList.length - 2]);
    const antepenultimate = cleanAdminPrefix(candidateList[candidateList.length - 3]);

    if (penultimate && penultimate.toLowerCase() !== province.toLowerCase()) {
      local = penultimate;
    } else if (antepenultimate) {
      local = antepenultimate;
    } else {
      local = cleanAdminPrefix(candidateList[0]);
    }
  }

  const cleanLocal = capitalizeWords(local);

  if (!cleanLocal) return province;
  if (!province) return cleanLocal;
  if (cleanLocal.toLowerCase() === province.toLowerCase()) return province;

  return `${cleanLocal}, ${province}`;
}

/**
 * Parse Excel files with flexible header aliases and multi-row header support
 */
export function parseExcelFile(
  fileData: ArrayBuffer,
  existingWorkers: Worker[],
  config: DormConfig,
  targetDormNumber: number = 1
): ImportSummary {
  const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  // Extract with formatted text strings and raw values
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const jsonDataRaw: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: true });

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

  // 1. Detect header row by scanning first 25 rows for known keywords with weighted scoring
  let headerRowIdx = 0;
  let maxHeaderScore = 0;

  for (let r = 0; r < Math.min(25, jsonData.length); r++) {
    const row = jsonData[r];
    if (!Array.isArray(row)) continue;
    let score = 0;
    row.forEach((cell: any) => {
      const norm = removeVietnameseTones(String(cell || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!norm) return;

      // Họ và tên (weight 5)
      if (norm.includes('hovaten') || norm.includes('hoten') || (norm.includes('ho') && norm.includes('ten')) || norm.includes('fullname') || (norm.includes('ten') && norm.includes('congnhan')) || (norm.includes('ten') && norm.includes('nhanvien')) || (norm.includes('nguoi') && norm.includes('laodong'))) {
        score += 5;
      }
      // Ngày tháng năm sinh (weight 4)
      else if (norm.includes('ngaythangnamsinh') || norm.includes('ngaysinh') || norm.includes('namsinh') || norm.includes('ngaythangnam') || norm.includes('sinhngay') || norm === 'dob' || norm.includes('birthdate') || norm === 'ns') {
        score += 4;
      }
      // Mã nhân viên (weight 4)
      else if (norm.includes('manhanvien') || norm.includes('manv') || norm.includes('msnv') || norm.includes('mathe') || norm.includes('sothe') || norm.includes('macc') || norm.includes('macongnhan') || norm.includes('macn') || norm.includes('staffid') || norm.includes('empcode') || norm === 'sbd') {
        score += 4;
      }
      // CCCD (weight 4)
      else if (norm.includes('socccd') || norm.includes('cccd') || norm.includes('cmnd') || norm.includes('socmnd') || norm.includes('cancuoc') || norm.includes('cmtnd') || norm.includes('socmt') || norm === 'cmt' || norm.includes('dinhdanh')) {
        score += 4;
      }
      // SĐT (weight 4)
      else if (norm.includes('sodienthoai') || norm.includes('sdt') || norm.includes('dienthoai') || norm.includes('sodt') || norm.includes('phone') || norm.includes('mobile') || norm.includes('tel') || norm.includes('lienhe') || norm.includes('didong')) {
        score += 4;
      }
      // Tổ đội là tên tổ trưởng (weight 4)
      else if (norm.includes('todoi') || norm.includes('totruong') || norm.includes('tentotruong') || norm.includes('doitruong') || norm.includes('tendoitruong') || norm.includes('tothicong') || norm.includes('truongnhom') || norm === 'to' || norm === 'doi' || norm === 'nhom' || norm.includes('teamleader') || norm.includes('leader')) {
        score += 4;
      }
      // Xã Tỉnh / Quê quán / Địa chỉ (weight 4)
      else if (norm.includes('xatinh') || norm.includes('tinhxa') || norm.includes('quequan') || norm.includes('noithuongtru') || norm.includes('hokhauthuongtru') || norm.includes('thuongtru') || norm.includes('hokhau') || norm.includes('diachi') || norm === 'xa' || norm === 'tinh' || norm.includes('xaphuong') || norm.includes('tinhtp') || norm.includes('thanhpho')) {
        score += 4;
      }
      // STT (weight 2)
      else if (norm === 'stt' || norm === 'no' || norm === 'tt') {
        score += 2;
      }
      // Giới tính (weight 2)
      else if (norm.includes('gioitinh') || norm === 'phai' || norm === 'gender') {
        score += 2;
      }
    });

    if (score > maxHeaderScore) {
      maxHeaderScore = score;
      headerRowIdx = r;
    }
  }

  // 2. Check if row right below headerRowIdx is a sub-header (e.g. Xã, Tỉnh, Huyện, Thôn)
  let subHeaderRowIdx = -1;
  if (headerRowIdx + 1 < jsonData.length) {
    const nextRow = jsonData[headerRowIdx + 1];
    if (Array.isArray(nextRow)) {
      const subMatches = nextRow.filter((cell: any) => {
        const norm = removeVietnameseTones(String(cell || '')).toLowerCase().replace(/[^a-z0-9]/g, '');
        return ['xa', 'xaphuong', 'tinh', 'tinhtp', 'thanhpho', 'tothonban', 'thon', 'ban', 'huyen', 'quan', 'phuong', 'thitran', 'ten', 'hodem'].includes(norm);
      });
      if (subMatches.length >= 2) {
        subHeaderRowIdx = headerRowIdx + 1;
      }
    }
  }

  const primaryHeader = (jsonData[headerRowIdx] || []).map((c: any) => String(c || '').trim());
  const subHeader = subHeaderRowIdx !== -1 ? (jsonData[subHeaderRowIdx] || []).map((c: any) => String(c || '').trim()) : [];
  const maxCols = Math.max(primaryHeader.length, subHeader.length);

  const headerMap: { [key: string]: number } = {};
  const assignedCols = new Set<number>();

  // Pass 1: Sub-header specific mapping (e.g. Xã, Tỉnh, Huyện, Thôn under Hộ khẩu)
  if (subHeader.length > 0) {
    subHeader.forEach((col: string, idx: number) => {
      const norm = removeVietnameseTones(col).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm === 'xa' || norm.includes('xaphuong') || norm.includes('phuongxa') || norm === 'phuong' || norm.includes('thitran')) {
        headerMap['ward'] = idx;
        assignedCols.add(idx);
      } else if (norm === 'tinh' || norm.includes('tinhtp') || norm.includes('thanhpho') || norm === 'tp') {
        headerMap['province'] = idx;
        assignedCols.add(idx);
      } else if (norm === 'huyen' || norm.includes('quanhuyen') || norm.includes('huyenquan') || norm === 'quan' || norm.includes('thixa')) {
        headerMap['district'] = idx;
        assignedCols.add(idx);
      } else if (norm === 'thon' || norm === 'ban' || norm === 'ap' || norm === 'xom' || norm.includes('thonban') || norm.includes('tothonban')) {
        headerMap['village'] = idx;
        assignedCols.add(idx);
      } else if (norm === 'ten' || norm === 'tengoi' || norm === 'firstname') {
        headerMap['firstName'] = idx;
        assignedCols.add(idx);
      } else if (norm.includes('hodem') || norm.includes('hovatedem') || norm === 'ho') {
        headerMap['lastName'] = idx;
        assignedCols.add(idx);
      }
    });
  }

  // Pass 2: Main header mapping with flexible regex and fuzzy matching
  primaryHeader.forEach((col: string, idx: number) => {
    if (assignedCols.has(idx)) return;
    const topNorm = removeVietnameseTones(col).toLowerCase().replace(/[^a-z0-9]/g, '');
    const subCol = subHeader[idx] || '';
    const subNorm = removeVietnameseTones(subCol).toLowerCase().replace(/[^a-z0-9]/g, '');
    const combinedNorm = removeVietnameseTones(`${col} ${subCol}`).toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!topNorm && !subNorm) return;

    // 1. STT
    if (['stt', 'no', 'order', 'tt', 'sott'].includes(topNorm)) {
      headerMap['stt'] = idx;
      assignedCols.add(idx);
    }
    // 2. Họ và tên
    else if (
      topNorm.includes('hovaten') ||
      topNorm.includes('hoten') ||
      (topNorm.includes('ho') && topNorm.includes('ten')) ||
      topNorm.includes('fullname') ||
      topNorm.includes('tencongnhan') ||
      topNorm.includes('tennhanvien') ||
      topNorm.includes('tennld') ||
      topNorm.includes('nguoilaodong')
    ) {
      if (headerMap['name'] === undefined) {
        headerMap['name'] = idx;
        assignedCols.add(idx);
      }
    }
    // Separate Họ đệm / Tên
    else if (topNorm.includes('hovatedem') || topNorm.includes('hovadem') || topNorm.includes('hotendem') || topNorm.includes('hodem') || topNorm === 'ho') {
      headerMap['lastName'] = idx;
      assignedCols.add(idx);
    } else if (topNorm === 'ten' || topNorm === 'tengoi' || topNorm === 'firstname') {
      headerMap['firstName'] = idx;
      assignedCols.add(idx);
    }
    // 3. Ngày tháng Năm sinh
    else if (
      topNorm.includes('ngaythangnamsinh') ||
      topNorm.includes('ngaythangsinh') ||
      topNorm.includes('ngaysinh') ||
      topNorm.includes('namsinh') ||
      topNorm.includes('ngaythangnam') ||
      topNorm.includes('sinhngay') ||
      topNorm === 'dob' ||
      topNorm.includes('birthdate') ||
      topNorm.includes('dateofbirth') ||
      topNorm === 'ns'
    ) {
      if (headerMap['dob'] === undefined) {
        headerMap['dob'] = idx;
        assignedCols.add(idx);
      }
    }
    // 4. Mã nhân viên
    else if (
      topNorm.includes('manhanvien') ||
      topNorm.includes('manv') ||
      topNorm.includes('msnv') ||
      topNorm.includes('mathe') ||
      topNorm.includes('sothe') ||
      topNorm.includes('macc') ||
      topNorm.includes('macongnhan') ||
      topNorm.includes('macn') ||
      topNorm.includes('maso') ||
      topNorm.includes('staffid') ||
      topNorm.includes('empcode') ||
      topNorm.includes('employeeid') ||
      topNorm === 'sbd' ||
      topNorm === 'code'
    ) {
      if (headerMap['empCode'] === undefined) {
        headerMap['empCode'] = idx;
        assignedCols.add(idx);
      }
    }
    // 5. Số CCCD
    else if (
      topNorm.includes('socccd') ||
      topNorm.includes('cccd') ||
      topNorm.includes('cmnd') ||
      topNorm.includes('socmnd') ||
      topNorm.includes('cancuoc') ||
      topNorm.includes('cmtnd') ||
      topNorm.includes('socmt') ||
      topNorm === 'cmt' ||
      topNorm.includes('citizenid') ||
      topNorm.includes('idcard') ||
      topNorm.includes('dinhdanh')
    ) {
      if (headerMap['cccd'] === undefined) {
        headerMap['cccd'] = idx;
        assignedCols.add(idx);
      }
    }
    // 6. Số điện thoại
    else if (
      topNorm.includes('sodienthoai') ||
      topNorm.includes('sdt') ||
      topNorm.includes('dienthoai') ||
      topNorm.includes('sodt') ||
      topNorm.includes('phone') ||
      topNorm.includes('mobile') ||
      topNorm.includes('tel') ||
      topNorm.includes('lienhe') ||
      topNorm.includes('didong') ||
      topNorm === 'dt'
    ) {
      if (headerMap['phone'] === undefined) {
        headerMap['phone'] = idx;
        assignedCols.add(idx);
      }
    }
    // 7. Tổ đội là tên tổ trưởng
    else if (
      topNorm.includes('todoi') ||
      topNorm.includes('totruong') ||
      topNorm.includes('tentotruong') ||
      topNorm.includes('doitruong') ||
      topNorm.includes('tendoitruong') ||
      topNorm.includes('tothicong') ||
      topNorm.includes('truongnhom') ||
      topNorm === 'to' ||
      topNorm === 'doi' ||
      topNorm === 'nhom' ||
      topNorm.includes('teamleader') ||
      topNorm.includes('leader') ||
      topNorm.includes('phutrach') ||
      topNorm.includes('canbophutrach')
    ) {
      if (headerMap['teamLeader'] === undefined) {
        headerMap['teamLeader'] = idx;
        assignedCols.add(idx);
      }
    }
    // 8. Xã Tỉnh / Quê quán / Địa chỉ (Separate or combined)
    else if (topNorm === 'xa' || topNorm.includes('xaphuong') || topNorm.includes('phuongxa') || topNorm === 'phuong' || topNorm.includes('thitran')) {
      headerMap['ward'] = idx;
      assignedCols.add(idx);
    } else if (topNorm === 'tinh' || topNorm.includes('tinhtp') || topNorm.includes('thanhpho') || topNorm === 'tp') {
      headerMap['province'] = idx;
      assignedCols.add(idx);
    } else if (topNorm === 'huyen' || topNorm.includes('quanhuyen') || topNorm.includes('huyenquan') || topNorm === 'quan' || topNorm.includes('thixa')) {
      headerMap['district'] = idx;
      assignedCols.add(idx);
    } else if (
      topNorm.includes('xatinh') ||
      topNorm.includes('tinhxa') ||
      topNorm.includes('quequan') ||
      topNorm.includes('noithuongtru') ||
      topNorm.includes('hokhauthuongtru') ||
      topNorm.includes('noidangkyhokhauthuongtru') ||
      topNorm.includes('thuongtru') ||
      topNorm.includes('hokhau') ||
      topNorm.includes('diachi') ||
      topNorm === 'address' ||
      topNorm === 'hometown'
    ) {
      if (headerMap['address'] === undefined) {
        headerMap['address'] = idx;
        assignedCols.add(idx);
      }
    }
    // 9. Giới tính
    else if (topNorm.includes('gioitinh') || topNorm === 'phai' || topNorm.includes('gender') || topNorm.includes('namnu')) {
      headerMap['gender'] = idx;
      assignedCols.add(idx);
    }
    // 10. Dãy, Phòng, Giường
    else if (topNorm.includes('dayktx') || topNorm.includes('khoiktx') || topNorm === 'day' || topNorm === 'khu' || topNorm === 'dorm') {
      headerMap['dorm'] = idx;
      assignedCols.add(idx);
    } else if (topNorm.includes('sophong') || topNorm === 'phong' || topNorm === 'room') {
      headerMap['room'] = idx;
      assignedCols.add(idx);
    } else if (topNorm.includes('sogiuong') || topNorm.includes('sovitri') || topNorm === 'giuong' || topNorm === 'bed') {
      headerMap['bed'] = idx;
      assignedCols.add(idx);
    }
    // 11. Nơi làm việc
    else if (topNorm.includes('noilamviec') || topNorm.includes('workplace') || topNorm.includes('bophan') || topNorm.includes('xuong') || topNorm.includes('donvi')) {
      headerMap['workplace'] = idx;
      assignedCols.add(idx);
    }
    // 12. Trạng thái
    else if (topNorm.includes('trangthai') || topNorm.includes('tinhtrang') || topNorm.includes('status')) {
      headerMap['status'] = idx;
      assignedCols.add(idx);
    }
    // 13. Ghi chú
    else if (topNorm.includes('ghichu') || topNorm === 'note' || topNorm === 'notes' || topNorm.includes('remark')) {
      headerMap['note'] = idx;
      assignedCols.add(idx);
    }
  });

  // Check if firstName and lastName were found instead of single 'name'
  if (headerMap['name'] === undefined && headerMap['firstName'] !== undefined) {
    // Both split columns exist
  }

  const startDataRowIdx = subHeaderRowIdx !== -1 ? subHeaderRowIdx + 1 : headerRowIdx + 1;

  // Pass 3: Heuristic content detection for missing essential fields
  // If CCCD, Phone, DOB, or EmpCode were not recognized by header, inspect actual data
  const sampleRows = jsonData.slice(startDataRowIdx, startDataRowIdx + 10);
  if (sampleRows.length > 0) {
    const colCount = Math.max(...sampleRows.map((r) => (Array.isArray(r) ? r.length : 0)));
    for (let c = 0; c < colCount; c++) {
      if (assignedCols.has(c)) continue;
      const values = sampleRows.map((r) => String(r[c] || '').trim()).filter(Boolean);
      if (values.length === 0) continue;

      // CCCD heuristic: 9 or 12 digits or scientific notation
      if (headerMap['cccd'] === undefined) {
        const cccdMatches = values.filter((v) => /^(0\d{11}|\d{12}|\d{9}|[1-9]\.\d+e\+\d+)$/i.test(v.replace(/\s+/g, '')));
        if (cccdMatches.length >= Math.ceil(values.length * 0.6)) {
          headerMap['cccd'] = c;
          assignedCols.add(c);
          continue;
        }
      }

      // Phone heuristic: 10 digits starting with 03, 05, 07, 08, 09 or +84
      if (headerMap['phone'] === undefined) {
        const phoneMatches = values.filter((v) => /^(0[35789]\d{8}|\+84[35789]\d{8}|84[35789]\d{8})$/.test(v.replace(/[\s\.\-]/g, '')));
        if (phoneMatches.length >= Math.ceil(values.length * 0.6)) {
          headerMap['phone'] = c;
          assignedCols.add(c);
          continue;
        }
      }

      // DOB heuristic: dates like DD/MM/YYYY or 4-digit years 1950-2010
      if (headerMap['dob'] === undefined) {
        const dobMatches = values.filter((v) => /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(v) || /^(19[4-9]\d|200\d|201\d)$/.test(v));
        if (dobMatches.length >= Math.ceil(values.length * 0.6)) {
          headerMap['dob'] = c;
          assignedCols.add(c);
          continue;
        }
      }

      // EmpCode heuristic: short alphanumeric code, e.g. NV..., MS...
      if (headerMap['empCode'] === undefined) {
        const empMatches = values.filter((v) => /^[a-zA-Z0-9_-]{3,12}$/.test(v) && !/^\d{9,12}$/.test(v));
        if (empMatches.length >= Math.ceil(values.length * 0.6)) {
          headerMap['empCode'] = c;
          assignedCols.add(c);
          continue;
        }
      }
    }
  }

  const existingEmpCodes = new Set(existingWorkers.map((w) => w.empCode.toLowerCase()));
  const existingCccds = new Set(existingWorkers.filter((w) => w.cccd).map((w) => w.cccd));
  
  const parsedRows: ImportPreviewRow[] = [];
  const seenEmpCodes = new Set<string>();
  const seenCccds = new Set<string>();

  let missingPhoneCount = 0;
  let dupEmpCount = 0;
  let dupCccdCount = 0;

  // Track ditto marks (") or blank rows for team leader / tổ đội
  let lastTeamLeader = '';

  // Smart Room & Bed assignment setup (when Excel has no Dorm/Room/Bed columns)
  const hasDormCol = headerMap['dorm'] !== undefined;
  const hasRoomCol = headerMap['room'] !== undefined;
  const targetDorm = Math.min(Math.max(targetDormNumber || 1, 1), config.numDorms);

  // Pre-calculate room occupancy in target dorm
  const currentOccupancyByRoom = new Map<number, number>();
  existingWorkers
    .filter((w) => w.dorm === targetDorm && w.status === 'Đang ở')
    .forEach((w) => {
      currentOccupancyByRoom.set(w.room, (currentOccupancyByRoom.get(w.room) || 0) + 1);
    });

  let currentAllocRoom = 1;
  let currentAllocBed = 1;
  // Advance to first room with space
  while (currentAllocRoom <= config.roomsPerDorm && (currentOccupancyByRoom.get(currentAllocRoom) || 0) >= config.maxBedsPerRoom) {
    currentAllocRoom++;
  }
  currentAllocBed = (currentOccupancyByRoom.get(currentAllocRoom) || 0) + 1;

  for (let r = startDataRowIdx; r < jsonData.length; r++) {
    const row = jsonData[r];
    const rawRow = jsonDataRaw[r] || [];
    if (!row || row.every((c: any) => c === '' || c === undefined)) continue;

    const getValue = (key: string): any => {
      const colIdx = headerMap[key];
      if (colIdx !== undefined) {
        const valFormatted = row[colIdx];
        const valRaw = rawRow[colIdx];
        if (valFormatted !== undefined && String(valFormatted).trim() !== '') {
          return valFormatted;
        }
        if (valRaw !== undefined && String(valRaw).trim() !== '') {
          return valRaw;
        }
      }
      return '';
    };

    // Full name handling: single column or split (Họ & tên đệm + Tên)
    let rawName = String(getValue('name') || '').trim();
    if (!rawName && headerMap['firstName'] !== undefined) {
      const lastName = String(getValue('lastName') || '').trim();
      const firstName = String(getValue('firstName') || '').trim();
      rawName = [lastName, firstName].filter(Boolean).join(' ');
    }

    const rawEmpCode = String(getValue('empCode') || '').trim();
    const rawCccd = getValue('cccd');

    // Skip title or divider rows (if no name, no empCode, no cccd)
    if (!rawName && !rawEmpCode && !rawCccd) {
      continue;
    }

    const stt = getValue('stt') || (parsedRows.length + 1);
    const name = normalizePersonName(rawName);
    const cccd = normalizeCccdNumber(rawCccd);
    const phone = normalizePhoneNumber(getValue('phone'));
    const dob = formatToDmy(getValue('dob'));
    
    // Gender
    const rawGender = String(getValue('gender') || '').trim();
    let gender = '';
    if (rawGender) {
      const gNorm = removeVietnameseTones(rawGender).toLowerCase();
      if (gNorm.startsWith('nam') || gNorm === 'm' || gNorm === 'male') gender = 'Nam';
      else if (gNorm.startsWith('nu') || gNorm === 'f' || gNorm === 'female') gender = 'Nữ';
      else gender = rawGender;
    }

    // Tổ đội / Tên tổ trưởng (User requirement: "tổ đội là tên tổ trưởng")
    // Handling ditto mark " or blank under team leader
    let rawTeam = String(getValue('teamLeader') || '').trim();
    const isDitto = rawTeam === '"' || rawTeam === '""' || rawTeam === '”' || rawTeam === '“' || rawTeam === '″' || rawTeam === '-' || rawTeam === '--' || rawTeam === '---' || rawTeam.toLowerCase() === 'nt' || rawTeam.toLowerCase() === 'nt.' || rawTeam.toLowerCase() === 'nhu tren';
    
    if (isDitto) {
      rawTeam = lastTeamLeader;
    } else if (rawTeam) {
      lastTeamLeader = rawTeam;
    } else if (!rawTeam && lastTeamLeader) {
      // Inherit team leader when empty in group
      rawTeam = lastTeamLeader;
    }

    const teamLeader = rawTeam;
    const workplace = rawTeam ? (rawTeam.toLowerCase().startsWith('tổ') ? rawTeam : `Tổ ${rawTeam}`) : String(getValue('workplace') || '').trim();

    // Hộ khẩu thường trú / Quê quán (Xã, Tỉnh)
    const rawVillage = String(getValue('village') || '').trim();
    const rawWard = String(getValue('ward') || '').trim();
    const rawDistrict = String(getValue('district') || '').trim();
    const rawProvince = String(getValue('province') || '').trim();
    const rawAddress = String(getValue('address') || '').trim();

    let address = '';
    let hometown = '';

    if (rawWard && rawProvince) {
      const parts = [rawVillage, rawWard, rawDistrict, rawProvince].filter(Boolean);
      address = parts.join(', ');
      hometown = `${rawWard}, ${rawProvince}`;
    } else if (rawProvince) {
      const parts = [rawVillage, rawWard, rawDistrict, rawProvince].filter(Boolean);
      address = parts.join(', ');
      hometown = rawDistrict ? `${rawDistrict}, ${rawProvince}` : rawProvince;
    } else if (rawWard) {
      address = rawWard;
      hometown = rawWard;
    } else if (rawAddress) {
      address = simplifyAddress(rawAddress);
      hometown = address;
    }

    // EmpCode fallback if missing in file
    let empCode = rawEmpCode.replace(/\.0+$/, '').trim();
    if (!empCode) {
      if (cccd) {
        empCode = 'NV' + cccd.slice(-6);
      } else {
        empCode = 'NV' + String(stt).padStart(4, '0');
      }
    }

    // Dorm, Room, Bed assignment
    let dormNum = targetDorm;
    let roomNum = 1;
    let bedNum = 1;

    if (hasDormCol || hasRoomCol) {
      const parsedDorm = parseInt(String(getValue('dorm')).replace(/[^0-9]/g, '') || String(targetDorm), 10);
      dormNum = !isNaN(parsedDorm) && parsedDorm > 0 ? parsedDorm : targetDorm;

      const parsedRoom = parseInt(String(getValue('room')).replace(/[^0-9]/g, '') || '1', 10);
      roomNum = !isNaN(parsedRoom) && parsedRoom > 0 ? parsedRoom : 1;

      const parsedBed = parseInt(String(getValue('bed')).replace(/[^0-9]/g, '') || '1', 10);
      bedNum = !isNaN(parsedBed) && parsedBed > 0 ? parsedBed : 1;
    } else {
      // Auto sequential bed distribution across rooms in selected dorm
      dormNum = targetDorm;
      roomNum = currentAllocRoom;
      bedNum = currentAllocBed;

      // Increment allocation pointer
      currentAllocBed++;
      if (currentAllocBed > config.maxBedsPerRoom) {
        currentAllocRoom++;
        currentAllocBed = 1;
      }
    }

    // Status
    const rawStatus = String(getValue('status') || '');
    let status: WorkerStatus = 'Đang ở';
    if (rawStatus && (removeVietnameseTones(rawStatus).includes('roi') || removeVietnameseTones(rawStatus).includes('nghi') || removeVietnameseTones(rawStatus).includes('out') || removeVietnameseTones(rawStatus).includes('check'))) {
      status = 'Đã check out';
    }

    const note = String(getValue('note') || '').trim();

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
        warnings.push('Mã NV đã có trên KTX (sẽ cập nhật)');
        dupEmpCount++;
      }
      if (seenEmpCodes.has(lowerCode)) {
        warnings.push('Mã NV lặp lại trong file Excel');
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
      gender,
      dorm: dormNum,
      room: roomNum,
      bed: bedNum,
      teamLeader,
      status,
      empCode,
      cccd,
      address,
      hometown,
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
 * Async wrapper for parsing File directly with targetDorm support
 */
export async function parseWorkersFromExcel(
  file: File,
  existingWorkers: Worker[],
  config: DormConfig = { numDorms: 8, roomsPerDorm: 20, maxBedsPerRoom: 30, enableBedManagement: true },
  targetDormNumber: number = 1
): Promise<{
  validWorkers: Partial<Worker>[];
  previewRows: ImportPreviewRow[];
  errors: string[];
  totalRows: number;
  missingPhonesCount: number;
  duplicateEmpCodesCount: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const summary = parseExcelFile(arrayBuffer, existingWorkers, config, targetDormNumber);

  const validWorkers: Partial<Worker>[] = summary.rows
    .filter((r) => r.isValid)
    .map((r) => ({
      name: normalizePersonName(r.name),
      empCode: r.empCode.toUpperCase().trim(),
      cccd: r.cccd,
      phone: r.phone,
      dob: r.dob,
      gender: r.gender,
      address: r.address,
      hometown: r.hometown || r.address,
      workplace: r.workplace,
      teamLeader: r.teamLeader,
      dorm: r.dorm,
      room: r.room,
      bed: r.bed,
      status: r.status,
      note: r.note,
      entryDate: getTodayStr(),
      isValid: true,
    } as any));

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
    previewRows: summary.rows,
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

/**
 * Nén ảnh base64/file an toàn cho Cloud Firestore (< 200KB, max 1200px)
 * Đảm bảo không bị quá giới hạn 1MB của Firestore Document và hiển thị sắc nét
 */
export function compressImageBase64(dataUrl: string, maxDim = 1200, quality = 0.75): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return Promise.resolve(dataUrl || '');
  }
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

export type CccdPhotoStatusType = 'full' | 'partial' | 'missing';

export interface CccdPhotoStatusInfo {
  status: CccdPhotoStatusType;
  color: 'green' | 'blue' | 'yellow';
  label: string;
  tooltip: string;
  count: number;
  // Tailwind color styles for buttons & badges
  btnClass: string;
  iconClass: string;
  dotClass: string;
  badgeClass: string;
}

/**
 * Xác định trạng thái cảnh báo ảnh CCCD của công nhân:
 * - Đủ ảnh CCCD (2 mặt): Cảnh báo màu XANH LÁ (green)
 * - Có 1 mặt CCCD: Cảnh báo màu XANH DƯƠNG (blue)
 * - Thiếu cả 2 mặt CCCD: Cảnh báo màu VÀNG (yellow)
 */
export function getCccdPhotoStatus(worker?: {
  cccdFrontImage?: string;
  cccdBackImage?: string;
  cccdDocument?: { hasFront?: boolean; hasBack?: boolean };
} | null): CccdPhotoStatusInfo {
  if (!worker) {
    return {
      status: 'missing',
      color: 'yellow',
      count: 0,
      label: 'Thiếu cả 2 mặt',
      tooltip: 'Chưa có ảnh CCCD (thiếu cả 2 mặt) - Nhấn để chụp / tải ảnh',
      btnClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700/80 shadow-xs ring-1 ring-amber-400/30',
      iconClass: 'text-amber-500 hover:text-amber-600 dark:text-amber-400',
      dotClass: 'bg-amber-500 ring-white dark:ring-slate-900',
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    };
  }

  const hasFront = Boolean(worker.cccdFrontImage || worker.cccdDocument?.hasFront);
  const hasBack = Boolean(worker.cccdBackImage || worker.cccdDocument?.hasBack);

  if (hasFront && hasBack) {
    return {
      status: 'full',
      color: 'green',
      count: 2,
      label: 'Đủ 2 mặt',
      tooltip: 'Đủ ảnh CCCD (2 mặt trước & sau) - Nhấn để xem / quản lý ảnh',
      btnClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700/80 shadow-xs ring-1 ring-emerald-400/30',
      iconClass: 'text-emerald-500 hover:text-emerald-600 dark:text-emerald-400',
      dotClass: 'bg-emerald-500 ring-white dark:ring-slate-900',
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    };
  }

  if (hasFront || hasBack) {
    const side = hasFront ? 'mặt trước' : 'mặt sau';
    return {
      status: 'partial',
      color: 'blue',
      count: 1,
      label: 'Có 1 mặt',
      tooltip: `Có 1 mặt ảnh CCCD (${side}, thiếu 1 mặt) - Nhấn để bổ sung ảnh`,
      btnClass: 'text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 border border-blue-300 dark:border-blue-700/80 shadow-xs ring-1 ring-blue-400/30',
      iconClass: 'text-blue-500 hover:text-blue-600 dark:text-blue-400',
      dotClass: 'bg-blue-500 ring-white dark:ring-slate-900',
      badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    };
  }

  return {
    status: 'missing',
    color: 'yellow',
    count: 0,
    label: 'Thiếu cả 2 mặt',
    tooltip: 'Chưa có ảnh CCCD (thiếu cả 2 mặt) - Nhấn để chụp / tải ảnh',
    btnClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700/80 shadow-xs ring-1 ring-amber-400/30',
    iconClass: 'text-amber-500 hover:text-amber-600 dark:text-amber-400',
    dotClass: 'bg-amber-500 ring-white dark:ring-slate-900',
    badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  };
}
