import React, { useState } from 'react';
import { X, FileDown, FileSpreadsheet, Building, DoorOpen, CheckCircle } from 'lucide-react';
import { Worker } from '../../types';
import { useDorm } from '../../context/DormContext';
import { exportWorkersToExcel } from '../../utils/helpers';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { workers, config, manager } = useDorm();

  const [exportScope, setExportScope] = useState<'ALL' | 'ACTIVE_ONLY' | 'BY_DORM' | 'BY_ROOM'>('ALL');
  const [selectedDorm, setSelectedDorm] = useState<number>(1);
  const [selectedRoom, setSelectedRoom] = useState<number>(1);

  if (!isOpen) return null;

  const handleExport = () => {
    let targetWorkers: Worker[] = [];
    let scopeName = 'Toan_Bo';

    if (exportScope === 'ALL') {
      targetWorkers = workers;
      scopeName = 'Tat_Ca';
    } else if (exportScope === 'ACTIVE_ONLY') {
      targetWorkers = workers.filter((w) => w.status === 'Đang ở');
      scopeName = 'Dang_O';
    } else if (exportScope === 'BY_DORM') {
      targetWorkers = workers.filter((w) => w.dorm === selectedDorm);
      scopeName = `Day_${selectedDorm}`;
    } else if (exportScope === 'BY_ROOM') {
      targetWorkers = workers.filter((w) => w.dorm === selectedDorm && w.room === selectedRoom);
      scopeName = `Day_${selectedDorm}_Phong_${selectedRoom}`;
    }

    const fileName = `Danh_Sach_KTX_${scopeName}_${new Date().toISOString().split('T')[0]}.xlsx`;

    exportWorkersToExcel(targetWorkers, config, fileName);
    onSuccessToast(`Đã xuất thành công file Excel: ${fileName} (${targetWorkers.length} dòng, 2 Sheet)!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Xuất dữ liệu ra file Excel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tạo file bảng tính 2 Sheet (Chi tiết + Báo cáo tổng hợp)
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
        <div className="p-6 space-y-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Chọn phạm vi dữ liệu xuất:
            </label>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === 'ALL'}
                  onChange={() => setExportScope('ALL')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">Toàn bộ hồ sơ</span>
                  <p className="text-slate-500">Tất cả {workers.length} công nhân (gồm Đang ở & Đã rời KTX)</p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === 'ACTIVE_ONLY'}
                  onChange={() => setExportScope('ACTIVE_ONLY')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">Chỉ công nhân "Đang ở"</span>
                  <p className="text-slate-500">
                    {workers.filter((w) => w.status === 'Đang ở').length} công nhân hiện đang cư trú
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === 'BY_DORM'}
                  onChange={() => setExportScope('BY_DORM')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <span className="font-bold text-slate-900 dark:text-white">Xuất theo Dãy cụ thể</span>
                  {exportScope === 'BY_DORM' && (
                    <div className="mt-2">
                      <select
                        value={selectedDorm}
                        onChange={(e) => setSelectedDorm(Number(e.target.value))}
                        className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        {Array.from({ length: config.numDorms }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            Dãy {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer">
                <input
                  type="radio"
                  name="exportScope"
                  checked={exportScope === 'BY_ROOM'}
                  onChange={() => setExportScope('BY_ROOM')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <span className="font-bold text-slate-900 dark:text-white">Xuất theo Phòng cụ thể</span>
                  {exportScope === 'BY_ROOM' && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <select
                        value={selectedDorm}
                        onChange={(e) => setSelectedDorm(Number(e.target.value))}
                        className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        {Array.from({ length: config.numDorms }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>
                            Dãy {d}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedRoom}
                        onChange={(e) => setSelectedRoom(Number(e.target.value))}
                        className="p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        {Array.from({ length: config.roomsPerDorm }, (_, i) => i + 1).map((r) => (
                          <option key={r} value={r}>
                            Phòng {String(r).padStart(2, '0')}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Cấu trúc file Excel xuất ra:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] space-y-0.5">
              <li><strong>Sheet 1 (Danh sách):</strong> Toàn bộ cột chi tiết, ngày giờ cập nhật, quản lý.</li>
              <li><strong>Sheet 2 (Tổng quan theo dãy):</strong> Số lượng nhân sự, số phòng sử dụng, tỷ lệ %.</li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center gap-2"
          >
            <FileDown className="w-4 h-4" />
            <span>Tải file Excel ngay</span>
          </button>
        </div>

      </div>
    </div>
  );
};
