import React from 'react';
import { Users, UserPlus, UserCheck, DoorClosed, ArrowRight } from 'lucide-react';
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
  onOpenTeamLeaders,
  onOpenActiveRooms,
}) => {
  const {
    getTotalOccupants,
    getTodayEntriesCount,
    getTeamLeadersCount,
    getOccupiedRoomsCount,
    config,
  } = useDorm();

  const totalOccupants = getTotalOccupants();
  const todayEntered = getTodayEntriesCount();
  const totalTeamLeaders = getTeamLeadersCount();
  const occupiedRooms = getOccupiedRoomsCount();
  const totalRooms = config.numDorms * config.roomsPerDorm;
  const maxCapacity = totalRooms * config.maxBedsPerRoom;
  const occupancyPercentage = maxCapacity > 0 ? Math.round((totalOccupants / maxCapacity) * 100) : 0;

  return (
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
                / {maxCapacity.toLocaleString()} sức chứa ({occupancyPercentage}%)
              </span>
            </div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <span>Xem danh sách công nhân đang ở</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* 2. Công nhân vào hôm nay */}
      <div
        id="card-stat-today-entered"
        onClick={onFilterTodayEntered}
        className="group relative bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden"
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Công nhân vào hôm nay
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {todayEntered}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">công nhân mới</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
            <UserPlus className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <span>Xem danh sách vào KTX hôm nay</span>
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
              <span className="text-xs text-slate-500 dark:text-slate-400">tổ trưởng các phòng</span>
            </div>
          </div>
          <div className="p-3 bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 rounded-lg group-hover:scale-110 transition-transform">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-violet-600 dark:text-violet-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <span>Xem danh sách tổng hợp tổ trưởng</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* 4. Phòng đang sử dụng */}
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
                / {totalRooms} phòng
              </span>
            </div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
            <DoorClosed className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <span>Xem chi tiết danh sách phòng có người</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

    </div>
  );
};

