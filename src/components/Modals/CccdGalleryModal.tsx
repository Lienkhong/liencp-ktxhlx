import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Upload, Building, DoorOpen, Users, CreditCard, ChevronRight } from 'lucide-react';
import { Worker } from '../../types';
import { useDorm } from '../../context/DormContext';

interface CccdGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedWorker?: Worker | null;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const CccdGalleryModal: React.FC<CccdGalleryModalProps> = ({
  isOpen,
  onClose,
  selectedWorker,
  onSuccessToast,
  onErrorToast,
}) => {
  const { workers, config, updateWorker, currentUser } = useDorm();
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [activeWorkerId, setActiveWorkerId] = useState<string>(selectedWorker?.id || '');
  const [selectedDorm, setSelectedDorm] = useState<number>(selectedWorker?.dorm || 1);
  const [selectedRoom, setSelectedRoom] = useState<number>(selectedWorker?.room || 1);

  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (selectedWorker) {
      setActiveWorkerId(selectedWorker.id);
      setSelectedDorm(selectedWorker.dorm);
      setSelectedRoom(selectedWorker.room);
    }
  }, [selectedWorker]);

  if (!isOpen) return null;

  const roomWorkers = workers.filter((w) => w.dorm === selectedDorm && w.room === selectedRoom);
  const currentWorker = workers.find((w) => w.id === activeWorkerId) || roomWorkers[0] || selectedWorker;

  const handleImageUpload = (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorker) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64 = event.target.result as string;
        const res = updateWorker(currentWorker.id, {
          [side === 'front' ? 'cccdFrontImage' : 'cccdBackImage']: base64,
        });
        if (res.success) {
          onSuccessToast(`Đã lưu ảnh CCCD mặt ${side === 'front' ? 'trước' : 'sau'} thành công!`);
        } else {
          onErrorToast(res.message);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Kho lưu trữ & Xem ảnh CCCD
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Xem và quản lý 2 mặt ảnh CCCD/CMND của từng công nhân theo phòng
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
          
          {/* Dorm & Room selector toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Chọn Dãy:
              </label>
              <select
                value={selectedDorm}
                onChange={(e) => setSelectedDorm(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {Array.from({ length: config.numDorms }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Dãy {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Chọn Phòng:
              </label>
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-semibold rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {Array.from({ length: config.roomsPerDorm }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={r}>
                    Phòng {String(r).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Công nhân trong phòng:
              </label>
              <select
                value={activeWorkerId}
                onChange={(e) => setActiveWorkerId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {roomWorkers.length === 0 ? (
                  <option value="">(Phòng trống)</option>
                ) : (
                  roomWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} - {w.empCode}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {currentWorker ? (
            <div className="space-y-4">
              {/* Worker summary banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs">
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white mr-2">
                    {currentWorker.name}
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 mr-2">
                    {currentWorker.empCode}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    CCCD: {currentWorker.cccd || 'Chưa cập nhật'}
                  </span>
                </div>
                <div className="text-slate-600 dark:text-slate-300">
                  Dãy {currentWorker.dorm} - Phòng {String(currentWorker.room).padStart(2, '0')} (G.{currentWorker.bed || 1})
                </div>
              </div>

              {/* Two-sided CCCD Display Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Front Side */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      MẶT TRƯỚC CCCD
                    </span>
                    {currentWorker.cccdFrontImage && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                        Đã có ảnh
                      </span>
                    )}
                  </div>

                  <div className="aspect-[1.58/1] w-full bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 dark:border-slate-700">
                    {currentWorker.cccdFrontImage ? (
                      <img
                        src={currentWorker.cccdFrontImage}
                        alt="Mặt trước CCCD"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-400" />
                        <span className="text-xs">Chưa có ảnh mặt trước</span>
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div>
                      <input
                        type="file"
                        ref={frontInputRef}
                        accept="image/*"
                        onChange={(e) => handleImageUpload('front', e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => frontInputRef.current?.click()}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải lên / Thay ảnh mặt trước</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Back Side */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      MẶT SAU CCCD
                    </span>
                    {currentWorker.cccdBackImage && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                        Đã có ảnh
                      </span>
                    )}
                  </div>

                  <div className="aspect-[1.58/1] w-full bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 dark:border-slate-700">
                    {currentWorker.cccdBackImage ? (
                      <img
                        src={currentWorker.cccdBackImage}
                        alt="Mặt sau CCCD"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center text-slate-400 p-4">
                        <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-400" />
                        <span className="text-xs">Chưa có ảnh mặt sau</span>
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div>
                      <input
                        type="file"
                        ref={backInputRef}
                        accept="image/*"
                        onChange={(e) => handleImageUpload('back', e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => backInputRef.current?.click()}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Tải lên / Thay ảnh mặt sau</span>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              Vui lòng chọn công nhân để xem ảnh CCCD.
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
