import React from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { Worker } from '../../types';
import { useDorm } from '../../context/DormContext';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  worker: Worker | null;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  worker,
  onClose,
  onSuccessToast,
  onErrorToast,
}) => {
  const { deleteWorker } = useDorm();

  if (!isOpen || !worker) return null;

  const handleConfirm = () => {
    const res = deleteWorker(worker.id);
    if (res.success) {
      onSuccessToast(`Đã xóa thành công công nhân ${worker.name}`);
      onClose();
    } else {
      onErrorToast(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <div className="p-2 bg-rose-100 dark:bg-rose-950/60 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Xác nhận xóa hồ sơ công nhân?
            </h3>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ của công nhân sau không?
          </p>

          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="font-bold text-sm text-slate-900 dark:text-white">{worker.name}</div>
            <div>Mã NV: <strong className="font-mono text-blue-600 dark:text-blue-400">{worker.empCode}</strong></div>
            <div>Vị trí: Dãy {worker.dorm} - Phòng {String(worker.room).padStart(2, '0')} (Giường {worker.bed || 1})</div>
            <div>Trạng thái: <strong>{worker.status}</strong></div>
          </div>

          <p className="text-[11px] text-rose-500 font-semibold">
            Lưu ý: Thao tác này sẽ giải phóng chỗ trong phòng và không thể hoàn tác trực tiếp.
          </p>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xác nhận xóa</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
