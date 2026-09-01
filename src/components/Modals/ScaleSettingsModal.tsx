import React, { useState, useRef } from 'react';
import {
  X,
  Sliders,
  CheckCircle,
  Building,
  HardDrive,
  Download,
  Upload,
  Layers,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  FileCode,
  Clock,
} from 'lucide-react';
import { useDorm } from '../../context/DormContext';

interface ScaleSettingsModalProps {
  isOpen: boolean;
  initialTab?: 'scale' | 'backup';
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const ScaleSettingsModal: React.FC<ScaleSettingsModalProps> = ({
  isOpen,
  initialTab = 'scale',
  onClose,
  onSuccessToast,
  onErrorToast,
}) => {
  const {
    config,
    updateConfig,
    workers,
    manager,
    users,
    auditLogs,
    restoreData,
    mergeJsonData,
    autoSaveJsonOnExit,
    setAutoSaveJsonOnExit,
    downloadBackupJson,
    getLatestExitBackup,
  } = useDorm();

  const [activeTab, setActiveTab] = useState<'scale' | 'backup'>(initialTab);

  // Scale states
  const [numDorms, setNumDorms] = useState<number>(config.numDorms);
  const [roomsPerDorm, setRoomsPerDorm] = useState<number>(config.roomsPerDorm);
  const [maxBedsPerRoom, setMaxBedsPerRoom] = useState<number>(config.maxBedsPerRoom);
  const [enableBedManagement, setEnableBedManagement] = useState<boolean>(config.enableBedManagement);

  // Backup & Restore states
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const mergeInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmOverwriteModal, setConfirmOverwriteModal] = useState<{
    backupData: any;
    fileName: string;
  } | null>(null);

  // Sync initial tab when opened
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setNumDorms(config.numDorms);
      setRoomsPerDorm(config.roomsPerDorm);
      setMaxBedsPerRoom(config.maxBedsPerRoom);
      setEnableBedManagement(config.enableBedManagement);
    }
  }, [isOpen, initialTab, config]);

  if (!isOpen) return null;

  const totalRooms = numDorms * roomsPerDorm;
  const maxCapacity = totalRooms * maxBedsPerRoom;
  const latestSnapshot = getLatestExitBackup();

  // Handle Scale Save
  const handleSaveScale = (e: React.FormEvent) => {
    e.preventDefault();

    if (numDorms < 1 || numDorms > 100) {
      onErrorToast('Số dãy phải từ 1 đến 100');
      return;
    }
    if (roomsPerDorm < 1 || roomsPerDorm > 200) {
      onErrorToast('Số phòng mỗi dãy phải từ 1 đến 200');
      return;
    }
    if (maxBedsPerRoom < 1 || maxBedsPerRoom > 200) {
      onErrorToast('Số người tối đa mỗi phòng phải từ 1 đến 200');
      return;
    }

    const outOfBoundsWorkers = workers.filter(
      (w) => w.status === 'Đang ở' && (w.dorm > numDorms || w.room > roomsPerDorm)
    );

    if (outOfBoundsWorkers.length > 0) {
      const sample = outOfBoundsWorkers[0];
      onErrorToast(
        `Không thể thu nhỏ quy mô! Có ${outOfBoundsWorkers.length} công nhân đang ở ngoài phạm vi mới (Ví dụ: ${sample.name} ở Dãy ${sample.dorm} - Phòng ${sample.room}). Vui lòng chuyển phòng cho họ trước.`
      );
      return;
    }

    const res = updateConfig({
      numDorms,
      roomsPerDorm,
      maxBedsPerRoom,
      enableBedManagement,
    });

    if (res.success) {
      onSuccessToast('Đã lưu cấu hình quy mô KTX thành công!');
      onClose();
    } else {
      onErrorToast(res.message);
    }
  };

  // 1. Export Manual JSON Backup
  const handleDownloadBackup = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    downloadBackupJson(`Sao_Luu_KTX_${todayStr}_${Date.now()}.json`);
    onSuccessToast('Đã tải xuống file sao lưu JSON an toàn thành công!');
  };

  // 2. Select file to Restore (with overwrite prompt)
  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.workers || !Array.isArray(parsed.workers)) {
          throw new Error('File JSON không đúng cấu trúc sao lưu của hệ thống KTX');
        }
        setConfirmOverwriteModal({ backupData: parsed, fileName: file.name });
      } catch (err: any) {
        onErrorToast('Lỗi đọc file JSON: ' + (err.message || 'Dữ liệu không hợp lệ'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmRestore = () => {
    if (!confirmOverwriteModal) return;
    const res = restoreData(confirmOverwriteModal.backupData, true);
    if (res.success) {
      onSuccessToast(res.message);
      setConfirmOverwriteModal(null);
      onClose();
    } else {
      onErrorToast(res.message);
    }
  };

  // 3. Multi-file merge
  const handleMergeFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const parsedList: any[] = [];
    for (let i = 0; i < files.length; i++) {
      const text = await files[i].text();
      try {
        const json = JSON.parse(text);
        parsedList.push(json);
      } catch (err) {
        console.warn(`File ${files[i].name} invalid JSON`);
      }
    }

    if (parsedList.length === 0) {
      onErrorToast('Không có file JSON nào hợp lệ để ghép');
      return;
    }

    const res = mergeJsonData(parsedList, 'keep_existing');
    if (res.success) {
      onSuccessToast(`Đã ghép thành công ${parsedList.length} file JSON! Thêm mới: ${res.addedCount}, Cập nhật: ${res.updatedCount}`);
      onClose();
    } else {
      onErrorToast('Lỗi trong quá trình ghép file JSON');
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Cài đặt Hệ thống & Dữ liệu KTX
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tùy chỉnh quy mô, quản lý sao lưu & khôi phục file JSON
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-850 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('scale')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'scale'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>1. Quy mô Ký túc xá</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'backup'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 rounded-t-lg shadow-xs'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-500" />
            <span>2. Sao lưu & Khôi phục (JSON)</span>
            {autoSaveJsonOnExit && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800" title="Tự động lưu khi thoát đang bật" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* TAB 1: SCALE SETTINGS */}
          {activeTab === 'scale' && (
            <form onSubmit={handleSaveScale} className="space-y-5">
              
              {/* Summary Calculation Box */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Tổng số phòng KTX
                  </span>
                  <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
                    {totalRooms} phòng
                  </div>
                  <div className="text-[10px] text-slate-400">({numDorms} dãy × {roomsPerDorm} phòng)</div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Sức chứa tối đa
                  </span>
                  <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {maxCapacity.toLocaleString()} người
                  </div>
                  <div className="text-[10px] text-slate-400">({maxBedsPerRoom} người/phòng)</div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                
                {/* Num Dorms */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Số lượng dãy (1 - 100 dãy)
                    </label>
                    <span className="text-xs font-bold text-blue-600">{numDorms} dãy</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={numDorms}
                    onChange={(e) => setNumDorms(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="mt-1 flex justify-end">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={numDorms}
                      onChange={(e) => setNumDorms(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-xs text-right rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* Rooms per dorm */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Số phòng mỗi dãy (1 - 200 phòng)
                    </label>
                    <span className="text-xs font-bold text-blue-600">{roomsPerDorm} phòng/dãy</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={roomsPerDorm}
                    onChange={(e) => setRoomsPerDorm(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="mt-1 flex justify-end">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={roomsPerDorm}
                      onChange={(e) => setRoomsPerDorm(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-xs text-right rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* Max beds per room */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Sức chứa tối đa mỗi phòng (1 - 200 người/phòng)
                    </label>
                    <span className="text-xs font-bold text-blue-600">{maxBedsPerRoom} người/phòng</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={maxBedsPerRoom}
                    onChange={(e) => setMaxBedsPerRoom(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="mt-1 flex justify-end">
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={maxBedsPerRoom}
                      onChange={(e) => setMaxBedsPerRoom(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-xs text-right rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900"
                    />
                  </div>
                </div>

                {/* Enable bed control */}
                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableBedManagement}
                      onChange={(e) => setEnableBedManagement(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Bật quản lý chi tiết số thứ tự giường của từng công nhân
                    </span>
                  </label>
                </div>

              </div>

              {/* Footer actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Lưu cấu hình quy mô</span>
                </button>
              </div>

            </form>
          )}

          {/* TAB 2: JSON BACKUP & RESTORE & AUTO-SAVE ON EXIT */}
          {activeTab === 'backup' && (
            <div className="space-y-4">

              {/* Auto-Save on Exit Feature Box */}
              <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/30 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-xs shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Tự động sao lưu file JSON khi thoát</span>
                        <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-200 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300">
                          Khuyên dùng
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        Hệ thống sẽ tự động tạo và tải xuống file JSON (.json) đầy đủ dữ liệu khi bạn đóng trình duyệt, chuyển trang hoặc bấm đăng xuất.
                      </p>
                    </div>
                  </div>

                  {/* Switch toggle */}
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input
                      type="checkbox"
                      checked={autoSaveJsonOnExit}
                      onChange={(e) => {
                        setAutoSaveJsonOnExit(e.target.checked);
                        if (e.target.checked) {
                          onSuccessToast('Đã bật tính năng tự động lưu file JSON khi thoát!');
                        } else {
                          onSuccessToast('Đã tắt tính năng tự động lưu file JSON khi thoát');
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Snapshot Status & Quick Download */}
                {latestSnapshot && (
                  <div className="pt-2 border-t border-emerald-200/80 dark:border-emerald-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Bản lưu gần nhất: <strong>{new Date(latestSnapshot.timestamp).toLocaleTimeString('vi-VN')} {new Date(latestSnapshot.timestamp).toLocaleDateString('vi-VN')}</strong> ({latestSnapshot.workersCount} công nhân)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        downloadBackupJson(`Sao_Luu_KTX_Snapshot_${Date.now()}.json`);
                        onSuccessToast('Đã tải xuống bản sao lưu JSON gần nhất!');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors shadow-2xs"
                    >
                      <Download className="w-3 h-3" />
                      <span>Tải bản này về máy</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action 1: Manual Backup Download */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    1. Tải bản sao lưu toàn bộ ngay (Backup JSON)
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Đóng gói {workers.length} hồ sơ, cấu hình phòng, tài khoản và lịch sử vào 1 file duy nhất.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file JSON (.json)</span>
                </button>
              </div>

              {/* Action 2: Restore from file */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    2. Phục hồi từ file sao lưu (Restore JSON)
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nạp lại dữ liệu từ file sao lưu trước đó (hệ thống sẽ yêu cầu xác nhận ghi đè an toàn).
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={restoreInputRef}
                    accept=".json"
                    onChange={handleRestoreFileSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => restoreInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Chọn file phục hồi</span>
                  </button>
                </div>
              </div>

              {/* Action 3: Multi-file JSON merge */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    3. Ghép nhiều file JSON (Merge Multiple JSON)
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Chọn nhiều file sao lưu từ nhiều ca/chi nhánh khác nhau để hợp nhất không bị mất dữ liệu.
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={mergeInputRef}
                    accept=".json"
                    multiple
                    onChange={handleMergeFilesSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => mergeInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Ghép nhiều file</span>
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Đóng
          </button>
        </div>

        {/* Sub-Modal: Confirm Overwrite */}
        {confirmOverwriteModal && (
          <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl border border-rose-300 dark:border-rose-700 space-y-4">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-7 h-7 shrink-0" />
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  Xác nhận Phục hồi dữ liệu?
                </h4>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Bạn đang chuẩn bị phục hồi từ file <strong>{confirmOverwriteModal.fileName}</strong>{' '}
                chứa <strong>{confirmOverwriteModal.backupData.workers?.length || 0}</strong> công nhân.
              </p>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                ⚠️ Thao tác này sẽ <strong>thay thế toàn bộ dữ liệu hiện tại</strong> trong hệ thống.
                Hãy đảm bảo bạn đã tải bản sao lưu hiện tại nếu cần lưu trữ lại!
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setConfirmOverwriteModal(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-md"
                >
                  Đồng ý ghi đè & Phục hồi
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
