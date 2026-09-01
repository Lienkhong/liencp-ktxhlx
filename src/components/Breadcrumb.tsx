import React from 'react';
import { ChevronRight, Home, Building, DoorOpen } from 'lucide-react';

interface BreadcrumbProps {
  selectedDorm: number | null;
  selectedRoom: number | null;
  onSelectRoot: () => void;
  onSelectDorm: (dorm: number) => void;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  selectedDorm,
  selectedRoom,
  onSelectRoot,
  onSelectDorm,
}) => {
  return (
    <nav className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400 py-2.5 px-4 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 mb-6 overflow-x-auto">
      <button
        type="button"
        onClick={onSelectRoot}
        className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0"
      >
        <Home className="w-4 h-4 text-slate-500" />
        <span>Tổng quan KTX</span>
      </button>

      {selectedDorm !== null && (
        <>
          <ChevronRight className="w-4 h-4 mx-2 text-slate-400 shrink-0" />
          <button
            type="button"
            onClick={() => onSelectDorm(selectedDorm)}
            className={`inline-flex items-center gap-1.5 transition-colors shrink-0 ${
              selectedRoom === null
                ? 'font-bold text-blue-600 dark:text-blue-400'
                : 'hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            <Building className="w-4 h-4 text-slate-500" />
            <span>Dãy {selectedDorm}</span>
          </button>
        </>
      )}

      {selectedDorm !== null && selectedRoom !== null && (
        <>
          <ChevronRight className="w-4 h-4 mx-2 text-slate-400 shrink-0" />
          <span className="inline-flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400 shrink-0">
            <DoorOpen className="w-4 h-4 text-blue-500" />
            <span>Phòng {String(selectedRoom).padStart(2, '0')}</span>
          </span>
        </>
      )}
    </nav>
  );
};
