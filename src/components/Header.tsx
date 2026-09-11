import React, { useState, useRef, useEffect } from 'react';
import {
  Building2,
  UserCheck,
  SearchCode,
  Camera,
  UserPlus,
  Settings,
  Sun,
  Moon,
  LogOut,
  Shield,
  UserCog,
  FileSpreadsheet,
  Database,
  History,
  Link2,
  Smartphone,
  Bot,
  Sparkles,
  ChevronDown,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useDorm } from '../context/DormContext';
import { LeeMascot } from './LeeMascot';

interface HeaderProps {
  onOpenEditManager: () => void;
  onOpenDuplicateChecker: () => void;
  onOpenCccdScan: () => void;
  onOpenAddWorker: () => void;
  onOpenSettings: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal: () => void;
  onOpenBackupModal: () => void;
  onOpenAuditLogs: () => void;
  onOpenUserManagement: () => void;
  onOpenLogin: () => void;
  onOpenManagerLinks: () => void;
  onSwitchToMobile?: () => void;
  onOpenAiAssistant?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenEditManager,
  onOpenDuplicateChecker,
  onOpenCccdScan,
  onOpenAddWorker,
  onOpenSettings,
  onOpenImportModal,
  onOpenExportModal,
  onOpenBackupModal,
  onOpenAuditLogs,
  onOpenUserManagement,
  onOpenLogin,
  onOpenManagerLinks,
  onSwitchToMobile,
  onOpenAiAssistant,
}) => {
  const { manager, currentUser, theme, toggleTheme, logout } = useDorm();
  const [isUtilitiesOpen, setIsUtilitiesOpen] = useState(false);
  const utilitiesRef = useRef<HTMLDivElement>(null);

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  const roleName =
    currentUser?.role === 'admin'
      ? 'Admin'
      : currentUser?.role === 'manager'
      ? 'Quản lý'
      : 'Khách';

  // Close utilities dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (utilitiesRef.current && !utilitiesRef.current.contains(e.target as Node)) {
        setIsUtilitiesOpen(false);
      }
    };
    if (isUtilitiesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUtilitiesOpen]);

  return (
    <header className="sticky top-0 z-40 bg-[#040c24] border-b border-blue-900/50 shadow-lg text-white select-none transition-colors duration-200">
      <div className="max-w-[1680px] mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-16 sm:h-[68px] gap-2 sm:gap-3">
          
          {/* 1. Left: Logo & Title (QUẢN LÝ KÝ TÚC XÁ) */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/40 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white uppercase whitespace-nowrap">
                QUẢN LÝ KÝ TÚC XÁ
              </h1>
              <button
                type="button"
                id="btn-header-manager-name"
                onClick={onOpenEditManager}
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors group cursor-pointer text-left"
                title="Bấm để đổi tên hoặc thông tin người quản lý KTX"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300 shrink-0" />
                <span className="text-slate-400">Quản lý:</span>
                <span className="text-white font-semibold group-hover:underline truncate max-w-[140px] sm:max-w-[200px]">
                  {manager.name}
                </span>
              </button>
            </div>
          </div>

          {/* 2. Action buttons matching template exactly */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 py-1">
            
            {/* [ 📷 CHỤP CCCD ] with glowing cyan border and 3 cyan light rays */}
            <div className="relative flex items-center shrink-0">
              {/* 3 cyan rays pointing outwards to match template */}
              <div className="hidden md:flex flex-col items-end justify-center mr-1.5 space-y-1 select-none pointer-events-none">
                <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full rotate-[-25deg] shadow-[0_0_8px_#22d3ee]" />
                <span className="w-3.5 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
                <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full rotate-[25deg] shadow-[0_0_8px_#22d3ee]" />
              </div>

              <button
                type="button"
                id="btn-header-cccd-scan"
                onClick={onOpenCccdScan}
                className="relative inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white uppercase tracking-wide bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 border-2 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.9),0_0_30px_rgba(37,99,235,0.5)] active:scale-95 transition-all shrink-0"
                title="Chụp ảnh CCCD và OCR tự động điền form"
              >
                <Camera className="w-4 h-4 text-white shrink-0" />
                <span className="font-extrabold whitespace-nowrap">CHỤP CCCD</span>
              </button>
            </div>

            {/* [ ✨ Trợ lý AI Lee ] Button */}
            {onOpenAiAssistant && (
              <button
                type="button"
                id="btn-header-ai-assistant"
                onClick={onOpenAiAssistant}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-teal-600 via-cyan-600 to-teal-700 hover:from-teal-500 hover:to-cyan-500 text-white border border-teal-400/50 shadow-md shadow-teal-900/40 active:scale-95 transition-all shrink-0 whitespace-nowrap"
                title="Mở Trợ lý AI Lee - Ký túc xá Hạ Long Xanh"
              >
                <LeeMascot variant="badge" size={26} className="shrink-0 -my-1 drop-shadow-xs" />
                <span>Trợ lý AI Lee</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              </button>
            )}

            {/* [ 📱 Bản ĐT ] Button */}
            {onSwitchToMobile && (
              <button
                type="button"
                id="btn-header-mobile-view"
                onClick={onSwitchToMobile}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 active:scale-95 transition-all shrink-0 whitespace-nowrap"
                title="Chuyển sang giao diện tối ưu cho Điện thoại"
              >
                <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Bản ĐT</span>
              </button>
            )}

            {/* [ ⚡ Tiện ích KTX ] Dropdown - Preserves ALL functions so none are lost */}
            <div className="relative shrink-0" ref={utilitiesRef}>
              <button
                type="button"
                id="btn-header-utilities"
                onClick={() => setIsUtilitiesOpen(!isUtilitiesOpen)}
                className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all shrink-0 whitespace-nowrap ${
                  isUtilitiesOpen
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                    : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Xem các phím chức năng quản lý: Thêm công nhân, Đường dẫn QL, Trùng mã, Xuất/Nhập Excel..."
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Chức năng</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isUtilitiesOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Utilities Dropdown Menu */}
              {isUtilitiesOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 text-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-1.5 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Phím chức năng hệ thống</span>
                    <span className="text-blue-400 text-[10px]">Đầy đủ</span>
                  </div>

                  <div className="py-1 text-xs">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUtilitiesOpen(false);
                          onOpenAddWorker();
                        }}
                        className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 hover:bg-blue-900/50 text-blue-300 hover:text-blue-200 transition-colors border-b border-slate-800 bg-blue-950/30"
                      >
                        <Plus className="w-4 h-4 text-blue-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white">Thêm công nhân mới</div>
                          <div className="text-[10px] text-blue-300/80">Đăng ký mới hồ sơ vào KTX</div>
                        </div>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsUtilitiesOpen(false);
                        onOpenManagerLinks();
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 transition-colors"
                    >
                      <Link2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold">Đường dẫn Quản lý (Links)</div>
                        <div className="text-[10px] text-slate-400">Bảng link phân quyền dãy phòng</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUtilitiesOpen(false);
                        onOpenDuplicateChecker();
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800 text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      <SearchCode className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold">Kiểm tra trùng mã NV</div>
                        <div className="text-[10px] text-slate-400">Rà soát thẻ/mã bị trùng lặp</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUtilitiesOpen(false);
                        onOpenEditManager();
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800 text-slate-200 hover:text-white transition-colors"
                    >
                      <UserCog className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-semibold">Đổi tên & SĐT Quản lý</div>
                        <div className="text-[10px] text-slate-400">Cập nhật thông tin quản lý KTX</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-slate-800" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsUtilitiesOpen(false);
                        onOpenExportModal();
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-semibold">Xuất dữ liệu Excel</div>
                        <div className="text-[10px] text-slate-400">Tải báo cáo KTX dạng bảng tính</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUtilitiesOpen(false);
                        onOpenImportModal();
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800 text-blue-300 hover:text-blue-200 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <div className="font-semibold">Nhập dữ liệu Excel</div>
                        <div className="text-[10px] text-slate-400">Nạp danh sách công nhân hàng loạt</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUtilitiesOpen(false);
                        onOpenBackupModal();
                      }}
                      className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 transition-colors"
                    >
                      <Database className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="font-semibold">Sao lưu & Phục hồi JSON</div>
                        <div className="text-[10px] text-slate-400">Lưu trữ hoặc khôi phục an toàn</div>
                      </div>
                    </button>

                    {isAdmin && (
                      <>
                        <div className="my-1 border-t border-slate-800" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsUtilitiesOpen(false);
                            onOpenUserManagement();
                          }}
                          className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800 text-purple-300 hover:text-purple-200 transition-colors"
                        >
                          <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                          <div>
                            <div className="font-semibold">Phân quyền tài khoản</div>
                            <div className="text-[10px] text-slate-400">Quản lý tài khoản Admin & Quản lý</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsUtilitiesOpen(false);
                            onOpenAuditLogs();
                          }}
                          className="w-full px-3.5 py-2 text-left flex items-center gap-2.5 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                        >
                          <History className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-semibold">Nhật ký hoạt động</div>
                            <div className="text-[10px] text-slate-400">Xem lịch sử chỉnh sửa hệ thống</div>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* [ ⚙️ ] Settings Button */}
            <button
              type="button"
              id="btn-header-settings"
              onClick={onOpenSettings}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
              title="Cài đặt quy mô KTX & Hệ thống"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* [ 🌙 ] Theme Toggle Button */}
            <button
              type="button"
              id="btn-header-theme-toggle"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
              title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-300" />
              )}
            </button>

            {/* Vertical Divider */}
            <div className="h-6 w-px bg-slate-700/80 mx-1 shrink-0" />

            {/* User Profile / Auth Control matching template */}
            {currentUser ? (
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-left hidden sm:block">
                  <div
                    className="text-xs font-semibold text-white truncate max-w-[120px] lg:max-w-[150px]"
                    title={currentUser.name}
                  >
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    <span>{roleName}</span>
                  </div>
                </div>

                {/* Logout Button */}
                <button
                  type="button"
                  id="btn-header-logout"
                  onClick={logout}
                  className="p-2 rounded-xl text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                  title={`Đăng xuất (${currentUser.email})`}
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="btn-header-login"
                onClick={onOpenLogin}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors shrink-0"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Đăng nhập</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};

