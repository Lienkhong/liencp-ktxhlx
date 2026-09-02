import React, { useState } from 'react';
import {
  X,
  Shield,
  UserPlus,
  Trash2,
  KeyRound,
  UserCheck,
  Eye,
  Lock,
  Mail,
  User,
  Link2,
  Copy,
  Check,
} from 'lucide-react';
import { User as UserType, UserRole } from '../../types';
import { useDorm } from '../../context/DormContext';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
  onErrorToast: (msg: string) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
  onErrorToast,
}) => {
  const { users, addUser, updateUser, deleteUser, currentUser } = useDorm();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('viewer');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '';

  const copyUserLink = (role: UserRole, id: string, name: string) => {
    const link = `${baseUrl}?portal=${role}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      onSuccessToast(`Đã sao chép đường dẫn truy cập cho ${name}!`);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim() || !newName.trim()) {
      onErrorToast('Vui lòng điền đầy đủ email, mật khẩu và họ tên!');
      return;
    }

    const res = await addUser({
      email: newEmail.trim(),
      password: newPassword.trim(),
      name: newName.trim(),
      role: newRole,
    });

    if (res.success) {
      onSuccessToast(res.message);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('viewer');
      setShowAddForm(false);
    } else {
      onErrorToast(res.message);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (email === 'Liencp85@gmail.com') {
      onErrorToast('Không thể xóa tài khoản Quản trị viên tối cao (Super Admin)!');
      return;
    }
    const res = await deleteUser(userId);
    if (res.success) {
      onSuccessToast(res.message);
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
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Quản lý Người dùng & Phân quyền (RBAC)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phân quyền tài khoản: Admin toàn quyền, Quản lý KTX, hoặc Nhân viên xem
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

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {/* Action button */}
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Danh sách tài khoản ({users.length} người dùng)
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Đóng biểu mẫu' : 'Thêm tài khoản mới'}</span>
            </button>
          </div>

          {/* Add User Form */}
          {showAddForm && (
            <form
              onSubmit={handleAddUser}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3 animate-in fade-in duration-150"
            >
              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
                Tạo tài khoản người dùng mới
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email đăng nhập <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@ktx.com"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu khởi tạo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mật khẩu ít nhất 6 ký tự"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Họ và tên người dùng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ví dụ: Hoàng Văn Quản Lý"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vai trò & Quyền hạn <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none font-semibold"
                  >
                    <option value="viewer">Nhân viên xem (Chỉ tìm kiếm/xem)</option>
                    <option value="manager">Quản lý KTX (Thêm/sửa/xóa công nhân, Excel)</option>
                    <option value="admin">Quản trị viên Admin (Toàn quyền hệ thống)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                >
                  Tạo tài khoản ngay
                </button>
              </div>
            </form>
          )}

          {/* Users List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {users.map((u) => {
              const isSuperAdmin = u.email === 'Liencp85@gmail.com';
              const isSelf = u.id === currentUser?.id;

              return (
                <div
                  key={u.id}
                  className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${
                        u.role === 'admin'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : u.role === 'manager'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {u.name}
                        </span>
                        {isSuperAdmin && (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-600 text-white">
                            Super Admin
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            Bạn
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">{u.email}</div>
                    </div>
                  </div>

                  {/* Role Selector & Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => copyUserLink(u.role, u.id, u.name)}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors"
                      title={`Sao chép link truy cập cho ${u.name}`}
                    >
                      {copiedId === u.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <select
                      disabled={isSuperAdmin}
                      value={u.role}
                      onChange={(e) => {
                        updateUser(u.id, { role: e.target.value as UserRole });
                        onSuccessToast(`Đã đổi quyền của ${u.name} thành ${e.target.value}`);
                      }}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                    >
                      <option value="viewer">Xem</option>
                      <option value="manager">Quản lý</option>
                      <option value="admin">Admin</option>
                    </select>

                    {!isSuperAdmin && !isSelf && (
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id, u.email)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                        title="Xóa người dùng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

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
