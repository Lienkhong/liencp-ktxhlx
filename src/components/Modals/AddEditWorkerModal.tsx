import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserPlus,
  Save,
  AlertTriangle,
  CheckCircle,
  DoorOpen,
  Camera,
  Upload,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Trash2,
  Lock,
} from 'lucide-react';
import { Worker, WorkerStatus } from '../../types';
import { useDorm } from '../../context/DormContext';
import { normalizeCccdNumber, normalizePersonName, normalizeDateInput, maskCccdNumber } from '../../utils/helpers';
import { CccdScanModal } from './CccdScanModal';

interface AddEditWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerToEdit?: Worker | null;
  initialDorm?: number;
  initialRoom?: number;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const AddEditWorkerModal: React.FC<AddEditWorkerModalProps> = ({
  isOpen,
  onClose,
  workerToEdit,
  initialDorm = 1,
  initialRoom = 1,
  onSuccessToast,
  onErrorToast,
}) => {
  const {
    workers,
    config,
    addWorker,
    updateWorker,
    canViewCccd,
    fetchSecureCccdImages,
    currentUser,
  } = useDorm();

  const isEditing = Boolean(workerToEdit);

  // Form State - all fields are optional
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [cccd, setCccd] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  const [dorm, setDorm] = useState<number>(initialDorm);
  const [room, setRoom] = useState<number>(initialRoom);
  const [bed, setBed] = useState<number>(1);
  const [teamLeader, setTeamLeader] = useState('');
  const [status, setStatus] = useState<WorkerStatus>('Đang ở');

  // CCCD Photos state
  const [cccdFrontImage, setCccdFrontImage] = useState<string | undefined>(undefined);
  const [cccdBackImage, setCccdBackImage] = useState<string | undefined>(undefined);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [isLoadingCccd, setIsLoadingCccd] = useState(false);

  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);

  // Overwrite confirmation modal state
  const [duplicateConflictWorker, setDuplicateConflictWorker] = useState<Worker | null>(null);

  // Initialize or populate form
  useEffect(() => {
    if (workerToEdit) {
      setName(workerToEdit.name || '');
      setDob(workerToEdit.dob || '');
      setEmpCode(workerToEdit.empCode || '');
      setCccd(workerToEdit.cccd || '');
      setPhone(workerToEdit.phone || '');
      setAddress(workerToEdit.address || '');
      setNote(workerToEdit.note || '');
      setDorm(workerToEdit.dorm || 1);
      setRoom(workerToEdit.room || 1);
      setBed(workerToEdit.bed || 1);
      setTeamLeader(workerToEdit.teamLeader || '');
      setStatus(workerToEdit.status || 'Đang ở');
      setCccdFrontImage(workerToEdit.cccdFrontImage);
      setCccdBackImage(workerToEdit.cccdBackImage);

      // If existing worker has CCCD document on cloud storage, fetch securely
      if (canViewCccd() && workerToEdit.cccdDocument && (!workerToEdit.cccdFrontImage && !workerToEdit.cccdBackImage)) {
        setIsLoadingCccd(true);
        fetchSecureCccdImages(workerToEdit.id)
          .then((docs) => {
            if (docs?.frontImage) setCccdFrontImage(docs.frontImage);
            if (docs?.backImage) setCccdBackImage(docs.backImage);
          })
          .catch((err) => console.error('Error fetching secure CCCD:', err))
          .finally(() => setIsLoadingCccd(false));
      }
    } else {
      setName('');
      setDob('');
      setEmpCode('');
      setCccd('');
      setPhone('');
      setAddress('');
      setNote('');
      setDorm(initialDorm);
      setRoom(initialRoom);
      setBed(1);
      setTeamLeader('');
      setStatus('Đang ở');
      setCccdFrontImage(undefined);
      setCccdBackImage(undefined);
    }
    setDuplicateConflictWorker(null);
  }, [workerToEdit, initialDorm, initialRoom, isOpen]);

  if (!isOpen) return null;

  // Calculate current room occupants
  const roomOccupants = workers.filter(
    (w) => w.dorm === dorm && w.room === room && w.status === 'Đang ở' && w.id !== workerToEdit?.id
  );
  const roomCount = roomOccupants.length;
  const isRoomFull = roomCount >= config.maxBedsPerRoom && status === 'Đang ở';

  const handleFileUpload = (side: 'front' | 'back', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64 = event.target.result as string;
        if (side === 'front') {
          setCccdFrontImage(base64);
        } else {
          setCccdBackImage(base64);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleOcrDataReceived = (extractedData: {
    name?: string;
    cccd?: string;
    dob?: string;
    address?: string;
    frontImage?: string;
    backImage?: string;
  }) => {
    if (extractedData.name) setName(extractedData.name);
    if (extractedData.cccd) setCccd(extractedData.cccd);
    if (extractedData.dob) setDob(extractedData.dob);
    if (extractedData.address) setAddress(extractedData.address);
    if (extractedData.frontImage) setCccdFrontImage(extractedData.frontImage);
    if (extractedData.backImage) setCccdBackImage(extractedData.backImage);
    onSuccessToast('Đã trích xuất và điền thông tin từ CCCD thành công!');
  };

  const handleSubmit = async (e?: React.FormEvent, forceOverwrite = false) => {
    if (e) e.preventDefault();

    // Clean inputs - all fields are optional
    const cleanName = name.trim() ? normalizePersonName(name) : (workerToEdit ? workerToEdit.name : 'Công nhân mới');
    const autoCode = `NV${Math.floor(1000 + Math.random() * 9000)}`;
    const cleanEmpCode = empCode.trim() ? empCode.trim().toUpperCase() : (workerToEdit ? workerToEdit.empCode : autoCode);
    const cleanCccd = cccd.trim() ? normalizeCccdNumber(cccd) : '';

    if (isEditing && workerToEdit) {
      const res = await updateWorker(workerToEdit.id, {
        name: cleanName,
        dob: dob ? normalizeDateInput(dob) : '',
        empCode: cleanEmpCode,
        cccd: cleanCccd,
        phone: phone.trim(),
        address: address.trim(),
        note: note.trim(),
        dorm,
        room,
        bed,
        teamLeader: teamLeader.trim(),
        status,
        cccdFrontImage,
        cccdBackImage,
      });

      if (res.success) {
        onSuccessToast(res.message);
        onClose();
      } else {
        onErrorToast(res.message);
      }
    } else {
      // Add worker
      const res = await addWorker(
        {
          name: cleanName,
          dob: dob ? normalizeDateInput(dob) : '',
          empCode: cleanEmpCode,
          cccd: cleanCccd,
          phone: phone.trim(),
          address: address.trim(),
          note: note.trim(),
          dorm,
          room,
          bed,
          teamLeader: teamLeader.trim(),
          status,
          entryDate: '',
          exitDate: '',
          cccdFrontImage,
          cccdBackImage,
        },
        forceOverwrite
      );

      if (res.success) {
        onSuccessToast(res.message);
        onClose();
      } else if (res.duplicateWorker) {
        setDuplicateConflictWorker(res.duplicateWorker);
      } else {
        onErrorToast(res.message);
      }
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                {isEditing ? <Save className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  {isEditing ? `Cập nhật thông tin: ${workerToEdit?.name || 'Công nhân'}` : 'Thêm công nhân mới vào KTX'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tất cả thông tin đều không bắt buộc. Quản lý có thể chụp ảnh CCCD để AI tự động điền.
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

          {/* Quick OCR Scanner Trigger Banner */}
          <div className="px-6 pt-4">
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Chụp ảnh & Trích xuất CCCD bằng AI</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-semibold">OCR Online</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Chụp bằng camera điện thoại hoặc tải ảnh lên để tự động điền thông tin
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOcrModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quét CCCD ngay</span>
              </button>
            </div>
          </div>

          {/* Modal Form Body */}
          <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-5">
            
            {/* Section 1: Thông tin cá nhân */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 pb-1 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span>1. Thông tin cá nhân (Tùy chọn)</span>
                <span className="text-[10px] font-normal text-slate-400 capitalize">Không bắt buộc</span>
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Họ và tên */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và tên
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: NGUYỄN VĂN A (Nếu để trống hệ thống sẽ ghi Công nhân mới)"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Mã nhân viên */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mã nhân viên (Mã NV)
                  </label>
                  <input
                    type="text"
                    value={empCode}
                    onChange={(e) => setEmpCode(e.target.value)}
                    placeholder="Ví dụ: NV001 (Nếu để trống sẽ tự tạo mã)"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Ngày sinh */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ngày sinh (YYYY-MM-DD hoặc DD/MM/YYYY)
                  </label>
                  <input
                    type="text"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    placeholder="Ví dụ: 1996-08-15 hoặc 15/08/1996"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Số CCCD */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số CCCD / CMND
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={cccd}
                    onChange={(e) => setCccd(normalizeCccdNumber(e.target.value))}
                    placeholder="Ví dụ: 001096012345"
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Số điện thoại */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ví dụ: 0912 345 678"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Nơi thường trú */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nơi đăng ký hộ khẩu thường trú / Quê quán
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ví dụ: Xã Phú Nghĩa, Huyện Chương Mỹ, TP Hà Nội"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Ghi chú */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ghi chú
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: Tổ phó, trực ca đêm..."
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Ảnh CCCD - Bảo mật dữ liệu nhạy cảm */}
            <div>
              <div className="flex items-center justify-between mb-3 pb-1 border-b border-slate-100 dark:border-slate-700">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. Lưu trữ ảnh CCCD bảo mật</span>
                </h4>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Private Storage
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Front CCCD Image Card */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      Mặt trước CCCD
                    </span>
                    {cccdFrontImage && (
                      <span className="text-[10px] text-emerald-600 font-semibold">Đã tải ảnh</span>
                    )}
                  </div>

                  <div className="aspect-[1.58/1] w-full rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center relative">
                    {isLoadingCccd ? (
                      <span className="text-xs text-slate-400">Đang tải ảnh bảo mật...</span>
                    ) : cccdFrontImage ? (
                      <>
                        <img src={cccdFrontImage} alt="Mặt trước CCCD" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setCccdFrontImage(undefined)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600 text-white shadow hover:bg-rose-700 transition-colors"
                          title="Xóa ảnh mặt trước"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-3 text-slate-400">
                        <CreditCard className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <span className="text-[11px]">Chưa có ảnh mặt trước</span>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={frontInputRef}
                    accept="image/*"
                    onChange={(e) => handleFileUpload('front', e)}
                    className="hidden"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => frontInputRef.current?.click()}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{cccdFrontImage ? 'Đổi ảnh' : 'Tải ảnh lên'}</span>
                    </button>
                  </div>
                </div>

                {/* Back CCCD Image Card */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      Mặt sau CCCD
                    </span>
                    {cccdBackImage && (
                      <span className="text-[10px] text-emerald-600 font-semibold">Đã tải ảnh</span>
                    )}
                  </div>

                  <div className="aspect-[1.58/1] w-full rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center relative">
                    {isLoadingCccd ? (
                      <span className="text-xs text-slate-400">Đang tải ảnh bảo mật...</span>
                    ) : cccdBackImage ? (
                      <>
                        <img src={cccdBackImage} alt="Mặt sau CCCD" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setCccdBackImage(undefined)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600 text-white shadow hover:bg-rose-700 transition-colors"
                          title="Xóa ảnh mặt sau"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-3 text-slate-400">
                        <CreditCard className="w-6 h-6 mx-auto mb-1 opacity-50" />
                        <span className="text-[11px]">Chưa có ảnh mặt sau</span>
                      </div>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={backInputRef}
                    accept="image/*"
                    onChange={(e) => handleFileUpload('back', e)}
                    className="hidden"
                  />

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => backInputRef.current?.click()}
                      className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{cccdBackImage ? 'Đổi ảnh' : 'Tải ảnh lên'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Thông tin KTX */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 pb-1 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span>3. Vị trí & Trạng thái tại KTX (Tùy chọn)</span>
                <span className="text-[10px] font-normal text-slate-400 capitalize">Không bắt buộc</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                
                {/* Dãy */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Dãy KTX
                  </label>
                  <select
                    value={dorm}
                    onChange={(e) => setDorm(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                  >
                    {Array.from({ length: config.numDorms }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        Dãy {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Phòng */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phòng
                  </label>
                  <select
                    value={room}
                    onChange={(e) => setRoom(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-semibold"
                  >
                    {Array.from({ length: config.roomsPerDorm }, (_, i) => i + 1).map((r) => (
                      <option key={r} value={r}>
                        Phòng {String(r).padStart(2, '0')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Số giường */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số giường (1 - {config.maxBedsPerRoom})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={config.maxBedsPerRoom}
                    value={bed}
                    onChange={(e) => setBed(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Room capacity indicator bar */}
                <div className="sm:col-span-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>
                      Hiện trạng <strong>Phòng {String(room).padStart(2, '0')} (Dãy {dorm})</strong>:
                    </span>
                    <span className={`font-bold ${isRoomFull ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {roomCount} / {config.maxBedsPerRoom} người
                    </span>
                  </div>
                  {isRoomFull && (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Phòng đã đầy!
                    </span>
                  )}
                </div>

                {/* Tổ trưởng */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tổ trưởng quản lý
                  </label>
                  <input
                    type="text"
                    value={teamLeader}
                    onChange={(e) => setTeamLeader(e.target.value)}
                    placeholder="Ví dụ: Phạm Minh Tuấn"
                    className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Trạng thái */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as WorkerStatus)}
                    className={`w-full px-3 py-2 text-sm font-bold rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none ${
                      status === 'Đang ở'
                        ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <option value="Đang ở">Đang ở</option>
                    <option value="Đã rời KTX">Đã rời KTX</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isEditing ? 'Lưu thay đổi' : 'Lưu công nhân'}</span>
              </button>
            </div>

          </form>

          {/* Sub-modal: Duplicate Employee Code Warning & Overwrite Dialog */}
          {duplicateConflictWorker && (
            <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl border border-amber-300 dark:border-amber-700 space-y-4">
                <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-7 h-7 shrink-0" />
                  <h4 className="font-bold text-base text-slate-900 dark:text-white">
                    Mã nhân viên đã tồn tại!
                  </h4>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Mã nhân viên <strong className="font-mono text-blue-600">{duplicateConflictWorker.empCode}</strong> đã được sử dụng cho công nhân sau:
                </p>

                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs space-y-1 border border-slate-200 dark:border-slate-700">
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {duplicateConflictWorker.name}
                  </div>
                  <div>Vị trí: Dãy {duplicateConflictWorker.dorm} - Phòng {String(duplicateConflictWorker.room).padStart(2, '0')} (Giường {duplicateConflictWorker.bed})</div>
                  <div>Trạng thái: {duplicateConflictWorker.status}</div>
                  {duplicateConflictWorker.phone && <div>SĐT: {duplicateConflictWorker.phone}</div>}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bạn có muốn <strong>ghi đè</strong> toàn bộ thông tin bản ghi cũ bằng thông tin mới vừa nhập không?
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setDuplicateConflictWorker(null)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateConflictWorker(null);
                      handleSubmit(undefined, true);
                    }}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-md"
                  >
                    Ghi đè thông tin
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* OCR Scan Modal Integration */}
      <CccdScanModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onScanCompleted={handleOcrDataReceived}
        onErrorToast={onErrorToast}
      />
    </>
  );
};
