import React from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  DoorClosed,
  ArrowRight,
  Cloud,
  CloudCheck,
  RefreshCw,
  WifiOff,
  Bed,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserMinus,
  Sparkles,
} from 'lucide-react';
import { useDorm } from '../context/DormContext';

interface DashboardCardsProps {
  onFilterActive: () => void;
  onFilterTodayEntered: () => void;
  onFilterTodayExited?: () => void;
  onOpenTeamLeaders: () => void;
  onOpenActiveRooms: () => void;
}

export const DashboardCards: React.FC<DashboardCardsProps> = ({
  onFilterActive,
  onFilterTodayEntered,
  onFilterTodayExited,
  onOpenTeamLeaders,
  onOpenActiveRooms,
}) => {
  const {
    workers,
    getTotalOccupants,
    getTodayEntriesCount,
    getTodayExitsCount,
    getTeamLeadersCount,
    getOccupiedRoomsCount,
    config,
    syncStatus,
    isOnline,
    lastSyncTime,
    forceSyncNow,
  } = useDorm();

  const totalAllWorkers = workers.length;
  const totalOccupants = getTotalOccupants();
  const totalExited = totalAllWorkers - totalOccupants;
  const todayEntered = getTodayEntriesCount();
  const todayExited = getTodayExitsCount();
  const totalTeamLeaders = getTeamLeadersCount();
  const occupiedRooms = getOccupiedRoomsCount();

  const totalRooms = config.numDorms * config.roomsPerDorm;
  const totalBeds = totalRooms * config.maxBedsPerRoom;
  const vacantBeds = Math.max(0, totalBeds - totalOccupants);

  // Count fully packed rooms and available rooms
  const roomOccupancyMap = new Map<string, number>();
  workers.forEach((w) => {
    if (w.status === 'Đang ở') {
      const key = `${w.dorm}_${w.room}`;
      roomOccupancyMap.set(key, (roomOccupancyMap.get(key) || 0) + 1);
    }
  });

  let fullRoomsCount = 0;
  roomOccupancyMap.forEach((count) => {
    if (count >= config.maxBedsPerRoom) {
      fullRoomsCount++;
    }
  });
  const emptyRoomsCount = Math.max(0, totalRooms - occupiedRooms);
  const occupancyPercentage = totalBeds > 0 ? Math.round((totalOccupants / totalBeds) * 100) : 0;

  // Format time for sync
  const formatSyncTime = (date: Date | null) => {
    if (!date) return 'Vừa xong';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Cloud Realtime Synchronization Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-emerald-50/80 dark:from-slate-800/90 dark:via-slate-800/80 dark:to-slate-800/90 border border-blue-200/60 dark:border-slate-700 rounded-xl shadow-xs text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center">
            {syncStatus === 'synced' && (
              <>
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            )}
            {syncStatus === 'saving' && (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 animate-pulse"></span>
            )}
            {syncStatus === 'syncing' && (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 animate-spin"></span>
            )}
            {(!isOnline || syncStatus === 'offline') && (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            )}
            {syncStatus === 'error' && (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            )}
          </div>

          <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200">
            <Cloud className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Cloud Database:</span>
            {syncStatus === 'synced' && (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                Đã đồng bộ thời gian thực (Realtime)
              </span>
            )}
            {syncStatus === 'saving' && (
              <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                Đang lưu dữ liệu lên Cloud...
              </span>
            )}
            {syncStatus === 'syncing' && (
              <span className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                Đang đồng bộ dữ liệu...
              </span>
            )}
            {(!isOnline || syncStatus === 'offline') && (
              <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" /> Không có kết nối mạng (Đang chạy Offline)
              </span>
            )}
            {syncStatus === 'error' && (
              <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Có lỗi kết nối Cloud
              </span>
            )}
          </div>

          <span className="hidden sm:inline text-slate-400 dark:text-slate-500">•</span>
          <span className="hidden sm:inline text-slate-500 dark:text-slate-400">
            Cập nhật lúc: <strong>{formatSyncTime(lastSyncTime)}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => forceSyncNow()}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-md border border-slate-200 dark:border-slate-600 transition-colors shadow-2xs"
            title="Đồng bộ lại dữ liệu từ Cloud Database"
          >
            <RefreshCw className={`w-3 h-3 text-slate-500 dark:text-slate-400 ${syncStatus === 'syncing' || syncStatus === 'saving' ? 'animate-spin' : ''}`} />
            <span>Đồng bộ ngay</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* 1. Tổng công nhân đang ở */}
        <div
          id="card-stat-total-occupants"
          onClick={onFilterActive}
          className="group relative bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tổng công nhân đang ở
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                  {totalOccupants}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  / {totalBeds.toLocaleString()} giường ({occupancyPercentage}%)
                </span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Tổng hồ sơ: <strong>{totalAllWorkers}</strong></span>
            <span>Đã rời KTX: <strong>{totalExited}</strong></span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <span>Xem danh sách công nhân đang ở</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 2. Biến động hôm nay (Vào / Rời) */}
        <div
          id="card-stat-today-entered"
          onClick={onFilterTodayEntered}
          className="group relative bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Vào KTX hôm nay
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  +{todayEntered}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">người mới</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
              <UserPlus className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Rời KTX hôm nay: <strong className="text-rose-600 dark:text-rose-400">{todayExited}</strong></span>
            <span>Chênh lệch: <strong className={todayEntered - todayExited >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{todayEntered - todayExited >= 0 ? `+${todayEntered - todayExited}` : todayEntered - todayExited}</strong></span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <span>Xem công nhân vào hôm nay</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 3. Danh sách tổ trưởng */}
        <div
          id="card-stat-team-leaders"
          onClick={onOpenTeamLeaders}
          className="group relative bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden hover:border-violet-300 dark:hover:border-violet-600"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Danh sách tổ trưởng
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-violet-600 dark:text-violet-400">
                  {totalTeamLeaders}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">tổ trưởng phụ trách</span>
              </div>
            </div>
            <div className="p-3 bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 rounded-lg group-hover:scale-110 transition-transform">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Bao quát: <strong>{totalOccupants} công nhân</strong></span>
            <span className="text-violet-600 dark:text-violet-400 font-medium">SĐT gọi ngay</span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-violet-600 dark:text-violet-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <span>Xem danh sách tổng hợp tổ trưởng</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* 4. Thống kê Phòng & Giường */}
        <div
          id="card-stat-active-rooms"
          onClick={onOpenActiveRooms}
          className="group relative bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Phòng đang sử dụng
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                  {occupiedRooms}
                </span>
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  / {totalRooms} phòng ({emptyRoomsCount} trống)
                </span>
              </div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
              <DoorClosed className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Phòng đã đầy: <strong className="text-rose-600 dark:text-rose-400">{fullRoomsCount}</strong></span>
            <span>Giường còn trống: <strong className="text-emerald-600 dark:text-emerald-400">{vacantBeds}</strong></span>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <span>Xem chi tiết danh sách phòng có người</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

      </div>
    </div>
  );
};
