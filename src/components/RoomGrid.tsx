import React from 'react';
import { DoorOpen, Users, UserPlus, ArrowLeft, ArrowRight, BedDouble } from 'lucide-react';
import { useDorm } from '../context/DormContext';

interface RoomGridProps {
  dormNumber: number;
  onSelectRoom: (room: number) => void;
  onBackToDorms: () => void;
  onAddWorkerToRoom?: (dorm: number, room: number) => void;
}

export const RoomGrid: React.FC<RoomGridProps> = ({
  dormNumber,
  onSelectRoom,
  onBackToDorms,
  onAddWorkerToRoom,
}) => {
  const { workers, config, currentUser } = useDorm();

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const roomCards = Array.from({ length: config.roomsPerDorm }, (_, i) => i + 1).map((roomNum) => {
    const roomWorkers = workers.filter(
      (w) => w.dorm === dormNumber && w.room === roomNum && w.status === 'Đang ở'
    );
    const count = roomWorkers.length;
    const max = config.maxBedsPerRoom;
    const occupancyPercentage = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;

    let barColor = 'bg-blue-600';
    let statusText = 'Còn trống';
    let badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

    if (count >= max) {
      barColor = 'bg-rose-500';
      statusText = 'Đã đầy';
      badgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
    } else if (count > 0) {
      barColor = 'bg-emerald-500';
      statusText = `${count} người`;
      badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
    }

    return {
      roomNum,
      workers: roomWorkers,
      count,
      max,
      occupancyPercentage,
      barColor,
      statusText,
      badgeClass,
    };
  });

  const dormTotalOccupants = workers.filter(
    (w) => w.dorm === dormNumber && w.status === 'Đang ở'
  ).length;

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDorms}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            title="Quay lại danh sách dãy"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DoorOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Chi tiết Dãy {dormNumber} ({config.roomsPerDorm} phòng)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Đang có <strong>{dormTotalOccupants}</strong> công nhân cư trú. Nhấn vào phòng để lọc danh sách công nhân.
            </p>
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
        {roomCards.map((room) => (
          <div
            key={room.roomNum}
            id={`room-card-${dormNumber}-${room.roomNum}`}
            className="group relative bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200/90 dark:border-slate-700/90 shadow-sm hover:shadow-md hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              {/* Room Card Header */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  Phòng {String(room.roomNum).padStart(2, '0')}
                </span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${room.badgeClass}`}>
                  {room.statusText}
                </span>
              </div>

              {/* Occupancy stats */}
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                  {room.count} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ {room.max}</span>
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {room.occupancyPercentage}% đầy
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-2">
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${room.barColor} rounded-full transition-all duration-300`}
                    style={{ width: `${room.occupancyPercentage}%` }}
                  />
                </div>
              </div>

              {/* Worker preview names if any */}
              {room.workers.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {room.workers.slice(0, 2).map((w) => w.name).join(', ')}
                    {room.workers.length > 2 ? ` và +${room.workers.length - 2} người khác` : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelectRoom(room.roomNum)}
                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors"
                title="Lọc danh sách công nhân phòng này"
              >
                <span>Xem danh sách</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              {canEdit && room.count < room.max && onAddWorkerToRoom && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddWorkerToRoom(dormNumber, room.roomNum);
                  }}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition-colors"
                  title="Thêm công nhân vào phòng này"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
