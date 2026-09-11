import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  Bed,
  CreditCard,
  Building2,
  Users,
  ChevronRight,
  ShieldAlert,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  GripHorizontal,
} from 'lucide-react';
import { useDorm } from '../../context/DormContext';
import { AiChatMessage, AiAssistantAction } from '../../types';
import { buildDormAiContext, sendQueryToAiAssistant, runLocalAiQuery } from '../../utils/aiAssistant';
import { LeeMascot } from '../LeeMascot';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRooms?: (roomNumbers: number[]) => void;
  onSelectDormRoom?: (dorm: number, room: number) => void;
  onOpenModal?: (modalName: 'cccd_scan' | 'duplicate_checker' | 'active_rooms' | 'team_leaders' | 'export_excel') => void;
  onFilterWorkerEmpCodes?: (empCodes: string[]) => void;
}

const QUICK_PROMPTS = [
  {
    id: 'p1',
    label: 'Tìm phòng còn ít hơn 3 giường trống',
    icon: Bed,
    prompt: 'Hãy tìm tất cả phòng còn ít hơn 3 giường trống.',
  },
  {
    id: 'p2',
    label: 'Tìm hồ sơ chưa có ảnh CCCD',
    icon: CreditCard,
    prompt: 'Tìm hồ sơ chưa có ảnh CCCD.',
  },
  {
    id: 'p3',
    label: 'Tự kiểm tra lỗi & sự cố cần khắc phục',
    icon: AlertTriangle,
    prompt: 'Tự kiểm tra và báo có những lỗi và sự cố gì cần sửa chữa hoặc khắc phục cho tôi.',
  },
  {
    id: 'p4',
    label: 'Báo cáo tổng quan tình hình KTX',
    icon: Building2,
    prompt: 'Báo cáo tổng quan tình hình KTX, tỷ lệ lấp đầy và số giường trống hôm nay.',
  },
  {
    id: 'p5',
    label: 'Danh sách Tổ trưởng & Số điện thoại',
    icon: Users,
    prompt: 'Cho tôi danh sách các tổ trưởng và số điện thoại liên hệ.',
  },
  {
    id: 'p6',
    label: 'Kiểm tra mã nhân viên bị trùng',
    icon: ShieldAlert,
    prompt: 'Kiểm tra xem có mã nhân viên nào bị trùng lặp trong hệ thống không.',
  },
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  onSelectRooms,
  onSelectDormRoom,
  onOpenModal,
  onFilterWorkerEmpCodes,
}) => {
  const { workers, config, manager, getTeamLeadersSummary } = useDorm();

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      const defaultW = Math.min(690, Math.max(360, window.innerWidth - 24));
      const defaultH = Math.min(590, Math.max(420, window.innerHeight - 40));
      return { width: defaultW, height: defaultH };
    }
    return { width: 690, height: 590 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep modal inside viewport on window resize
  useEffect(() => {
    const handleWindowResize = () => {
      setSize((prev) => ({
        width: Math.min(prev.width, window.innerWidth - 16),
        height: Math.min(prev.height, window.innerHeight - 24),
      }));
      if (position) {
        setPosition((prev) => {
          if (!prev) return null;
          return {
            x: Math.max(8, Math.min(window.innerWidth - 120, prev.x)),
            y: Math.max(8, Math.min(window.innerHeight - 120, prev.y)),
          };
        });
      }
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [position]);

  // Pointer drag handler for header
  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) {
      return;
    }
    if (isExpanded) return;

    e.preventDefault();
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    let initX = position?.x;
    let initY = position?.y;

    if (initX === undefined || initY === undefined) {
      if (modalRef.current) {
        const rect = modalRef.current.getBoundingClientRect();
        initX = rect.left;
        initY = rect.top;
      } else {
        initX = Math.max(8, (window.innerWidth - size.width) / 2);
        initY = Math.max(8, (window.innerHeight - size.height) / 2);
      }
    }

    setIsDragging(true);

    const onPointerMove = (moveEv: PointerEvent) => {
      const deltaX = moveEv.clientX - startClientX;
      const deltaY = moveEv.clientY - startClientY;
      const maxX = Math.max(8, window.innerWidth - size.width - 8);
      const maxY = Math.max(8, window.innerHeight - size.height - 8);

      const nextX = Math.max(8, Math.min(maxX, (initX ?? 0) + deltaX));
      const nextY = Math.max(8, Math.min(maxY, (initY ?? 0) + deltaY));
      setPosition({ x: nextX, y: nextY });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Pointer resize handler for corners and edges
  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, direction: 'se' | 'e' | 's') => {
    e.preventDefault();
    e.stopPropagation();
    if (isExpanded) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startW = size.width;
    const startH = size.height;

    if (!position && modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setPosition({ x: rect.left, y: rect.top });
    }

    setIsResizing(true);

    const onPointerMove = (moveEv: PointerEvent) => {
      const currentPosX = position?.x ?? (window.innerWidth - startW) / 2;
      const currentPosY = position?.y ?? (window.innerHeight - startH) / 2;

      const maxW = Math.max(360, window.innerWidth - currentPosX - 10);
      const maxH = Math.max(400, window.innerHeight - currentPosY - 10);

      let newW = startW;
      let newH = startH;

      if (direction === 'se' || direction === 'e') {
        newW = Math.max(360, Math.min(maxW, startW + (moveEv.clientX - startClientX)));
      }
      if (direction === 'se' || direction === 's') {
        newH = Math.max(400, Math.min(maxH, startH + (moveEv.clientY - startClientY)));
      }

      setSize({ width: newW, height: newH });
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Initialize welcome message when modal opens or on first load
  useEffect(() => {
    if (isOpen) {
      if (messages.length === 0) {
        const teamLeaders = getTeamLeadersSummary();
        const context = buildDormAiContext(workers, config, manager, teamLeaders);
        const welcome = runLocalAiQuery('', context);
        setMessages([welcome]);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const teamLeaders = getTeamLeadersSummary();
      const context = buildDormAiContext(workers, config, manager, teamLeaders);

      const aiResponse = await sendQueryToAiAssistant(query, messages, context);
      setMessages((prev) => [...prev, aiResponse]);
    } catch (err) {
      console.error('AI assistant processing failed:', err);
      // Fallback
      const teamLeaders = getTeamLeadersSummary();
      const context = buildDormAiContext(workers, config, manager, teamLeaders);
      const fallbackMsg = runLocalAiQuery(query, context);
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    const teamLeaders = getTeamLeadersSummary();
    const context = buildDormAiContext(workers, config, manager, teamLeaders);
    const welcome = runLocalAiQuery('', context);
    setMessages([welcome]);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTriggerAction = (action?: AiAssistantAction) => {
    if (!action) return;

    if (action.actionType === 'FILTER_ROOMS' && action.targetRooms && action.targetRooms.length > 0) {
      if (onSelectRooms) {
        onSelectRooms(action.targetRooms);
      }
      onClose();
    } else if (action.actionType === 'OPEN_MODAL' && action.modal) {
      if (onOpenModal) {
        onOpenModal(action.modal);
      }
      onClose();
    } else if (action.actionType === 'FILTER_WORKERS' && action.targetEmpCodes && action.targetEmpCodes.length > 0) {
      if (onFilterWorkerEmpCodes) {
        onFilterWorkerEmpCodes(action.targetEmpCodes);
      }
      onClose();
    } else if (action.actionType === 'SYSTEM_AUDIT') {
      if (onOpenModal) {
        onOpenModal('active_rooms');
      }
      onClose();
    }
  };

  // Format simple markdown helper
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');

    return lines.map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="font-bold text-slate-900 text-sm sm:text-base mt-2 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('#### ')) {
        return (
          <h5 key={idx} className="font-bold text-slate-800 text-xs sm:text-sm mt-2 mb-0.5">
            {line.replace('#### ', '')}
          </h5>
        );
      }

      // Bullet points
      if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
        const text = line.replace(/^[•\-\*]\s*/, '');
        return (
          <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed text-slate-800 ml-1 my-0.5">
            <span className="text-teal-600 font-bold shrink-0 mt-0.5">•</span>
            <span>{renderInlineStyles(text)}</span>
          </div>
        );
      }

      // Numbered lists e.g. "1. "
      const numMatch = line.match(/^(\d+)\.\s*(.*)$/);
      if (numMatch) {
        return (
          <div key={idx} className="flex items-start gap-2 text-xs sm:text-sm leading-relaxed text-slate-800 ml-1 my-0.5">
            <span className="font-bold text-teal-700 shrink-0">{numMatch[1]}.</span>
            <span>{renderInlineStyles(numMatch[2])}</span>
          </div>
        );
      }

      // Empty line
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }

      // Normal text
      return (
        <p key={idx} className="text-xs sm:text-sm leading-relaxed text-slate-800 my-0.5">
          {renderInlineStyles(line)}
        </p>
      );
    });
  };

  // Render bold, code, italics
  const renderInlineStyles = (text: string) => {
    // Replace **bold** with <strong>
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200/80 font-mono text-[11px] sm:text-xs font-semibold"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className="italic text-slate-600 font-medium">
            {part.slice(1, -1)}
          </em>
        );
      }
      return part;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDragging && !isResizing) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        style={
          isExpanded
            ? {
                width: 'calc(100vw - 24px)',
                height: 'calc(100vh - 24px)',
                maxWidth: '1200px',
                maxHeight: '94vh',
                backgroundColor: '#2A948D',
              }
            : position
            ? {
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                maxWidth: 'calc(100vw - 16px)',
                maxHeight: 'calc(100vh - 16px)',
                backgroundColor: '#2A948D',
              }
            : {
                width: `${size.width}px`,
                height: `${size.height}px`,
                maxWidth: 'calc(100vw - 16px)',
                maxHeight: 'calc(100vh - 16px)',
                backgroundColor: '#2A948D',
              }
        }
        className={`bg-[#2A948D] rounded-2xl flex flex-col shadow-2xl border border-teal-600/50 overflow-hidden relative select-text ${
          isDragging || isResizing ? 'transition-none shadow-teal-900/40' : 'transition-all duration-150'
        }`}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Header (Draggable) */}
        <div
          onPointerDown={handleHeaderPointerDown}
          onDoubleClick={() => setIsExpanded(!isExpanded)}
          className={`px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-[#185c57] via-[#1f736c] to-[#258a83] text-white flex items-center justify-between shadow-md shrink-0 border-b border-white/10 select-none ${
            isExpanded ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          title={isExpanded ? 'Nhấp đúp để thu nhỏ lại' : 'Giữ chuột và kéo để di chuyển vị trí, nhấp đúp để phóng to'}
        >
          <div className="flex items-center gap-2 min-w-0 pointer-events-none">
            <GripHorizontal className="w-4 h-4 text-white/70 -mr-0.5 shrink-0 hidden sm:block" />
            <div className="p-0.5 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
              <LeeMascot variant="badge" size={32} className="shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm sm:text-base tracking-wide truncate text-white drop-shadow-xs">
                  TRỢ LÝ AI LEE
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 text-white border border-white/30 px-1.5 py-0.2 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
                  Hạ Long Xanh
                </span>
              </div>
              <p className="text-[11px] text-teal-100 truncate">
                Được tạo bởi Khổng Minh Liên • KTX thông minh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {position && !isExpanded && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPosition(null);
                }}
                className="px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-medium transition-colors hidden sm:inline-flex items-center gap-1 border border-white/20"
                title="Đưa cửa sổ về chính giữa màn hình"
              >
                Về giữa
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
              title={isExpanded ? 'Khôi phục kích thước' : 'Phóng to toàn màn hình'}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleResetChat}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Làm mới hội thoại"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="bg-[#1e6e67] border-b border-teal-800/40 px-3 py-2 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 min-w-max">
            <span className="text-[10px] font-bold text-teal-100 uppercase tracking-wider flex items-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3 text-teal-200" />
              Gợi ý:
            </span>
            {QUICK_PROMPTS.map((qp) => {
              const IconComponent = qp.icon;
              return (
                <button
                  key={qp.id}
                  type="button"
                  onClick={() => handleSendMessage(qp.prompt)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-white text-teal-900 border border-white/80 hover:bg-teal-50 hover:text-teal-950 shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
                >
                  <IconComponent className="w-3 h-3 text-teal-700 shrink-0" />
                  <span>{qp.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat Messages Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-[#2A948D]">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isWelcomeCard = !isUser && msg.content.includes('Xin chào, mình là Lee');

            if (isWelcomeCard) {
              return (
                <div key={msg.id} className="w-full flex justify-center py-1 animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-full max-w-md bg-white/98 text-slate-800 border-2 border-white rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col items-center text-center">
                    {/* Character Mascot Lee Waving */}
                    <div className="mb-1.5">
                      <LeeMascot variant="full" size={105} animated={true} />
                    </div>

                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight mb-2">
                      Xin chào, mình là Lee
                    </h2>

                    <div className="text-xs text-slate-700 leading-relaxed font-medium space-y-0.5 mb-2">
                      <p>Là một trợ lý AI quản lý</p>
                      <p className="font-bold text-teal-700 text-sm">Ký túc xá Hạ Long Xanh,</p>
                      <p>được tạo bởi <span className="font-bold text-slate-900">Khổng Minh Liên</span>.</p>
                    </div>

                    <div className="text-xs text-slate-600 leading-relaxed font-medium space-y-0.5 mb-3">
                      <p>Lee sẽ luôn đồng hành giúp đỡ bạn</p>
                      <p>trong việc tìm kiếm, rà soát thông tin,</p>
                      <p>kiểm tra tình trạng Ký túc xá.</p>
                    </div>

                    <p className="text-xs font-bold text-teal-800 bg-teal-50 px-3.5 py-1.5 rounded-lg border border-teal-200 shadow-xs">
                      Bạn có câu hỏi gì dành cho mình không?
                    </p>

                    <div className="mt-3 pt-2 border-t border-slate-100 w-full flex items-center justify-between text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-teal-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Trợ lý AI Lee • {msg.timestamp}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
                        title="Sao chép nội dung"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="shrink-0 mt-0.5">
                    <LeeMascot variant="badge" size={36} className="drop-shadow-md" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 shadow-md text-xs sm:text-sm ${
                    isUser
                      ? 'bg-slate-900 text-white border border-slate-800 rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-white/90 rounded-tl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-slate-100">
                    <span className={`text-[11px] font-bold ${isUser ? 'text-teal-300' : 'text-teal-700'}`}>
                      {isUser ? 'Bạn' : '✨ Trợ lý AI Lee'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] ${isUser ? 'text-slate-400' : 'text-slate-400'}`}>
                        {msg.timestamp}
                      </span>
                      {!isUser && (
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
                          title="Sao chép nội dung"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-slate-800">
                    {isUser ? (
                      <p className="whitespace-pre-wrap leading-relaxed font-medium text-white">{msg.content}</p>
                    ) : (
                      renderFormattedContent(msg.content)
                    )}
                  </div>

                  {/* Interactive Action Button (if AI suggested a direct UI filter or action) */}
                  {!isUser && msg.action && (
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTriggerAction(msg.action)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                        <span>{msg.action.summary || 'Thực hiện ngay trên giao diện'}</span>
                      </button>

                      {msg.action.actionType === 'FILTER_ROOMS' && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          (Bấm để lọc trực tiếp trên sơ đồ phòng)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-md mt-0.5 font-bold text-xs border border-slate-800">
                    QL
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="shrink-0">
                <LeeMascot variant="badge" size={34} animated={true} />
              </div>
              <div className="bg-white border border-white/90 rounded-2xl rounded-tl-xs p-3.5 shadow-md flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse delay-100" />
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse delay-200" />
                </div>
                <span>Lee đang rà soát dữ liệu Ký túc xá và chuẩn bị câu trả lời...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-2.5 sm:p-3 bg-[#1e6e67] border-t border-teal-800/40 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Hỏi Lee (vd: 'Phòng trống', 'Lỗi cần sửa')..."
                className="w-full pl-3 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-white border border-white/80 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300 font-medium shadow-sm transition-all"
                disabled={isLoading}
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-teal-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:pointer-events-none shrink-0"
              title="Gửi câu hỏi"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Gửi</span>
            </button>
          </form>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-teal-100/90 px-1">
            <span className="flex items-center gap-1">
              <span>💡 Giữ thanh tiêu đề để di chuyển • Kéo góc phải để chỉnh kích thước</span>
            </span>
            <span className="font-semibold text-white">Lee v3.0</span>
          </div>
        </div>

        {/* Resize Handles (Only in non-expanded mode) */}
        {!isExpanded && (
          <>
            {/* Bottom-right diagonal resize handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'se')}
              className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1 text-white/60 hover:text-white z-20 select-none group touch-none"
              title="Kéo góc này để tùy chỉnh to nhỏ cửa sổ theo ý muốn"
            >
              <svg
                viewBox="0 0 16 16"
                width="12"
                height="12"
                className="stroke-current fill-none stroke-[2] group-hover:scale-125 transition-transform"
              >
                <path d="M14 6 L14 14 L6 14" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 10 L10 14" strokeLinecap="round" />
              </svg>
            </div>

            {/* Right edge horizontal resize handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 'e')}
              className="absolute top-12 right-0 bottom-6 w-2 cursor-e-resize hover:bg-teal-500/20 active:bg-teal-500/40 transition-colors z-20 touch-none"
              title="Kéo mép phải để điều chỉnh chiều ngang"
            />

            {/* Bottom edge vertical resize handle */}
            <div
              onPointerDown={(e) => handleResizePointerDown(e, 's')}
              className="absolute bottom-0 left-6 right-6 h-2 cursor-s-resize hover:bg-teal-500/20 active:bg-teal-500/40 transition-colors z-20 touch-none"
              title="Kéo mép dưới để điều chỉnh chiều dọc"
            />
          </>
        )}
      </div>
    </div>
  );
};
