import { Worker, DormConfig, ManagerInfo, TeamLeaderSummary, DormAiContext, AiChatMessage, AiAssistantAction } from '../types';

/**
 * Prepares the rich contextual data snapshot of the dormitory for the AI Assistant
 */
export function buildDormAiContext(
  workers: Worker[],
  config: DormConfig,
  manager: ManagerInfo,
  teamLeaders: TeamLeaderSummary[]
): DormAiContext {
  const activeWorkers = workers.filter((w) => w.status === 'Đang ở');
  const exitedWorkers = workers.filter((w) => w.status === 'Đã check out' || (w.status as any) === 'Đã rời KTX');
  
  const totalWorkers = workers.length;
  const totalOccupants = activeWorkers.length;
  const totalExited = exitedWorkers.length;
  const totalRooms = config.numDorms * config.roomsPerDorm;
  const totalBeds = totalRooms * config.maxBedsPerRoom;
  const vacantBeds = Math.max(0, totalBeds - totalOccupants);

  // Group active workers by room
  const roomWorkersMap = new Map<string, Worker[]>();
  for (const w of activeWorkers) {
    const key = `${w.dorm}-${w.room}`;
    const list = roomWorkersMap.get(key) || [];
    list.push(w);
    roomWorkersMap.set(key, list);
  }

  // Room summaries
  const roomSummaries: DormAiContext['roomSummaries'] = [];
  let occupiedRoomsCount = 0;

  for (let d = 1; d <= config.numDorms; d++) {
    for (let r = 1; r <= config.roomsPerDorm; r++) {
      const key = `${d}-${r}`;
      const occupantsInRoom = roomWorkersMap.get(key) || [];
      const occupantsCount = occupantsInRoom.length;
      if (occupantsCount > 0) {
        occupiedRoomsCount++;
      }

      const vacant = Math.max(0, config.maxBedsPerRoom - occupantsCount);
      let status: 'EMPTY' | 'PARTIAL' | 'FULL' | 'OVERLOAD' = 'EMPTY';
      if (occupantsCount > config.maxBedsPerRoom) {
        status = 'OVERLOAD';
      } else if (occupantsCount === config.maxBedsPerRoom) {
        status = 'FULL';
      } else if (occupantsCount > 0) {
        status = 'PARTIAL';
      }

      roomSummaries.push({
        dorm: d,
        room: r,
        roomNumber: d * 100 + r,
        roomName: `Dãy ${d} - P${String(r).padStart(2, '0')}`,
        capacity: config.maxBedsPerRoom,
        occupants: occupantsCount,
        vacant,
        status,
        workers: occupantsInRoom.map((w) => ({
          id: w.id,
          name: w.name,
          empCode: w.empCode,
          gender: w.gender,
          teamLeader: w.teamLeader,
          hasCccdImage: Boolean(w.cccdFrontImage || w.cccdBackImage || w.cccdDocument?.hasFront),
        })),
      });
    }
  }

  // Missing CCCD workers
  const missingCccdWorkers: DormAiContext['missingCccdWorkers'] = [];
  for (const w of activeWorkers) {
    const hasFront = Boolean(w.cccdFrontImage || w.cccdDocument?.hasFront);
    const hasBack = Boolean(w.cccdBackImage || w.cccdDocument?.hasBack);
    if (!hasFront || !hasBack) {
      missingCccdWorkers.push({
        id: w.id,
        name: w.name,
        empCode: w.empCode,
        dorm: w.dorm,
        room: w.room,
        hasFront,
        hasBack,
      });
    }
  }

  // Duplicate empCode detection
  const empCodeCountMap = new Map<string, Worker[]>();
  for (const w of workers) {
    const code = (w.empCode || '').trim();
    if (!code) continue;
    const list = empCodeCountMap.get(code) || [];
    list.push(w);
    empCodeCountMap.set(code, list);
  }

  const duplicateEmpCodes: DormAiContext['duplicateEmpCodes'] = [];
  for (const [empCode, list] of empCodeCountMap.entries()) {
    if (list.length > 1) {
      duplicateEmpCodes.push({
        empCode,
        count: list.length,
        names: list.map((w) => w.name),
        rooms: list.map((w) => `Dãy ${w.dorm} - P${String(w.room).padStart(2, '0')}`),
      });
    }
  }

  // Unassigned or invalid room workers
  const unassignedWorkers = activeWorkers.filter(
    (w) => w.dorm < 1 || w.dorm > config.numDorms || w.room < 1 || w.room > config.roomsPerDorm
  );

  // Overloaded rooms
  const overloadedRooms = roomSummaries.filter((r) => r.status === 'OVERLOAD');

  // Diagnostics assembly
  const diagnostics: DormAiContext['diagnostics'] = [];

  if (duplicateEmpCodes.length > 0) {
    diagnostics.push({
      id: 'diag-dup-code',
      type: 'DUPLICATE_EMP_CODE',
      severity: 'CRITICAL',
      title: `Trùng lặp ${duplicateEmpCodes.length} mã nhân viên`,
      description: `Phát hiện các mã: ${duplicateEmpCodes.map((d) => d.empCode).join(', ')} đang được gán cho nhiều công nhân khác nhau.`,
      count: duplicateEmpCodes.length,
      actionType: 'OPEN_MODAL',
      modal: 'duplicate_checker',
      targetEmpCodes: duplicateEmpCodes.map((d) => d.empCode),
    });
  }

  if (overloadedRooms.length > 0) {
    diagnostics.push({
      id: 'diag-overload',
      type: 'ROOM_OVERLOAD',
      severity: 'CRITICAL',
      title: `Có ${overloadedRooms.length} phòng đang quá tải`,
      description: `Các phòng vượt mức tối đa ${config.maxBedsPerRoom} người: ${overloadedRooms.map((r) => r.roomName).join(', ')}. Cần giãn bớt công nhân sang phòng trống.`,
      count: overloadedRooms.length,
      actionType: 'FILTER_ROOMS',
      targetRooms: overloadedRooms.map((r) => r.roomNumber),
    });
  }

  if (unassignedWorkers.length > 0) {
    diagnostics.push({
      id: 'diag-unassigned',
      type: 'UNASSIGNED_WORKER',
      severity: 'CRITICAL',
      title: `Có ${unassignedWorkers.length} công nhân xếp sai phòng`,
      description: `Các công nhân có số Dãy hoặc số Phòng ngoài phạm vi thiết lập (Dãy 1-${config.numDorms}, Phòng 1-${config.roomsPerDorm}).`,
      count: unassignedWorkers.length,
      actionType: 'FILTER_WORKERS',
      targetEmpCodes: unassignedWorkers.map((w) => w.empCode),
    });
  }

  if (missingCccdWorkers.length > 0) {
    diagnostics.push({
      id: 'diag-missing-cccd',
      type: 'MISSING_CCCD',
      severity: 'WARNING',
      title: `Có ${missingCccdWorkers.length} hồ sơ chưa đủ 2 mặt CCCD`,
      description: `Nhiều công nhân đang ở chưa được chụp hoặc quét ảnh CCCD đầy đủ để hoàn tất hồ sơ lưu trữ an ninh.`,
      count: missingCccdWorkers.length,
      actionType: 'OPEN_MODAL',
      modal: 'cccd_scan',
      targetEmpCodes: missingCccdWorkers.map((w) => w.empCode),
    });
  }

  // Check workers with missing critical info
  const workersMissingDob = activeWorkers.filter((w) => !w.dob || !w.dob.trim());
  if (workersMissingDob.length > 0) {
    diagnostics.push({
      id: 'diag-missing-dob',
      type: 'MISSING_INFO',
      severity: 'WARNING',
      title: `Có ${workersMissingDob.length} công nhân thiếu ngày sinh`,
      description: `Hồ sơ thiếu ngày tháng năm sinh có thể gây trở ngại khi đối chiếu CCCD và báo cáo tạm trú.`,
      count: workersMissingDob.length,
      actionType: 'FILTER_WORKERS',
      targetEmpCodes: workersMissingDob.map((w) => w.empCode),
    });
  }

  // High occupancy rooms (1 or 2 beds left)
  const almostFullRooms = roomSummaries.filter(
    (r) => r.occupants > 0 && r.vacant > 0 && r.vacant <= 2
  );
  if (almostFullRooms.length > 0) {
    diagnostics.push({
      id: 'diag-almost-full',
      type: 'INFO',
      severity: 'INFO',
      title: `Có ${almostFullRooms.length} phòng sắp kín chỗ (còn ≤ 2 giường)`,
      description: `Gồm các phòng: ${almostFullRooms.slice(0, 6).map((r) => `${r.roomName} (còn ${r.vacant})`).join(', ')}${almostFullRooms.length > 6 ? '...' : ''}.`,
      count: almostFullRooms.length,
      actionType: 'FILTER_ROOMS',
      targetRooms: almostFullRooms.map((r) => r.roomNumber),
    });
  }

  return {
    managerName: manager.name || 'Quản lý KTX',
    totalWorkers,
    totalOccupants,
    totalExited,
    vacantBeds,
    totalRooms,
    occupiedRoomsCount,
    config,
    roomSummaries,
    missingCccdWorkers,
    duplicateEmpCodes,
    diagnostics,
    teamLeaders,
  };
}

/**
 * Intelligent Local Pattern Solver (Instant Fallback Engine)
 * Handles queries with 0 latency even without network or AI quota
 */
export function runLocalAiQuery(query: string, context: DormAiContext): AiChatMessage {
  const normalized = query.toLowerCase().trim();
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // 1. Query: "phòng còn ít hơn X giường trống" / "ít hơn 3 giường" / "còn trống ít hơn"
  const roomVacancyMatch = normalized.match(/(ít hơn|dưới|còn lại|trống ít hơn|còn trống ít hơn|còn|chỉ còn)\s*(\d+)\s*(giường|chỗ|vị trí)/i)
    || normalized.match(/còn ít hơn\s*(\d+)/i)
    || normalized.match(/ít hơn\s*(\d+)\s*giường/i);

  if (roomVacancyMatch || normalized.includes('ít hơn 3 giường') || normalized.includes('ít hơn 3') || normalized.includes('giường trống')) {
    let threshold = 3;
    if (roomVacancyMatch && roomVacancyMatch[2]) {
      threshold = parseInt(roomVacancyMatch[2], 10);
    } else if (roomVacancyMatch && roomVacancyMatch[1] && !isNaN(parseInt(roomVacancyMatch[1], 10))) {
      threshold = parseInt(roomVacancyMatch[1], 10);
    }

    // Filter rooms with occupants > 0 and vacant < threshold
    // Also include rooms that are FULL (vacant === 0)
    const matchingRooms = context.roomSummaries.filter(
      (r) => r.occupants > 0 && r.vacant < threshold
    );

    if (matchingRooms.length === 0) {
      return {
        id,
        role: 'assistant',
        timestamp,
        content: `**Kết quả tìm kiếm:**\n\nKhông có phòng nào đang ở mà còn ít hơn **${threshold} giường trống**. Tất cả các phòng có người đều còn từ ${threshold} chỗ trống trở lên, hoặc phòng hiện đang để trống hoàn toàn.`,
      };
    }

    const lines = matchingRooms.map(
      (r) => `• **${r.roomName}**: còn **${r.vacant}** chỗ trống *(đang ở: ${r.occupants}/${r.capacity})*`
    );

    const content = `Có **${matchingRooms.length} phòng** còn ít hơn ${threshold} giường trống:\n\n${lines.join('\n')}\n\n💡 *Gợi ý:* Bạn có thể bấm nút bên dưới để xem trực tiếp các phòng này trên sơ đồ KTX.`;

    return {
      id,
      role: 'assistant',
      timestamp,
      content,
      action: {
        actionType: 'FILTER_ROOMS',
        targetRooms: matchingRooms.map((r) => r.roomNumber),
        summary: `Xem ${matchingRooms.length} phòng này trên Sơ đồ`,
      },
    };
  }

  // 2. Query: "tìm hồ sơ chưa có ảnh CCCD" / "chưa có ảnh cccd" / "thiếu cccd"
  if (
    normalized.includes('ảnh cccd') ||
    normalized.includes('chưa có ảnh') ||
    normalized.includes('chưa có cccd') ||
    normalized.includes('thiếu cccd') ||
    normalized.includes('hồ sơ chưa có cccd') ||
    normalized.includes('không có cccd')
  ) {
    const list = context.missingCccdWorkers;
    if (list.length === 0) {
      return {
        id,
        role: 'assistant',
        timestamp,
        content: `🎉 **Tuyệt vời!** Toàn bộ **${context.totalOccupants} công nhân** đang lưu trú tại Ký túc xá đều đã được lưu ảnh CCCD đầy đủ cả 2 mặt. Không có hồ sơ nào bị thiếu ảnh!`,
      };
    }

    const sample = list.slice(0, 20);
    const lines = sample.map((w, idx) => {
      const missingParts: string[] = [];
      if (!w.hasFront && !w.hasBack) missingParts.push('cả 2 mặt');
      else if (!w.hasFront) missingParts.push('mặt trước');
      else if (!w.hasBack) missingParts.push('mặt sau');

      return `${idx + 1}. **${w.name}** - Mã NV: \`${w.empCode}\` (Dãy ${w.dorm} - P${String(w.room).padStart(2, '0')}) ➔ *Thiếu ${missingParts.join(', ')}*`;
    });

    const moreText = list.length > 20 ? `\n\n*(và còn ${list.length - 20} hồ sơ khác)*` : '';

    const content = `Tìm thấy **${list.length} hồ sơ công nhân** đang ở chưa có ảnh CCCD đầy đủ:\n\n${lines.join('\n')}${moreText}\n\n📸 *Hướng dẫn:* Bạn có thể sử dụng chức năng **Quét OCR CCCD** để chụp bổ sung ảnh 2 mặt cho công nhân rất nhanh chóng.`;

    return {
      id,
      role: 'assistant',
      timestamp,
      content,
      action: {
        actionType: 'OPEN_MODAL',
        modal: 'cccd_scan',
        targetEmpCodes: list.map((w) => w.empCode),
        summary: `Mở công cụ Quét OCR CCCD bổ sung (${list.length} người)`,
      },
    };
  }

  // 3. Query: "tự kiểm tra và báo có những lỗi và sự cố gì cần sửa chữa hoặc khắc phục cho tôi"
  if (
    normalized.includes('lỗi') ||
    normalized.includes('sự cố') ||
    normalized.includes('khắc phục') ||
    normalized.includes('kiểm tra') ||
    normalized.includes('rà soát') ||
    normalized.includes('tự kiểm tra')
  ) {
    const { diagnostics } = context;
    const criticals = diagnostics.filter((d) => d.severity === 'CRITICAL');
    const warnings = diagnostics.filter((d) => d.severity === 'WARNING');
    const infos = diagnostics.filter((d) => d.severity === 'INFO');

    let content = `### 🔍 BÁO CÁO RÀ SOÁT & TỰ KIỂM TRA SỰ CỐ KÝ TÚC XÁ\n\n`;

    if (criticals.length === 0 && warnings.length === 0) {
      content += `✅ **Hệ thống dữ liệu KTX rất tốt!**\nKhông phát hiện lỗi nghiêm trọng nào. Mọi mã nhân viên, phân bổ phòng và hồ sơ đều hợp lệ.\n\n`;
    } else {
      if (criticals.length > 0) {
        content += `#### 🔴 LỖI NGHIÊM TRỌNG CẦN KHẮC PHỤC NGAY (${criticals.length} vấn đề):\n`;
        criticals.forEach((c, idx) => {
          content += `${idx + 1}. **${c.title}**\n   ${c.description}\n`;
        });
        content += `\n`;
      }

      if (warnings.length > 0) {
        content += `#### 🟡 CẢNH BÁO HỒ SƠ & DỮ LIỆU (${warnings.length} vấn đề):\n`;
        warnings.forEach((w, idx) => {
          content += `${idx + 1}. **${w.title}**\n   ${w.description}\n`;
        });
        content += `\n`;
      }
    }

    if (infos.length > 0) {
      content += `#### 🔵 THÔNG TIN VẬN HÀNH & SẮP ĐẦY:\n`;
      infos.forEach((i, idx) => {
        content += `• ${i.title}: ${i.description}\n`;
      });
      content += `\n`;
    }

    content += `#### 🛠️ KHUYẾN NGHỊ HÀNH ĐỘNG DÀNH CHO QUẢN LÝ:\n`;
    if (context.duplicateEmpCodes.length > 0) {
      content += `1. **Ưu tiên số 1:** Nhấp vào công cụ **"Kiểm tra trùng mã"** ở thanh tiêu đề để đổi lại các mã NV bị trùng lặp.\n`;
    }
    if (context.missingCccdWorkers.length > 0) {
      content += `2. **Hoàn thiện CCCD:** Sử dụng tính năng **"Quét OCR CCCD"** bổ sung hình chụp 2 mặt cho ${context.missingCccdWorkers.length} công nhân.\n`;
    }
    content += `3. **Sao lưu dữ liệu:** Đừng quên tải file dự phòng JSON định kỳ để bảo vệ dữ liệu toàn vẹn.`;

    const primaryAction: AiAssistantAction = context.duplicateEmpCodes.length > 0
      ? {
          actionType: 'OPEN_MODAL',
          modal: 'duplicate_checker',
          summary: 'Mở công cụ xử lý trùng mã nhân viên',
        }
      : context.missingCccdWorkers.length > 0
      ? {
          actionType: 'OPEN_MODAL',
          modal: 'cccd_scan',
          summary: 'Mở Quét OCR CCCD',
        }
      : {
          actionType: 'SYSTEM_AUDIT',
          summary: 'Kiểm tra chi tiết tình trạng phòng',
        };

    return {
      id,
      role: 'assistant',
      timestamp,
      content,
      action: primaryAction,
      diagnostics: {
        totalIssues: diagnostics.length,
        criticalIssues: criticals.length,
        warningIssues: warnings.length,
      },
    };
  }

  // 4. Query: "tổ trưởng" / "danh sách tổ trưởng" / "số điện thoại tổ trưởng"
  if (normalized.includes('tổ trưởng') || normalized.includes('trưởng nhóm') || normalized.includes('nhóm trưởng')) {
    const { teamLeaders } = context;
    if (teamLeaders.length === 0) {
      return {
        id,
        role: 'assistant',
        timestamp,
        content: `Hiện tại chưa có công nhân nào được ghi nhận vai trò Tổ trưởng trong danh sách hồ sơ. Bạn có thể gán tổ trưởng khi thêm/sửa công nhân.`,
      };
    }

    const lines = teamLeaders.map((tl, idx) => {
      const phone = tl.contactPhone ? ` - SĐT: \`${tl.contactPhone}\`` : ' *(Chưa có SĐT)*';
      return `${idx + 1}. **${tl.name}**${phone} (Phụ trách: **${tl.activeWorkers}** công nhân)`;
    });

    const content = `Có **${teamLeaders.length} Tổ trưởng** đang phụ trách công nhân tại KTX:\n\n${lines.join('\n')}\n\nBấm nút bên dưới để xem chi tiết danh sách từng phòng do các tổ trưởng phụ trách hoặc xuất danh bạ.`;

    return {
      id,
      role: 'assistant',
      timestamp,
      content,
      action: {
        actionType: 'OPEN_MODAL',
        modal: 'team_leaders',
        summary: 'Xem chi tiết Bảng Tổ trưởng',
      },
    };
  }

  // 4.1. Query: Building comparison / building stats / "dãy nào đông nhất" / "so sánh"
  if (normalized.includes('dãy nào đông') || normalized.includes('đông nhất') || normalized.includes('so sánh') || normalized.includes('dãy')) {
    // Calculate stats per building
    const buildingStats: { dorm: number; occupants: number; capacity: number; roomsCount: number }[] = [];
    for (let d = 1; d <= context.config.numDorms; d++) {
      const roomsInDorm = context.roomSummaries.filter(r => r.dorm === d);
      const occupants = roomsInDorm.reduce((sum, r) => sum + r.occupants, 0);
      const capacity = roomsInDorm.reduce((sum, r) => sum + r.capacity, 0);
      buildingStats.push({ dorm: d, occupants, capacity, roomsCount: roomsInDorm.length });
    }

    buildingStats.sort((a, b) => b.occupants - a.occupants);
    const busiest = buildingStats[0];

    // Check if user specifically asked about a specific building like "dãy 3"
    const dormMatch = normalized.match(/dãy\s*(\d+)/i);
    if (dormMatch && dormMatch[1]) {
      const targetDorm = parseInt(dormMatch[1], 10);
      const stat = buildingStats.find(s => s.dorm === targetDorm);
      if (stat) {
        const rate = stat.capacity > 0 ? ((stat.occupants / stat.capacity) * 100).toFixed(1) : '0';
        const dormRooms = context.roomSummaries.filter(r => r.dorm === targetDorm);
        const activeRoomsCount = dormRooms.filter(r => r.occupants > 0).length;
        const totalWorkersInDorm = dormRooms.reduce((acc, r) => acc + r.workers.length, 0);

        return {
          id,
          role: 'assistant',
          timestamp,
          content: `### 🏢 THÔNG TIN CHI TIẾT DÃY ${targetDorm}\n\n` +
            `• **Số công nhân đang ở:** **${stat.occupants} người** (trên tổng sức chứa ${stat.capacity} giường)\n` +
            `• **Tỷ lệ lấp đầy:** **${rate}%**\n` +
            `• **Số phòng có người:** ${activeRoomsCount} / ${stat.roomsCount} phòng\n` +
            `• **Số giường trống:** ${Math.max(0, stat.capacity - stat.occupants)} giường\n\n` +
            `💡 *Bạn có thể yêu cầu tôi liệt kê danh sách công nhân hoặc phòng cụ thể trong Dãy ${targetDorm}!*`,
          action: {
            actionType: 'FILTER_ROOMS',
            targetRooms: dormRooms.map(r => r.roomNumber),
            summary: `Xem sơ đồ các phòng Dãy ${targetDorm}`,
          },
        };
      }
    }

    const lines = buildingStats.map((s, idx) => {
      const rate = s.capacity > 0 ? ((s.occupants / s.capacity) * 100).toFixed(1) : '0';
      return `${idx + 1}. **Dãy ${s.dorm}**: **${s.occupants}** người / ${s.capacity} giường *(Lấp đầy: ${rate}%, ${s.roomsCount} phòng)*`;
    });

    return {
      id,
      role: 'assistant',
      timestamp,
      content: `### 📊 PHÂN TÍCH & SO SÁNH TÌNH TRẠNG CÁC DÃY KÝ TÚC XÁ\n\n` +
        `🏆 **Dãy đông nhất:** Dãy ${busiest.dorm} với **${busiest.occupants} công nhân** đang lưu trú.\n\n` +
        `**Chi tiết từng dãy:**\n${lines.join('\n')}\n\n` +
        `💡 *Mọi số liệu được tổng hợp trực tiếp từ cơ sở dữ liệu hiện tại của hệ thống.*`,
    };
  }

  // 4.2. Query: "quá tải" / "phòng quá tải"
  if (normalized.includes('quá tải') || normalized.includes('vượt sức chứa')) {
    const overloaded = context.roomSummaries.filter(r => r.status === 'OVERLOAD');
    if (overloaded.length === 0) {
      return {
        id,
        role: 'assistant',
        timestamp,
        content: `✅ **Không có phòng nào bị quá tải!** Tất cả các phòng trong KTX hiện đang tuân thủ đúng định mức sức chứa tối đa (${context.config.maxBedsPerRoom} người/phòng).`,
      };
    }

    const lines = overloaded.map((r, idx) => `${idx + 1}. **${r.roomName}**: đang ở **${r.occupants}/${r.capacity}** người *(Vượt ${r.occupants - r.capacity} người)*`);
    return {
      id,
      role: 'assistant',
      timestamp,
      content: `⚠️ Phát hiện **${overloaded.length} phòng đang quá tải** (vượt mức ${context.config.maxBedsPerRoom} giường/phòng):\n\n${lines.join('\n')}\n\n💡 *Khuyến nghị:* Cần nhanh chóng điều phối công nhân sang các phòng còn trống để đảm bảo an toàn vận hành.`,
      action: {
        actionType: 'FILTER_ROOMS',
        targetRooms: overloaded.map(r => r.roomNumber),
        summary: `Xem ${overloaded.length} phòng quá tải trên sơ đồ`,
      },
    };
  }

  // 5. Query: "tổng quan" / "báo cáo" / "tỷ lệ lấp đầy" / "thống kê"
  if (
    normalized.includes('tổng quan') ||
    normalized.includes('báo cáo') ||
    normalized.includes('thống kê') ||
    normalized.includes('lấp đầy') ||
    normalized.includes('tình hình')
  ) {
    const occupancyRate = context.totalRooms * context.config.maxBedsPerRoom > 0
      ? ((context.totalOccupants / (context.totalRooms * context.config.maxBedsPerRoom)) * 100).toFixed(1)
      : '0';

    const content = `### 📊 BÁO CÁO TỔNG QUAN TÌNH HÌNH KÝ TÚC XÁ\n\n` +
      `• **Người quản lý:** ${context.managerName}\n` +
      `• **Tổng số dãy phòng:** ${context.config.numDorms} dãy (tổng cộng ${context.totalRooms} phòng)\n` +
      `• **Công nhân đang ở thực tế:** **${context.totalOccupants} người**\n` +
      `• **Công nhân đã trả phòng/rời đi:** ${context.totalExited} người\n` +
      `• **Số phòng đang hoạt động:** ${context.occupiedRoomsCount} / ${context.totalRooms} phòng\n` +
      `• **Tổng số giường còn trống:** **${context.vacantBeds} giường**\n` +
      `• **Tỷ lệ lấp đầy toàn KTX:** **${occupancyRate}%**\n` +
      `• **Hồ sơ chưa có ảnh CCCD:** ${context.missingCccdWorkers.length} hồ sơ\n` +
      `• **Mã nhân viên bị trùng:** ${context.duplicateEmpCodes.length} mã\n\n` +
      `💡 *Bạn có thể yêu cầu tôi tìm phòng trống cụ thể, lọc hồ sơ hoặc phát hiện lỗi bất cứ lúc nào!*`;

    return {
      id,
      role: 'assistant',
      timestamp,
      content,
      action: {
        actionType: 'OPEN_MODAL',
        modal: 'active_rooms',
        summary: 'Xem Danh sách các phòng đang có người ở',
      },
    };
  }

  // 7. Query: "xin chào" / "bạn là ai" / "giới thiệu" / "lee" / "khổng minh liên"
  if (
    normalized.includes('bạn là ai') ||
    normalized.includes('bạn tên gì') ||
    normalized.includes('giới thiệu') ||
    normalized.includes('khổng minh liên') ||
    normalized.includes('mình là lee') ||
    normalized === 'lee' ||
    normalized === 'xin chào' ||
    normalized === 'chào bạn' ||
    normalized === 'hello'
  ) {
    return {
      id,
      role: 'assistant',
      timestamp,
      content: `Xin chào, mình là Lee\n\n` +
        `Là một trợ lý AI quản lý\n` +
        `Ký túc xá Hạ Long Xanh,\n` +
        `được tạo bởi Khổng Minh Liên.\n\n` +
        `Lee sẽ luôn đồng hành giúp đỡ bạn trong việc tìm kiếm, rà soát thông tin, kiểm tra tình trạng Ký túc xá.\n\n` +
        `Bạn có câu hỏi gì dành cho mình không?`,
    };
  }

  // Fallback greeting / guide (Exact greeting from the image)
  return {
    id,
    role: 'assistant',
    timestamp,
    content: `Xin chào, mình là Lee\n\n` +
      `Là một trợ lý AI quản lý\n` +
      `Ký túc xá Hạ Long Xanh,\n` +
      `được tạo bởi Khổng Minh Liên.\n\n` +
      `Lee sẽ luôn đồng hành giúp đỡ bạn trong việc tìm kiếm, rà soát thông tin, kiểm tra tình trạng Ký túc xá.\n\n` +
      `Bạn có câu hỏi gì dành cho mình không?`,
  };
}

/**
 * Sends a natural language query to the backend Gemini AI assistant endpoint
 * With automatic fallback to local solver if offline or without API key
 */
export async function sendQueryToAiAssistant(
  query: string,
  history: AiChatMessage[],
  context: DormAiContext
): Promise<AiChatMessage> {
  const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  try {
    const formattedHistory = history.slice(-8).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.content,
    }));

    const response = await fetch('/api/ai/assistant', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        history: formattedHistory,
        context,
      }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data && data.success && data.content) {
        let content = data.content as string;
        let action: AiAssistantAction | undefined = data.action;

        // Extract action block from content if model put it inside markdown code block
        const actionBlockMatch = content.match(/```action\s*([\s\S]*?)\s*```/);
        if (actionBlockMatch) {
          try {
            const parsedAction = JSON.parse(actionBlockMatch[1]);
            if (parsedAction && parsedAction.actionType) {
              action = parsedAction;
            }
          } catch (e) {
            console.warn('Failed to parse AI action block:', e);
          }
          // Clean the action block from displayed message
          content = content.replace(/```action\s*[\s\S]*?\s*```/, '').trim();
        }

        return {
          id,
          role: 'assistant',
          timestamp,
          content,
          action,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to contact /api/ai/assistant, using local intelligent engine:', err);
  }

  // Graceful local engine fallback
  return runLocalAiQuery(query, context);
}
