import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Link2,
  Copy,
  Check,
  Shield,
  UserCheck,
  Eye,
  Share2,
  KeyRound,
  ArrowRight,
  QrCode,
  Users,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Smartphone,
  Globe,
} from 'lucide-react';
import { useDorm } from '../../context/DormContext';

interface ManagerLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

interface UrlStatus {
  isChecking: boolean;
  checked: boolean;
  httpStatus: number;
  isAvailable: boolean;
  isNotFound: boolean;
  isForbidden: boolean;
  error?: string;
}

export const ManagerLinksModal: React.FC<ManagerLinksModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { users, currentUser, switchUser } = useDorm();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedQrUrl, setSelectedQrUrl] = useState<{ title: string; url: string; badge?: string } | null>(null);

  // Link mode: 'public' (ais-pre / shared) or 'direct' (current origin / dev)
  const isDevHost = typeof window !== 'undefined' && window.location.origin.includes('ais-dev-');
  const [selectedMode, setSelectedMode] = useState<'public' | 'dev' | 'custom'>('public');

  const [customDomain, setCustomDomain] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dorm_custom_share_domain') || '';
    }
    return '';
  });
  const [isEditingDomain, setIsEditingDomain] = useState<boolean>(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState<boolean>(false);

  // Status of the public (ais-pre) link
  const [publicUrlStatus, setPublicUrlStatus] = useState<UrlStatus>({
    isChecking: false,
    checked: false,
    httpStatus: 0,
    isAvailable: false,
    isNotFound: false,
    isForbidden: false,
  });

  // Calculate URLs
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  // Public URL (ais-pre)
  const publicBaseUrl = isDevHost
    ? currentOrigin.replace('ais-dev-', 'ais-pre-') + currentPath
    : `${currentOrigin}${currentPath}`;

  // Dev URL (ais-dev)
  const devBaseUrl = `${currentOrigin}${currentPath}`;

  // Resolve current active baseUrl based on selected mode
  let resolvedBaseUrl = publicBaseUrl;
  if (selectedMode === 'custom' && customDomain.trim()) {
    const cleanCustom = customDomain.trim().replace(/\/+$/, '');
    resolvedBaseUrl = cleanCustom.startsWith('http') ? cleanCustom : `https://${cleanCustom}`;
  } else if (selectedMode === 'dev') {
    resolvedBaseUrl = devBaseUrl;
  } else {
    resolvedBaseUrl = publicBaseUrl;
  }

  const baseUrl = resolvedBaseUrl.replace(/\/+$/, '');

  // Function to test public URL accessibility via backend proxy
  const checkPublicLinkStatus = useCallback(async () => {
    if (!isDevHost) return;
    setPublicUrlStatus((prev) => ({ ...prev, isChecking: true }));
    try {
      const res = await fetch(`/api/check-link-status?url=${encodeURIComponent(publicBaseUrl)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          setPublicUrlStatus({
            isChecking: false,
            checked: true,
            httpStatus: data.httpStatus || 0,
            isAvailable: Boolean(data.isAvailable),
            isNotFound: Boolean(data.isNotFound),
            isForbidden: Boolean(data.isForbidden),
            error: data.error,
          });
        } else {
          setPublicUrlStatus((prev) => ({ ...prev, isChecking: false, checked: true }));
        }
      } else {
        setPublicUrlStatus((prev) => ({ ...prev, isChecking: false, checked: true }));
      }
    } catch {
      setPublicUrlStatus((prev) => ({ ...prev, isChecking: false, checked: true }));
    }
  }, [isDevHost, publicBaseUrl]);

  useEffect(() => {
    if (isOpen && isDevHost) {
      checkPublicLinkStatus();
    }
  }, [isOpen, isDevHost, checkPublicLinkStatus]);

  if (!isOpen) return null;

  const handleSaveCustomDomain = (val: string) => {
    setCustomDomain(val);
    if (typeof window !== 'undefined') {
      if (val.trim()) {
        localStorage.setItem('dorm_custom_share_domain', val.trim());
      } else {
        localStorage.removeItem('dorm_custom_share_domain');
      }
    }
    setIsEditingDomain(false);
    setSelectedMode('custom');
    onSuccessToast('Đã lưu tên miền chia sẻ tùy chỉnh!');
  };

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      if (selectedMode === 'public' && publicUrlStatus.isNotFound) {
        onSuccessToast(`Đã sao chép ${label}! (Lưu ý: Bấm nút 'Share' trên AI Studio để kích hoạt)`);
      } else {
        onSuccessToast(`Đã sao chép ${label}!`);
      }
      setTimeout(() => setCopiedKey(null), 2500);
    });
  };

  const managerUsers = users.filter((u) => u.role === 'manager');

  // Role Portals
  const roleLinks = [
    {
      key: 'portal_manager',
      title: 'Cổng Quản lý KTX (Toàn quyền điều hành)',
      description: 'Dành cho các Quản lý KTX: Toàn quyền thêm mới, sửa hồ sơ, xếp phòng, chuyển phòng, duyệt công nhân ra/vào và quét CCCD.',
      url: `${baseUrl}?portal=manager`,
      icon: UserCheck,
      color: 'emerald',
      badge: 'Cổng Quản lý',
      targetRole: 'manager' as const,
    },
    {
      key: 'portal_admin',
      title: 'Cổng Quản trị Super Admin (Khổng Minh Liên)',
      description: 'Dành cho Admin: Quản lý người dùng, phân quyền tài khoản, chỉnh quy mô số dãy/phòng, sao lưu Cloud và xem nhật ký bảo mật.',
      url: `${baseUrl}?portal=admin`,
      icon: Shield,
      color: 'rose',
      badge: 'Super Admin',
      targetRole: 'admin' as const,
    },
    {
      key: 'portal_viewer',
      title: 'Cổng Nhân viên Tra cứu & Bảo vệ (Chỉ xem)',
      description: 'Dành cho bảo vệ, nhân sự tiếp nhận hoặc tra cứu danh sách phòng, kiểm tra trạng thái cư trú mà không chỉnh sửa dữ liệu.',
      url: `${baseUrl}?portal=viewer`,
      icon: Eye,
      color: 'blue',
      badge: 'Chỉ xem & Tra cứu',
      targetRole: 'viewer' as const,
    },
  ];

  const handleCopyAll = () => {
    const text = `HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ CÔNG NHÂN
Quản trị viên: Khổng Minh Liên
-----------------------------------------
🔗 ĐƯỜNG DẪN CÁC CỔNG TRUY CẬP HỆ THỐNG:
1. 🏢 Cổng Quản lý KTX: ${baseUrl}?portal=manager
2. 🛡️ Cổng Admin Tối cao: ${baseUrl}?portal=admin
3. 👁️ Cổng Tra cứu & Xem: ${baseUrl}?portal=viewer

👉 Mở đường dẫn trên điện thoại hoặc máy tính để đăng nhập và làm việc trực tiếp.`;

    handleCopy(text, 'all_info', 'toàn bộ danh sách các cổng chia sẻ link');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50/50 to-transparent dark:from-emerald-950/40 dark:via-slate-900/50 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Cổng chia sẻ link truy cập cho Quản lý
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  Real-time Portal
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gửi link trực tiếp cho Quản lý hoặc quét mã QR bằng camera điện thoại để làm việc ngay
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

          {/* URL Status & Mode Selector Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                  Chọn loại đường dẫn chia sẻ:
                </span>
                <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('public')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedMode === 'public'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>🌐 Link Công khai (Shared App)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('dev')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedMode === 'dev'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>💻 Link Dev Trực tiếp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMode('custom');
                      setIsEditingDomain(true);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      selectedMode === 'custom'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <span>⚙️ Tên miền riêng</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0"
                >
                  {copiedKey === 'all_info' ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'all_info' ? 'Đã sao chép!' : 'Sao chép tất cả'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  title="Hướng dẫn sửa lỗi không truy cập được"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Live Status Indicator for Public Link */}
            {isDevHost && selectedMode === 'public' && (
              <div className="p-3 rounded-lg border text-xs transition-all">
                {publicUrlStatus.isChecking ? (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Đang kiểm tra kết nối đường link công khai (ais-pre-*)...</span>
                  </div>
                ) : publicUrlStatus.isNotFound ? (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <span className="font-bold">Đường link công khai (ais-pre-*) đang trả về lỗi 404 (Chưa kích hoạt nút Share)</span>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                            Trên Google AI Studio, đường link công khai chỉ hoạt động sau khi bạn nhấn nút <strong className="text-amber-800 dark:text-amber-200">Share</strong> (hoặc <strong className="text-amber-800 dark:text-amber-200">Chia sẻ</strong>) ở góc trên bên phải màn hình.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={checkPublicLinkStatus}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-50 shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Kiểm tra lại</span>
                      </button>
                    </div>

                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-md border border-amber-200 dark:border-amber-800 text-[11px] space-y-1">
                      <div className="font-bold text-amber-900 dark:text-amber-200">
                        👉 Các bước kích hoạt link công khai (1 lần duy nhất):
                      </div>
                      <ol className="list-decimal list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
                        <li>Nhấn nút <strong>Share</strong> (hoặc <strong>Chia sẻ</strong>) màu xanh ở thanh công cụ phía trên góc phải Google AI Studio.</li>
                        <li>Chọn quyền truy cập công khai và bấm Xác nhận / Xuất bản.</li>
                        <li>Quay lại đây và nhấn <strong>&quot;Kiểm tra lại&quot;</strong>, link sẽ hoạt động trên mọi điện thoại & máy tính!</li>
                      </ol>
                    </div>
                  </div>
                ) : publicUrlStatus.isAvailable ? (
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-bold">
                        Đường link công khai đã kích hoạt sẵn sàng (Không bị lỗi 403, không cần đăng nhập Google)!
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={checkPublicLinkStatus}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Kiểm tra lại</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span>Chế độ đường dẫn công khai (Shared link)</span>
                    </div>
                    <button
                      type="button"
                      onClick={checkPublicLinkStatus}
                      className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Kiểm tra trạng thái link
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Dev Mode Notice */}
            {selectedMode === 'dev' && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Đang dùng Link Dev Trực tiếp: </span>
                  <span>Đường dẫn này mở trực tiếp môi trường hiện tại. Phù hợp khi bạn mở trên tab mới hoặc thiết bị có đăng nhập tài khoản Google của bạn. (Nếu người khác mở mà bị lỗi 403, hãy chuyển sang tab Link Công khai).</span>
                </div>
              </div>
            )}

            {/* Custom Domain Input */}
            {selectedMode === 'custom' && (
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 space-y-2 animate-in fade-in duration-150 text-xs">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Tên miền triển khai riêng hoặc Cloud Run URL:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={customDomain}
                    placeholder="https://ktx.congty.vn"
                    id="custom-domain-input"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('custom-domain-input') as HTMLInputElement;
                      if (input) handleSaveCustomDomain(input.value);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
                  >
                    Lưu
                  </button>
                  {customDomain && (
                    <button
                      type="button"
                      onClick={() => handleSaveCustomDomain('')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Active Base URL Bar */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="truncate mr-2">
                <span className="font-sans font-semibold text-slate-700 dark:text-slate-300">Gốc URL đang chọn: </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">{baseUrl}</span>
              </div>
              <a
                href={baseUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-sans text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                <span>Mở thử</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Troubleshooting Accordion if requested */}
          {showTroubleshoot && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 space-y-3 text-xs text-slate-800 dark:text-slate-200 animate-in fade-in duration-150">
              <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Hướng dẫn xử lý lỗi không truy cập được đường link
                </span>
                <button
                  type="button"
                  onClick={() => setShowTroubleshoot(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 leading-relaxed">
                <div>
                  <strong className="text-rose-600 dark:text-rose-400">1. Lỗi 404 (That’s an error. The requested URL was not found):</strong>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">
                    Xảy ra khi bạn gửi link công khai (`ais-pre-*`) nhưng trên Google AI Studio bạn chưa bấm nút <strong>&quot;Share&quot;</strong>. Google Cloud Run chỉ tạo đường dẫn công khai sau khi người tạo bấm nút Share. Hãy bấm nút Share ở góc trên màn hình AI Studio.
                  </p>
                </div>
                <div>
                  <strong className="text-rose-600 dark:text-rose-400">2. Lỗi 403 (You don’t have permission / Yêu cầu đăng nhập Google):</strong>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">
                    Xảy ra khi người nhận mở link `ais-dev-*` (đây là link chỉ dành riêng cho tài khoản Google của người tạo). Để Quản lý mở được, hãy chuyển sang tab <strong>🌐 Link Công khai</strong> sau khi đã bấm Share.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ROLE PORTALS */}
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Đường dẫn các Cổng truy cập theo vai trò</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {roleLinks.map((item) => {
                const Icon = item.icon;
                const isCopied = copiedKey === item.key;
                const isCurrentRole = currentUser?.role === item.targetRole;

                return (
                  <div
                    key={item.key}
                    className={`p-4 rounded-xl border transition-all ${
                      item.color === 'emerald'
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : item.color === 'rose'
                        ? 'border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20'
                        : 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
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
                          <div className="flex items-center gap-2 flex-wrap">
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
                              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                                ✓ Đang sử dụng
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedQrUrl({ title: item.title, url: item.url, badge: item.badge })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors shadow-2xs"
                          title="Mã QR để quét bằng điện thoại"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>Mã QR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy(item.url, item.key, item.title)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors shadow-2xs"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{isCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                        </button>

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors shadow-2xs"
                          title="Mở trong tab mới để kiểm tra"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Mở thử</span>
                        </a>

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
                          <span>Chuyển ngay</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* URL preview box */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white/80 dark:bg-slate-900/60 px-2.5 py-1 rounded-md">
                      <span className="truncate mr-2">{item.url}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold shrink-0">
                        ✓ Tự động đăng nhập
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* REGISTERED MANAGER ACCOUNTS */}
          {managerUsers.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Danh sách tài khoản Quản lý chi tiết ({managerUsers.length} tài khoản)</span>
                </span>
                <span className="text-[11px] text-slate-500">Sao chép link kèm định danh từng quản lý</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
                {managerUsers.map((mgr) => {
                  const personalUrl = `${baseUrl}?portal=manager&user=${mgr.id}&name=${encodeURIComponent(mgr.name)}`;
                  const isCopiedMgr = copiedKey === `mgr_${mgr.id}`;

                  return (
                    <div key={mgr.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{mgr.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            ID: {mgr.id}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                          Email: <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{mgr.email}</span> • Mật khẩu: <span className="font-mono font-semibold">{mgr.password || 'manager123'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => setSelectedQrUrl({ title: `Quản lý: ${mgr.name}`, url: personalUrl, badge: mgr.email })}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-600 dark:text-slate-300"
                          title="Mã QR cá nhân cho quản lý này"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(personalUrl, `mgr_${mgr.id}`, `link cho Quản lý ${mgr.name}`)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 transition-colors border border-emerald-200 dark:border-emerald-800 flex items-center gap-1"
                        >
                          {isCopiedMgr ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{isCopiedMgr ? 'Đã sao chép' : 'Sao chép link'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            switchUser(mgr.id);
                            onSuccessToast(`Đã chuyển sang tài khoản Quản lý: ${mgr.name}`);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 transition-colors"
                        >
                          Đăng nhập ngay
                        </button>
                      </div>
                    </div>
                  );
                })}
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

      {/* QR Code Popup Modal */}
      {selectedQrUrl && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Quét mã QR bằng Camera điện thoại
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQrUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center space-y-3">
              <div className="p-3 bg-white rounded-xl inline-block border-2 border-slate-200 shadow-inner">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(selectedQrUrl.url)}`}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto"
                />
              </div>

              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedQrUrl.title}
                </div>
                {selectedQrUrl.badge && (
                  <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {selectedQrUrl.badge}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Mở camera trên điện thoại (iPhone hoặc Android) và quét mã QR trên để truy cập và làm việc ngay lập tức.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleCopy(selectedQrUrl.url, 'qr_url', selectedQrUrl.title)}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                {copiedKey === 'qr_url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'qr_url' ? 'Đã sao chép' : 'Sao chép link'}</span>
              </button>
              <a
                href={selectedQrUrl.url}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Mở</span>
              </a>
              <button
                type="button"
                onClick={() => setSelectedQrUrl(null)}
                className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


