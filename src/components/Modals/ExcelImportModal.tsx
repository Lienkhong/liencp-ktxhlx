import React, { useState, useRef } from 'react';
import {
  X,
  FileUp,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { Worker } from '../../types';
import { parseWorkersFromExcel } from '../../utils/helpers';
import { useDorm } from '../../context/DormContext';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
  onErrorToast,
}) => {
  const { workers, importWorkers } = useDorm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parsedData, setParsedData] = useState<{
    validWorkers: Partial<Worker>[];
    errors: string[];
    totalRows: number;
    missingPhonesCount: number;
    duplicateEmpCodesCount: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFileSelected = async (file: File) => {
    setFileName(file.name);
    setIsProcessing(true);
    try {
      const result = await parseWorkersFromExcel(file, workers);
      setParsedData(result);
    } catch (err: any) {
      onErrorToast('Lỗi khi đọc file Excel: ' + (err.message || 'Định dạng không hợp lệ'));
      setParsedData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedData || parsedData.validWorkers.length === 0) return;
    const res = await importWorkers(parsedData.validWorkers);
    if (res.success) {
      onSuccessToast(res.message);
      onClose();
    } else {
      onErrorToast(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Nhập danh sách công nhân từ Excel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tự động nhận diện các cột dữ liệu theo mẫu chuẩn
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
        <div className="p-6 space-y-5">
          
          {/* File Drag Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer bg-indigo-50/30 dark:bg-indigo-950/20 transition-all"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f);
              }}
              className="hidden"
            />
            <FileUp className="w-10 h-10 mx-auto text-indigo-600 dark:text-indigo-400 mb-2" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {fileName ? fileName : 'Kéo thả file Excel (.xlsx, .xls) vào đây hoặc bấm để chọn'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hỗ trợ file xuất từ hệ thống KTX, HRM hoặc file bảng tính nội bộ
            </p>
          </div>

          {/* Processing / Results preview */}
          {isProcessing ? (
            <div className="py-6 text-center text-sm font-semibold text-slate-600 dark:text-slate-400">
              Đang phân tích cấu trúc file Excel...
            </div>
          ) : parsedData ? (
            <div className="space-y-4">
              
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {parsedData.totalRows}
                  </div>
                  <div className="text-[11px] text-slate-500">Tổng số dòng</div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {parsedData.validWorkers.length}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Hợp lệ</div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {parsedData.missingPhonesCount}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">Thiếu SĐT</div>
                </div>

                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
                    {parsedData.duplicateEmpCodesCount}
                  </div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-400">Trùng mã NV</div>
                </div>
              </div>

              {/* Errors & Warnings */}
              {parsedData.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                  <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Lưu ý khi nhập dữ liệu ({parsedData.errors.length} cảnh báo):</span>
                  </div>
                  <ul className="list-disc list-inside text-amber-700 dark:text-amber-400 max-h-20 overflow-y-auto">
                    {parsedData.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview table (Top 5 rows) */}
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Xem trước dữ liệu ({Math.min(5, parsedData.validWorkers.length)} dòng đầu tiên):
                </div>
                <div className="max-h-36 overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                  <table className="w-full text-[11px] text-left text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-900 font-semibold">
                      <tr>
                        <th className="p-2">Họ tên</th>
                        <th className="p-2">Mã NV</th>
                        <th className="p-2">Dãy</th>
                        <th className="p-2">Phòng</th>
                        <th className="p-2">Giường</th>
                        <th className="p-2">Trạng thái</th>
                        <th className="p-2">SĐT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {parsedData.validWorkers.slice(0, 5).map((w, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-bold">{w.name}</td>
                          <td className="p-2 font-mono">{w.empCode}</td>
                          <td className="p-2 text-center">{w.dorm}</td>
                          <td className="p-2 text-center">{w.room}</td>
                          <td className="p-2 text-center">{w.bed}</td>
                          <td className="p-2">{w.status}</td>
                          <td className="p-2">{w.phone || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : null}

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
            onClick={handleConfirmImport}
            disabled={!parsedData || parsedData.validWorkers.length === 0}
            className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Xác nhận nhập ({parsedData?.validWorkers.length || 0} công nhân)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
