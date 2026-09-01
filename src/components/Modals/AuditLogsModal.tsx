import React, { useState, useMemo } from 'react';
import { X, History, Search, Filter, Shield, User, Clock } from 'lucide-react';
import { useDorm } from '../../context/DormContext';
import { formatDateTimeDisplay } from '../../utils/helpers';

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({ isOpen, onClose }) => {
  const { auditLogs } = useDorm();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const mDetails = log.details.toLowerCase().includes(q);
        const mUser = log.userName.toLowerCase().includes(q) || log.userEmail.toLowerCase().includes(q);
        return mDetails || mUser;
      }
      return true;
    });
  }, [auditLogs, searchTerm, actionFilter]);

  if (!isOpen) return null;

  const actionTypes = Array.from(new Set(auditLogs.map((l) => l.action)));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Nhật ký hoạt động hệ thống (Audit Logs)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ghi nhận chi tiết mọi thao tác thêm, sửa, xóa, nhập/xuất và cập nhật KTX
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

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo nội dung, người thực hiện..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full py-1.5 px-3 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
            >
              <option value="ALL">Tất cả hành động ({actionTypes.length})</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Log Timeline */}
        <div className="p-6 max-h-[50vh] overflow-y-auto space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Không có dữ liệu nhật ký phù hợp.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/30 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                    {log.action}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateTimeDisplay(log.timestamp)}
                  </span>
                </div>

                <p className="text-slate-700 dark:text-slate-300 font-medium pt-1">
                  {log.details}
                </p>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Thực hiện bởi: <strong>{log.userName}</strong> ({log.userEmail})</span>
                </div>
              </div>
            ))
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
