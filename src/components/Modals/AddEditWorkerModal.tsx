import React, { useState, useEffect } from 'react';
import { X, UserPlus, Save, AlertTriangle, CheckCircle, BedDouble, Building, DoorOpen, ShieldAlert } from 'lucide-react';
import { Worker, WorkerStatus } from '../../types';
import { useDorm } from '../../context/DormContext';
import { normalizeCccdNumber, normalizePersonName, normalizeDateInput } from '../../utils/helpers';

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
  const { workers, config, addWorker, updateWorker, getWorkersInRoom } = useDorm();

  const isEditing = Boolean(workerToEdit);

  // Form State
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [cccd, setCccd] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [note, setNote] = useState('');

  const [dorm, setDorm] = useState<number>(initialDorm);
  const [room, setRoom] = useState<number>(initialRoom);
  const [bed, setBed] = useState<number>(1);
  const [teamLeader, setTeamLeader] = useState('');
  const [status, setStatus] = useState<WorkerStatus>('Đang ở');

  // Overwrite confirmation modal state
  const [duplicateConflictWorker, setDuplicateConflictWorker] = useState<Worker | null>(null);

  // Initialize or populate form
  useEffect(() => {
    if (workerToEdit) {
      setName(workerToEdit.name);
      setDob(workerToEdit.dob || '');
      setEmpCode(workerToEdit.empCode);
      setCccd(workerToEdit.cccd || '');
      setPhone(workerToEdit.phone || '');
      setAddress(workerToEdit.address || '');
      setWorkplace(workerToEdit.workplace || '');
      setNote(workerToEdit.note || '');
      setDorm(workerToEdit.dorm);
      setRoom(workerToEdit.room);
      setBed(workerToEdit.bed || 1);
      setTeamLeader(workerToEdit.teamLeader || '');
      setStatus(workerToEdit.status);
    } else {
      setName('');
      setDob('');
      setEmpCode('');
      setCccd('');
      setPhone('');
      setAddress('');
      setWorkplace('');
      setNote('');
      setDorm(initialDorm);
      setRoom(initialRoom);
      setBed(1);
      setTeamLeader('');
      setStatus('Đang ở');
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

  const handleSubmit = (e?: React.FormEvent, forceOverwrite = false) => {
    if (e) e.preventDefault();

    // Validation
    const cleanName = normalizePersonName(name);
    const cleanEmpCode = empCode.trim().toUpperCase();
    const cleanCccd = normalizeCccdNumber(cccd);

    if (!cleanName) {
      onErrorToast('Vui lòng nhập họ và tên công nhân!');
      return;
    }
    if (!cleanEmpCode) {
      onErrorToast('Vui lòng nhập mã nhân viên!');
      return;
    }

    if (isEditing && workerToEdit) {
      const res = updateWorker(workerToEdit.id, {
        name: cleanName,
        dob: normalizeDateInput(dob),
        empCode: cleanEmpCode,
        cccd: cleanCccd,
        phone: phone.trim(),
        address: address.trim(),
        workplace: workplace.trim(),
        note: note.trim(),
        dorm,
        room,
        bed,
        teamLeader: teamLeader.trim(),
        status,
      });

      if (res.success) {
        onSuccessToast(res.message);
        onClose();
      } else {
        onErrorToast(res.message);
      }
    } else {
      // Add worker
      const res = addWorker(
        {
          name: cleanName,
          dob: normalizeDateInput(dob),
          empCode: cleanEmpCode,
          cccd: cleanCccd,
          phone: phone.trim(),
          address: address.trim(),
          workplace: workplace.trim(),
          note: note.trim(),
          dorm,
          room,
          bed,
          teamLeader: teamLeader.trim(),
          status,
          entryDate: '',
          exitDate: '',
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
                {isEditing ? `Cập nhật thông tin: ${workerToEdit?.name}` : 'Thêm công nhân mới vào KTX'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Điền đầy đủ thông tin cá nhân và vị trí phòng ở trong ký túc xá
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

        {/* Modal Form Body */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-5">
          
          {/* Section 1: Thông tin cá nhân */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 pb-1 border-b border-slate-100 dark:border-slate-700">
              1. Thông tin cá nhân
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Họ và tên */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: NGUYỄN VĂN A"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Mã nhân viên */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mã nhân viên (Mã NV) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value)}
                  placeholder="Ví dụ: NV001"
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
                  Số CCCD / CMND (12 số)
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

              {/* Nơi làm việc / Xưởng */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nơi làm việc / Xưởng / Bộ phận
                </label>
                <input
                  type="text"
                  value={workplace}
                  onChange={(e) => setWorkplace(e.target.value)}
                  placeholder="Ví dụ: Xưởng Ép nhựa 1"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Ghi chú */}
              <div>
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

          {/* Section 2: Thông tin KTX */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-3 pb-1 border-b border-slate-100 dark:border-slate-700">
              2. Vị trí & Trạng thái tại KTX
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Dãy */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dãy KTX <span className="text-rose-500">*</span>
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
                  Phòng <span className="text-rose-500">*</span>
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
                  Trạng thái <span className="text-rose-500">*</span>
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
              <span>{isEditing ? 'Lưu thay đổi' : 'Thêm công nhân'}</span>
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
  );
};
