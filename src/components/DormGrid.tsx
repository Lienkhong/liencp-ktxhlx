import React from 'react';
import { Building, Users, DoorClosed, ArrowRight } from 'lucide-react';
import { useDorm } from '../context/DormContext';

interface DormGridProps {
  onSelectDorm: (dorm: number) => void;
}

export const DormGrid: React.FC<DormGridProps> = ({ onSelectDorm }) => {
  const { workers, config } = useDorm();

  const dormCards = Array.from({ length: config.numDorms }, (_, i) => i + 1).map((dormNum) => {
    const dormWorkers = workers.filter((w) => w.dorm === dormNum && w.status === 'Đang ở');
    const workerCount = dormWorkers.length;
    
    // Count distinct used rooms in this dorm
    const usedRooms = new Set(dormWorkers.map((w) => w.room)).size;
    const maxCapacity = config.roomsPerDorm * config.maxBedsPerRoom;
    const occupancyPercentage = maxCapacity > 0 ? Math.min(100, Math.round((workerCount / maxCapacity) * 100)) : 0;

    let barColor = 'bg-blue-600';
    let badgeColor = 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
    if (occupancyPercentage > 85) {
      barColor = 'bg-rose-500';
      badgeColor = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300';
    } else if (occupancyPercentage > 50) {
      barColor = 'bg-amber-500';
      badgeColor = 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
    } else if (occupancyPercentage > 0) {
      barColor = 'bg-emerald-500';
      badgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
    }

    return {
      dormNum,
      workerCount,
      usedRooms,
      totalRooms: config.roomsPerDorm,
      maxCapacity,
      occupancyPercentage,
      barColor,
      badgeColor,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Danh sách Dãy Ký túc xá ({config.numDorms} dãy)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Nhấn vào dãy để xem chi tiết phòng và công nhân bên trong
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {dormCards.map((dorm) => (
          <div
            key={dorm.dormNum}
            id={`dorm-card-${dorm.dormNum}`}
            onClick={() => onSelectDorm(dorm.dormNum)}
            className="group relative bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200/90 dark:border-slate-700/90 shadow-sm hover:shadow-lg hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-sm">
                    {dorm.dormNum}
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    Dãy {dorm.dormNum}
                  </h3>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${dorm.badgeColor}`}>
                  {dorm.occupancyPercentage}% sức chứa
                </span>
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {dorm.workerCount} nhân sự
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Đang ở</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DoorClosed className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {dorm.usedRooms} / {dorm.totalRooms} phòng
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Đang sử dụng</div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  <span>Sức chứa: {dorm.workerCount}/{dorm.maxCapacity}</span>
                  <span className="font-medium">{dorm.occupancyPercentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${dorm.barColor} rounded-full transition-all duration-300`}
                    style={{ width: `${dorm.occupancyPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer action */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Xem các phòng</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
