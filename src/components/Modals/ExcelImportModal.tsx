import React, { useState, useRef } from 'react';
import {
  X,
  FileUp,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Worker, ImportPreviewRow } from '../../types';
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
  const { workers, importWorkers, config } = useDorm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetDorm, setTargetDorm] = useState<number>(1);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState<boolean>(true);

  const [parsedData, setParsedData] = useState<{
    validWorkers: Partial<Worker>[];
    previewRows: ImportPreviewRow[];
    errors: string[];
    totalRows: number;
    missingPhonesCount: number;
    duplicateEmpCodesCount: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const processFile = async (file: File, dormNum: number) => {
    setIsProcessing(true);
    try {
      const result = await parseWorkersFromExcel(file, workers, config, dormNum);
      setParsedData(result);
    } catch (err: any) {
      onErrorToast('Lỗi khi đọc file Excel: ' + (err.message || 'Định dạng không hợp lệ'));
      setParsedData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelected = async (file: File) => {
    setSelectedFile(file);
    setFileName(file.name);
    await processFile(file, targetDorm);
  };

  const handleTargetDormChange = async (dormNum: number) => {
    setTargetDorm(dormNum);
    if (selectedFile) {
      await processFile(selectedFile, dormNum);
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
    setIsProcessing(true);
    try {
      const res = await importWorkers(
        parsedData.previewRows || (parsedData.validWorkers as any),
        overwriteDuplicates,
        fileName,
        targetDorm
      );
      if (res.success) {
        onSuccessToast(
          `Đã nhập thành công ${res.importedCount} công nhân mới${res.updatedCount > 0 ? `, cập nhật ${res.updatedCount} công nhân` : ''}!`
        );
        onClose();
      } else {
        onErrorToast(res.message || 'Có lỗi xảy ra trong quá trình nhập dữ liệu.');
      }
    } catch (e: any) {
      onErrorToast('Lỗi khi nhập dữ liệu: ' + (e.message || 'Thất bại'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Nhập danh sách công nhân từ Excel
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhận diện chính xác: Họ tên, Ngày sinh, Mã NV, CCCD, Xã Tỉnh, SĐT, Tổ đội (Tên tổ trưởng)
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Top Controls: File upload & Dorm selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* File Drag Drop Zone (2 cols) */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="md:col-span-2 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-5 text-center cursor-pointer bg-indigo-50/30 dark:bg-indigo-950/20 transition-all flex flex-col items-center justify-center min-h-[110px]"
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
              <FileUp className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-1.5" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate max-w-full px-2">
                {fileName ? fileName : 'Kéo thả file Excel (.xlsx, .xls) vào đây hoặc bấm để chọn'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hỗ trợ cả file mẫu nội bộ, có cột con Xã/Tỉnh hoặc dấu nháy kép (&quot;) ở Tổ đội
              </p>
            </div>

            {/* Target Dorm & Settings (1 col) */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Dãy KTX tiếp nhận (nếu file không có cột Dãy):</span>
                </label>
                <select
                  value={targetDorm}
                  onChange={(e) => handleTargetDormChange(Number(e.target.value))}
                  className="w-full text-xs font-semibold py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Array.from({ length: config.numDorms }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Dãy {d}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Hệ thống tự động xếp vào các phòng và giường còn trống trong dãy.
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={overwriteDuplicates}
                    onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span>Cập nhật thông tin nếu trùng Mã NV</span>
                </label>
              </div>
            </div>

          </div>

          {/* Processing / Results preview */}
          {isProcessing ? (
            <div className="py-10 text-center text-sm font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Đang phân tích cấu trúc cột và dữ liệu Excel...</span>
            </div>
          ) : parsedData ? (
            <div className="space-y-4">
              
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {parsedData.totalRows}
                  </div>
                  <div className="text-[11px] text-slate-500">Tổng số dòng đọc được</div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {parsedData.validWorkers.length}
                  </div>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Hợp lệ để nhập</div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {parsedData.missingPhonesCount}
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">Chưa có số ĐT</div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {parsedData.duplicateEmpCodesCount}
                  </div>
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-400">Trùng mã NV (cập nhật)</div>
                </div>
              </div>

              {/* Errors & Warnings */}
              {parsedData.errors.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs space-y-1">
                  <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Chi tiết lưu ý dữ liệu ({parsedData.errors.length} dòng):</span>
                  </div>
                  <ul className="list-disc list-inside text-amber-700 dark:text-amber-400 max-h-20 overflow-y-auto space-y-0.5">
                    {parsedData.errors.slice(0, 6).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {parsedData.errors.length > 6 && (
                      <li className="italic">Và {parsedData.errors.length - 6} lưu ý khác...</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Recognized Fields Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span>Xem trước các trường đã nhận diện ({parsedData.previewRows.length} công nhân):</span>
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Đã chuẩn hóa Họ tên, Ngày sinh, CCCD, Xã Tỉnh, Tổ đội
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl shadow-inner">
                  <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-900 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2.5 text-center">STT</th>
                        <th className="p-2.5">Họ và tên</th>
                        <th className="p-2.5 text-center">Ngày sinh</th>
                        <th className="p-2.5 text-center">Giới tính</th>
                        <th className="p-2.5 font-mono">Mã NV</th>
                        <th className="p-2.5 font-mono">Số CCCD</th>
                        <th className="p-2.5">Quê quán (Xã, Tỉnh)</th>
                        <th className="p-2.5 font-mono">Số ĐT</th>
                        <th className="p-2.5 font-semibold text-indigo-600 dark:text-indigo-400">Tổ đội (Tổ trưởng)</th>
                        <th className="p-2.5 text-center bg-indigo-50/70 dark:bg-indigo-950/40">Phòng &amp; Giường</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {parsedData.previewRows.map((r, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/40 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="p-2.5 text-center text-slate-400 font-mono">{r.stt || idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{r.name}</td>
                          <td className="p-2.5 text-center font-mono">{r.dob || '-'}</td>
                          <td className="p-2.5 text-center">{r.gender || '-'}</td>
                          <td className="p-2.5 font-mono font-medium text-slate-800 dark:text-slate-200">{r.empCode}</td>
                          <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">{r.cccd || '-'}</td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300 max-w-[180px] truncate" title={r.hometown || r.address}>
                            {r.hometown || r.address || '-'}
                          </td>
                          <td className="p-2.5 font-mono">{r.phone || '-'}</td>
                          <td className="p-2.5 font-medium text-indigo-600 dark:text-indigo-400">
                            {r.teamLeader || '-'}
                          </td>
                          <td className="p-2.5 text-center font-bold bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300">
                            Dãy {r.dorm} - P.{r.room} - G.{r.bed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Quy chuẩn nhận diện thông minh đã kích hoạt:</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span><b>Họ và tên:</b> Cột Họ tên, Họ và tên, Tên công nhân</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span><b>Ngày sinh:</b> Cột Ngày sinh, Ngày tháng năm sinh (17-4-1972)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span><b>Mã nhân viên:</b> Mã NV, Mã nhân viên</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span><b>Số CCCD:</b> Tự động bù số 0 nếu Excel bỏ mất (0420...)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span><b>Xã, Tỉnh:</b> Nhận dạng gộp cột con Xã &amp; Tỉnh dưới Hộ khẩu</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span><b>Số điện thoại:</b> Tự động bù số 0 (036..., 097...)</span>
                </li>
                <li className="flex items-center gap-1.5 sm:col-span-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span><b>Tổ đội (Tổ trưởng):</b> Tự động sao chép tên tổ trưởng cho các dòng có dấu nháy kép (&quot;) hoặc khoảng trống</span>
                </li>
              </ul>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {parsedData ? `Sẵn sàng nhập ${parsedData.validWorkers.length} hồ sơ vào hệ thống Cloud` : 'Vui lòng chọn file Excel để xem trước'}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Hủy
            </button>
            
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!parsedData || parsedData.validWorkers.length === 0 || isProcessing}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 transition-all"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang nhập...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận nhập ({parsedData?.validWorkers.length || 0} công nhân)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

