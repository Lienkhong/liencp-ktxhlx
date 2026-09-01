import React, { useState } from 'react';
import { DormProvider, useDorm } from './context/DormContext';
import { Header } from './components/Header';
import { Breadcrumb } from './components/Breadcrumb';
import { DashboardCards } from './components/DashboardCards';
import { DormGrid } from './components/DormGrid';
import { RoomGrid } from './components/RoomGrid';
import { WorkersTable } from './components/WorkersTable';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';

// Modals
import { AddEditWorkerModal } from './components/Modals/AddEditWorkerModal';
import { SearchModal } from './components/Modals/SearchModal';
import { DuplicateEmpCodeModal } from './components/Modals/DuplicateEmpCodeModal';
import { DeleteByEmpCodeModal } from './components/Modals/DeleteByEmpCodeModal';
import { ActiveRoomsModal } from './components/Modals/ActiveRoomsModal';
import { TeamLeadersModal } from './components/Modals/TeamLeadersModal';
import { CccdScanModal } from './components/Modals/CccdScanModal';
import { CccdGalleryModal } from './components/Modals/CccdGalleryModal';
import { ExcelImportModal } from './components/Modals/ExcelImportModal';
import { ExcelExportModal } from './components/Modals/ExcelExportModal';
import { JsonBackupRestoreModal } from './components/Modals/JsonBackupRestoreModal';
import { ScaleSettingsModal } from './components/Modals/ScaleSettingsModal';
import { UserManagementModal } from './components/Modals/UserManagementModal';
import { AuditLogsModal } from './components/Modals/AuditLogsModal';
import { EditManagerModal } from './components/Modals/EditManagerModal';
import { ConfirmDeleteModal } from './components/Modals/ConfirmDeleteModal';
import { LoginModal } from './components/Modals/LoginModal';

import { Worker } from './types';
import {
  Building2,
  Users,
  UserCheck,
  Settings,
  Shield,
  HardDrive,
  History,
  FileSpreadsheet,
  Plus,
  Camera,
  Layers,
} from 'lucide-react';

const DormApp: React.FC = () => {
  const { currentUser } = useDorm();

  // Navigation State
  const [selectedDorm, setSelectedDorm] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);

  // Filter shortcuts from Dashboard cards
  const [tableStatusFilter, setTableStatusFilter] = useState<string>('ALL');
  const [tableEnteredToday, setTableEnteredToday] = useState<boolean>(false);
  const [tableExitedToday, setTableExitedToday] = useState<boolean>(false);

  // Toast Notification State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Modals Visibility
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<Worker | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [workerToViewCccd, setWorkerToViewCccd] = useState<Worker | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDuplicateCheckerOpen, setIsDuplicateCheckerOpen] = useState(false);
  const [isDeleteByEmpCodeOpen, setIsDeleteByEmpCodeOpen] = useState(false);
  const [isActiveRoomsOpen, setIsActiveRoomsOpen] = useState(false);
  const [isTeamLeadersOpen, setIsTeamLeadersOpen] = useState(false);
  const [isCccdScanOpen, setIsCccdScanOpen] = useState(false);
  const [isCccdGalleryOpen, setIsCccdGalleryOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isExcelExportOpen, setIsExcelExportOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'scale' | 'backup'>('scale');
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [isEditManagerOpen, setIsEditManagerOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Navigation handlers
  const handleSelectRoot = () => {
    setSelectedDorm(null);
    setSelectedRoom(null);
  };

  const handleSelectDorm = (dorm: number) => {
    setSelectedDorm(dorm);
    setSelectedRoom(null);
  };

  const handleSelectRoom = (room: number) => {
    setSelectedRoom(room);
  };

  // Dashboard shortcuts
  const handleFilterActive = () => {
    setTableStatusFilter('Đang ở');
    setTableEnteredToday(false);
    setTableExitedToday(false);
    addToast('info', 'Đang lọc danh sách công nhân Đang ở');
  };

  const handleFilterTodayEntered = () => {
    setTableEnteredToday(true);
    setTableExitedToday(false);
    setTableStatusFilter('ALL');
    addToast('info', 'Đang lọc danh sách công nhân vào KTX hôm nay');
  };

  const handleFilterTodayExited = () => {
    setTableExitedToday(true);
    setTableEnteredToday(false);
    setTableStatusFilter('ALL');
    addToast('info', 'Đang lọc danh sách công nhân rời KTX hôm nay');
  };

  // Open Add modal with OCR prefilled data
  const handleOcrCompleted = (extracted: any) => {
    setWorkerToEdit({
      id: '',
      name: extracted.name || '',
      cccd: extracted.cccd || '',
      dob: extracted.dob || '',
      address: extracted.address || '',
      empCode: '',
      phone: '',
      dorm: selectedDorm || 1,
      room: selectedRoom || 1,
      bed: 1,
      status: 'Đang ở',
      entryDate: new Date().toISOString().split('T')[0],
      exitDate: '',
      cccdFrontImage: extracted.frontImage,
      cccdBackImage: extracted.backImage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsAddWorkerOpen(true);
    addToast('success', 'Đã nạp dữ liệu OCR thành công vào biểu mẫu!');
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      
      {/* Toast Notification Layer */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Main Top Header */}
      <Header
        onOpenEditManager={() => setIsEditManagerOpen(true)}
        onOpenDuplicateChecker={() => setIsDuplicateCheckerOpen(true)}
        onOpenCccdScan={() => setIsCccdScanOpen(true)}
        onOpenAddWorker={() => {
          setWorkerToEdit(null);
          setIsAddWorkerOpen(true);
        }}
        onOpenSettings={() => {
          setSettingsTab('scale');
          setIsSettingsOpen(true);
        }}
        onOpenImportModal={() => setIsExcelImportOpen(true)}
        onOpenExportModal={() => setIsExcelExportOpen(true)}
        onOpenBackupModal={() => {
          setSettingsTab('backup');
          setIsSettingsOpen(true);
        }}
        onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
        onOpenUserManagement={() => setIsUserManagementOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top Metric Cards */}
        <DashboardCards
          onFilterActive={handleFilterActive}
          onFilterTodayEntered={handleFilterTodayEntered}
          onFilterTodayExited={handleFilterTodayExited}
          onOpenTeamLeaders={() => setIsTeamLeadersOpen(true)}
          onOpenActiveRooms={() => setIsActiveRoomsOpen(true)}
        />

        {/* Breadcrumb Navigation */}
        <Breadcrumb
          selectedDorm={selectedDorm}
          selectedRoom={selectedRoom}
          onSelectRoot={handleSelectRoot}
          onSelectDorm={handleSelectDorm}
        />

        {/* View Switching: Dorms List OR Room Details in Selected Dorm */}
        {selectedDorm === null ? (
          <DormGrid onSelectDorm={handleSelectDorm} />
        ) : selectedRoom === null ? (
          <RoomGrid
            dormNumber={selectedDorm}
            onSelectRoom={handleSelectRoom}
            onBackToDorms={handleSelectRoot}
            onAddWorkerToRoom={(dorm, room) => {
              setWorkerToEdit(null);
              setSelectedDorm(dorm);
              setSelectedRoom(room);
              setIsAddWorkerOpen(true);
            }}
          />
        ) : null}

        {/* Workers Main Table */}
        <div className="pt-2">
          <WorkersTable
            key={`${selectedDorm}-${selectedRoom}-${tableStatusFilter}-${tableEnteredToday}-${tableExitedToday}`}
            selectedDormFilter={selectedDorm}
            selectedRoomFilter={selectedRoom}
            onClearRoomFilter={() => setSelectedRoom(null)}
            initialStatusFilter={tableStatusFilter}
            initialEnteredToday={tableEnteredToday}
            initialExitedToday={tableExitedToday}
            onEditWorker={(worker) => {
              setWorkerToEdit(worker);
              setIsAddWorkerOpen(true);
            }}
            onDeleteWorker={(worker) => {
              setWorkerToDelete(worker);
            }}
            onViewCccd={(worker) => {
              setWorkerToViewCccd(worker);
              setIsCccdGalleryOpen(true);
            }}
            onOpenAddWorker={() => {
              setWorkerToEdit(null);
              setIsAddWorkerOpen(true);
            }}
            onOpenSearchModal={() => setIsSearchOpen(true)}
            onOpenDeleteByEmpCodeModal={() => setIsDeleteByEmpCodeOpen(true)}
            onOpenExportModal={() => setIsExcelExportOpen(true)}
            onOpenImportModal={() => setIsExcelImportOpen(true)}
          />
        </div>

        {/* System Administration Shortcuts Banner */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Tiện ích hệ thống nâng cao:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTeamLeadersOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/60 hover:bg-violet-100 dark:hover:bg-violet-900/60 text-violet-700 dark:text-violet-300 transition-colors border border-violet-200 dark:border-violet-800 font-medium"
            >
              <UserCheck className="w-3.5 h-3.5 text-violet-600" />
              <span>Danh sách tổ trưởng</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCccdGalleryOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-blue-500" />
              <span>Kho ảnh CCCD</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSettingsTab('backup');
                setIsSettingsOpen(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
              <span>Sao lưu / Phục hồi JSON</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAuditLogsOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <History className="w-3.5 h-3.5 text-amber-500" />
              <span>Nhật ký thao tác</span>
            </button>

            {currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => setIsUserManagementOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 transition-colors border border-rose-200 dark:border-rose-800 font-semibold"
              >
                <Shield className="w-3.5 h-3.5 text-rose-600" />
                <span>Phân quyền tài khoản</span>
              </button>
            )}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs py-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>Hệ thống Quản lý Ký túc xá Công nhân • Phiên bản Web Enterprise • Hỗ trợ OCR CCCD & Xuất Excel 2 Sheet</p>
      </footer>

      {/* All Modal Overlays */}
      <AddEditWorkerModal
        isOpen={isAddWorkerOpen}
        onClose={() => {
          setIsAddWorkerOpen(false);
          setWorkerToEdit(null);
        }}
        workerToEdit={workerToEdit}
        initialDorm={selectedDorm || 1}
        initialRoom={selectedRoom || 1}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectWorker={(worker) => {
          setSelectedDorm(worker.dorm);
          setSelectedRoom(worker.room);
        }}
      />

      <DuplicateEmpCodeModal
        isOpen={isDuplicateCheckerOpen}
        onClose={() => setIsDuplicateCheckerOpen(false)}
        onEditWorker={(worker) => {
          setWorkerToEdit(worker);
          setIsAddWorkerOpen(true);
        }}
        onDeleteWorker={(worker) => {
          setWorkerToDelete(worker);
        }}
      />

      <DeleteByEmpCodeModal
        isOpen={isDeleteByEmpCodeOpen}
        onClose={() => setIsDeleteByEmpCodeOpen(false)}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <ActiveRoomsModal
        isOpen={isActiveRoomsOpen}
        onClose={() => setIsActiveRoomsOpen(false)}
        onSelectRoom={(dorm, room) => {
          setSelectedDorm(dorm);
          setSelectedRoom(room);
        }}
      />

      <TeamLeadersModal
        isOpen={isTeamLeadersOpen}
        onClose={() => setIsTeamLeadersOpen(false)}
        onSelectRoom={(dorm, room) => {
          setSelectedDorm(dorm);
          setSelectedRoom(room);
        }}
      />

      <CccdScanModal
        isOpen={isCccdScanOpen}
        onClose={() => setIsCccdScanOpen(false)}
        onScanCompleted={handleOcrCompleted}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <CccdGalleryModal
        isOpen={isCccdGalleryOpen}
        onClose={() => {
          setIsCccdGalleryOpen(false);
          setWorkerToViewCccd(null);
        }}
        selectedWorker={workerToViewCccd}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <ExcelExportModal
        isOpen={isExcelExportOpen}
        onClose={() => setIsExcelExportOpen(false)}
        onSuccessToast={(msg) => addToast('success', msg)}
      />

      <JsonBackupRestoreModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <ScaleSettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <AuditLogsModal
        isOpen={isAuditLogsOpen}
        onClose={() => setIsAuditLogsOpen(false)}
      />

      <EditManagerModal
        isOpen={isEditManagerOpen}
        onClose={() => setIsEditManagerOpen(false)}
        onSuccessToast={(msg) => addToast('success', msg)}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(workerToDelete)}
        worker={workerToDelete}
        onClose={() => setWorkerToDelete(null)}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccessToast={(msg) => addToast('success', msg)}
        onErrorToast={(msg) => addToast('error', msg)}
      />

    </div>
  );
};

export function App() {
  return (
    <DormProvider>
      <DormApp />
    </DormProvider>
  );
}

export default App;
