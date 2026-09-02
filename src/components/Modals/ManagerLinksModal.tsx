import React, { useState } from 'react';
import {
  X,
  Link2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  UserCheck,
  Eye,
  Camera,
  Users,
  Building,
  Search,
  SearchCode,
  Share2,
  Smartphone,
  KeyRound,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useDorm } from '../../context/DormContext';
import { User } from '../../types';

interface ManagerLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const ManagerLinksModal: React.FC<ManagerLinksModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { users, currentUser, switchUser } = useDorm();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      onSuccessToast(`Đã sao chép ${label}!`);
      setTimeout(() => setCopiedKey(null), 2500);
    });
  };

  const managerUsers = users.filter((u) => u.role === 'manager');

  const linksList = [
    {
      key: 'portal_manager',
      title: 'Đường dẫn Cổng Quản lý KTX (Quyền Quản lý)',
      description: 'Dành cho Quản lý KTX đăng nhập trực tiếp: toàn quyền thêm, sửa, xếp phòng, chuyển phòng, duyệt công nhân ra/vào và quét CCCD.',
      url: `${baseUrl}?portal=manager`,
      icon: UserCheck,
      color: 'emerald',
      badge: 'Dành cho Quản lý',
      targetRole: 'manager' as const,
    },
    {
      key: 'portal_admin',
      title: 'Đường dẫn Quản trị viên Tối cao (Admin - Khổng Minh Liên)',
      description: 'Dành cho Admin: toàn quyền hệ thống, phân quyền người dùng, cấu hình quy mô và lịch sử thao tác.',
      url: `${baseUrl}?portal=admin`,
      icon: Shield,
      color: 'rose',
      badge: 'Super Admin',
      targetRole: 'admin' as const,
    },
    {
      key: 'portal_viewer',
      title: 'Đường dẫn Nhân viên xem & tra cứu (Viewer)',
      description: 'Dành cho bảo vệ, nhân viên tiếp nhận hoặc tra cứu danh sách phòng, xem thông tin và kiểm tra trạng thái.',
      url: `${baseUrl}?portal=viewer`,
      icon: Eye,
      color: 'blue',
      badge: 'Chỉ xem & Tra cứu',
      targetRole: 'viewer' as const,
    },
  ];

  const quickActionLinks = [
    {
      key: 'action_scan',
      title: 'Chụp & Quét CCCD trực tiếp',
      url: `${baseUrl}?action=scan`,
      icon: Camera,
    },
    {
      key: 'action_leaders',
      title: 'Danh sách Tổ trưởng & SĐT gọi ngay',
      url: `${baseUrl}?action=leaders`,
      icon: Users,
    },
    {
      key: 'action_active_rooms',
      title: 'Sơ đồ phòng đang có người ở',
      url: `${baseUrl}?action=active-rooms`,
      icon: Building,
    },
    {
      key: 'action_search',
      title: 'Bộ lọc & Tra cứu nhanh công nhân',
      url: `${baseUrl}?action=search`,
      icon: Search,
    },
  ];

  const handleCopyAll = () => {
    const text = `HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN
Quản trị viên: Khổng Minh Liên
-----------------------------------------
🔗 ĐƯỜNG DẪN TRUY CẬP DÀNH CHO QUẢN LÝ:
👉 Cổng Quản lý KTX: ${baseUrl}?portal=manager
👉 Quét nhanh CCCD tại chỗ: ${baseUrl}?action=scan
👉 Danh sách Tổ trưởng: ${baseUrl}?action=leaders
👉 Tra cứu hồ sơ: ${baseUrl}?action=search

📱 Quản lý chỉ cần mở link trên điện thoại hoặc máy tính để thao tác ngay lập tức.`;

    handleCopy(text, 'all_info', 'toàn bộ thông tin đường dẫn');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50/50 to-transparent dark:from-emerald-950/40 dark:via-slate-900/50 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Đường dẫn truy cập dành cho Quản lý
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  Liên kết trực tiếp
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gửi đường dẫn này cho các Quản lý hoặc mở trên điện thoại để thao tác nhanh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {/* Quick Notice Banner */}
          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-bold text-emerald-900 dark:text-emerald-200">
                  Tài khoản Admin: Khổng Minh Liên
                </span>
                <p className="mt-0.5 text-slate-600 dark:text-slate-400">
                  Bạn có thể sao chép đường dẫn bên dưới gửi qua Zalo/Tin nhắn cho các Quản lý KTX để họ truy cập trực tiếp vào hệ thống.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyAll}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0"
            >
              {copiedKey === 'all_info' ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'all_info' ? 'Đã sao chép!' : 'Sao chép tất cả'}</span>
            </button>
          </div>

          {/* Main Role Access Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Đường dẫn đăng nhập theo vai trò</span>
            </h4>

            <div className="grid grid-cols-1 gap-3">
              {linksList.map((item) => {
                const Icon = item.icon;
                const isCopied = copiedKey === item.key;
                const isCurrentRole = currentUser?.role === item.targetRole;

                return (
                  <div
                    key={item.key}
                    className={`p-4 rounded-xl border transition-all ${
                      item.color === 'emerald'
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : item.color === 'rose'
                        ? 'border-rose-200 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/20'
                        : 'border-blue-200 dark:border-blue-800 bg-blue-50/20 dark:bg-blue-950/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            item.color === 'emerald'
                              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                              : item.color === 'rose'
                              ? 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {item.title}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.color === 'emerald'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                  : item.color === 'rose'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              }`}
                            >
                              {item.badge}
                            </span>
                            {isCurrentRole && (
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                Đang kích hoạt
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.url, item.key, item.title)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors shadow-2xs"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{isCopied ? 'Đã sao chép' : 'Sao chép link'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const found = users.find((u) => u.role === item.targetRole);
                            if (found) {
                              switchUser(found.id);
                              onSuccessToast(`Đã chuyển sang vai trò: ${found.name}`);
                              onClose();
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg text-white transition-colors shadow-2xs ${
                            item.color === 'emerald'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : item.color === 'rose'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                          }`}
                        >
                          <span>Mở ngay</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* URL preview box */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/50 px-2.5 py-1 rounded-md">
                      <span className="truncate mr-2">{item.url}</span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-sans">1 chạm tự đăng nhập</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action Deep Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Đường dẫn nhanh cho Quản lý khi đi kiểm tra thực địa</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {quickActionLinks.map((action) => {
                const ActionIcon = action.icon;
                const isCopied = copiedKey === action.key;

                return (
                  <div
                    key={action.key}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 flex items-center justify-between gap-2 hover:border-blue-400 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ActionIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {action.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(action.url, action.key, action.title)}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shrink-0"
                      title="Sao chép đường dẫn"
                    >
                      {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Registered Manager Accounts */}
          {managerUsers.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tài khoản Quản lý hiện có trong hệ thống ({managerUsers.length} tài khoản)
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                {managerUsers.map((mgr) => (
                  <div key={mgr.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {mgr.name}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                        Email: <span className="font-mono text-slate-700 dark:text-slate-300">{mgr.email}</span> • MK: <span className="font-mono">{mgr.password || '******'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        switchUser(mgr.id);
                        onSuccessToast(`Đã chuyển sang tài khoản Quản lý: ${mgr.name}`);
                        onClose();
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 transition-colors border border-emerald-200 dark:border-emerald-800"
                    >
                      Đăng nhập nhanh
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Hệ thống Quản lý Ký túc xá Công nhân • Admin: Khổng Minh Liên
          </span>
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
