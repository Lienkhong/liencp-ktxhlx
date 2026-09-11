import React, { useState, useMemo, useRef } from 'react';
import {
  Building2,
  User,
  Settings,
  Search,
  Camera,
  Plus,
  Image as ImageIcon,
  Trash2,
  Phone,
  Edit,
  DoorOpen,
  X,
  Monitor,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Users,
  Bed,
  Layers,
  Sparkles,
  Link2,
  FileUp,
  FileDown,
  SearchCode,
  HardDrive,
  History,
  Shield,
  UserCheck,
  SlidersHorizontal,
  LogOut,
  ChevronDown,
  CloudCheck,
  CloudAlert,
  Bot,
  Grid,
  CheckCircle2,
  IdCard,
} from 'lucide-react';
import { useDorm } from '../context/DormContext';
import { Worker } from '../types';
import { getCccdPhotoStatus, getTodayStr } from '../utils/helpers';
import { LeeMascot } from './LeeMascot';

interface MobileDormViewProps {
  onOpenEditManager: () => void;
  onOpenDuplicateChecker: () => void;
  onOpenCccdScan: () => void;
  onOpenAddWorker: () => void;
  onOpenSettings: () => void;
  onOpenSearchModal: () => void;
  onOpenCccdGallery: () => void;
  onOpenDeleteByEmpCodeModal: () => void;
  onOpenCheckedOutWorkersModal?: () => void;
  onOpenTeamLeadersModal: () => void;
  onOpenActiveRoomsModal: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
  onOpenBackupModal?: () => void;
  onOpenAuditLogs?: () => void;
  onOpenUserManagement?: () => void;
  onOpenManagerLinks?: () => void;
  onOpenAiAssistant?: () => void;
  onEditWorker: (worker: Worker) => void;
  onDeleteWorker: (worker: Worker) => void;
  onViewCccd: (worker: Worker) => void;
  onSwitchToDesktop: () => void;
  selectedDormFilter: number | null;
  onSelectDormFilter: (dorm: number | null) => void;
  selectedRoomFilter?: number | null;
  onSelectRoomFilter?: (room: number | null) => void;
}

type SortField = 'name' | 'dorm' | 'room' | 'bed';
type SortOrder = 'asc' | 'desc';
type RoomStatusFilter = 'ALL' | 'OCCUPIED' | 'AVAILABLE' | 'FULL';

export const MobileDormView: React.FC<MobileDormViewProps> = ({
  onOpenEditManager,
  onOpenDuplicateChecker,
  onOpenCccdScan,
  onOpenAddWorker,
  onOpenSettings,
  onOpenSearchModal,
  onOpenCccdGallery,
  onOpenDeleteByEmpCodeModal,
  onOpenCheckedOutWorkersModal,
  onOpenTeamLeadersModal,
  onOpenActiveRoomsModal,
  onOpenImportModal,
  onOpenExportModal,
  onOpenBackupModal,
  onOpenAuditLogs,
  onOpenUserManagement,
  onOpenManagerLinks,
  onOpenAiAssistant,
  onEditWorker,
  onDeleteWorker,
  onViewCccd,
  onSwitchToDesktop,
  selectedDormFilter,
  onSelectDormFilter,
  selectedRoomFilter = null,
  onSelectRoomFilter,
}) => {
  const {
    workers,
    checkedOutWorkers,
    config,
    manager,
    currentUser,
    logout,
    getTotalOccupants,
    getTodayEntriesCount,
    getTeamLeadersCount,
    getOccupiedRoomsCount,
    syncStatus,
    forceSyncNow,
  } = useDorm();

  // Panels & Menus
  const [isFunctionsSheetOpen, setIsFunctionsSheetOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  // Local filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Đang ở' | 'Đã rời đi'>('ALL');
  const [filterTodayEntered, setFilterTodayEntered] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedWorkerForAction, setSelectedWorkerForAction] = useState<Worker | null>(null);
  const [roomFilterTab, setRoomFilterTab] = useState<RoomStatusFilter>('ALL');

  // Pagination for worker cards on mobile
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Refs for smooth scroll
  const overviewRef = useRef<HTMLDivElement>(null);
  const workersListRef = useRef<HTMLDivElement>(null);

  // Internal room selection handler fallback
  const handleRoomSelect = (room: number | null) => {
    if (onSelectRoomFilter) {
      onSelectRoomFilter(room);
    }
  };

  // Metrics (Real state values)
  const totalOccupants = getTotalOccupants();
  const todayEntered = getTodayEntriesCount();
  const totalTeamLeaders = getTeamLeadersCount();
  const occupiedRooms = getOccupiedRoomsCount();
  const totalRooms = config.numDorms * config.roomsPerDorm;

  // Dorm overview list calculation (1 .. config.numDorms)
  const dormStatsList = useMemo(() => {
    return Array.from({ length: config.numDorms }, (_, idx) => {
      const dormNum = idx + 1;
      const dormWorkers = workers.filter((w) => w.dorm === dormNum && w.status === 'Đang ở');
      const workerCount = dormWorkers.length;
      const usedRooms = new Set(dormWorkers.map((w) => w.room)).size;
      const maxCapacity = config.roomsPerDorm * config.maxBedsPerRoom;
      const capacityPct = maxCapacity > 0 ? Math.min(100, Math.round((workerCount / maxCapacity) * 100)) : 0;

      return {
        dormNum,
        workerCount,
        usedRooms,
        totalRooms: config.roomsPerDorm,
        maxCapacity,
        capacityPct,
      };
    });
  }, [workers, config]);

  // Current selected Dorm stats
  const currentDormStats = useMemo(() => {
    if (selectedDormFilter === null) return null;
    return dormStatsList.find((d) => d.dormNum === selectedDormFilter) || null;
  }, [dormStatsList, selectedDormFilter]);

  // Current selected Dorm's rooms calculation
  const dormRoomsList = useMemo(() => {
    if (selectedDormFilter === null) return [];

    return Array.from({ length: config.roomsPerDorm }, (_, i) => {
      const roomNum = i + 1;
      const roomWorkers = workers.filter(
        (w) => w.dorm === selectedDormFilter && w.room === roomNum && w.status === 'Đang ở'
      );
      const count = roomWorkers.length;
      const max = config.maxBedsPerRoom;
      const isFull = count >= max;
      const isOccupied = count > 0;
      const isAvailable = count < max;

      return {
        roomNum,
        workers: roomWorkers,
        count,
        max,
        isFull,
        isOccupied,
        isAvailable,
      };
    });
  }, [selectedDormFilter, workers, config]);

  // Filtered rooms inside current selected Dorm
  const filteredDormRooms = useMemo(() => {
    if (roomFilterTab === 'ALL') return dormRoomsList;
    if (roomFilterTab === 'OCCUPIED') return dormRoomsList.filter((r) => r.isOccupied);
    if (roomFilterTab === 'AVAILABLE') return dormRoomsList.filter((r) => r.isAvailable);
    if (roomFilterTab === 'FULL') return dormRoomsList.filter((r) => r.isFull);
    return dormRoomsList;
  }, [dormRoomsList, roomFilterTab]);

  // Current selected Room's workers
  const selectedRoomWorkers = useMemo(() => {
    if (selectedDormFilter === null || selectedRoomFilter === null) return [];
    return workers.filter(
      (w) => w.dorm === selectedDormFilter && w.room === selectedRoomFilter
    );
  }, [workers, selectedDormFilter, selectedRoomFilter]);

  // Filtered workers list for cards
  const filteredWorkers = useMemo(() => {
    const todayStr = getTodayStr();

    return workers
      .filter((w) => {
        // Dorm filter
        if (selectedDormFilter !== null && w.dorm !== selectedDormFilter) {
          return false;
        }
        // Room filter
        if (selectedRoomFilter !== null && w.room !== selectedRoomFilter) {
          return false;
        }
        // Status filter
        if (statusFilter !== 'ALL' && w.status !== statusFilter) {
          return false;
        }
        // Today filter
        if (filterTodayEntered && w.entryDate !== todayStr) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = String(w.name || '').toLowerCase().includes(q);
          const matchCode = String(w.empCode || '').toLowerCase().includes(q);
          const matchCccd = String(w.cccd || '').toLowerCase().includes(q);
          const matchPhone = String(w.phone || '').toLowerCase().includes(q);
          const matchRoom = `d${w.dorm}-p${w.room < 10 ? '0' + w.room : w.room}`.toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchCccd && !matchPhone && !matchRoom) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === 'name') {
          comparison = (a.name || '').localeCompare(b.name || '', 'vi');
        } else if (sortField === 'dorm') {
          comparison = a.dorm - b.dorm;
        } else if (sortField === 'room') {
          comparison = a.room - b.room;
        } else if (sortField === 'bed') {
          comparison = (a.bed || 1) - (b.bed || 1);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [workers, selectedDormFilter, selectedRoomFilter, statusFilter, filterTodayEntered, searchQuery, sortField, sortOrder]);

  // Paginated workers
  const totalPages = Math.max(1, Math.ceil(filteredWorkers.length / pageSize));
  const paginatedWorkers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWorkers.slice(start, start + pageSize);
  }, [filteredWorkers, currentPage]);

  const handleResetToAllDorms = () => {
    onSelectDormFilter(null);
    handleRoomSelect(null);
    setStatusFilter('ALL');
    setFilterTodayEntered(false);
    setSearchQuery('');
    setCurrentPage(1);
  };

  const handleBackToRooms = () => {
    handleRoomSelect(null);
  };

  const scrollToOverview = () => {
    handleResetToAllDorms();
    overviewRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToWorkers = () => {
    workersListRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0b1329] text-slate-100 flex flex-col font-sans pb-24 overflow-x-hidden select-none">
      
      {/* ========================================================================= */}
      {/* 1. HEADER NỀN XANH (#2563eb)                                              */}
      {/* ========================================================================= */}
      <header className="bg-[#2563eb] text-white px-3.5 pt-3 pb-3.5 shadow-lg sticky top-0 z-30 border-b border-blue-400/30">
        
        {/* Row 1: Brand title & Account Button with Menu */}
        <div className="flex items-center justify-between gap-2 relative">
          
          {/* Brand Name & Cloud status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white truncate leading-tight">
                Quản lý KTX Công nhân
              </h1>
              
              {/* Cloud Sync Status Indicator */}
              <div className="flex items-center gap-1.5 text-[11px] text-blue-100/90 font-medium mt-0.5">
                {syncStatus === 'syncing' || syncStatus === 'saving' ? (
                  <span className="flex items-center gap-1 text-amber-200">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Đang đồng bộ...</span>
                  </span>
                ) : syncStatus === 'error' ? (
                  <span className="flex items-center gap-1 text-rose-200 font-semibold">
                    <CloudAlert className="w-3 h-3" />
                    <span>Lỗi đồng bộ</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Đã đồng bộ Cloud</span>
                  </span>
                )}
                <span>•</span>
                <button
                  type="button"
                  onClick={() => forceSyncNow()}
                  className="hover:text-white underline text-[10px]"
                  title="Đồng bộ ngay"
                >
                  Làm mới
                </button>
              </div>
            </div>
          </div>

          {/* Right Area: Account Button */}
          <div className="relative shrink-0">
            <button
              type="button"
              id="mobile-btn-account"
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Menu tài khoản quản lý"
            >
              <div className="w-7 h-7 rounded-lg bg-white/25 text-white flex items-center justify-center font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-blue-100 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Account Dropdown Popup Menu */}
            {isAccountMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsAccountMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 z-50 w-56 bg-[#10192e] text-white rounded-2xl border border-[#223050] shadow-2xl p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-[#223050] text-xs">
                    <div className="text-slate-400 text-[10px]">Tài khoản quản lý</div>
                    <div className="font-bold text-white truncate text-sm">
                      {manager.name || 'Người quản lý'}
                    </div>
                    {currentUser?.role && (
                      <div className="text-[10px] text-blue-400 font-medium uppercase mt-0.5">
                        Vai trò: {currentUser.role}
                      </div>
                    )}
                  </div>

                  {/* 1. Đổi tên */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onOpenEditManager();
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-left rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Đổi tên quản lý</span>
                  </button>

                  {/* 2. Cài đặt */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-left rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Cài đặt hệ thống</span>
                  </button>

                  {/* 3. Chuyển sang bản PC */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onSwitchToDesktop();
                    }}
                    className="w-full min-h-[44px] px-3 py-2 text-left rounded-xl hover:bg-white/10 flex items-center gap-2.5 text-xs text-slate-200 transition-colors cursor-pointer"
                  >
                    <Monitor className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Xem giao diện PC</span>
                  </button>

                  {/* 4. Đăng xuất */}
                  <div className="pt-1 border-t border-[#223050]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        logout();
                      }}
                      className="w-full min-h-[44px] px-3 py-2 text-left rounded-xl hover:bg-rose-500/20 text-rose-400 font-semibold flex items-center gap-2.5 text-xs transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Manager Name Pill */}
        <div className="mt-2.5 flex items-center justify-between text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-blue-100 font-normal">Quản lý:</span>
            <span className="font-extrabold text-white truncate">{manager.name || 'Người quản lý'}</span>
          </div>

          <button
            type="button"
            onClick={onOpenEditManager}
            className="text-[11px] text-blue-100 hover:text-white underline shrink-0 cursor-pointer font-medium"
          >
            Đổi tên
          </button>
        </div>

      </header>

      {/* ========================================================================= */}
      {/* 2. BODY CONTENT (Tối ưu cho 320px - 430px)                                */}
      {/* ========================================================================= */}
      <main className="px-3.5 py-3.5 space-y-4 max-w-lg mx-auto w-full">
        
        {/* ========================================================================= */}
        {/* NÚT LỚN TOÀN HÀNG: "CHỨC NĂNG" (Thay thế nút Thêm công nhân cũ)           */}
        {/* ========================================================================= */}
        <button
          type="button"
          id="mobile-btn-main-functions"
          onClick={() => setIsFunctionsSheetOpen(true)}
          className="w-full min-h-[52px] py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base transition-all shadow-lg shadow-blue-900/30 flex items-center justify-between border border-blue-400/40 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5 text-amber-300" />
            </div>
            <div className="text-left">
              <div className="tracking-wide">CHỨC NĂNG HỆ THỐNG</div>
              <div className="text-[11px] text-blue-100 font-medium">
                Mở toàn bộ 14 tiện ích, nhập/xuất Excel &amp; cấu hình KTX
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-200" />
        </button>

        {/* ========================================================================= */}
        {/* BỐN THAO TÁC NHANH DẠNG 2 CỘT (LƯỚI 2×2)                                  */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. Tìm công nhân */}
          <button
            type="button"
            id="mobile-quick-btn-search"
            onClick={onOpenSearchModal}
            className="min-h-[52px] p-3 rounded-xl bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] border border-[#223050] hover:border-blue-500 text-left transition-all flex items-center gap-2.5 shadow-xs cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
              <Search className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Tìm công nhân</div>
              <div className="text-[10px] text-slate-400 truncate">Tên, mã, phòng</div>
            </div>
          </button>

          {/* 2. Chụp CCCD */}
          <button
            type="button"
            id="mobile-quick-btn-cccd"
            onClick={onOpenCccdScan}
            className="min-h-[52px] p-3 rounded-xl bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] border border-[#223050] hover:border-teal-500 text-left transition-all flex items-center gap-2.5 shadow-xs cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-teal-600/30 border border-teal-500/40 text-teal-300 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Chụp CCCD</div>
              <div className="text-[10px] text-slate-400 truncate">Quét thẻ OCR</div>
            </div>
          </button>

          {/* 3. Phòng & giường */}
          <button
            type="button"
            id="mobile-quick-btn-rooms"
            onClick={onOpenActiveRoomsModal}
            className="min-h-[52px] p-3 rounded-xl bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] border border-[#223050] hover:border-cyan-500 text-left transition-all flex items-center gap-2.5 shadow-xs cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0">
              <DoorOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Phòng &amp; giường</div>
              <div className="text-[10px] text-slate-400 truncate">Thống kê phòng ở</div>
            </div>
          </button>

          {/* 4. Kiểm tra mã NV */}
          <button
            type="button"
            id="mobile-quick-btn-duplicate"
            onClick={onOpenDuplicateChecker}
            className="min-h-[52px] p-3 rounded-xl bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] border border-[#223050] hover:border-amber-500 text-left transition-all flex items-center gap-2.5 shadow-xs cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
              <SearchCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Kiểm tra mã NV</div>
              <div className="text-[10px] text-slate-400 truncate">Phát hiện trùng lặp</div>
            </div>
          </button>
        </div>

        {/* AI Assistant Banner Button */}
        {onOpenAiAssistant && (
          <button
            type="button"
            id="mobile-banner-ai-assistant"
            onClick={onOpenAiAssistant}
            className="w-full min-h-[46px] py-2 px-3.5 bg-gradient-to-r from-teal-900/70 via-cyan-900/60 to-blue-900/70 hover:from-teal-800/80 hover:to-cyan-800/80 active:scale-[0.99] text-white rounded-2xl border border-cyan-500/40 text-xs font-bold transition-all shadow-md flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <LeeMascot variant="badge" size={28} className="shrink-0 -my-0.5" />
              <div className="text-left">
                <div className="font-extrabold text-cyan-200">TRỢ LÝ AI LEE</div>
                <div className="text-[10px] text-slate-300 font-normal">Hỏi đáp nhân sự, lọc phòng trống thông minh</div>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
          </button>
        )}

        {/* ========================================================================= */}
        {/* 5. THỐNG KÊ MOBILE (LƯỚI 2×2)                                             */}
        {/* ========================================================================= */}
        <div ref={overviewRef} className="space-y-2 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>📊</span>
              <span>Thống kê nhân sự KTX</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            
            {/* Stat 1: Tổng nhân sự KTX */}
            <div
              id="mobile-stat-total-occupants"
              onClick={() => {
                setStatusFilter('Đang ở');
                setFilterTodayEntered(false);
                scrollToWorkers();
              }}
              className="min-h-[82px] relative bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] rounded-2xl p-3 border border-[#223050] hover:border-blue-500 transition-all cursor-pointer overflow-hidden shadow-xs"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#3b82f6] rounded-l" />
              <div className="pl-1.5 flex flex-col justify-between h-full">
                <div className="text-2xl font-extrabold text-white tracking-tight leading-none">
                  {totalOccupants}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 mt-1">
                    Tổng nhân sự KTX
                  </div>
                  <div className="text-[10px] text-blue-400 mt-0.5">
                    Đang lưu trú tại KTX
                  </div>
                </div>
              </div>
            </div>

            {/* Stat 2: Vào KTX hôm nay */}
            <div
              id="mobile-stat-today-entered"
              onClick={() => {
                setFilterTodayEntered(!filterTodayEntered);
                setStatusFilter('ALL');
                scrollToWorkers();
              }}
              className={`min-h-[82px] relative bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] rounded-2xl p-3 border transition-all cursor-pointer overflow-hidden shadow-xs ${
                filterTodayEntered
                  ? 'border-emerald-500 shadow-md shadow-emerald-500/20'
                  : 'border-[#223050] hover:border-emerald-500'
              }`}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#10b981] rounded-l" />
              <div className="pl-1.5 flex flex-col justify-between h-full">
                <div className="text-2xl font-extrabold text-emerald-400 tracking-tight leading-none">
                  {todayEntered}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 mt-1">
                    Vào KTX hôm nay
                  </div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    {filterTodayEntered ? 'Đang lọc theo ngày' : 'Nhấn để xem danh sách'}
                  </div>
                </div>
              </div>
            </div>

            {/* Stat 3: Danh sách tổ trưởng */}
            <div
              id="mobile-stat-team-leaders"
              onClick={onOpenTeamLeadersModal}
              className="min-h-[82px] relative bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] rounded-2xl p-3 border border-[#223050] hover:border-purple-500 transition-all cursor-pointer overflow-hidden shadow-xs"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#a855f7] rounded-l" />
              <div className="pl-1.5 flex flex-col justify-between h-full">
                <div className="text-2xl font-extrabold text-purple-400 tracking-tight leading-none">
                  {totalTeamLeaders}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 mt-1">
                    Danh sách tổ trưởng
                  </div>
                  <div className="text-[10px] text-purple-400 mt-0.5">
                    Theo dãy và phòng
                  </div>
                </div>
              </div>
            </div>

            {/* Stat 4: Phòng đang sử dụng */}
            <div
              id="mobile-stat-active-rooms"
              onClick={onOpenActiveRoomsModal}
              className="min-h-[82px] relative bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] rounded-2xl p-3 border border-[#223050] hover:border-cyan-500 transition-all cursor-pointer overflow-hidden shadow-xs"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#06b6d4] rounded-l" />
              <div className="pl-1.5 flex flex-col justify-between h-full">
                <div className="text-2xl font-extrabold text-cyan-300 tracking-tight leading-none">
                  {occupiedRooms} <span className="text-sm font-normal text-slate-400">/ {totalRooms}</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 mt-1">
                    Phòng đang sử dụng
                  </div>
                  <div className="text-[10px] text-cyan-400 mt-0.5">
                    Nhấn xem chi tiết phòng
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. TỔNG QUAN KTX: LƯỚI 3 CỘT (DÃY KTX)                                    */}
        {/* ========================================================================= */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>🏢</span>
              <span>Tổng quan các dãy KTX</span>
            </h2>
            {selectedDormFilter !== null && (
              <button
                type="button"
                onClick={handleResetToAllDorms}
                className="text-[11px] text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Xem tất cả dãy
              </button>
            )}
          </div>

          {/* 3 Columns Dorm Grid */}
          <div className="grid grid-cols-3 gap-2">
            {dormStatsList.map((dorm) => {
              const isSelected = selectedDormFilter === dorm.dormNum;
              return (
                <div
                  key={dorm.dormNum}
                  id={`mobile-dorm-card-${dorm.dormNum}`}
                  onClick={() => {
                    onSelectDormFilter(dorm.dormNum);
                    handleRoomSelect(null);
                  }}
                  className={`min-h-[105px] rounded-2xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden active:scale-[0.97] ${
                    isSelected
                      ? 'bg-blue-950/80 border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500'
                      : 'bg-[#131b2e] hover:bg-[#18233c] border-[#223050] hover:border-blue-500/70'
                  }`}
                >
                  {/* Top: Dãy & Worker count badge */}
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="text-[11px] font-bold text-slate-300">Dãy</div>
                      <div className="text-xl font-extrabold text-white leading-none mt-0.5">
                        {dorm.dormNum}
                      </div>
                    </div>
                    <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-[#2563eb] text-white text-center leading-tight shrink-0 shadow-xs">
                      {dorm.workerCount}
                      <span className="block text-[8px] font-normal opacity-90">người</span>
                    </div>
                  </div>

                  {/* Room ratio & Capacity percent */}
                  <div className="space-y-1 mt-2">
                    <div className="text-[11px] text-slate-300 font-medium leading-none">
                      {dorm.usedRooms}/{dorm.totalRooms} phòng
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal leading-none flex items-center justify-between">
                      <span>{dorm.capacityPct}%</span>
                      <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#1e2942] rounded-full h-1.5 overflow-hidden border border-slate-700/40">
                      <div
                        className="bg-[#3b82f6] h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${dorm.capacityPct > 0 ? Math.max(8, dorm.capacityPct) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Dorm: Rooms List & Filter */}
        {selectedDormFilter !== null && (
          <div className="space-y-2.5 p-3 rounded-2xl bg-[#10192e] border border-blue-600/40 animate-in fade-in duration-200 shadow-md">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  D{selectedDormFilter}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">
                    Các phòng Dãy {selectedDormFilter}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {currentDormStats?.workerCount || 0} công nhân • {currentDormStats?.usedRooms || 0}/{config.roomsPerDorm} phòng đang dùng
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetToAllDorms}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Đổi Dãy</span>
              </button>
            </div>

            {/* Room Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRoomFilterTab('ALL')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  roomFilterTab === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#131b2e] text-slate-400 hover:text-white'
                }`}
              >
                Tất cả ({dormRoomsList.length})
              </button>
              <button
                type="button"
                onClick={() => setRoomFilterTab('OCCUPIED')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  roomFilterTab === 'OCCUPIED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#131b2e] text-slate-400 hover:text-white'
                }`}
              >
                Có người ({dormRoomsList.filter((r) => r.isOccupied).length})
              </button>
              <button
                type="button"
                onClick={() => setRoomFilterTab('AVAILABLE')}
                className={`min-h-[36px] px-2.5 py-1 rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  roomFilterTab === 'AVAILABLE'
                    ? 'bg-amber-600 text-white'
                    : 'bg-[#131b2e] text-slate-400 hover:text-white'
                }`}
              >
                Còn trống ({dormRoomsList.filter((r) => r.isAvailable).length})
              </button>
            </div>

            {/* Rooms Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredDormRooms.map((room) => {
                const isSelectedRoom = selectedRoomFilter === room.roomNum;
                return (
                  <div
                    key={room.roomNum}
                    onClick={() => handleRoomSelect(isSelectedRoom ? null : room.roomNum)}
                    className={`min-h-[76px] p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelectedRoom
                        ? 'bg-emerald-950/80 border-emerald-500 shadow-md ring-1 ring-emerald-500'
                        : room.isFull
                        ? 'bg-[#181523] border-rose-900/60 hover:border-rose-500'
                        : room.isOccupied
                        ? 'bg-[#12202f] border-emerald-900/60 hover:border-emerald-500'
                        : 'bg-[#0d1527] border-[#223050] hover:border-blue-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-white">
                        Phòng {String(room.roomNum).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                          room.isFull
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : room.isOccupied
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {room.isFull ? 'Đầy' : room.isOccupied ? `${room.count}/${room.max}` : 'Trống'}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-300 truncate mt-1">
                      {room.workers.length > 0 ? (
                        <span>👤 {room.workers[0].name}{room.workers.length > 1 ? ` +${room.workers.length - 1}` : ''}</span>
                      ) : (
                        <span className="text-slate-500 italic">Chưa có người</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 7. DANH SÁCH CÔNG NHÂN TRÊN MOBILE (DẠNG CARD DỌC THAY THẾ BẢNG NGANG)    */}
        {/* ========================================================================= */}
        <div ref={workersListRef} className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>👥</span>
              <span>Danh sách hồ sơ công nhân</span>
            </h2>
            <span className="text-[11px] text-blue-400 font-semibold">
              {filteredWorkers.length} hồ sơ
            </span>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-[#10192e] p-3 rounded-2xl border border-[#223050] space-y-2.5 shadow-sm">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                id="mobile-input-search-workers"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm họ tên, mã NV, CCCD, phòng..."
                className="w-full min-h-[44px] pl-9 pr-8 py-2 bg-[#090f1f] text-white placeholder-slate-500 rounded-xl text-xs border border-[#223050] focus:outline-hidden focus:border-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Status Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setFilterTodayEntered(false);
                  setCurrentPage(1);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'ALL' && !filterTodayEntered
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-[#131b2e] text-slate-400 hover:text-white'
                }`}
              >
                Tất cả ({workers.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter('Đang ở');
                  setFilterTodayEntered(false);
                  setCurrentPage(1);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'Đang ở' && !filterTodayEntered
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-[#131b2e] text-slate-400 hover:text-white'
                }`}
              >
                Đang ở ({totalOccupants})
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterTodayEntered(true);
                  setStatusFilter('ALL');
                  setCurrentPage(1);
                }}
                className={`min-h-[36px] px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                  filterTodayEntered
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-[#131b2e] text-slate-400 hover:text-white'
                }`}
              >
                Vào hôm nay ({todayEntered})
              </button>

              {/* Reset Dorm Filter Tag if selected */}
              {selectedDormFilter !== null && (
                <button
                  type="button"
                  onClick={handleResetToAllDorms}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg bg-blue-900/60 text-blue-300 border border-blue-700/60 font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <span>Dãy {selectedDormFilter}</span>
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Workers Vertical Cards List */}
          {filteredWorkers.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-2xl bg-[#10192e] border border-[#223050] text-slate-400 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
              <p className="text-xs font-semibold text-slate-300">
                Không tìm thấy công nhân nào khớp với tiêu chí tìm kiếm
              </p>
              <button
                type="button"
                onClick={handleResetToAllDorms}
                className="text-xs text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Xóa bộ lọc để xem toàn bộ danh sách
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {paginatedWorkers.map((worker) => {
                const photoSt = getCccdPhotoStatus(worker);
                const isLiving = worker.status === 'Đang ở';

                return (
                  <div
                    key={worker.id}
                    id={`mobile-worker-card-${worker.id}`}
                    onClick={() => setSelectedWorkerForAction(worker)}
                    className="p-3.5 rounded-2xl bg-[#10192e] hover:bg-[#14203a] active:scale-[0.99] border border-[#223050] hover:border-blue-500/80 transition-all cursor-pointer shadow-xs space-y-2.5"
                  >
                    {/* Header: Name, Code & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-extrabold text-white text-sm sm:text-base uppercase tracking-wide truncate">
                          {worker.name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {worker.empCode ? (
                            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-700/60">
                              Mã: {worker.empCode}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Chưa có mã</span>
                          )}

                          {worker.phone && (
                            <span className="font-mono text-[11px] text-slate-300 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {worker.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                          isLiving
                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                            : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                        }`}
                      >
                        {worker.status}
                      </span>
                    </div>

                    {/* Room Allocation Info Box */}
                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-[#090f1f] border border-[#223050] text-center text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Dãy</div>
                        <div className="font-extrabold text-blue-400">Dãy {worker.dorm}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Phòng</div>
                        <div className="font-extrabold text-emerald-400">
                          P.{String(worker.room).padStart(2, '0')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Giường</div>
                        <div className="font-extrabold text-amber-400">G.{worker.bed || 1}</div>
                      </div>
                    </div>

                    {/* Footer Info: Entry Date, CCCD Status & Action hint */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <div className="flex items-center gap-2 truncate">
                        {worker.entryDate && (
                          <span className="truncate">Vào: {worker.entryDate}</span>
                        )}
                        {photoSt.status === 'full' && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Đủ CCCD
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-blue-400 font-semibold text-xs shrink-0">
                        <span>Chi tiết</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 pb-1 text-xs">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#10192e] text-slate-300 border border-[#223050] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Trang trước
                  </button>
                  <span className="text-slate-400 font-medium">
                    Trang {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#10192e] text-slate-300 border border-[#223050] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Trang sau
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </main>

      {/* ========================================================================= */}
      {/* 8. THANH ĐIỀU HƯỚNG DƯỚI CÙNG (BOTTOM NAVIGATION BAR)                     */}
      {/* ========================================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c1426]/95 backdrop-blur-md border-t border-[#223050] h-16 px-2 flex items-center justify-around shadow-2xl">
        
        {/* 1. Tổng quan */}
        <button
          type="button"
          id="mobile-nav-overview"
          onClick={scrollToOverview}
          className="flex-1 min-h-[44px] py-1 flex flex-col items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          <Building2 className="w-5 h-5 text-blue-400" />
          <span className="text-[10px] font-bold mt-0.5">Tổng quan</span>
        </button>

        {/* 2. Công nhân */}
        <button
          type="button"
          id="mobile-nav-workers"
          onClick={scrollToWorkers}
          className="flex-1 min-h-[44px] py-1 flex flex-col items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          <Users className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] font-bold mt-0.5">Công nhân</span>
        </button>

        {/* 3. Tiện ích (Mở Panel Chức năng) */}
        <button
          type="button"
          id="mobile-nav-utilities"
          onClick={() => setIsFunctionsSheetOpen(true)}
          className="flex-1 min-h-[44px] py-1 flex flex-col items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all cursor-pointer"
        >
          <div className="relative">
            <SlidersHorizontal className="w-5 h-5 text-amber-300" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
          </div>
          <span className="text-[10px] font-bold mt-0.5 text-amber-300">Tiện ích</span>
        </button>

        {/* 4. AI Lee */}
        {onOpenAiAssistant && (
          <button
            type="button"
            id="mobile-nav-ai"
            onClick={onOpenAiAssistant}
            className="flex-1 min-h-[44px] py-1 flex flex-col items-center justify-center text-slate-400 hover:text-white active:scale-95 transition-all cursor-pointer"
          >
            <Bot className="w-5 h-5 text-cyan-300" />
            <span className="text-[10px] font-bold mt-0.5 text-cyan-300">AI Lee</span>
          </button>
        )}
      </nav>

      {/* ========================================================================= */}
      {/* 3. PANEL "CHỨC NĂNG" (BOTTOM SHEET CHỨA ĐẦY ĐỦ TIỆN ÍCH HỆ THỐNG)         */}
      {/* ========================================================================= */}
      {isFunctionsSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setIsFunctionsSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[90vh] flex flex-col bg-[#10192e] border-t sm:border border-[#223050] rounded-t-3xl sm:rounded-2xl text-white shadow-2xl animate-in slide-in-from-bottom duration-300"
          >
            {/* Panel Header */}
            <div className="p-4 border-b border-[#223050] flex items-center justify-between shrink-0 bg-[#0c1426] rounded-t-3xl sm:rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Grid className="w-5 h-5 text-blue-100" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                    <span>Menu chức năng &amp; Tiện ích</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Chọn nhanh các tính năng quản lý KTX công nhân
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="btn-close-functions-panel"
                onClick={() => setIsFunctionsSheetOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Panel 2-Column Grid Content */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-xs flex-1">
              
              <div className="grid grid-cols-2 gap-2.5">
                
                {/* 1. Thêm công nhân */}
                <button
                  type="button"
                  id="mobile-func-add-worker"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenAddWorker();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-blue-500/50 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-blue-400 uppercase">Thêm mới</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-blue-300">
                      Thêm công nhân
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Nhập hồ sơ mới vào KTX</div>
                  </div>
                </button>

                {/* 2. Tìm công nhân */}
                <button
                  type="button"
                  id="mobile-func-search"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenSearchModal();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-cyan-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-cyan-600 text-white flex items-center justify-center">
                      <Search className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-cyan-400 uppercase">Tra cứu</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300">
                      Tìm công nhân
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Tìm đa trường: tên, mã, quê</div>
                  </div>
                </button>

                {/* 3. Chụp / tải CCCD */}
                <button
                  type="button"
                  id="mobile-func-scan-cccd"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenCccdScan();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-teal-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                      <Camera className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-teal-400 uppercase">Camera</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-teal-300">
                      Chụp / tải CCCD
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Quét OCR tự động điền form</div>
                  </div>
                </button>

                {/* 4. Kho ảnh CCCD */}
                <button
                  type="button"
                  id="mobile-func-gallery-cccd"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenCccdGallery();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-emerald-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase">Thư viện</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                      Kho ảnh CCCD
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Ảnh thẻ CCCD 2 mặt an toàn</div>
                  </div>
                </button>

                {/* 5. Kiểm tra trùng mã nhân viên */}
                <button
                  type="button"
                  id="mobile-func-duplicate-checker"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenDuplicateChecker();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-amber-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                      <SearchCode className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-amber-400 uppercase">Trùng mã</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300">
                      Kiểm tra trùng mã NV
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Quét trùng lặp hồ sơ</div>
                  </div>
                </button>

                {/* 6. Đường dẫn quản lý */}
                {onOpenManagerLinks && (
                  <button
                    type="button"
                    id="mobile-func-manager-links"
                    onClick={() => {
                      setIsFunctionsSheetOpen(false);
                      onOpenManagerLinks();
                    }}
                    className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-violet-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center">
                        <Link2 className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-bold text-violet-400 uppercase">Chia sẻ</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-violet-300">
                        Đường dẫn quản lý
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">Cổng link &amp; mã QR</div>
                    </div>
                  </button>
                )}

                {/* 7. Nhập Excel */}
                <button
                  type="button"
                  id="mobile-func-import-excel"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenImportModal();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-emerald-600/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
                      <FileUp className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 uppercase">Excel vào</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                      Nhập Excel
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Nạp dữ liệu từ bảng tính</div>
                  </div>
                </button>

                {/* 8. Xuất Excel */}
                <button
                  type="button"
                  id="mobile-func-export-excel"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenExportModal();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-indigo-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                      <FileDown className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-indigo-400 uppercase">Excel ra</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300">
                      Xuất Excel
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Tải danh sách KTX ra file</div>
                  </div>
                </button>

                {/* 9. Danh sách đã check-out */}
                {onOpenCheckedOutWorkersModal && (
                  <button
                    type="button"
                    id="mobile-func-checked-out"
                    onClick={() => {
                      setIsFunctionsSheetOpen(false);
                      onOpenCheckedOutWorkersModal();
                    }}
                    className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-orange-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-orange-600 text-white flex items-center justify-center">
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-bold text-orange-400 uppercase">Đã rời</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-orange-300">
                        Đã check-out KTX
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {checkedOutWorkers.length} người đã trả phòng
                      </div>
                    </div>
                  </button>
                )}

                {/* 10. Danh sách tổ trưởng */}
                <button
                  type="button"
                  id="mobile-func-team-leaders"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenTeamLeadersModal();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-purple-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-purple-400 uppercase">Tổ đội</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-purple-300">
                      Danh sách tổ trưởng
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Quản lý tổ đội &amp; phòng</div>
                  </div>
                </button>

                {/* 11. Sao lưu / phục hồi JSON */}
                <button
                  type="button"
                  id="mobile-func-backup"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    if (onOpenBackupModal) {
                      onOpenBackupModal();
                    } else {
                      onOpenSettings();
                    }
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-teal-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-teal-400 uppercase">Dữ liệu</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-teal-300">
                      Sao lưu / phục hồi JSON
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Backup an toàn tệp JSON</div>
                  </div>
                </button>

                {/* 12. Nhật ký thao tác */}
                {onOpenAuditLogs && (
                  <button
                    type="button"
                    id="mobile-func-audit"
                    onClick={() => {
                      setIsFunctionsSheetOpen(false);
                      onOpenAuditLogs();
                    }}
                    className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-blue-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center">
                        <History className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-bold text-blue-400 uppercase">Lịch sử</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-blue-300">
                        Nhật ký thao tác
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">Lịch sử thêm, sửa, xóa</div>
                    </div>
                  </button>
                )}

                {/* 13. Phân quyền tài khoản (Chỉ hiển thị với Admin) */}
                {onOpenUserManagement && currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    id="mobile-func-users"
                    onClick={() => {
                      setIsFunctionsSheetOpen(false);
                      onOpenUserManagement();
                    }}
                    className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-amber-500/40 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-[9px] font-bold text-amber-400 uppercase">Admin</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-amber-300">
                        Phân quyền tài khoản
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">Cấp quyền người dùng</div>
                    </div>
                  </button>
                )}

                {/* 14. Thiết lập KTX */}
                <button
                  type="button"
                  id="mobile-func-settings"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenSettings();
                  }}
                  className="min-h-[64px] p-3 rounded-xl bg-[#090f1f] hover:bg-[#131f38] border border-slate-600/60 text-left transition-all flex flex-col justify-between shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center">
                      <Settings className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">Cấu hình</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-slate-200">
                      Thiết lập KTX
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">Số Dãy, Phòng, Giường</div>
                  </div>
                </button>

              </div>

              {/* RIÊNG MỤC: XÓA THEO MÃ NHÂN VIÊN (ĐẶT Ở CUỐI PANEL, CẢNH BÁO ĐỎ) */}
              <div className="pt-2">
                <button
                  type="button"
                  id="mobile-func-delete-by-code"
                  onClick={() => {
                    setIsFunctionsSheetOpen(false);
                    onOpenDeleteByEmpCodeModal();
                  }}
                  className="w-full min-h-[50px] p-3 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 active:bg-rose-950 border border-rose-600/80 text-rose-200 flex items-center justify-between gap-2.5 transition-all shadow-sm group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-xs font-bold text-rose-300 group-hover:text-white">
                        Xóa theo mã nhân viên
                      </div>
                      <div className="text-[10px] text-rose-400/80 truncate">
                        Yêu cầu xác nhận an toàn trước khi xóa
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-900/90 text-rose-200 border border-rose-700 uppercase shrink-0">
                    Cảnh báo
                  </span>
                </button>
              </div>

            </div>

            {/* Panel Footer */}
            <div className="p-3 border-t border-[#223050] bg-[#0c1426] flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span className="text-[11px]">KTX: {config.dormitoryName}</span>
              <button
                type="button"
                onClick={() => setIsFunctionsSheetOpen(false)}
                className="min-h-[44px] px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. WORKER DETAIL POPUP SHEET (KHI CHẠM CARD CÔNG NHÂN)                    */}
      {/* ========================================================================= */}
      {selectedWorkerForAction && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedWorkerForAction(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#10192e] border-t sm:border border-[#223050] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 text-white shadow-2xl animate-in slide-in-from-bottom duration-300"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#223050]">
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">
                  Chi tiết hồ sơ
                </span>
                <h3 className="text-lg font-extrabold text-white uppercase mt-0.5 truncate">
                  {selectedWorkerForAction.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Mã NV: <strong className="text-white font-mono">{selectedWorkerForAction.empCode || 'Chưa có'}</strong></span>
                  <span>•</span>
                  <span>CCCD: <strong className="text-white font-mono">{selectedWorkerForAction.cccd || 'Chưa có'}</strong></span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedWorkerForAction(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Room Location Info */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-[#090f1f] rounded-xl border border-[#223050] text-center">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">DÃY</div>
                <div className="text-base font-extrabold text-blue-400">Dãy {selectedWorkerForAction.dorm}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">PHÒNG</div>
                <div className="text-base font-extrabold text-emerald-400">
                  P.{String(selectedWorkerForAction.room).padStart(2, '0')}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">GIƯỜNG</div>
                <div className="text-base font-extrabold text-amber-400">G.{selectedWorkerForAction.bed || 1}</div>
              </div>
            </div>

            {/* Additional Info Rows */}
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Ngày vào KTX:</span>
                <span className="font-semibold text-white">{selectedWorkerForAction.entryDate || 'Chưa cập nhật'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trạng thái:</span>
                <span className={`font-bold ${selectedWorkerForAction.status === 'Đang ở' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedWorkerForAction.status}
                </span>
              </div>
              {selectedWorkerForAction.workplace && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Nơi làm việc:</span>
                  <span className="font-semibold text-white">{selectedWorkerForAction.workplace}</span>
                </div>
              )}
              {selectedWorkerForAction.phone && (
                <div className="flex justify-between items-center pt-1 border-t border-[#223050]">
                  <span className="text-slate-400">Số điện thoại:</span>
                  <a
                    href={`tel:${selectedWorkerForAction.phone}`}
                    className="font-bold text-blue-400 underline flex items-center gap-1 text-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {selectedWorkerForAction.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Actions: Sửa, CCCD, Xóa */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const w = selectedWorkerForAction;
                  setSelectedWorkerForAction(null);
                  onEditWorker(w);
                }}
                className="min-h-[48px] flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                <span>Sửa hồ sơ</span>
              </button>

              {(() => {
                const photoSt = getCccdPhotoStatus(selectedWorkerForAction);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      const w = selectedWorkerForAction;
                      setSelectedWorkerForAction(null);
                      onViewCccd(w);
                    }}
                    className="min-h-[48px] flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-xs transition-colors cursor-pointer"
                  >
                    <IdCard className="w-4 h-4" />
                    <span>{photoSt.label}</span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={() => {
                  const w = selectedWorkerForAction;
                  setSelectedWorkerForAction(null);
                  onDeleteWorker(w);
                }}
                className="min-h-[48px] flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa bỏ</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
