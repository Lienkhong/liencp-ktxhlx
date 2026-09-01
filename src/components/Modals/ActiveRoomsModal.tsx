import React from 'react';
import { X, DoorClosed, Users, ArrowRight, Building } from 'lucide-react';
import { useDorm } from '../../context/DormContext';

interface ActiveRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom: (dorm: number, room: number) => void;
}

export const ActiveRoomsModal: React.FC<ActiveRoomsModalProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
}) => {
  const { workers, config } = useDorm();

  if (!isOpen) return null;

  // Group active workers by dorm and room
  const activeRoomsMap = new Map<string, { dorm: number; room: number; count: number; names: string[] }>();

  workers
    .filter((w) => w.status === 'Đang ở')
    .forEach((w) => {
      const key = `${w.dorm}-${w.room}`;
      const existing = activeRoomsMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.names.push(w.name);
      } else {
        activeRoomsMap.set(key, {
          dorm: w.dorm,
          room: w.room,
          count: 1,
          names: [w.name],
        });
      }
    });

  const activeRoomsList = Array.from(activeRoomsMap.values()).sort((a, b) => {
    return a.dorm - b.dorm || a.room - b.room;
  });

  const totalRooms = config.numDorms * config.roomsPerDorm;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <DoorClosed className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Danh sách phòng đang sử dụng ({activeRoomsList.length} / {totalRooms} phòng)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Các phòng có ít nhất 1 công nhân đang ở thực tế
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
          {activeRoomsList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Hiện tại chưa có phòng nào có công nhân ở.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeRoomsList.map((item) => (
                <div
                  key={`${item.dorm}-${item.room}`}
                  onClick={() => {
                    onSelectRoom(item.dorm, item.room);
                    onClose();
                  }}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        Dãy {item.dorm} - Phòng {String(item.room).padStart(2, '0')}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                        {item.count} / {config.maxBedsPerRoom} người
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {item.names.join(', ')}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <span>Xem danh sách</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
