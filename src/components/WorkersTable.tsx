import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  Image as ImageIcon,
  UserPlus,
  FileDown,
  FileUp,
  Filter,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SearchCode,
  UserX,
} from 'lucide-react';
import { Worker, WorkerStatus } from '../types';
import { useDorm } from '../context/DormContext';
import { formatDateDisplay, formatDateTimeDisplay } from '../utils/helpers';
import { matchesVietnameseSearch } from '../utils/vietnamese';

interface WorkersTableProps {
  selectedDormFilter?: number | null;
  selectedRoomFilter?: number | null;
  onClearRoomFilter?: () => void;
  onEditWorker: (worker: Worker) => void;
  onDeleteWorker: (worker: Worker) => void;
  onViewCccd: (worker: Worker) => void;
  onOpenAddWorker: () => void;
  onOpenSearchModal: () => void;
  onOpenDeleteByEmpCodeModal: () => void;
  onOpenExportModal: () => void;
  onOpenImportModal: () => void;
  initialStatusFilter?: string;
  initialEnteredToday?: boolean;
  initialExitedToday?: boolean;
}

type SortField = 'name' | 'dorm' | 'room' | 'status' | 'empCode' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export const WorkersTable: React.FC<WorkersTableProps> = ({
  selectedDormFilter = null,
  selectedRoomFilter = null,
  onClearRoomFilter,
  onEditWorker,
  onDeleteWorker,
  onViewCccd,
  onOpenAddWorker,
  onOpenSearchModal,
  onOpenDeleteByEmpCodeModal,
  onOpenExportModal,
  onOpenImportModal,
  initialStatusFilter = 'ALL',
  initialEnteredToday = false,
  initialExitedToday = false,
}) => {
  const { workers, config, currentUser } = useDorm();

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [dormFilter, setDormFilter] = useState<string>(selectedDormFilter ? String(selectedDormFilter) : 'ALL');
  const [roomFilter, setRoomFilter] = useState<string>(selectedRoomFilter ? String(selectedRoomFilter) : 'ALL');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [onlyEnteredToday, setOnlyEnteredToday] = useState(initialEnteredToday);
  const [onlyExitedToday, setOnlyExitedToday] = useState(initialExitedToday);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Sync external filters
  React.useEffect(() => {
    if (selectedDormFilter !== null) setDormFilter(String(selectedDormFilter));
  }, [selectedDormFilter]);

  React.useEffect(() => {
    if (selectedRoomFilter !== null) setRoomFilter(String(selectedRoomFilter));
  }, [selectedRoomFilter]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtered and Sorted Workers
  const filteredWorkers = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    return workers.filter((worker) => {
      // Search term filter (accent-insensitive)
      if (searchTerm) {
        const matchName = matchesVietnameseSearch(worker.name, searchTerm);
        const matchCode = matchesVietnameseSearch(worker.empCode, searchTerm);
        const matchTeamLeader = worker.teamLeader && matchesVietnameseSearch(worker.teamLeader, searchTerm);
        const matchWorkplace = worker.workplace && matchesVietnameseSearch(worker.workplace, searchTerm);
        const matchPhone = worker.phone && worker.phone.includes(searchTerm);
        const matchCccd = worker.cccd && worker.cccd.includes(searchTerm);
        const matchAddress = matchesVietnameseSearch(worker.address, searchTerm);
        if (!matchName && !matchCode && !matchTeamLeader && !matchWorkplace && !matchPhone && !matchCccd && !matchAddress) {
          return false;
        }
      }

      // Dorm filter
      if (dormFilter !== 'ALL' && worker.dorm !== Number(dormFilter)) {
        return false;
      }

      // Room filter
      if (roomFilter !== 'ALL' && worker.room !== Number(roomFilter)) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && worker.status !== statusFilter) {
        return false;
      }

      // Entered today
      if (onlyEnteredToday && worker.entryDate !== today) {
        return false;
      }

      // Exited today
      if (onlyExitedToday && worker.exitDate !== today) {
        return false;
      }

      return true;
    });
  }, [workers, searchTerm, dormFilter, roomFilter, statusFilter, onlyEnteredToday, onlyExitedToday]);

  // Sort logic
  const sortedWorkers = useMemo(() => {
    return [...filteredWorkers].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, 'vi');
      } else if (sortField === 'dorm') {
        comparison = a.dorm - b.dorm || a.room - b.room;
      } else if (sortField === 'room') {
        comparison = a.room - b.room || a.dorm - b.dorm;
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status, 'vi');
      } else if (sortField === 'empCode') {
        comparison = a.empCode.localeCompare(b.empCode);
      } else if (sortField === 'updatedAt') {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredWorkers, sortField, sortOrder]);

  // Pagination calculation
  const totalItems = sortedWorkers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const currentWorkers = sortedWorkers.slice(startIndex, startIndex + pageSize);

  const resetFilters = () => {
    setSearchTerm('');
    setDormFilter('ALL');
    setRoomFilter('ALL');
    setStatusFilter('ALL');
    setOnlyEnteredToday(false);
    setOnlyExitedToday(false);
    setCurrentPage(1);
    if (onClearRoomFilter) onClearRoomFilter();
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    dormFilter !== 'ALL' ||
    roomFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    onlyEnteredToday ||
    onlyExitedToday;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/90 shadow-sm overflow-hidden">
      
      {/* Table Control Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 space-y-4">
        
        {/* Row 1: Title & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Danh sách Công nhân Ký túc xá
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                {totalItems} hồ sơ
              </span>
            </h3>
            {hasActiveFilters && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1">
                <span>Đang áp dụng bộ lọc.</span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="underline hover:text-amber-700 font-medium"
                >
                  Xóa tất cả bộ lọc
                </button>
              </p>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="btn-table-search-modal"
              onClick={onOpenSearchModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Tìm công nhân</span>
            </button>

            {canEdit && (
              <button
                type="button"
                id="btn-table-delete-by-empcode"
                onClick={onOpenDeleteByEmpCodeModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors border border-rose-200 dark:border-rose-800"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Xóa theo mã NV</span>
              </button>
            )}

            <button
              type="button"
              id="btn-table-export-excel"
              onClick={onOpenExportModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors border border-emerald-200 dark:border-emerald-800"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Xuất Excel</span>
            </button>

            {canEdit && (
              <button
                type="button"
                id="btn-table-import-excel"
                onClick={onOpenImportModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors border border-indigo-200 dark:border-indigo-800"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Nhập Excel</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                id="btn-table-add-worker"
                onClick={onOpenAddWorker}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Thêm công nhân</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search & Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
          
          {/* Quick Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm nhanh: Họ tên, Mã NV, SĐT, CCCD, Quê quán..."
              className="w-full pl-9 pr-8 py-1.5 text-xs sm:text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dorm Filter */}
          <div>
            <select
              value={dormFilter}
              onChange={(e) => {
                setDormFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs sm:text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả Dãy (1 - {config.numDorms})</option>
              {Array.from({ length: config.numDorms }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Dãy {d}
                </option>
              ))}
            </select>
          </div>

          {/* Room Filter */}
          <div>
            <select
              value={roomFilter}
              onChange={(e) => {
                setRoomFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs sm:text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả Phòng (1 - {config.roomsPerDorm})</option>
              {Array.from({ length: config.roomsPerDorm }, (_, i) => i + 1).map((r) => (
                <option key={r} value={r}>
                  Phòng {String(r).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-1.5 px-2.5 text-xs sm:text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Tất cả Trạng thái</option>
              <option value="Đang ở">Đang ở</option>
              <option value="Đã rời KTX">Đã rời KTX</option>
            </select>
          </div>

        </div>
      </div>

      {/* Main Responsive Table */}
      <div className="overflow-x-auto min-h-[350px]">
        <table className="w-full text-left text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          
          {/* Table Header */}
          <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 font-semibold border-b border-slate-200 dark:border-slate-700 select-none">
            <tr>
              <th className="py-3 px-3 w-12 text-center">STT</th>
              
              <th
                onClick={() => handleSort('name')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Họ và tên</span>
                  {sortField === 'name' ? (
                    sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('dorm')}
                className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Dãy</span>
                  {sortField === 'dorm' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  )}
                </div>
              </th>

              <th
                onClick={() => handleSort('room')}
                className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Phòng</span>
                  {sortField === 'room' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  )}
                </div>
              </th>

              <th className="py-3 px-2 text-center">Số giường</th>
              <th className="py-3 px-3">Tổ trưởng</th>

              <th
                onClick={() => handleSort('status')}
                className="py-3 px-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>Trạng thái</span>
                  {sortField === 'status' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  )}
                </div>
              </th>

              <th className="py-3 px-3">Ngày sinh</th>

              <th
                onClick={() => handleSort('empCode')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Mã NV</span>
                  {sortField === 'empCode' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  )}
                </div>
              </th>

              <th className="py-3 px-3">CCCD</th>
              <th className="py-3 px-3 min-w-[160px]">Hộ khẩu thường trú</th>
              <th className="py-3 px-3">SĐT</th>

              <th
                onClick={() => handleSort('updatedAt')}
                className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Cập nhật</span>
                  {sortField === 'updatedAt' && (
                    sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                  )}
                </div>
              </th>

              <th className="py-3 px-3 text-center w-28">Thao tác</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {currentWorkers.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <SearchCode className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold">Không tìm thấy công nhân nào phù hợp</p>
                    <p className="text-xs">Thử thay đổi bộ lọc tìm kiếm hoặc thêm mới công nhân vào ký túc xá.</p>
                  </div>
                </td>
              </tr>
            ) : (
              currentWorkers.map((worker, index) => {
                const globalIndex = startIndex + index + 1;
                const isActive = worker.status === 'Đang ở';

                return (
                  <tr
                    key={worker.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors group"
                  >
                    {/* STT */}
                    <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs">
                      {globalIndex}
                    </td>

                    {/* Họ và tên */}
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span>{worker.name}</span>
                        {(worker.cccdFrontImage || worker.cccdBackImage) && (
                          <button
                            type="button"
                            onClick={() => onViewCccd(worker)}
                            className="text-blue-500 hover:text-blue-700"
                            title="Có ảnh CCCD"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Dãy */}
                    <td className="py-3 px-2 text-center">
                      <span className="inline-block font-bold text-slate-800 dark:text-slate-200">
                        {worker.dorm}
                      </span>
                    </td>

                    {/* Phòng */}
                    <td className="py-3 px-2 text-center">
                      <span className="inline-block px-1.5 py-0.5 font-bold rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs">
                        P.{String(worker.room).padStart(2, '0')}
                      </span>
                    </td>

                    {/* Số giường */}
                    <td className="py-3 px-2 text-center font-medium">
                      {worker.bed ? `G.${worker.bed}` : '-'}
                    </td>

                    {/* Tổ trưởng */}
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {worker.teamLeader || '-'}
                    </td>

                    {/* Trạng thái */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isActive
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {worker.status}
                      </span>
                    </td>

                    {/* Ngày sinh */}
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDateDisplay(worker.dob)}
                    </td>

                    {/* Mã NV */}
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {worker.empCode}
                    </td>

                    {/* CCCD */}
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                      {worker.cccd || '-'}
                    </td>

                    {/* Hộ khẩu thường trú */}
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={worker.address}>
                      {worker.address || '-'}
                    </td>

                    {/* SĐT */}
                    <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {worker.phone || '-'}
                    </td>

                    {/* Cập nhật */}
                    <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      <div>{formatDateTimeDisplay(worker.updatedAt)}</div>
                      {worker.updatedBy && (
                        <div className="text-[10px] text-slate-400">{worker.updatedBy}</div>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewCccd(worker)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                          title="Xem / chụp ảnh CCCD"
                        >
                          <ImageIcon className="w-4 h-4" />
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onEditWorker(worker)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                            title="Sửa thông tin công nhân"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onDeleteWorker(worker)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                            title="Xóa công nhân này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        
        {/* Info */}
        <div>
          {totalItems > 0 ? (
            <span>
              Hiển thị <strong className="text-slate-900 dark:text-white">{startIndex + 1}</strong> -{' '}
              <strong className="text-slate-900 dark:text-white">
                {Math.min(startIndex + pageSize, totalItems)}
              </strong>{' '}
              trong tổng số <strong className="text-slate-900 dark:text-white">{totalItems}</strong> công nhân
            </span>
          ) : (
            <span>0 công nhân</span>
          )}
        </div>

        {/* Page size & Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Số dòng/trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 text-xs rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Pagination buttons: « ‹ 1 2 3 4 5 › » */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Trang đầu"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page numbers */}
            <div className="flex items-center gap-1 px-1 font-medium">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5) {
                  if (currentPage > 3 && currentPage < totalPages - 1) {
                    p = currentPage - 2 + i;
                  } else if (currentPage >= totalPages - 1) {
                    p = totalPages - 4 + i;
                  }
                }
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded text-xs flex items-center justify-center transition-colors ${
                      currentPage === p
                        ? 'bg-blue-600 text-white font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Trang cuối"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
