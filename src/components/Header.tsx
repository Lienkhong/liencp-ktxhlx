import React from 'react';
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
  Users,
  Link2,
  Smartphone,
} from 'lucide-react';
import { useDorm } from '../context/DormContext';

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
}) => {
  const { manager, currentUser, theme, toggleTheme, logout } = useDorm();

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  const roleName =
    currentUser?.role === 'admin'
      ? 'Admin'
      : currentUser?.role === 'manager'
      ? 'Quản lý KTX'
      : 'Xem & Tìm kiếm';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Main Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase truncate">
                QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Quản lý: <strong className="text-slate-900 dark:text-white">{manager.name}</strong>
                </span>
                {currentUser?.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                    <Shield className="w-2.5 h-2.5" />
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Bar */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            
            {/* Quick Actions (Desktop & Tablet) */}
            <div className="hidden lg:flex items-center gap-1.5 mr-1 border-r border-slate-200 dark:border-slate-800 pr-2">
              <button
                type="button"
                id="btn-header-manager-links"
                onClick={onOpenManagerLinks}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors"
                title="Mở bảng đường dẫn truy cập dành cho các Quản lý"
              >
                <Link2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Đường dẫn QL</span>
              </button>

              <button
                type="button"
                id="btn-header-edit-manager"
                onClick={onOpenEditManager}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Đổi tên hoặc số điện thoại người quản lý"
              >
                <UserCog className="w-3.5 h-3.5 text-slate-500" />
                <span>Đổi tên QL</span>
              </button>

              <button
                type="button"
                id="btn-header-check-duplicate"
                onClick={onOpenDuplicateChecker}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Quét toàn bộ danh sách kiểm tra trùng mã nhân viên"
              >
                <SearchCode className="w-3.5 h-3.5 text-amber-500" />
                <span>Kiểm tra trùng mã</span>
              </button>

              <button
                type="button"
                id="btn-header-cccd-scan"
                onClick={onOpenCccdScan}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 transition-colors"
                title="Chụp ảnh CCCD và OCR tự động điền form"
              >
                <Camera className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Chụp CCCD</span>
              </button>
            </div>

            {/* Add Worker Button */}
            {canEdit && (
              <button
                type="button"
                id="btn-header-add-worker"
                onClick={onOpenAddWorker}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow transition-all"
                title="Thêm mới hồ sơ công nhân vào KTX"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Thêm công nhân</span>
                <span className="sm:hidden">Thêm</span>
              </button>
            )}

            {/* Switch to Mobile View Button */}
            {onSwitchToMobile && (
              <button
                type="button"
                id="btn-header-mobile-view"
                onClick={onSwitchToMobile}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition-all shadow-2xs"
                title="Chuyển sang giao diện tối ưu cho Điện thoại"
              >
                <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Bản ĐT</span>
              </button>
            )}

            {/* Settings Button */}
            <button
              type="button"
              id="btn-header-settings"
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Cài đặt quy mô KTX & Hệ thống"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Theme Toggle Button */}
            <button
              type="button"
              id="btn-header-theme-toggle"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* User Profile / Auth Control */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden md:block text-right">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        currentUser.role === 'admin'
                          ? 'bg-rose-500'
                          : currentUser.role === 'manager'
                          ? 'bg-emerald-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    {roleName}
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-header-logout"
                  onClick={logout}
                  className="p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors"
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
