import React, { useState } from 'react';
import { X, UserX, Search, Trash2, AlertTriangle, Building, Phone } from 'lucide-react';
import { Worker } from '../../types';
import { useDorm } from '../../context/DormContext';
import { formatDateDisplay } from '../../utils/helpers';

interface DeleteByEmpCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const DeleteByEmpCodeModal: React.FC<DeleteByEmpCodeModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
  onErrorToast,
}) => {
  const { workers, deleteWorker } = useDorm();
  const [empCodeInput, setEmpCodeInput] = useState('');
  const [searchedWorker, setSearchedWorker] = useState<Worker | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = empCodeInput.trim().toUpperCase();
    if (!clean) {
      onErrorToast('Vui lòng nhập mã nhân viên cần tìm!');
      return;
    }
    const found = workers.find((w) => w.empCode.toUpperCase() === clean);
    setSearchedWorker(found || null);
    setHasSearched(true);
  };

  const handleConfirmDelete = async () => {
    if (!searchedWorker) return;
    const res = await deleteWorker(searchedWorker.id);
    if (res.success) {
      onSuccessToast(`Đã xóa thành công công nhân ${searchedWorker.name} (Mã: ${searchedWorker.empCode})`);
      onClose();
    } else {
      onErrorToast(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Xóa hồ sơ theo Mã nhân viên
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tìm nhanh theo mã và xác nhận xóa an toàn
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

        {/* Body */}
        <div className="p-6 space-y-4">
          <form onSubmit={handleSearch} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nhập mã nhân viên cần xóa:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={empCodeInput}
                onChange={(e) => {
                  setEmpCodeInput(e.target.value);
                  setHasSearched(false);
                  setSearchedWorker(null);
                }}
                placeholder="Ví dụ: NV005"
                className="flex-1 px-3 py-2 text-sm font-mono uppercase rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Tìm</span>
              </button>
            </div>
          </form>

          {/* Search Result Box */}
          {hasSearched && (
            searchedWorker ? (
              <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Tìm thấy thông tin công nhân:</span>
                </div>

                <div className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-rose-100 dark:border-rose-900/40">
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {searchedWorker.name}
                  </div>
                  <div>Mã NV: <strong className="font-mono text-blue-600 dark:text-blue-400">{searchedWorker.empCode}</strong></div>
                  <div>Vị trí: <strong>Dãy {searchedWorker.dorm} - Phòng {String(searchedWorker.room).padStart(2, '0')} (Giường {searchedWorker.bed || 1})</strong></div>
                  <div>Trạng thái: <strong>{searchedWorker.status}</strong></div>
                  {searchedWorker.phone && <div>SĐT: {searchedWorker.phone}</div>}
                  {searchedWorker.dob && <div>Ngày sinh: {formatDateDisplay(searchedWorker.dob)}</div>}
                </div>

                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  Hành động này sẽ xóa vĩnh viễn hồ sơ của công nhân khỏi hệ thống KTX.
                </p>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                Không tìm thấy công nhân nào có mã nhân viên <strong>{empCodeInput.toUpperCase()}</strong>.
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
};
