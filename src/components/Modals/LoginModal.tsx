import React, { useState } from 'react';
import { X, Shield, Lock, Mail, CheckCircle2, User, KeyRound, AlertCircle } from 'lucide-react';
import { useDorm } from '../../context/DormContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
  onErrorToast,
}) => {
  const { login, currentUser } = useDorm();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const res = login(email.trim(), password.trim());
    if (res.success) {
      onSuccessToast(`Đăng nhập thành công! Chào mừng ${res.user?.name}`);
      onClose();
    } else {
      setErrorMsg(res.message);
      onErrorToast(res.message);
    }
  };

  const quickFill = (eMail: string, pass: string) => {
    setEmail(eMail);
    setPassword(pass);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Đăng nhập Hệ thống KTX
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhập tài khoản được cấp quyền để quản lý dữ liệu
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email tài khoản
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Liencp85@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Đăng nhập hệ thống</span>
            </button>
          </form>

          {/* Preset Demo Accounts */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Chọn nhanh tài khoản mẫu:
            </span>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => quickFill('Liencp85@gmail.com', 'admin123')}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>👑 Admin: Khổng Minh Liên</span>
                    <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950 px-1.5 py-0.2 rounded font-mono">
                      Liencp85@gmail.com
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Mật khẩu: admin123 (Toàn quyền hệ thống & phân quyền)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickFill('quanlyktx@company.vn', 'manager123')}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🏢 Quản lý KTX (Lê Văn Quyết)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 px-1.5 py-0.2 rounded font-mono">
                      quanlyktx@company.vn
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Mật khẩu: manager123 (Thêm, sửa, xếp phòng, duyệt ra/vào)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => quickFill('nhanvienxem@company.vn', 'viewer123')}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>👀 Nhân viên xem & tra cứu</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 px-1.5 py-0.2 rounded font-mono">
                      nhanvienxem@company.vn
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">Mật khẩu: viewer123 (Tìm kiếm & xem thông tin)</div>
                </div>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
