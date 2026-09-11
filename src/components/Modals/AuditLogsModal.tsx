import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Search,
  FileSpreadsheet,
  FileDown,
  Download,
  Upload,
  Layers,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Building,
  Users,
  FileText,
  ShieldCheck,
  UserPlus,
  UserCheck,
  UserX,
  LogIn,
  Sliders,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useDorm } from '../../context/DormContext';
import { formatDateTimeDisplay } from '../../utils/helpers';
import { AuditLog, AuditItemRecord } from '../../types';

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FilterCategory =
  | 'ALL'
  | 'IMPORT_EXPORT'
  | 'IMPORT_EXCEL'
  | 'EXPORT_EXCEL'
  | 'BACKUP_RESTORE'
  | 'WORKER'
  | 'AUTH';

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({ isOpen, onClose }) => {
  const { auditLogs } = useDorm();

  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [itemSearchTerms, setItemSearchTerms] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Safe Audit Logs Array
  const safeAuditLogs: AuditLog[] = useMemo(() => {
    if (!Array.isArray(auditLogs)) return [];
    return auditLogs.filter((log): log is AuditLog => Boolean(log && typeof log === 'object'));
  }, [auditLogs]);

  // Toggle accordion expand
  const toggleExpand = (id?: string) => {
    if (!id) return;
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Safe copy emp codes to clipboard
  const handleCopyEmpCodes = async (logId: string, items?: AuditItemRecord[]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    try {
      const codes = items
        .map((i) => (i?.empCode ? String(i.empCode).trim() : ''))
        .filter(Boolean)
        .join(', ');

      if (!codes) return;

      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(codes);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = codes;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedId(logId);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.warn('Lỗi khi sao chép mã nhân viên:', err);
    }
  };

  // Safe download items as Excel
  const handleDownloadLogItemsExcel = (log: AuditLog) => {
    if (!Array.isArray(log.items) || log.items.length === 0) return;

    try {
      const data = log.items.map((item, idx) => ({
        'STT': idx + 1,
        'Mã NV': item?.empCode ? String(item.empCode) : '-',
        'Họ và tên': item?.name ? String(item.name) : '-',
        'Dãy': item?.dorm ? `Dãy ${item.dorm}` : '-',
        'Phòng': item?.room ? `Phòng ${String(item.room).padStart(2, '0')}` : '-',
        'Giường': item?.bed ? `Giường ${item.bed}` : '-',
        'Thao tác': item?.actionType ? String(item.actionType) : '-',
        'Trạng thái': item?.status ? String(item.status) : '-',
        'Số điện thoại': item?.phone ? String(item.phone) : '-',
        'Số CCCD': item?.cccd ? String(item.cccd) : '-',
        'Nơi làm việc': item?.workplace ? String(item.workplace) : '-',
        'Giới tính': item?.gender ? String(item.gender) : '-',
        'Ngày vào': item?.entryDate ? String(item.entryDate) : '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ChiTiet');

      const rawTitle = log.fileName || log.action || 'DanhSach_ChiTiet';
      const cleanTitle = String(rawTitle).replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, '_');
      const fileName = `ChiTiet_${cleanTitle}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error('Lỗi tải file Excel chi tiết:', err);
    }
  };

  // Safe export all audit logs
  const handleExportAllAuditLogs = () => {
    try {
      const exportData = safeAuditLogs.map((l, index) => ({
        'STT': index + 1,
        'Thời gian': formatDateTimeDisplay(l.timestamp),
        'Hành động': l.action ? String(l.action) : 'HOẠT ĐỘNG',
        'Nội dung chi tiết': l.details ? String(l.details) : '',
        'Tên tệp liên quan': l.fileName ? String(l.fileName) : '-',
        'Phạm vi': l.scope ? String(l.scope) : '-',
        'Tổng số công nhân':
          l.totalCount !== undefined
            ? l.totalCount
            : Array.isArray(l.items)
            ? l.items.length
            : '-',
        'Người thực hiện': l.userName ? String(l.userName) : 'Hệ thống',
        'Email người thực hiện': l.userEmail ? String(l.userEmail) : '-',
        'Vai trò': l.role ? String(l.role) : 'manager',
        'Mã NV liên quan': l.empCode ? String(l.empCode) : '-',
        'Trạng thái': l.status ? String(l.status) : 'SUCCESS',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'NhatKyHeThong');

      const fileName = `Nhat_Ky_Hoat_Dong_KTX_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error('Lỗi xuất Excel toàn bộ nhật ký:', err);
    }
  };

  // Safe category counts
  const counts = useMemo(() => {
    let importExport = 0;
    let importExcel = 0;
    let exportExcel = 0;
    let backupRestore = 0;
    let worker = 0;
    let auth = 0;

    safeAuditLogs.forEach((l) => {
      if (!l) return;
      const act = typeof l.action === 'string' ? l.action : '';

      if (act === 'IMPORT_EXCEL' || act === 'IMPORT') importExcel++;
      if (act === 'EXPORT_EXCEL') exportExcel++;
      if (
        act === 'EXPORT_BACKUP' ||
        act === 'RESTORE_DATA' ||
        act === 'MERGE_DATA' ||
        act === 'RESTORE'
      ) {
        backupRestore++;
      }
      if (
        act.includes('IMPORT') ||
        act.includes('EXPORT') ||
        act.includes('RESTORE') ||
        act.includes('MERGE')
      ) {
        importExport++;
      }
      if (['CREATE', 'UPDATE', 'DELETE', 'CHECK_OUT'].includes(act)) worker++;
      if (['LOGIN', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER'].includes(act)) auth++;
    });

    return {
      all: safeAuditLogs.length,
      importExport,
      importExcel,
      exportExcel,
      backupRestore,
      worker,
      auth,
    };
  }, [safeAuditLogs]);

  // Action types for select dropdown
  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    safeAuditLogs.forEach((l) => {
      if (l && typeof l.action === 'string' && l.action.trim()) {
        set.add(l.action.trim());
      }
    });
    return Array.from(set);
  }, [safeAuditLogs]);

  // Safe Filtered Logs
  const filteredLogs = useMemo(() => {
    return safeAuditLogs.filter((log) => {
      if (!log) return false;
      const act = typeof log.action === 'string' ? log.action : '';

      // 1. Category Filter
      if (activeCategory === 'IMPORT_EXPORT') {
        const isIE =
          act.includes('IMPORT') ||
          act.includes('EXPORT') ||
          act.includes('RESTORE') ||
          act.includes('MERGE');
        if (!isIE) return false;
      } else if (activeCategory === 'IMPORT_EXCEL') {
        if (act !== 'IMPORT_EXCEL' && act !== 'IMPORT') return false;
      } else if (activeCategory === 'EXPORT_EXCEL') {
        if (act !== 'EXPORT_EXCEL') return false;
      } else if (activeCategory === 'BACKUP_RESTORE') {
        if (
          act !== 'EXPORT_BACKUP' &&
          act !== 'RESTORE_DATA' &&
          act !== 'MERGE_DATA' &&
          act !== 'RESTORE'
        ) {
          return false;
        }
      } else if (activeCategory === 'WORKER') {
        if (!['CREATE', 'UPDATE', 'DELETE', 'CHECK_OUT'].includes(act)) return false;
      } else if (activeCategory === 'AUTH') {
        if (!['LOGIN', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER'].includes(act)) return false;
      }

      // 2. Action Filter Dropdown
      if (actionFilter !== 'ALL' && act !== actionFilter) {
        return false;
      }

      // 3. Search Query (Safe String Conversion for all properties)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const mDetails = String(log.details || '').toLowerCase().includes(q);
        const mUser =
          String(log.userName || '').toLowerCase().includes(q) ||
          String(log.userEmail || '').toLowerCase().includes(q);
        const mFile = String(log.fileName || '').toLowerCase().includes(q);
        const mScope = String(log.scope || '').toLowerCase().includes(q);
        const mEmp = String(log.empCode || '').toLowerCase().includes(q);

        // Search inside items safely (handles numbers and undefined values)
        const mItems =
          Array.isArray(log.items) &&
          log.items.some((it) => {
            if (!it) return false;
            return (
              String(it.empCode || '').toLowerCase().includes(q) ||
              String(it.name || '').toLowerCase().includes(q) ||
              String(it.phone || '').toLowerCase().includes(q) ||
              String(it.cccd || '').toLowerCase().includes(q) ||
              String(it.room || '').toLowerCase().includes(q) ||
              String(it.dorm || '').toLowerCase().includes(q)
            );
          });

        return Boolean(mDetails || mUser || mFile || mScope || mEmp || mItems);
      }

      return true;
    });
  }, [safeAuditLogs, activeCategory, actionFilter, searchTerm]);

  // Safe Action Badge Renderer
  const renderActionBadge = (action?: string) => {
    const act = typeof action === 'string' ? action : 'HOẠT ĐỘNG';
    switch (act) {
      case 'IMPORT_EXCEL':
      case 'IMPORT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Nhập danh sách Excel</span>
          </span>
        );
      case 'EXPORT_EXCEL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <FileDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Xuất file Excel</span>
          </span>
        );
      case 'EXPORT_BACKUP':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
            <Download className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Xuất sao lưu JSON</span>
          </span>
        );
      case 'RESTORE_DATA':
      case 'RESTORE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Upload className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Phục hồi dữ liệu JSON</span>
          </span>
        );
      case 'MERGE_DATA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-50 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
            <Layers className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
            <span>Ghép dữ liệu JSON</span>
          </span>
        );
      case 'CREATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            <UserPlus className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Thêm hồ sơ</span>
          </span>
        );
      case 'UPDATE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <UserCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Cập nhật hồ sơ</span>
          </span>
        );
      case 'DELETE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Xóa hồ sơ</span>
          </span>
        );
      case 'CHECK_OUT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            <Users className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            <span>Check-out trả phòng</span>
          </span>
        );
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <LogIn className="w-3.5 h-3.5 text-slate-500" />
            <span>Đăng nhập</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <span>{act}</span>
          </span>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-4 sm:my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Nhật ký hoạt động hệ thống (Audit Logs)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                  {safeAuditLogs.length} bản ghi
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Theo dõi chi tiết danh sách nhập/xuất Excel, sao lưu JSON và các thao tác biến động KTX
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-audit-logs"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'ALL'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tất cả ({counts.all})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('IMPORT_EXPORT')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'IMPORT_EXPORT'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Toàn bộ Nhập/Xuất ({counts.importExport})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('IMPORT_EXCEL')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'IMPORT_EXCEL'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-indigo-200 dark:border-indigo-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-500" />
            <span>Nhập Excel ({counts.importExcel})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('EXPORT_EXCEL')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'EXPORT_EXCEL'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs border border-emerald-200 dark:border-emerald-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-500" />
            <span>Xuất Excel ({counts.exportExcel})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('BACKUP_RESTORE')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'BACKUP_RESTORE'
                ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-xs border border-cyan-200 dark:border-cyan-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Download className="w-3.5 h-3.5 text-cyan-500" />
            <span>Sao lưu / Khôi phục ({counts.backupRestore})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('WORKER')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'WORKER'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs border border-teal-200 dark:border-teal-800'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-teal-500" />
            <span>Biến động hồ sơ ({counts.worker})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('AUTH')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'AUTH'
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white/60 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span>Tài khoản & Đăng nhập ({counts.auth})</span>
          </button>
        </div>

        {/* Toolbar (Search & Detail Filter) */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-800 shrink-0">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="input-search-audit-logs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo nội dung, tên tệp, phạm vi, người thực hiện hoặc mã NV / tên công nhân..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors font-medium"
            >
              <option value="ALL">Tất cả loại thao tác ({actionTypes.length})</option>
              {actionTypes.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Log Timeline Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 bg-slate-50/50 dark:bg-slate-900/30">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
              <History className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="font-semibold text-slate-600 dark:text-slate-400">Không có dữ liệu nhật ký phù hợp</p>
              <p className="text-slate-400">Hãy thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.</p>
            </div>
          ) : (
            filteredLogs.map((log, logIdx) => {
              const logKey = log.id || `audit-log-fallback-${logIdx}`;
              const isExpanded = expandedLogIds.has(logKey);
              const hasItems = Array.isArray(log.items) && log.items.length > 0;
              const subSearch = itemSearchTerms[logKey] || '';

              // Filter sub items safely
              const displayedItems = hasItems
                ? log.items!.filter((it) => {
                    if (!it) return false;
                    if (!subSearch.trim()) return true;
                    const q = subSearch.toLowerCase().trim();
                    return (
                      String(it.empCode || '').toLowerCase().includes(q) ||
                      String(it.name || '').toLowerCase().includes(q) ||
                      String(it.phone || '').toLowerCase().includes(q) ||
                      String(it.cccd || '').toLowerCase().includes(q) ||
                      String(it.room || '').toLowerCase().includes(q) ||
                      String(it.dorm || '').toLowerCase().includes(q)
                    );
                  })
                : [];

              return (
                <div
                  key={logKey}
                  id={`audit-log-${logKey}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all overflow-hidden"
                >
                  {/* Log Card Header */}
                  <div className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {renderActionBadge(log.action)}
                        {log.totalCount !== undefined && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                            {log.totalCount} công nhân
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDateTimeDisplay(log.timestamp)}</span>
                      </div>
                    </div>

                    {/* Details Message */}
                    <div className="text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold leading-relaxed">
                      {log.details || 'Không có mô tả chi tiết'}
                    </div>

                    {/* Metadata Chips (File, Scope, Operator) */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {log.fileName && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 font-mono">
                          <FileText className="w-3 h-3 text-slate-500" />
                          <span className="font-semibold">Tệp:</span> {log.fileName}
                        </span>
                      )}

                      {log.scope && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                          <Building className="w-3 h-3 text-slate-500" />
                          <span className="font-semibold">Phạm vi:</span> {log.scope}
                        </span>
                      )}

                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>
                          Thực hiện: <strong>{log.userName || 'Hệ thống'}</strong>
                          {log.userEmail ? ` (${log.userEmail})` : ''}
                        </span>
                      </span>

                      {log.empCode && !hasItems && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono font-bold">
                          Mã NV: {log.empCode}
                        </span>
                      )}
                    </div>

                    {/* Button Toggle Chi tiết danh sách */}
                    {hasItems && (
                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700/60 mt-2">
                        <button
                          type="button"
                          onClick={() => toggleExpand(logKey)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>
                            {isExpanded
                              ? 'Thu gọn danh sách'
                              : `Xem chi tiết danh sách (${log.items!.length} công nhân)`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                          )}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleCopyEmpCodes(logKey, log.items!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Sao chép toàn bộ danh sách mã nhân viên"
                          >
                            {copiedId === logKey ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600 font-bold">Đã chép mã NV</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Sao chép mã NV</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadLogItemsExcel(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                            title="Tải danh sách này ra file Excel"
                          >
                            <FileDown className="w-3 h-3" />
                            <span>Tải Excel</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Items Table Section */}
                  {hasItems && isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-900/70 p-3.5 space-y-2.5">
                      {/* Sub Search Toolbar */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="relative w-full sm:w-72">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={subSearch}
                            onChange={(e) =>
                              setItemSearchTerms((prev) => ({ ...prev, [logKey]: e.target.value }))
                            }
                            placeholder="Lọc nhanh mã NV, họ tên, phòng..."
                            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Hiển thị <strong>{displayedItems.length}</strong> / {log.items!.length} hồ sơ công nhân
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="overflow-x-auto max-h-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                            <tr>
                              <th className="py-2 px-3 text-center w-12">STT</th>
                              <th className="py-2 px-3">Mã NV</th>
                              <th className="py-2 px-3">Họ và tên</th>
                              <th className="py-2 px-3">Phân bổ KTX</th>
                              <th className="py-2 px-3 text-center">Thao tác</th>
                              <th className="py-2 px-3">Trạng thái</th>
                              <th className="py-2 px-3">Số điện thoại</th>
                              <th className="py-2 px-3">CCCD</th>
                              <th className="py-2 px-3">Nơi làm việc</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {displayedItems.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="py-6 text-center text-slate-400 text-xs">
                                  Không tìm thấy công nhân nào khớp từ khóa lọc.
                                </td>
                              </tr>
                            ) : (
                              displayedItems.map((item, idx) => {
                                const actionColor =
                                  item?.actionType === 'Thêm mới'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : item?.actionType === 'Cập nhật'
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                    : item?.actionType === 'Xuất file'
                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';

                                const rowKey = item?.empCode
                                  ? `${logKey}-${item.empCode}-${idx}`
                                  : `${logKey}-row-${idx}`;

                                return (
                                  <tr
                                    key={rowKey}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                                  >
                                    <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                      {idx + 1}
                                    </td>
                                    <td className="py-1.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                                        {item?.empCode ? String(item.empCode) : '-'}
                                      </span>
                                    </td>
                                    <td className="py-1.5 px-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                      {item?.name ? String(item.name) : '-'}
                                    </td>
                                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                      {item?.dorm ? `Dãy ${item.dorm}` : ''}
                                      {item?.room ? ` - P.${String(item.room).padStart(2, '0')}` : ''}
                                      {item?.bed ? ` - G.${item.bed}` : ''}
                                      {!item?.dorm && !item?.room && '-'}
                                    </td>
                                    <td className="py-1.5 px-3 text-center">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${actionColor}`}
                                      >
                                        {item?.actionType ? String(item.actionType) : 'Hồ sơ'}
                                      </span>
                                    </td>
                                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                      {item?.status ? String(item.status) : '-'}
                                    </td>
                                    <td className="py-1.5 px-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                      {item?.phone ? String(item.phone) : '-'}
                                    </td>
                                    <td className="py-1.5 px-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                      {item?.cccd ? String(item.cccd) : '-'}
                                    </td>
                                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-xs">
                                      {item?.workplace ? String(item.workplace) : '-'}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Hiển thị <strong>{filteredLogs.length}</strong> / {safeAuditLogs.length} sự kiện hệ thống
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-export-all-audit-logs"
              onClick={handleExportAllAuditLogs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Xuất nhật ký ra Excel</span>
            </button>

            <button
              type="button"
              id="btn-close-audit-logs-footer"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
