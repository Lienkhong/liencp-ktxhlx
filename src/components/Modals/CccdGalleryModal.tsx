import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Image as ImageIcon,
  Upload,
  Building,
  DoorOpen,
  Users,
  CreditCard,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Trash2,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Worker } from '../../types';
import { useDorm } from '../../context/DormContext';
import { maskCccdNumber } from '../../utils/helpers';

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
  const {
    workers,
    config,
    updateWorker,
    currentUser,
    canViewCccd,
    fetchSecureCccdImages,
    deleteSecureCccdImages,
  } = useDorm();

  const isAuthorized = canViewCccd();
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [activeWorkerId, setActiveWorkerId] = useState<string>(selectedWorker?.id || '');
  const [selectedDorm, setSelectedDorm] = useState<number>(selectedWorker?.dorm || 1);
  const [selectedRoom, setSelectedRoom] = useState<number>(selectedWorker?.room || 1);

  // Loaded secure images cache for current view
  const [loadedImages, setLoadedImages] = useState<{ [workerId: string]: { front?: string; back?: string } }>({});
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedWorker) {
      setActiveWorkerId(selectedWorker.id);
      setSelectedDorm(selectedWorker.dorm);
      setSelectedRoom(selectedWorker.room);
    }
  }, [selectedWorker]);

  const roomWorkers = workers.filter((w) => w.dorm === selectedDorm && w.room === selectedRoom);
  const currentWorker = workers.find((w) => w.id === activeWorkerId) || roomWorkers[0] || selectedWorker;

  // Fetch secure CCCD images from Private Firestore Collection when worker changes
  useEffect(() => {
    if (isOpen && isAuthorized && currentWorker) {
      const workerId = currentWorker.id;
      // If already in memory or in worker state
      if (currentWorker.cccdFrontImage || currentWorker.cccdBackImage) {
        setLoadedImages((prev) => ({
          ...prev,
          [workerId]: {
            front: currentWorker.cccdFrontImage,
            back: currentWorker.cccdBackImage,
          },
        }));
      } else if (!loadedImages[workerId]) {
        setIsLoadingImages(true);
        fetchSecureCccdImages(workerId)
          .then((docs) => {
            if (docs) {
              setLoadedImages((prev) => ({
                ...prev,
                [workerId]: { front: docs.frontImage, back: docs.backImage },
              }));
            }
          })
          .catch((err) => {
            console.error('Error fetching secure CCCD:', err);
          })
          .finally(() => {
            setIsLoadingImages(false);
          });
      }
    }
  }, [isOpen, isAuthorized, currentWorker?.id]);

  if (!isOpen) return null;

  const currentFront = currentWorker ? (loadedImages[currentWorker.id]?.front || currentWorker.cccdFrontImage) : undefined;
  const currentBack = currentWorker ? (loadedImages[currentWorker.id]?.back || currentWorker.cccdBackImage) : undefined;

  const handleImageUpload = async (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorker) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const base64 = event.target.result as string;
        const res = await updateWorker(currentWorker.id, {
          [side === 'front' ? 'cccdFrontImage' : 'cccdBackImage']: base64,
        });
        if (res.success) {
          setLoadedImages((prev) => ({
            ...prev,
            [currentWorker.id]: {
              ...(prev[currentWorker.id] || {}),
              [side === 'front' ? 'front' : 'back']: base64,
            },
          }));
          onSuccessToast(`Đã lưu ảnh CCCD mặt ${side === 'front' ? 'trước' : 'sau'} vào Private Cloud Storage!`);
        } else {
          onErrorToast(res.message);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCccdSide = async (side: 'front' | 'back') => {
    if (!currentWorker) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ảnh CCCD mặt ${side === 'front' ? 'trước' : 'sau'} của công nhân này?`)) {
      return;
    }

    const updates = side === 'front'
      ? { cccdFrontImage: '' }
      : { cccdBackImage: '' };

    const res = await updateWorker(currentWorker.id, updates);
    if (res.success) {
      setLoadedImages((prev) => ({
        ...prev,
        [currentWorker.id]: {
          ...(prev[currentWorker.id] || {}),
          [side === 'front' ? 'front' : 'back']: undefined,
        },
      }));
      onSuccessToast(`Đã xóa ảnh CCCD mặt ${side === 'front' ? 'trước' : 'sau'} khỏi Private Storage!`);
    } else {
      onErrorToast(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Kho lưu trữ & Xem ảnh CCCD</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Private Security
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bảo vệ dữ liệu cá nhân nhạy cảm — Truy cập được kiểm soát và ghi nhận nhật ký Audit Trail
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

          {/* Access Denied Guard */}
          {!isAuthorized ? (
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-3">
              <ShieldAlert className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto" />
              <h4 className="font-bold text-base text-rose-900 dark:text-rose-200">
                Truy cập bị từ chối (403 Forbidden)
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-300 max-w-md mx-auto">
                Ảnh Căn cước công dân (CCCD/CMND) là dữ liệu cá nhân nhạy cảm. Chỉ tài khoản Quản trị viên (Admin) và Quản lý KTX mới có quyền xem hoặc sửa đổi.
              </p>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Tài khoản hiện tại: {currentUser?.email} (Vai trò: {currentUser?.role || 'Guest'})
              </div>
            </div>
          ) : (
            <>
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
                        CCCD: {currentWorker.cccd ? maskCccdNumber(currentWorker.cccd) : 'Chưa cập nhật'}
                      </span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300 font-semibold">
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
                        {currentFront && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                            Đã lưu trữ
                          </span>
                        )}
                      </div>

                      <div className="aspect-[1.58/1] w-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 dark:border-slate-700 relative">
                        {isLoadingImages ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                            <span>Đang tải ảnh bảo mật...</span>
                          </div>
                        ) : currentFront ? (
                          <img
                            src={currentFront}
                            alt="Mặt trước CCCD"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-400 p-4">
                            <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-500" />
                            <span className="text-xs">Chưa có ảnh mặt trước</span>
                          </div>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2">
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
                            className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{currentFront ? 'Thay ảnh' : 'Tải lên mặt trước'}</span>
                          </button>

                          {currentFront && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCccdSide('front')}
                              className="p-2 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 border border-rose-200 dark:border-rose-800 transition-colors"
                              title="Xóa ảnh mặt trước"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
                        {currentBack && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                            Đã lưu trữ
                          </span>
                        )}
                      </div>

                      <div className="aspect-[1.58/1] w-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-slate-300 dark:border-slate-700 relative">
                        {isLoadingImages ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                            <span>Đang tải ảnh bảo mật...</span>
                          </div>
                        ) : currentBack ? (
                          <img
                            src={currentBack}
                            alt="Mặt sau CCCD"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-center text-slate-400 p-4">
                            <ImageIcon className="w-8 h-8 mx-auto mb-1 text-slate-500" />
                            <span className="text-xs">Chưa có ảnh mặt sau</span>
                          </div>
                        )}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-2">
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
                            className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{currentBack ? 'Thay ảnh' : 'Tải lên mặt sau'}</span>
                          </button>

                          {currentBack && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCccdSide('back')}
                              className="p-2 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 border border-rose-200 dark:border-rose-800 transition-colors"
                              title="Xóa ảnh mặt sau"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
            </>
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
