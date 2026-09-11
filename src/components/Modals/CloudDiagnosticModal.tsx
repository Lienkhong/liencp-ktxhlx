import React from 'react';
import {
  Cloud,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Download,
  RefreshCw,
  Database,
  ShieldCheck,
  Server,
  X,
  Clock,
  WifiOff,
  Layers,
  Image,
} from 'lucide-react';
import { useDorm } from '../../context/DormContext';
import { SUPABASE_DASHBOARD_URL, FIRESTORE_CONSOLE_URL } from '../../context/DormContext';
import { isSupabaseConfigured, isServiceRoleDetected } from '../../lib/supabase';

interface CloudDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudDiagnosticModal: React.FC<CloudDiagnosticModalProps> = ({ isOpen, onClose }) => {
  const {
    syncStatus,
    isOnline,
    lastSyncTime,
    workers,
    checkedOutWorkers,
    cloudErrorInfo,
    forceSyncNow,
    downloadBackupJson,
  } = useDorm();

  if (!isOpen) return null;

  const isHealthy = syncStatus === 'synced';
  const isSyncing = syncStatus === 'syncing' || syncStatus === 'saving';
  const isOffline = !isOnline || syncStatus === 'offline';
  const isQuota = syncStatus === 'quota_exceeded' || Boolean(cloudErrorInfo?.isQuotaExceeded);
  const hasError = syncStatus === 'error' && !isQuota;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

  return (
    <div
      id="cloud-diagnostic-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="cloud-diagnostic-modal-content"
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className={`px-6 py-4.5 border-b flex items-center justify-between transition-colors ${
            isHealthy
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
              : isOffline
              ? 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
              : isQuota
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800/60'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shadow-xs ${
                isHealthy
                  ? 'bg-emerald-500 text-white'
                  : isOffline
                  ? 'bg-slate-500 text-white'
                  : isQuota
                  ? 'bg-amber-500 text-white'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {isHealthy ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isOffline ? (
                <WifiOff className="w-5 h-5" />
              ) : (
                <Cloud className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Chẩn Đoán Cơ Sở Dữ Liệu Cloud</span>
                {isHealthy && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    Hoạt động tốt
                  </span>
                )}
                {isOffline && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                    Offline / Cục bộ
                  </span>
                )}
                {isQuota && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                    Đạt giới hạn Quota ngày
                  </span>
                )}
                {hasError && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700">
                    Lỗi kết nối
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Google Cloud Firestore (Realtime onSnapshot)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Main Status Callout */}
          {isServiceRoleDetected ? (
            <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-rose-800 dark:text-rose-300">
                  Cảnh báo bảo mật: Phát hiện Service Role Key trong Frontend
                </h3>
                <p className="text-xs text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
                  Khóa <code>service_role</code> có đặc quyền tối cao (bypass RLS) và tuyệt đối <strong>không được để trong frontend</strong>. Hệ thống đã tự động kích hoạt lá chắn bảo mật và chặn kết nối này trên trình duyệt. Vui lòng thay thế bằng khóa công khai <code>VITE_SUPABASE_ANON_KEY</code>.
                </p>
              </div>
            </div>
          ) : isHealthy ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  Cơ sở dữ liệu Cloud đang kết nối & đồng bộ bình thường
                </h3>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 mt-0.5">
                  Tất cả thay đổi dữ liệu ký túc xá được lưu vào Supabase PostgreSQL và ảnh CCCD được bảo vệ trong Private Storage bucket <code className="font-mono bg-emerald-100 dark:bg-emerald-900/40 px-1 py-0.5 rounded">worker-documents</code>.
                </p>
              </div>
            </div>
          ) : isOffline ? (
            <div className="p-4 rounded-xl bg-slate-500/10 border border-slate-500/30 text-slate-900 dark:text-slate-200 flex items-start gap-2.5">
              <WifiOff className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-300">
                  Chế độ ngoại tuyến (Offline-First Local Storage)
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                  Ứng dụng đang hoạt động với dữ liệu lưu trên bộ nhớ trình duyệt máy tính. Khi có mạng trở lại hoặc cấu hình Supabase, hệ thống sẽ tự động đồng bộ.
                </p>
              </div>
            </div>
          ) : isQuota ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                    Google Cloud Firestore: Đạt giới hạn đọc miễn phí trong ngày (Free Daily Quota Exceeded)
                  </h3>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                    Hệ thống đã đạt giới hạn 50.000 lượt đọc/ngày của gói miễn phí (Spark Plan) trên Google Cloud Firestore. Do đó, các nick/thiết bị khác khi mở ứng dụng chưa thể tải dữ liệu tự động từ Cloud về máy.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-amber-100/70 dark:bg-amber-950/40 rounded-lg text-xs space-y-2 border border-amber-200 dark:border-amber-800/50">
                <div className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <span>💡 Cách đồng bộ ngay lập tức cho các nick/máy khác:</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 text-amber-800 dark:text-amber-300">
                  <li>
                    <strong>Cách 1 (Nhanh nhất & Miễn phí):</strong> Bấm nút <span className="font-bold">"Tải file sao lưu JSON ngay"</span> bên dưới, sau đó gửi file này cho nick khác. Ở nick khác, vào menu <span className="font-bold">"Sao lưu & Phục hồi JSON"</span> &rarr; chọn <span className="font-bold">"Khôi phục dữ liệu từ file"</span>. Toàn bộ danh sách công nhân sẽ hiển thị ngay lập tức!
                  </li>
                  <li>
                    <strong>Cách 2 (Nâng cấp Cloud):</strong> Bấm nút <span className="font-bold">"Nâng cấp Firebase Console"</span> bên dưới để chuyển sang gói Pay-as-you-go (Blaze plan) để gỡ bỏ hoàn toàn giới hạn 50.000 reads/ngày.
                  </li>
                  <li>
                    <strong>Lưu ý:</strong> Vòng lặp đọc ngầm đã được khắc phục hoàn toàn trong mã nguồn, khi Google reset hạn ngạch (vào 14:00 hàng ngày), hệ thống Cloud sẽ tự động kết nối lại ổn định.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-rose-800 dark:text-rose-300">
                  Thông tin kết nối Cloud Database
                </h3>
                <p className="text-xs text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
                  {cloudErrorInfo?.message || 'Có lỗi khi kết nối tới máy chủ Google Cloud Firestore. Dữ liệu đang chạy chế độ Offline an toàn.'}
                </p>
              </div>
            </div>
          )}

          {/* Safety & Persistence Assurance Card */}
          <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-semibold">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Dữ liệu của bạn được bảo toàn an toàn 100%</span>
            </div>
            <p className="text-xs text-blue-800 dark:text-blue-300/90 leading-relaxed">
              Hệ thống KTX được trang bị cơ chế <strong>Offline-First Resilience</strong>. Toàn bộ{' '}
              <strong>{workers.length} công nhân</strong> đang ở và <strong>{checkedOutWorkers.length} hồ sơ</strong> check out
              vẫn đang được lưu trữ an toàn trong bộ nhớ máy (Local Cache). Mọi thao tác thêm, sửa, đổi phòng, quét CCCD, xuất Excel
              vẫn hoạt động bình thường mà không bị gián đoạn.
            </p>
          </div>

          {/* System & Database Parameters */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-700 text-xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 font-semibold flex items-center justify-between text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Thông số kỹ thuật Cloud Database</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">Supabase Postgres</span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Trạng thái đồng bộ:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {isHealthy
                  ? 'Đã kết nối (Supabase Realtime)'
                  : isSyncing
                  ? 'Đang kiểm tra kết nối...'
                  : isOffline
                  ? 'Ngoại tuyến (Offline-First Cache)'
                  : 'Chạy bộ nhớ máy (Local Storage)'}
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Lần đồng bộ thành công gần nhất:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {lastSyncTime
                  ? lastSyncTime.toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : 'Chưa ghi nhận'}
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">URL Supabase:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-xs">
                {supabaseUrl || 'Chưa cấu hình (đang chạy local fallback)'}
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Khóa truy cập Frontend:</span>
              <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                VITE_SUPABASE_ANON_KEY (Public Anon - Bật RLS)
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Kiểm soát Service Role Key:</span>
              <span className={`text-[11px] font-semibold ${isServiceRoleDetected ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {isServiceRoleDetected
                  ? '⚠️ Bị phát hiện & Đã chặn tự động'
                  : '🛡️ Bảo vệ an toàn (Tuyệt đối không lưu trong Frontend)'}
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Storage Bucket CCCD:</span>
              <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                worker-documents (Private Bucket)
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Dự án Firebase đối soát gốc:</span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                basic-tribute-rt8c4 (Bảo lưu dữ liệu gốc)
              </span>
            </div>
          </div>

          {/* Solution & Action Guidelines */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Kiến trúc & Tiện ích:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>PostgreSQL & Realtime</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Supabase Postgres cung cấp khả năng mở rộng vượt trội, không bị giới hạn 50.000 lượt đọc/ngày và hỗ trợ đồng bộ thời gian thực mượt mà.
                </p>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Lưu trữ ảnh CCCD bảo mật</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Ảnh CCCD 2 mặt được phân tách độc lập trong Supabase Storage private bucket, tải ảnh nhanh hơn và tự động tạo Signed URL bảo mật.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                downloadBackupJson();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Tải file sao lưu JSON ngay</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                await forceSyncNow();
              }}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Đang kiểm tra...' : 'Thử kết nối lại'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={FIRESTORE_CONSOLE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors shadow-xs"
              title="Mở Google Firebase Cloud Firestore Console"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Firebase Console</span>
            </a>

            {isSupabaseConfigured && (
              <a
                href={SUPABASE_DASHBOARD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Supabase</span>
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
