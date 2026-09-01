import React, { useMemo } from 'react';
import { X, SearchCode, AlertTriangle, CheckCircle2, Edit2, Trash2, ShieldCheck, Users } from 'lucide-react';
import { Worker } from '../../types';
import { useDorm } from '../../context/DormContext';

interface DuplicateEmpCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditWorker: (worker: Worker) => void;
  onDeleteWorker: (worker: Worker) => void;
}

export const DuplicateEmpCodeModal: React.FC<DuplicateEmpCodeModalProps> = ({
  isOpen,
  onClose,
  onEditWorker,
  onDeleteWorker,
}) => {
  const { workers, currentUser } = useDorm();

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Find duplicates
  const duplicateGroups = useMemo(() => {
    const codeMap = new Map<string, Worker[]>();
    for (const w of workers) {
      const code = w.empCode.trim().toUpperCase();
      if (!code) continue;
      const list = codeMap.get(code) || [];
      list.push(w);
      codeMap.set(code, list);
    }

    const dupes: { code: string; workers: Worker[] }[] = [];
    for (const [code, list] of codeMap.entries()) {
      if (list.length > 1) {
        dupes.push({ code, workers: list });
      }
    }
    return dupes;
  }, [workers]);

  if (!isOpen) return null;

  const totalDuplicatesCount = duplicateGroups.reduce((acc, g) => acc + g.workers.length, 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <SearchCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Kiểm tra trùng Mã nhân viên
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Quét toàn bộ cơ sở dữ liệu để tìm các hồ sơ có cùng mã nhân viên
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
        <div className="p-6 space-y-5">
          
          {/* Summary Box */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-500" />
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {workers.length}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Tổng số hồ sơ</div>
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex items-center gap-3 ${
              duplicateGroups.length > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
            }`}>
              {duplicateGroups.length > 0 ? (
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {duplicateGroups.length} mã ({totalDuplicatesCount} hồ sơ)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Trùng lặp phát hiện</div>
              </div>
            </div>
          </div>

          {/* Duplicates List */}
          <div className="space-y-4 max-h-[50vh] overflow-y-auto">
            {duplicateGroups.length === 0 ? (
              <div className="py-8 text-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-12 h-12 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-sm">Hệ thống trong sạch!</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Không tìm thấy bất kỳ mã nhân viên nào bị trùng lặp trong hệ thống.
                </p>
              </div>
            ) : (
              duplicateGroups.map((group) => (
                <div
                  key={group.code}
                  className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/80 px-2 py-0.5 rounded">
                      Mã NV: {group.code}
                    </span>
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {group.workers.length} công nhân trùng mã
                    </span>
                  </div>

                  <div className="divide-y divide-amber-200/60 dark:divide-amber-900/40">
                    {group.workers.map((worker) => (
                      <div
                        key={worker.id}
                        className="py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {worker.name}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 ml-2">
                            (Dãy {worker.dorm} - P.{String(worker.room).padStart(2, '0')} - G.{worker.bed || 1})
                          </span>
                          <span className="text-slate-400 ml-2">
                            [{worker.status}]
                          </span>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onEditWorker(worker);
                                onClose();
                              }}
                              className="p-1.5 rounded text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-slate-800"
                              title="Sửa mã NV"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteWorker(worker);
                              }}
                              className="p-1.5 rounded text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-800"
                              title="Xóa bản ghi này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

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
