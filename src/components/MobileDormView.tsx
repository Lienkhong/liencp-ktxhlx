import React, { useState, useMemo } from 'react';
import {
  Building2,
  User,
  Settings,
  Search,
  Camera,
  Plus,
  RotateCw,
  Image as ImageIcon,
  Trash2,
  Phone,
  Edit,
  DoorOpen,
  X,
  Monitor,
  RefreshCw,
  DoorClosed,
  UserPlus,
  CheckCircle2,
} from 'lucide-react';
import { useDorm } from '../context/DormContext';
import { Worker } from '../types';

interface MobileDormViewProps {
  onOpenEditManager: () => void;
  onOpenDuplicateChecker: () => void;
  onOpenCccdScan: () => void;
  onOpenAddWorker: () => void;
  onOpenSettings: () => void;
  onOpenSearchModal: () => void;
  onOpenCccdGallery: () => void;
  onOpenDeleteByEmpCodeModal: () => void;
  onOpenTeamLeadersModal: () => void;
  onOpenActiveRoomsModal: () => void;
  onEditWorker: (worker: Worker) => void;
  onDeleteWorker: (worker: Worker) => void;
  onViewCccd: (worker: Worker) => void;
  onSwitchToDesktop: () => void;
  selectedDormFilter: number | null;
  onSelectDormFilter: (dorm: number | null) => void;
}

type SortField = 'name' | 'dorm' | 'room' | 'bed';
type SortOrder = 'asc' | 'desc';

export const MobileDormView: React.FC<MobileDormViewProps> = ({
  onOpenEditManager,
  onOpenDuplicateChecker,
  onOpenCccdScan,
  onOpenAddWorker,
  onOpenSettings,
  onOpenSearchModal,
  onOpenCccdGallery,
  onOpenDeleteByEmpCodeModal,
  onOpenTeamLeadersModal,
  onOpenActiveRoomsModal,
  onEditWorker,
  onDeleteWorker,
  onViewCccd,
  onSwitchToDesktop,
  selectedDormFilter,
  onSelectDormFilter,
}) => {
  const {
    workers,
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

  // Local filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Đang ở' | 'Đã rời đi'>('ALL');
  const [filterTodayEntered, setFilterTodayEntered] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedWorkerForAction, setSelectedWorkerForAction] = useState<Worker | null>(null);

  // Selected Dorm for Room Breakdown Modal/Drawer
  const [activeDormDetail, setActiveDormDetail] = useState<number | null>(null);
  const [activeRoomDetail, setActiveRoomDetail] = useState<number | null>(null);

  // Metrics
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

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return workers.filter((w) => {
      // Dorm filter
      if (selectedDormFilter !== null && w.dorm !== selectedDormFilter) {
        return false;
      }
      // Room filter if any selected
      if (activeRoomDetail !== null && w.room !== activeRoomDetail) {
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
        const matchName = (w.name || '').toLowerCase().includes(q);
        const matchCode = (w.empCode || '').toLowerCase().includes(q);
        const matchCccd = (w.cccd || '').toLowerCase().includes(q);
        const matchPhone = (w.phone || '').toLowerCase().includes(q);
        const matchRoom = `d${w.dorm}-p${w.room < 10 ? '0' + w.room : w.room}`.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCccd && !matchPhone && !matchRoom) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name, 'vi');
      } else if (sortField === 'dorm') {
        comparison = a.dorm - b.dorm;
      } else if (sortField === 'room') {
        comparison = a.room - b.room;
      } else if (sortField === 'bed') {
        comparison = a.bed - b.bed;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [workers, selectedDormFilter, activeRoomDetail, statusFilter, filterTodayEntered, searchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleClearFilters = () => {
    onSelectDormFilter(null);
    setActiveRoomDetail(null);
    setStatusFilter('ALL');
    setFilterTodayEntered(false);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-[#0b1329] text-slate-100 flex flex-col font-sans pb-16 select-none">
      
      {/* 1. TOP MOBILE HEADER (Solid Royal Blue matching Screenshot 1 & 2) */}
      <header className="bg-[#2563eb] text-white px-4 pt-3 pb-4 shadow-lg sticky top-0 z-30">
        
        {/* Row 1: Brand & Switch PC Button */}
        <div className="flex items-center justify-between gap-2 pb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-xs shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-[17px] sm:text-lg font-bold tracking-tight text-white truncate">
              Quản lý KTX Công nhân
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => forceSyncNow()}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 transition-all"
              title="Đồng bộ lại Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'syncing' || syncStatus === 'saving' ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onSwitchToDesktop}
              className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all text-xs font-semibold flex items-center gap-1 shadow-xs"
              title="Chuyển sang giao diện máy tính"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Bản PC</span>
            </button>
          </div>
        </div>

        {/* Action Button Rows (Exact Match to Screenshot 1) */}
        <div className="space-y-2 pt-0.5">
          
          {/* Row 2a: Quản lý: [tên] + [👤 Đổi tên] + [⚙️ Cài đặt] */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-white truncate">
              Quản lý: <span className="font-bold">{manager.name || 'liên'}</span>
            </span>

            <button
              type="button"
              onClick={onOpenEditManager}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 active:bg-white/35 text-white rounded-lg border border-white/30 text-xs font-medium transition-all shadow-2xs"
            >
              <User className="w-3 h-3 text-blue-100" />
              <span>Đổi tên</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 active:bg-white/35 text-white rounded-lg border border-white/30 text-xs font-medium transition-all shadow-2xs"
            >
              <Settings className="w-3 h-3 text-cyan-100" />
              <span>Cài đặt</span>
            </button>
          </div>

          {/* Row 2b: [🔍 Kiểm tra trùng mã NV] + [📷 Chụp CCCD] */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenDuplicateChecker}
              className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white/20 hover:bg-white/30 active:bg-white/35 text-white rounded-xl border border-white/30 text-xs font-medium transition-all shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 text-amber-200" />
              <span className="truncate">Kiểm tra trùng mã NV</span>
            </button>

            <button
              type="button"
              onClick={onOpenCccdScan}
              className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 bg-white/20 hover:bg-white/30 active:bg-white/35 text-white rounded-xl border border-white/30 text-xs font-medium transition-all shadow-2xs"
            >
              <Camera className="w-3.5 h-3.5 text-cyan-200" />
              <span className="truncate">Chụp CCCD</span>
            </button>
          </div>

          {/* Row 2c: [➕ Thêm công nhân] (Solid Blue) + [🔄 Thoát] (Solid Red) */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              onClick={onOpenAddWorker}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#3b82f6] hover:bg-blue-400 active:bg-blue-600 text-white rounded-xl border border-blue-300/40 text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm công nhân</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-[#ef4444] hover:bg-red-600 active:bg-red-700 text-white rounded-xl border border-red-400/40 text-xs font-bold transition-all shadow-sm"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          </div>

        </div>
      </header>

      {/* 2. BODY CONTENT (Dark themed matching Screenshot 1 & 2) */}
      <main className="px-3.5 py-3.5 space-y-4 max-w-lg mx-auto w-full">

        {/* 4 Stat KPI Cards (2x2 Grid with Left Color Bar - Exact match to Screenshot 1) */}
        <div className="grid grid-cols-2 gap-2.5">
          
          {/* 1. Tổng nhân sự KTX (Blue accent bar) */}
          <div
            id="mobile-card-total-occupants"
            onClick={() => {
              setStatusFilter('Đang ở');
              setFilterTodayEntered(false);
            }}
            className={`relative bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] rounded-xl p-3 border transition-all cursor-pointer overflow-hidden ${
              statusFilter === 'Đang ở' && !filterTodayEntered
                ? 'border-blue-500 shadow-md shadow-blue-500/20'
                : 'border-[#223050]'
            }`}
          >
            {/* Left Accent Bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3b82f6] rounded-l" />
            
            <div className="pl-1.5">
              <div className="text-2xl font-extrabold text-white tracking-tight leading-none">
                {totalOccupants}
              </div>
              <div className="text-xs text-slate-300 mt-1.5 font-medium leading-tight">
                Tổng nhân sự KTX
              </div>
            </div>
          </div>

          {/* 2. Công nhân vào KTX Hôm nay (Emerald green accent bar) */}
          <div
            id="mobile-card-today-entered"
            onClick={() => {
              setFilterTodayEntered(!filterTodayEntered);
              setStatusFilter('ALL');
            }}
            className={`relative bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] rounded-xl p-3 border transition-all cursor-pointer overflow-hidden ${
              filterTodayEntered
                ? 'border-emerald-500 shadow-md shadow-emerald-500/20'
                : 'border-[#223050]'
            }`}
          >
            {/* Left Accent Bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#10b981] rounded-l" />
            
            <div className="pl-1.5">
              <div className="text-2xl font-extrabold text-white tracking-tight leading-none">
                {todayEntered}
              </div>
              <div className="text-xs text-slate-300 mt-1.5 font-medium leading-tight">
                Công nhân vào KTX
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Hôm nay
              </div>
            </div>
          </div>

          {/* 3. Danh sách tổ trưởng (Red accent bar) */}
          <div
            id="mobile-card-team-leaders"
            onClick={onOpenTeamLeadersModal}
            className="relative bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] rounded-xl p-3 border border-[#223050] hover:border-red-500 transition-all cursor-pointer overflow-hidden"
          >
            {/* Left Accent Bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ef4444] rounded-l" />
            
            <div className="pl-1.5">
              <div className="text-2xl font-extrabold text-white tracking-tight leading-none">
                {totalTeamLeaders}
              </div>
              <div className="text-xs text-slate-300 mt-1.5 font-medium leading-tight">
                Danh sách tổ trưởng
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Theo dãy và phòng
              </div>
            </div>
          </div>

          {/* 4. Phòng đang sử dụng (Cyan accent bar) */}
          <div
            id="mobile-card-active-rooms"
            onClick={onOpenActiveRoomsModal}
            className="relative bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.98] rounded-xl p-3 border border-[#223050] hover:border-cyan-400 transition-all cursor-pointer overflow-hidden"
          >
            {/* Left Accent Bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#06b6d4] rounded-l" />
            
            <div className="pl-1.5">
              <div className="text-2xl font-extrabold text-white tracking-tight leading-none">
                {occupiedRooms} / {totalRooms}
              </div>
              <div className="text-xs text-slate-300 mt-1.5 font-medium leading-tight">
                Phòng đang sử dụng
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Nhấn để xem danh sách
              </div>
            </div>
          </div>

        </div>

        {/* 3. DORM OVERVIEW SECTION (3 Columns Grid - Exact Match to Screenshot 1) */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 leading-snug">
              <span>📊</span>
              <span>Tổng quan số lượng công nhân theo dãy (Nhấn vào dãy để xem chi tiết phòng)</span>
            </h2>
          </div>

          {/* 3 Columns Dorm Grid */}
          <div className="grid grid-cols-3 gap-2">
            {dormStatsList.map((dorm) => {
              const isSelected = selectedDormFilter === dorm.dormNum;
              return (
                <div
                  key={dorm.dormNum}
                  onClick={() => {
                    if (isSelected) {
                      onSelectDormFilter(null);
                      setActiveDormDetail(null);
                    } else {
                      onSelectDormFilter(dorm.dormNum);
                      setActiveDormDetail(dorm.dormNum);
                    }
                  }}
                  className={`bg-[#131b2e] hover:bg-[#18233c] active:scale-[0.97] rounded-xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between min-h-[96px] ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/50 bg-[#172340]'
                      : 'border-[#223050]'
                  }`}
                >
                  {/* Top Row: Dãy (left) + Badge (right) */}
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="font-bold text-xs text-white leading-tight">
                        Dãy
                      </div>
                      <div className="font-extrabold text-base text-white leading-none mt-0.5">
                        {dorm.dormNum}
                      </div>
                    </div>
                    <div className="text-[10px] font-semibold px-2 py-0.5 rounded-xl bg-[#2563eb] text-white text-center leading-tight shrink-0 shadow-2xs">
                      {dorm.workerCount} nhân
                      <br />
                      sự
                    </div>
                  </div>

                  {/* Room ratio & percentage */}
                  <div className="space-y-0.5 mt-2">
                    <div className="text-[11px] text-slate-400 font-medium leading-none">
                      {dorm.usedRooms}/{dorm.totalRooms} phòng
                    </div>
                    <div className="text-[11px] text-slate-400 font-normal leading-none pt-0.5">
                      {dorm.capacityPct}% sức chứa
                    </div>
                  </div>

                  {/* Progress bar line */}
                  <div className="w-full bg-[#1e2942] rounded-full h-1.5 overflow-hidden mt-1.5 border border-slate-700/40">
                    <div
                      className="bg-[#3b82f6] h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${dorm.capacityPct > 0 ? Math.max(6, dorm.capacityPct) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. THREE LARGE ACTION BUTTONS (Matching Screenshot 2) */}
        <div className="bg-[#10192e] p-3 rounded-2xl border border-[#223050] space-y-2.5 shadow-sm">
          
          {/* Button 1: Tìm công nhân (Vibrant Blue) */}
          <button
            type="button"
            onClick={onOpenSearchModal}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 active:scale-[0.99] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md text-sm transition-all"
          >
            <Search className="w-4 h-4 text-blue-100" />
            <span>Tìm công nhân</span>
          </button>

          {/* Button 2: Ảnh CCCD (Vibrant Green) */}
          <button
            type="button"
            onClick={onOpenCccdGallery}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 active:scale-[0.99] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md text-sm transition-all"
          >
            <ImageIcon className="w-4 h-4 text-emerald-100" />
            <span>Ảnh CCCD</span>
          </button>

          {/* Button 3: Xóa theo mã NV (Vibrant Red) */}
          <button
            type="button"
            onClick={onOpenDeleteByEmpCodeModal}
            className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 active:scale-[0.99] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md text-sm transition-all"
          >
            <Trash2 className="w-4 h-4 text-rose-100" />
            <span>Xóa theo mã NV</span>
          </button>

          {/* Total Count and active filter tag */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-1 px-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedDormFilter !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/60 text-[11px]">
                  Dãy {selectedDormFilter}
                  <button onClick={() => onSelectDormFilter(null)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {activeRoomDetail !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 text-[11px]">
                  Phòng {activeRoomDetail}
                  <button onClick={() => setActiveRoomDetail(null)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/60 text-[11px]">
                  {statusFilter}
                  <button onClick={() => setStatusFilter('ALL')} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterTodayEntered && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 text-[11px]">
                  Vào hôm nay
                  <button onClick={() => setFilterTodayEntered(false)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <div className="font-medium text-right shrink-0">
              Hiển thị {filteredWorkers.length} / {workers.length} công nhân
            </div>
          </div>

          {/* Quick search input bar */}
          <div className="relative pt-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gõ tên, mã NV, phòng (ví dụ: D3-P03) để lọc nhanh..."
              className="w-full pl-9 pr-8 py-2 bg-[#090f1f] text-white placeholder-slate-500 rounded-lg text-xs border border-[#223050] focus:outline-hidden focus:border-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-3.5" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-3.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>

        {/* 5. WORKERS TABLE LIST (Matching Screenshot 2 exactly) */}
        <div className="bg-[#10192e] rounded-xl border border-[#223050] overflow-hidden shadow-sm">
          
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-1 px-3 py-2.5 bg-[#090f1f] border-b border-[#223050] text-[11px] font-bold text-slate-400 uppercase tracking-wider items-center">
            
            {/* Col 1: Họ và tên */}
            <div
              onClick={() => handleSort('name')}
              className="col-span-5 flex items-center gap-1 cursor-pointer hover:text-white select-none"
            >
              <span>HỌ VÀ TÊN</span>
              <span className="text-[9px] text-blue-400">
                {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
              </span>
            </div>

            {/* Col 2: Dãy */}
            <div
              onClick={() => handleSort('dorm')}
              className="col-span-2 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-white select-none"
            >
              <span>DÃY</span>
              <span className="text-[9px] text-blue-400">
                {sortField === 'dorm' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
              </span>
            </div>

            {/* Col 3: Phòng */}
            <div
              onClick={() => handleSort('room')}
              className="col-span-3 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-white select-none"
            >
              <span>PHÒNG</span>
              <span className="text-[9px] text-blue-400">
                {sortField === 'room' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
              </span>
            </div>

            {/* Col 4: Số giường */}
            <div
              onClick={() => handleSort('bed')}
              className="col-span-2 text-center flex items-center justify-center gap-1 cursor-pointer hover:text-white select-none truncate"
            >
              <span>GIƯỜNG</span>
              <span className="text-[9px] text-blue-400">
                {sortField === 'bed' ? (sortOrder === 'asc' ? '▲' : '▼') : '▲▼'}
              </span>
            </div>

          </div>

          {/* Table Rows */}
          {filteredWorkers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <p className="text-sm">Không tìm thấy công nhân nào khớp bộ lọc</p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-blue-400 hover:underline font-semibold"
              >
                Xóa các bộ lọc để xem tất cả
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2a47]">
              {filteredWorkers.map((worker) => {
                const roomFormatted = `D${worker.dorm} - P${worker.room < 10 ? '0' + worker.room : worker.room}`;
                
                return (
                  <div
                    key={worker.id}
                    onClick={() => setSelectedWorkerForAction(worker)}
                    className="grid grid-cols-12 gap-1 px-3 py-3 hover:bg-[#152342] active:bg-[#1b2d56] transition-colors items-center cursor-pointer text-xs"
                  >
                    {/* Worker Name (Bold Uppercase White) */}
                    <div className="col-span-5 pr-1 min-w-0">
                      <div className="font-extrabold text-white text-xs sm:text-sm uppercase tracking-wide truncate">
                        {worker.name}
                      </div>
                      {worker.empCode && (
                        <div className="text-[10px] text-slate-400 truncate">
                          Mã: {worker.empCode}
                        </div>
                      )}
                    </div>

                    {/* Dorm Number */}
                    <div className="col-span-2 text-center font-bold text-slate-200 text-sm">
                      {worker.dorm}
                    </div>

                    {/* Room Pill Badge (e.g. D3 - P03) */}
                    <div className="col-span-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-600/60 text-[11px] font-semibold">
                        {roomFormatted}
                      </span>
                    </div>

                    {/* Bed number */}
                    <div className="col-span-2 text-center font-semibold text-slate-300">
                      {worker.bed || 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </main>

      {/* 6. DORM ROOMS DETAIL MODAL (Triggered when tapping a Dorm in the 3-column grid) */}
      {activeDormDetail !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg bg-[#10192e] border-t sm:border border-[#223050] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 text-white shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#223050] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {activeDormDetail}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Chi tiết các phòng Dãy {activeDormDetail}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chọn phòng để xem danh sách hoặc thêm công nhân
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveDormDetail(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Room Grid (1 .. roomsPerDorm) */}
            <div className="overflow-y-auto pr-1 flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {Array.from({ length: config.roomsPerDorm }, (_, i) => i + 1).map((roomNum) => {
                const roomWorkers = workers.filter(
                  (w) => w.dorm === activeDormDetail && w.room === roomNum && w.status === 'Đang ở'
                );
                const count = roomWorkers.length;
                const max = config.maxBedsPerRoom;
                const isFull = count >= max;
                const isSelected = activeRoomDetail === roomNum;

                return (
                  <div
                    key={roomNum}
                    onClick={() => {
                      setActiveRoomDetail(roomNum);
                      setActiveDormDetail(null);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/60 ring-1 ring-blue-400'
                        : isFull
                        ? 'bg-[#1a1523] border-rose-900/60 hover:border-rose-700'
                        : count > 0
                        ? 'bg-[#12202f] border-emerald-900/60 hover:border-emerald-700'
                        : 'bg-[#0d1527] border-[#223050] hover:border-blue-500/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">
                        Phòng {String(roomNum).padStart(2, '0')}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isFull
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : count > 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isFull ? 'Đầy' : count > 0 ? `${count} ng` : 'Trống'}
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-extrabold text-slate-200">
                      {count} / {max} <span className="font-normal text-[10px] text-slate-400">giường</span>
                    </div>

                    {/* Preview first worker name if any */}
                    {roomWorkers.length > 0 && (
                      <div className="text-[10px] text-slate-400 truncate mt-1">
                        {roomWorkers[0].name}
                        {roomWorkers.length > 1 ? ` +${roomWorkers.length - 1}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Modal Actions */}
            <div className="pt-2 border-t border-[#223050] flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSelectDormFilter(activeDormDetail);
                  setActiveDormDetail(null);
                }}
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-colors"
              >
                Lọc danh sách Dãy {activeDormDetail}
              </button>
              <button
                type="button"
                onClick={() => setActiveDormDetail(null)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. WORKER DETAIL SHEET MODAL when tapping a table row */}
      {selectedWorkerForAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-[#10192e] border-t sm:border border-[#223050] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 text-white shadow-2xl animate-in slide-in-from-bottom duration-300"
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#223050]">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-blue-400 font-semibold">
                  Hồ sơ công nhân
                </span>
                <h3 className="text-lg font-bold text-white uppercase mt-0.5">
                  {selectedWorkerForAction.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Mã: <strong className="text-slate-200">{selectedWorkerForAction.empCode || 'Chưa có'}</strong></span>
                  <span>•</span>
                  <span>CCCD: <strong className="text-slate-200">{selectedWorkerForAction.cccd || 'Chưa có'}</strong></span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedWorkerForAction(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Room Location Info */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-[#090f1f] rounded-xl border border-[#223050] text-center">
              <div>
                <div className="text-[10px] text-slate-400">DÃY</div>
                <div className="text-base font-bold text-blue-400">{selectedWorkerForAction.dorm}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">PHÒNG</div>
                <div className="text-base font-bold text-emerald-400">
                  P{selectedWorkerForAction.room < 10 ? '0' + selectedWorkerForAction.room : selectedWorkerForAction.room}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">GIƯỜNG</div>
                <div className="text-base font-bold text-amber-400">{selectedWorkerForAction.bed || 1}</div>
              </div>
            </div>

            {/* Dates & Status */}
            <div className="space-y-1.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Ngày vào KTX:</span>
                <span className="font-semibold text-white">{selectedWorkerForAction.entryDate || 'Chưa ghi'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trạng thái:</span>
                <span className={`font-semibold ${selectedWorkerForAction.status === 'Đang ở' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedWorkerForAction.status}
                </span>
              </div>
              {selectedWorkerForAction.phone && (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400">Số điện thoại:</span>
                  <a
                    href={`tel:${selectedWorkerForAction.phone}`}
                    className="font-bold text-blue-400 underline flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    {selectedWorkerForAction.phone}
                  </a>
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const w = selectedWorkerForAction;
                  setSelectedWorkerForAction(null);
                  onEditWorker(w);
                }}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-blue-600/80 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold text-xs transition-colors"
              >
                <Edit className="w-4 h-4" />
                <span>Sửa hồ sơ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const w = selectedWorkerForAction;
                  setSelectedWorkerForAction(null);
                  onViewCccd(w);
                }}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold text-xs transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Xem CCCD</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const w = selectedWorkerForAction;
                  setSelectedWorkerForAction(null);
                  onDeleteWorker(w);
                }}
                className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl bg-rose-600/80 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold text-xs transition-colors"
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

