import React, { useState, useMemo } from 'react';
import {
  X,
  UserCheck,
  Building,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  Check,
  Phone,
  PhoneCall,
  Edit2,
  Briefcase,
  DoorClosed,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { useDorm } from '../../context/DormContext';
import { matchesVietnameseSearch } from '../../utils/vietnamese';
import { TeamLeaderSummary } from '../../types';
import * as XLSX from 'xlsx';

interface TeamLeadersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom?: (dorm: number, room: number) => void;
}

export const TeamLeadersModal: React.FC<TeamLeadersModalProps> = ({
  isOpen,
  onClose,
  onSelectRoom,
}) => {
  const { getTeamLeadersSummary, config, workers, updateTeamLeaderPhone } = useDorm();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDormFilter, setSelectedDormFilter] = useState<string>('ALL');
  const [expandedLeaders, setExpandedLeaders] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [editingPhoneLeader, setEditingPhoneLeader] = useState<string | null>(null);
  const [tempPhone, setTempPhone] = useState('');

  const teamLeadersList = useMemo(() => {
    if (!isOpen) return [];
    return getTeamLeadersSummary();
  }, [isOpen, getTeamLeadersSummary, workers]);

  // Filter leaders by search term and dorm
  const filteredLeaders = useMemo(() => {
    return teamLeadersList.filter((leader) => {
      // Dorm filter
      if (selectedDormFilter !== 'ALL') {
        const dormNum = Number(selectedDormFilter);
        const hasDorm =
          leader.primaryDorm === dormNum ||
          leader.rooms.some((r) => r.dorm === dormNum);
        if (!hasDorm) return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const matchName = matchesVietnameseSearch(leader.name, searchTerm);
        const matchPhone = leader.contactPhone && leader.contactPhone.includes(searchTerm);
        const matchWorkplace = leader.workplaces.some((wp) =>
          matchesVietnameseSearch(wp, searchTerm)
        );
        const matchRoom =
          (leader.primaryDorm && leader.primaryRoom && `dãy ${leader.primaryDorm} phòng ${leader.primaryRoom} p.${leader.primaryRoom}`.toLowerCase().includes(searchTerm.toLowerCase())) ||
          leader.rooms.some((r) =>
            `dãy ${r.dorm} phòng ${r.room} p.${r.room}`.toLowerCase().includes(searchTerm.toLowerCase())
          );
        const matchWorker = leader.workers.some((w) =>
          matchesVietnameseSearch(w.name, searchTerm) || matchesVietnameseSearch(w.empCode, searchTerm)
        );

        if (!matchName && !matchPhone && !matchWorkplace && !matchRoom && !matchWorker) {
          return false;
        }
      }

      return true;
    });
  }, [teamLeadersList, searchTerm, selectedDormFilter]);

  // Aggregate stats
  const totalLeaders = teamLeadersList.length;
  const totalManagedWorkers = teamLeadersList.reduce((acc, l) => acc + l.activeWorkers, 0);
  const distinctRoomsCount = useMemo(() => {
    const roomSet = new Set<string>();
    teamLeadersList.forEach((l) => {
      if (l.primaryDorm && l.primaryRoom) {
        roomSet.add(`${l.primaryDorm}-${l.primaryRoom}`);
      }
      l.rooms.forEach((r) => roomSet.add(`${r.dorm}-${r.room}`));
    });
    return roomSet.size;
  }, [teamLeadersList]);

  if (!isOpen) return null;

  const toggleExpand = (name: string) => {
    setExpandedLeaders((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    filteredLeaders.forEach((l) => (all[l.name] = true));
    setExpandedLeaders(all);
  };

  const collapseAll = () => {
    setExpandedLeaders({});
  };

  const handleStartEditPhone = (leader: TeamLeaderSummary) => {
    setEditingPhoneLeader(leader.name);
    setTempPhone(leader.contactPhone || '');
  };

  const handleSavePhone = (leaderName: string) => {
    updateTeamLeaderPhone(leaderName, tempPhone.trim());
    setEditingPhoneLeader(null);
    setTempPhone('');
  };

  // Copy formatted list to clipboard
  const handleCopyList = () => {
    if (filteredLeaders.length === 0) return;

    let text = `DANH SÁCH TỔNG HỢP TỔ TRƯỞNG KÝ TÚC XÁ CÔNG NHÂN\n`;
    text += `Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}\n`;
    text += `Tổng số tổ trưởng: ${filteredLeaders.length}\n`;
    text += `--------------------------------------------------\n\n`;

    filteredLeaders.forEach((leader, idx) => {
      const dormStr = leader.primaryDorm ? `Dãy ${leader.primaryDorm}` : (leader.rooms[0] ? `Dãy ${leader.rooms[0].dorm}` : 'Chưa gán dãy');
      const roomStr = leader.primaryRoom ? `Phòng ${leader.primaryRoom}` : (leader.rooms[0] ? `Phòng ${leader.rooms[0].room}` : 'Chưa gán phòng');
      const phoneStr = leader.contactPhone || 'Chưa có SĐT';
      
      text += `${idx + 1}. ${leader.name} .... ${dormStr} .. ${roomStr} .... SĐT: ${phoneStr}\n`;
      if (leader.rooms.length > 1) {
        const extraRooms = leader.rooms.map((r) => `Dãy ${r.dorm} - P.${r.room} (${r.count} ng)`).join(', ');
        text += `   - Các phòng quản lý: ${extraRooms}\n`;
      }
      text += `   - Số công nhân quản lý: ${leader.activeWorkers} người đang ở (Tổng hồ sơ: ${leader.totalWorkers})\n`;
      if (leader.workplaces.length > 0) {
        text += `   - Xưởng/Bộ phận: ${leader.workplaces.join(', ')}\n`;
      }
      text += `\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredLeaders.length === 0) return;

    const rows: any[] = [];
    filteredLeaders.forEach((leader, idx) => {
      const dormStr = leader.primaryDorm ? `Dãy ${leader.primaryDorm}` : (leader.rooms[0] ? `Dãy ${leader.rooms[0].dorm}` : '-');
      const roomStr = leader.primaryRoom ? `Phòng ${leader.primaryRoom}` : (leader.rooms[0] ? `Phòng ${leader.rooms[0].room}` : '-');
      const roomsStr = leader.rooms.map((r) => `Dãy ${r.dorm} - P.${r.room} (${r.count} ng)`).join('; ');
      const workplacesStr = leader.workplaces.join(', ');
      const workerNames = leader.workers.map((w) => `${w.name} (${w.empCode} - SĐT: ${w.phone || 'N/A'})`).join('; ');

      rows.push({
        'STT': idx + 1,
        'Họ và tên Tổ trưởng': leader.name,
        'Dãy': dormStr,
        'Phòng': roomStr,
        'Số điện thoại liên hệ (Bấm gọi)': leader.contactPhone || 'Chưa cập nhật',
        'Các phòng phụ trách': roomsStr || 'Chưa gán',
        'Số công nhân đang ở': leader.activeWorkers,
        'Tổng số hồ sơ công nhân': leader.totalWorkers,
        'Xưởng / Bộ phận': workplacesStr || 'N/A',
        'Danh sách công nhân': workerNames,
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh_Sach_To_Truong');
    XLSX.writeFile(workbook, `Danh_Sach_To_Truong_KTX_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-violet-50 to-indigo-50/50 dark:from-violet-950/40 dark:to-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 dark:bg-violet-500 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                  Danh sách Tổng hợp Tổ trưởng các phòng
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300">
                  {filteredLeaders.length} tổ trưởng
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tổng hợp họ tên, vị trí Dãy - Phòng và Số điện thoại (có thể ấn trực tiếp để gọi ngay)
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

        {/* Quick Stats Summary Banner */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Tổng số tổ trưởng:</span>
              <span className="font-extrabold text-sm text-violet-600 dark:text-violet-400">{totalLeaders}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Phòng có tổ trưởng:</span>
              <span className="font-extrabold text-sm text-amber-600 dark:text-amber-400">{distinctRoomsCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">Công nhân do tổ trưởng quản lý:</span>
              <span className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">{totalManagedWorkers}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={expandAll}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Mở rộng tất cả
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Thu gọn tất cả
            </button>
            <button
              type="button"
              onClick={handleCopyList}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép!' : 'Sao chép văn bản'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên tổ trưởng (ví dụ: Nguyễn Văn A...), Dãy, Phòng, SĐT, Xưởng..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                Xóa
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedDormFilter}
              onChange={(e) => setSelectedDormFilter(e.target.value)}
              aria-label="Lọc danh sách tổ trưởng theo dãy KTX"
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
            >
              <option value="ALL">Tất cả các dãy (1-{config.numDorms})</option>
              {Array.from({ length: config.numDorms }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  Dãy {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leaders List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {filteredLeaders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <UserCheck className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">Không tìm thấy tổ trưởng nào phù hợp với bộ lọc.</p>
              <p className="text-xs text-slate-500">
                Hãy kiểm tra thông tin cột "Tổ trưởng" khi thêm mới hoặc sửa hồ sơ công nhân.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeaders.map((leader, index) => {
                const isExpanded = Boolean(expandedLeaders[leader.name]);
                const isEditingPhone = editingPhoneLeader === leader.name;
                const cleanPhone = leader.contactPhone ? leader.contactPhone.replace(/\s+/g, '') : '';
                
                // Format: Nguyễn Văn A .... Dãy 1 .. Phòng 2 .... Số điện thoại (Ấn trực tiếp để gọi)
                const displayDorm = leader.primaryDorm || (leader.rooms[0]?.dorm);
                const displayRoom = leader.primaryRoom || (leader.rooms[0]?.room);

                return (
                  <div
                    key={leader.name}
                    className="rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-white dark:bg-slate-800 shadow-xs hover:border-violet-400 dark:hover:border-violet-500 transition-all overflow-hidden"
                  >
                    {/* Leader Main Header Row */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/90 via-transparent to-transparent dark:from-slate-800/60">
                      
                      {/* Left Block: Index, Name, Dorm, Room, Phone Call Badge */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-extrabold text-sm flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Row 1: Name + Dorm & Room + Phone Call Link */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Leader Name */}
                            <span className="font-extrabold text-base text-slate-900 dark:text-white">
                              {leader.name}
                            </span>

                            {/* Location (Dãy .. Phòng) */}
                            {displayDorm && displayRoom ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onSelectRoom) {
                                    onSelectRoom(displayDorm, displayRoom);
                                    onClose();
                                  }
                                }}
                                title={`Bấm để chuyển đến sơ đồ Dãy ${displayDorm} - Phòng ${displayRoom}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-bold text-xs transition-colors cursor-pointer"
                              >
                                <Building className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Dãy {displayDorm}</span>
                                <span className="text-amber-400 dark:text-amber-500">•</span>
                                <DoorClosed className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span>Phòng {displayRoom}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 italic">
                                (Chưa gán phòng)
                              </span>
                            )}

                            {/* Phone Number with Direct Call Action */}
                            {isEditingPhone ? (
                              <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-violet-400">
                                <input
                                  type="tel"
                                  value={tempPhone}
                                  onChange={(e) => setTempPhone(e.target.value)}
                                  placeholder="Nhập SĐT..."
                                  autoFocus
                                  className="w-32 px-2 py-0.5 text-xs rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSavePhone(leader.name)}
                                  className="px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPhoneLeader(null);
                                    setTempPhone('');
                                  }}
                                  className="px-1.5 py-0.5 text-xs rounded-md bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : leader.contactPhone ? (
                              <div className="inline-flex items-center gap-1.5">
                                <a
                                  href={`tel:${cleanPhone}`}
                                  title={`Ấn trực tiếp để gọi cho tổ trưởng ${leader.name} (${leader.contactPhone})`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-xs transition-all cursor-pointer ring-2 ring-emerald-500/20"
                                >
                                  <PhoneCall className="w-3.5 h-3.5 text-white animate-pulse" />
                                  <span>{leader.contactPhone}</span>
                                  <span className="text-[10px] font-normal bg-emerald-700/60 px-1.5 py-0.2 rounded-full">
                                    Ấn để gọi
                                  </span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditPhone(leader)}
                                  title="Chỉnh sửa số điện thoại tổ trưởng"
                                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEditPhone(leader)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 dark:bg-slate-700 dark:hover:bg-emerald-950/50 text-slate-600 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 border border-dashed border-slate-300 dark:border-slate-600 text-xs font-medium transition-colors"
                              >
                                <Phone className="w-3 h-3" />
                                <span>Thêm SĐT (Ấn để gọi)</span>
                              </button>
                            )}
                          </div>

                          {/* Row 2: Secondary info (Workplaces + Managed Workers Count) */}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            {leader.workplaces.length > 0 && (
                              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1 bg-slate-100/80 dark:bg-slate-700/50 px-2 py-0.5 rounded-md">
                                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                {leader.workplaces.join(', ')}
                              </span>
                            )}
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {leader.activeWorkers} công nhân đang ở
                            </span>
                            {leader.totalWorkers > leader.activeWorkers && (
                              <span className="text-slate-400 text-[11px]">
                                ({leader.totalWorkers - leader.activeWorkers} đã rời KTX)
                              </span>
                            )}
                            {leader.rooms.length > 1 && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-violet-600 dark:text-violet-400 text-[11px] font-medium">
                                  Quản lý {leader.rooms.length} phòng
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Block: All Managed Room Badges + Accordion View */}
                      <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
                        {/* If leader manages multiple rooms, show badges */}
                        {leader.rooms.length > 1 && (
                          <div className="flex flex-wrap gap-1">
                            {leader.rooms.map((r) => (
                              <button
                                key={`${r.dorm}-${r.room}`}
                                type="button"
                                onClick={() => {
                                  if (onSelectRoom) {
                                    onSelectRoom(r.dorm, r.room);
                                    onClose();
                                  }
                                }}
                                title={`Xem chi tiết Phòng ${r.room} (Dãy ${r.dorm})`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-700/80 hover:bg-violet-100 dark:hover:bg-violet-950/80 text-slate-700 dark:text-slate-200 hover:text-violet-700 dark:hover:text-violet-300 transition-colors border border-slate-200 dark:border-slate-700"
                              >
                                <DoorClosed className="w-3 h-3 text-amber-500" />
                                <span>D.{r.dorm}-P.{String(r.room).padStart(2, '0')}</span>
                                <span className="text-[9px] px-1 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold">
                                  {r.count}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => toggleExpand(leader.name)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          <span>{isExpanded ? 'Thu gọn' : `Danh sách (${leader.workers.length})`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Detailed List of Workers in Team Leader's Group */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center justify-between">
                          <span>Danh sách công nhân thuộc tổ của {leader.name}:</span>
                          <span className="text-[11px] text-slate-400">Tổng cộng {leader.workers.length} hồ sơ</span>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                              <tr>
                                <th className="px-3 py-2">STT</th>
                                <th className="px-3 py-2">Mã NV</th>
                                <th className="px-3 py-2">Họ và tên</th>
                                <th className="px-3 py-2">Vị trí ở</th>
                                <th className="px-3 py-2">Xưởng làm việc</th>
                                <th className="px-3 py-2">Số điện thoại (Ấn gọi)</th>
                                <th className="px-3 py-2">Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                              {leader.workers.map((w, wIdx) => {
                                const cleanWorkerPhone = w.phone ? w.phone.replace(/\s+/g, '') : '';
                                return (
                                  <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                    <td className="px-3 py-2 text-slate-400">{wIdx + 1}</td>
                                    <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                                      {w.empCode}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                      {w.name}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                                        Dãy {w.dorm} - P.{String(w.room).padStart(2, '0')}
                                      </span>
                                      {w.bed ? <span className="text-slate-400"> (G.{w.bed})</span> : ''}
                                    </td>
                                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                                      {w.workplace || '-'}
                                    </td>
                                    <td className="px-3 py-2">
                                      {w.phone ? (
                                        <a
                                          href={`tel:${cleanWorkerPhone}`}
                                          title={`Bấm để gọi cho ${w.name}`}
                                          className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
                                        >
                                          <PhoneCall className="w-3 h-3 text-emerald-500" />
                                          <span>{w.phone}</span>
                                        </a>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                          w.status === 'Đang ở'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                        }`}
                                      >
                                        {w.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Hiển thị {filteredLeaders.length} / {totalLeaders} tổ trưởng
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
