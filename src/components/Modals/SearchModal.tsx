import React, { useState, useMemo } from 'react';
import { Search, X, User, Phone, CreditCard, Building, DoorOpen, ArrowRight, UserCheck } from 'lucide-react';
import { Worker } from '../../types';
import { useDorm } from '../../context/DormContext';
import { matchesVietnameseSearch } from '../../utils/vietnamese';
import { formatDateDisplay } from '../../utils/helpers';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorker: (worker: Worker) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelectWorker }) => {
  const { workers } = useDorm();
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return workers.filter((worker) => {
      const matchName = matchesVietnameseSearch(worker.name, query);
      const matchCode = matchesVietnameseSearch(worker.empCode, query);
      const matchPhone = worker.phone && worker.phone.includes(query.trim());
      const matchCccd = worker.cccd && worker.cccd.includes(query.trim());
      const matchAddress = matchesVietnameseSearch(worker.address, query);
      return matchName || matchCode || matchPhone || matchCccd || matchAddress;
    });
  }, [workers, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 pt-16 sm:pt-24 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Input Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo Họ tên, Mã NV, SĐT, CCCD... (Ví dụ: Nguyen Van A -> NGUYỄN VĂN A)"
            className="w-full bg-transparent text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-700/60">
          {query.trim() === '' ? (
            <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
              Nhập từ khóa tìm kiếm (hỗ trợ tiếng Việt không dấu, chữ hoa/thường).
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
              Không tìm thấy công nhân nào khớp với "<strong>{query}</strong>"
            </div>
          ) : (
            searchResults.map((worker) => (
              <div
                key={worker.id}
                onClick={() => {
                  onSelectWorker(worker);
                  onClose();
                }}
                className="py-3 px-2 flex items-center justify-between hover:bg-blue-50/60 dark:hover:bg-blue-950/40 rounded-lg cursor-pointer transition-colors group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {worker.name}
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      {worker.empCode}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
                        worker.status === 'Đang ở'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {worker.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      Dãy {worker.dorm} - Phòng {String(worker.room).padStart(2, '0')} (G.{worker.bed || 1})
                    </span>
                    {worker.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {worker.phone}
                      </span>
                    )}
                    {worker.cccd && (
                      <span className="flex items-center gap-1 font-mono">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        {worker.cccd}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform pl-3">
                  <span>Chi tiết</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Tìm thấy <strong>{searchResults.length}</strong> kết quả</span>
          <span>Nhấn ESC để đóng</span>
        </div>

      </div>
    </div>
  );
};
