import React, { useState, useMemo } from 'react';
import {
  X,
  LogOut,
  Search,
  Calendar,
  Clock,
  Building,
  DoorClosed,
  Phone,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  Filter,
  UserCheck,
  CreditCard,
  UserX,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { CheckedOutWorker } from '../../types';
import { useDorm } from '../../context/DormContext';
import * as XLSX from 'xlsx';

interface CheckedOutWorkersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkerForRestore?: (worker: CheckedOutWorker) => void;
  onFilterOnMainTable?: () => void;
  onSuccessToast?: (msg: string) => void;
  onErrorToast?: (msg: string) => void;
}

export const CheckedOutWorkersModal: React.FC<CheckedOutWorkersModalProps> = ({
  isOpen,
  onClose,
  onSelectWorkerForRestore,
  onFilterOnMainTable,
  onSuccessToast,
  onErrorToast,
}) => {
  const {
    checkedOutWorkers,
    currentUser,
    restoreCheckedOutWorker,
    deleteCheckedOutPermanent,
  } = useDorm();

  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [selectedDetailWorker, setSelectedDetailWorker] = useState<CheckedOutWorker | null>(null);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);

  // Restore Modal State
  const [workerToRestore, setWorkerToRestore] = useState<CheckedOutWorker | null>(null);
  const [restoreDorm, setRestoreDorm] = useState<number>(1);
  const [restoreRoom, setRestoreRoom] = useState<number>(1);
  const [restoreBed, setRestoreBed] = useState<number>(1);

  // Format date and time display: HH:mm - DD/MM/YYYY
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        // Fallback for YYYY-MM-DD
        const parts = isoString.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return isoString;
      }
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${hours}:${minutes} ${day}/${month}/${year}`;
    } catch {
      return isoString;
    }
  };

  // Format simple date DD/MM/YYYY
  const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Filter and sort checked out workers
  const filteredList = useMemo(() => {
    let result = [...checkedOutWorkers];

    // 1. Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((w) => {
        return (
          w.name.toLowerCase().includes(q) ||
          w.empCode.toLowerCase().includes(q) ||
          (w.cccd && w.cccd.toLowerCase().includes(q)) ||
          (w.phone && w.phone.toLowerCase().includes(q)) ||
          (w.teamLeader && w.teamLeader.toLowerCase().includes(q)) ||
          `dãy ${w.dorm}`.includes(q) ||
          `phòng ${w.room}`.includes(q) ||
          `p.${w.room}`.includes(q) ||
          (w.reason && w.reason.toLowerCase().includes(q))
        );
      });
    }

    // 2. Time Filter
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (timeFilter === 'TODAY') {
      result = result.filter((w) => {
        return (w.checkedOutAt && w.checkedOutAt.startsWith(todayStr)) || w.exitDate === todayStr;
      });
    } else if (timeFilter === 'WEEK') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      result = result.filter((w) => {
        const time = new Date(w.checkedOutAt || w.exitDate || 0).getTime();
        return time >= oneWeekAgo.getTime();
      });
    } else if (timeFilter === 'MONTH') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);
      result = result.filter((w) => {
        const time = new Date(w.checkedOutAt || w.exitDate || 0).getTime();
        return time >= oneMonthAgo.getTime();
      });
    }

    // 3. Sort by Date & Time
    result.sort((a, b) => {
      const timeA = new Date(a.checkedOutAt || a.exitDate || 0).getTime();
      const timeB = new Date(b.checkedOutAt || b.exitDate || 0).getTime();
      return sortOrder === 'DESC' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [checkedOutWorkers, searchTerm, timeFilter, sortOrder]);

  // Metric counts
  const totalCount = checkedOutWorkers.length;
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayCount = checkedOutWorkers.filter(
    (w) => (w.checkedOutAt && w.checkedOutAt.startsWith(todayStr)) || w.exitDate === todayStr
  ).length;
  const deletedCount = checkedOutWorkers.filter((w) => w.reason === 'Đã xóa khỏi KTX').length;
  const checkoutCount = totalCount - deletedCount;

  // Export Excel
  const handleExportExcel = () => {
    if (filteredList.length === 0) return;

    const dataRows = filteredList.map((w, idx) => ({
      STT: idx + 1,
      'Thời gian Check out': formatDateTime(w.checkedOutAt),
      'Họ và tên': w.name,
      'Mã nhân viên': w.empCode,
      'Dãy KTX': `Dãy ${w.dorm}`,
      'Số phòng': `Phòng ${w.room}`,
      'Vị trí giường': w.bed ? `Giường ${w.bed}` : '-',
      'Tổ trưởng phụ trách': w.teamLeader || '-',
      'Số CCCD': w.cccd || '-',
      'Số điện thoại': w.phone || '-',
      'Ngày sinh': formatDateOnly(w.dob),
      'Ngày vào KTX': formatDateOnly(w.entryDate),
      'Ngày rời KTX': formatDateOnly(w.exitDate),
      'Phân loại check out': w.reason || 'Check out khỏi phòng',
      'Trạng thái': 'Đã check out',
      'Ghi chú': w.note || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Da_Check_Out_KTX');

    const fileName = `Danh_Sach_Cong_Nhan_Da_Check_Out_${todayStr}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Handle Restore Worker
  const handleOpenRestore = (worker: CheckedOutWorker) => {
    setWorkerToRestore(worker);
    setRestoreDorm(worker.dorm || 1);
    setRestoreRoom(worker.room || 1);
    setRestoreBed(worker.bed || 1);
    setRestoreMessage(null);
  };

  const handleConfirmRestore = async () => {
    if (!workerToRestore) return;
    setIsRestoring(workerToRestore.id);
    const res = await restoreCheckedOutWorker(
      workerToRestore,
      restoreDorm,
      restoreRoom,
      restoreBed
    );
    setIsRestoring(null);
    if (res.success) {
      setRestoreMessage(res.message);
      if (onSuccessToast) onSuccessToast(res.message);
      setTimeout(() => {
        setWorkerToRestore(null);
        setRestoreMessage(null);
      }, 1200);
    } else {
      setRestoreMessage(`Lỗi: ${res.message}`);
      if (onErrorToast) onErrorToast(`Lỗi: ${res.message}`);
    }
  };

  // Handle Permanent Delete
  const handleDeletePermanent = async (recordId: string, name: string) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn XÓA VĨNH VIỄN hồ sơ "${name}" khỏi lịch sử check out? Thao tác này không thể hoàn tác.`
      )
    ) {
      return;
    }
    await deleteCheckedOutPermanent(recordId);
    if (onSuccessToast) {
      onSuccessToast(`Đã xóa vĩnh viễn hồ sơ "${name}" khỏi lịch sử.`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-850 rounded-2xl max-w-6xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[94vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-rose-50 via-amber-50/50 to-white dark:from-slate-800 dark:via-slate-800 dark:to-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Danh sách công nhân đã check out khỏi KTX
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                  {totalCount} hồ sơ
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bao gồm tất cả công nhân đã xóa và check out khỏi phòng, sắp xếp theo ngày giờ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick KPI Summary Cards */}
        <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Tổng đã check out</span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {totalCount} <span className="text-xs font-normal text-slate-400">người</span>
            </div>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Check out hôm nay</span>
            <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
              +{todayCount} <span className="text-xs font-normal text-slate-400">hôm nay</span>
            </div>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Check out từ phòng</span>
            <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
              {checkoutCount} <span className="text-xs font-normal text-slate-400">hồ sơ</span>
            </div>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Đã xóa khỏi KTX</span>
            <div className="text-xl font-extrabold text-violet-600 dark:text-violet-400 mt-0.5">
              {deletedCount} <span className="text-xs font-normal text-slate-400">hồ sơ lưu</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-850">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, mã NV, CCCD, SĐT, phòng..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Time Filter Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setTimeFilter('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                timeFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('TODAY')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                timeFilter === 'TODAY'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('WEEK')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                timeFilter === 'WEEK'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('MONTH')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                timeFilter === 'MONTH'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tháng này
            </button>
          </div>

          {/* Action Buttons: Sort & Main Table & Export */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors"
              title="Đổi chiều sắp xếp theo ngày giờ"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{sortOrder === 'DESC' ? 'Mới nhất trước' : 'Cũ nhất trước'}</span>
            </button>

            {onFilterOnMainTable && (
              <button
                type="button"
                onClick={() => {
                  onFilterOnMainTable();
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors"
                title="Áp dụng bộ lọc Đã check out trên bảng công nhân chính"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Lọc trên bảng chính</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredList.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Xuất Excel ({filteredList.length})</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredList.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <UserX className="w-12 h-12 mx-auto stroke-1 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Không tìm thấy hồ sơ công nhân đã check out nào phù hợp.
              </p>
              <p className="text-xs">
                Khi công nhân check out khỏi phòng hoặc bị xóa khỏi KTX, hệ thống sẽ tự động lưu lại vào danh sách này.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">STT</th>
                    <th className="py-3 px-3">
                      <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Ngày giờ Check out</span>
                      </div>
                    </th>
                    <th className="py-3 px-3">Họ và tên</th>
                    <th className="py-3 px-3">Mã NV</th>
                    <th className="py-3 px-3">Vị trí phòng từng ở</th>
                    <th className="py-3 px-3">Tổ trưởng</th>
                    <th className="py-3 px-3">SĐT & CCCD</th>
                    <th className="py-3 px-3">Phân loại</th>
                    <th className="py-3 px-3 text-center">Trạng thái</th>
                    <th className="py-3 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-850">
                  {filteredList.map((worker, index) => {
                    return (
                      <tr
                        key={worker.id || `co_${index}`}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                      >
                        {/* STT */}
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                          {index + 1}
                        </td>

                        {/* Ngày giờ Check out */}
                        <td className="py-2.5 px-3 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold border border-rose-200/80 dark:border-rose-800/60 text-[11px]">
                            <Clock className="w-3 h-3 text-rose-500" />
                            {formatDateTime(worker.checkedOutAt || worker.exitDate)}
                          </span>
                        </td>

                        {/* Họ và tên */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {worker.name}
                          </div>
                          {worker.dob && (
                            <span className="text-[11px] text-slate-400">
                              NS: {formatDateOnly(worker.dob)}
                            </span>
                          )}
                        </td>

                        {/* Mã NV */}
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {worker.empCode}
                        </td>

                        {/* Dãy / Phòng */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              Dãy {worker.dorm}
                            </span>
                            <span>P.{worker.room}</span>
                            {worker.bed && (
                              <span className="text-slate-400 text-[11px]">
                                (G.{worker.bed})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tổ trưởng */}
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {worker.teamLeader || '-'}
                        </td>

                        {/* SĐT & CCCD */}
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {worker.phone && <div>📞 {worker.phone}</div>}
                          {worker.cccd && <div>🪪 {worker.cccd}</div>}
                          {!worker.phone && !worker.cccd && '-'}
                        </td>

                        {/* Lý do / Phân loại */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              worker.reason === 'Đã xóa khỏi KTX'
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {worker.reason || 'Check out khỏi phòng'}
                          </span>
                        </td>

                        {/* Trạng thái */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                            Đã check out
                          </span>
                        </td>

                        {/* Thao tác */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Nút Tái nhập KTX */}
                            <button
                              type="button"
                              onClick={() => handleOpenRestore(worker)}
                              disabled={isRestoring === worker.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors"
                              title="Tái nhập / đưa công nhân quay lại KTX"
                            >
                              <RotateCcw className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Tái nhập KTX</span>
                            </button>

                            {/* Nút Xóa vĩnh viễn (Chỉ Admin hoặc Quản lý) */}
                            {currentUser?.role !== 'viewer' && (
                              <button
                                type="button"
                                onClick={() => handleDeletePermanent(worker.id, worker.name)}
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                title="Xóa vĩnh viễn khỏi lịch sử"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Hiển thị <strong>{filteredList.length}</strong> / <strong>{totalCount}</strong> hồ sơ đã check out
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>

      {/* Sub-Modal: Tái nhập công nhân vào KTX */}
      {workerToRestore && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Tái nhập công nhân vào KTX
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setWorkerToRestore(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs space-y-1">
              <div>Họ và tên: <strong className="text-slate-900 dark:text-white">{workerToRestore.name}</strong></div>
              <div>Mã NV: <strong className="font-mono text-blue-600">{workerToRestore.empCode}</strong></div>
              <div>Tổ trưởng: <span>{workerToRestore.teamLeader || '-'}</span></div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn Dãy KTX tiếp nhận:
                </label>
                <select
                  value={restoreDorm}
                  onChange={(e) => setRestoreDorm(Number(e.target.value))}
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold"
                >
                  {[1, 2, 3, 4, 5, 6].map((d) => (
                    <option key={d} value={d}>Dãy {d}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số phòng:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={restoreRoom}
                    onChange={(e) => setRestoreRoom(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vị trí giường:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={restoreBed}
                    onChange={(e) => setRestoreBed(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-bold text-center"
                  />
                </div>
              </div>
            </div>

            {restoreMessage && (
              <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>{restoreMessage}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWorkerToRestore(null)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={Boolean(isRestoring)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                <span>Xác nhận tái nhập</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
