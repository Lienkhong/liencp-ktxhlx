import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  Upload,
  Sparkles,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Shield,
  CreditCard,
  Smartphone,
  Image as ImageIcon,
  Save,
  DoorOpen,
  RotateCw,
  SwitchCamera,
  User,
  Calendar,
  MapPin,
  BedDouble,
} from 'lucide-react';
import { useDorm } from '../../context/DormContext';
import {
  normalizeCccdNumber,
  normalizePersonName,
  normalizeDateInput,
  formatToDmy,
  formatDateInputMask,
  simplifyAddress,
  getTodayStr,
} from '../../utils/helpers';
import { scanCccdQrFromImage } from '../../utils/cccdQr';
import { WorkerStatus } from '../../types';

interface CccdScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDorm?: number;
  defaultRoom?: number;
  onScanCompleted: (extractedData: {
    name?: string;
    cccd?: string;
    dob?: string;
    gender?: string;
    address?: string;
    issueDate?: string;
    issuePlace?: string;
    frontImage?: string;
    backImage?: string;
    dorm?: number;
    room?: number;
    bed?: number;
    teamLeader?: string;
    empCode?: string;
    phone?: string;
  }) => void;
  onErrorToast: (msg: string) => void;
  onSuccessToast?: (msg: string) => void;
}

type ScanStep = 'FRONT_CAPTURE' | 'FRONT_REVIEW' | 'BACK_CAPTURE' | 'FINAL_REVIEW';
type CaptureSource = 'LIVE_CAMERA' | 'UPLOAD_FILE';

/**
 * Utility: Compress & optimize image for AI OCR (max 1280px, JPEG 0.85)
 * Keeps text razor sharp while reducing camera shots to ~200-350KB for fast, reliable upload
 */
function optimizeImageForOcr(dataUrl: string, maxDim = 1280): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!dataUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Utility: Rotate image by 90 degrees
 */
function rotateImage90Deg(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!dataUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export const CccdScanModal: React.FC<CccdScanModalProps> = ({
  isOpen,
  onClose,
  defaultDorm,
  defaultRoom,
  onScanCompleted,
  onErrorToast,
  onSuccessToast,
}) => {
  const { config, addWorker, workers } = useDorm();

  const [step, setStep] = useState<ScanStep>('FRONT_CAPTURE');
  const [captureSource, setCaptureSource] = useState<CaptureSource>('LIVE_CAMERA');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [qrExtracted, setQrExtracted] = useState<boolean>(false);

  // Images
  const [frontImageBase64, setFrontImageBase64] = useState<string | null>(null);
  const [backImageBase64, setBackImageBase64] = useState<string | null>(null);

  // Extracted data
  const [extractedCccd, setExtractedCccd] = useState('');
  const [extractedName, setExtractedName] = useState('');
  const [extractedDob, setExtractedDob] = useState('');
  const [extractedGender, setExtractedGender] = useState('Nam');
  const [extractedAddress, setExtractedAddress] = useState('');
  const [extractedIssueDate, setExtractedIssueDate] = useState('');
  const [extractedIssuePlace, setExtractedIssuePlace] = useState('');

  // Dorm Assignment states
  const [assignedEmpCode, setAssignedEmpCode] = useState('');
  const [assignedPhone, setAssignedPhone] = useState('');
  const [assignedTeamLeader, setAssignedTeamLeader] = useState('');
  const [assignedDorm, setAssignedDorm] = useState<number>(defaultDorm || 1);
  const [dormInputText, setDormInputText] = useState<string>(String(defaultDorm || 1));
  const [assignedRoom, setAssignedRoom] = useState<number>(defaultRoom || 1);
  const [roomInputText, setRoomInputText] = useState<string>(String(defaultRoom || 1));
  const [assignedBed, setAssignedBed] = useState<number>(1);
  const [bedInputText, setBedInputText] = useState<string>('1');
  const [assignedStatus, setAssignedStatus] = useState<WorkerStatus>('Đang ở');
  const [isSavingDirectly, setIsSavingDirectly] = useState(false);

  // Refs for video stream and hidden file inputs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);

  // Stop camera stream helper
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start live camera stream
  const startCameraStream = useCallback(async () => {
    stopCameraStream();
    setCameraError(null);

    // If mediaDevices is not supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt không hỗ trợ truy cập camera trực tiếp. Vui lòng dùng tính năng tải ảnh.');
      setCaptureSource('UPLOAD_FILE');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.warn('Video play error:', e));
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      let msg = 'Không thể mở camera. Vui lòng cấp quyền truy cập camera trong trình duyệt.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Bạn đã từ chối quyền truy cập máy ảnh. Vui lòng bật lại quyền hoặc sử dụng tính năng tải ảnh.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Không tìm thấy thiết bị camera trên máy này. Hãy chuyển sang tải ảnh từ tệp.';
      }
      setCameraError(msg);
      // Automatically fallback to upload file mode if camera unavailable
      setCaptureSource('UPLOAD_FILE');
    }
  }, [facingMode, stopCameraStream]);

  // Handle open / close modal lifecycle
  useEffect(() => {
    if (isOpen) {
      // Auto-generate employee code
      setAssignedEmpCode(`NV${Math.floor(1000 + Math.random() * 9000)}`);
      const initDorm = defaultDorm || 1;
      const initRoom = defaultRoom || 1;
      setAssignedDorm(initDorm);
      setDormInputText(String(initDorm));
      setAssignedRoom(initRoom);
      setRoomInputText(String(initRoom));
      setAssignedBed(1);
      setBedInputText('1');
    } else {
      stopCameraStream();
      resetAllState();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, defaultDorm, defaultRoom, stopCameraStream]);

  // Manage camera streaming based on active step, captureSource and showWebcam
  useEffect(() => {
    if (isOpen && (step === 'FRONT_CAPTURE' || step === 'BACK_CAPTURE') && showWebcam) {
      startCameraStream();
    } else {
      stopCameraStream();
    }
  }, [isOpen, step, showWebcam, startCameraStream, stopCameraStream]);

  // Compute room occupancy to suggest empty bed and auto-fill team leader
  const roomOccupants = workers.filter(
    (w) => w.dorm === assignedDorm && w.room === assignedRoom && w.status === 'Đang ở'
  );
  const occupiedBeds = new Set(roomOccupants.map((w) => w.bed));
  const isRoomFull = roomOccupants.length >= config.maxBedsPerRoom;

  useEffect(() => {
    // When room changes, auto-select first unoccupied bed
    const firstFreeBed = Array.from({ length: config.maxBedsPerRoom }, (_, i) => i + 1).find(
      (b) => !occupiedBeds.has(b)
    );
    if (firstFreeBed) {
      setAssignedBed(firstFreeBed);
      setBedInputText(String(firstFreeBed));
    }

    // Auto-suggest team leader from existing roommates if any
    const existingLeader = roomOccupants.find((w) => w.teamLeader)?.teamLeader;
    if (existingLeader && !assignedTeamLeader) {
      setAssignedTeamLeader(existingLeader);
    }
  }, [assignedDorm, assignedRoom, config.maxBedsPerRoom, roomOccupants.length]);

  const handleSelectDorm = (d: number) => {
    setAssignedDorm(d);
    setDormInputText(String(d));
  };

  const handleDormTextChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    setDormInputText(cleaned);
    if (cleaned !== '') {
      const val = parseInt(cleaned, 10);
      if (!isNaN(val) && val > 0) {
        setAssignedDorm(val);
      }
    }
  };

  const handleDormTextBlur = () => {
    const val = parseInt(dormInputText, 10);
    if (isNaN(val) || val < 1) {
      setDormInputText(String(assignedDorm));
    } else {
      setAssignedDorm(val);
      setDormInputText(String(val));
    }
  };

  const handleSelectRoom = (r: number) => {
    setAssignedRoom(r);
    setRoomInputText(String(r));
  };

  const handleRoomTextChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    setRoomInputText(cleaned);
    if (cleaned !== '') {
      const val = parseInt(cleaned, 10);
      if (!isNaN(val) && val > 0) {
        setAssignedRoom(val);
      }
    }
  };

  const handleRoomTextBlur = () => {
    const val = parseInt(roomInputText, 10);
    if (isNaN(val) || val < 1) {
      setRoomInputText(String(assignedRoom));
    } else {
      setAssignedRoom(val);
      setRoomInputText(String(val));
    }
  };

  const handleSelectBed = (b: number) => {
    setAssignedBed(b);
    setBedInputText(String(b));
  };

  const handleBedTextChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, '');
    setBedInputText(cleaned);
    if (cleaned !== '') {
      const val = parseInt(cleaned, 10);
      if (!isNaN(val) && val > 0) {
        setAssignedBed(val);
      }
    }
  };

  const handleBedTextBlur = () => {
    const val = parseInt(bedInputText, 10);
    if (isNaN(val) || val < 1) {
      setBedInputText(String(assignedBed));
    } else {
      setAssignedBed(val);
      setBedInputText(String(val));
    }
  };

  const resetAllState = () => {
    setStep('FRONT_CAPTURE');
    setCaptureSource('LIVE_CAMERA');
    setShowWebcam(false);
    setCameraError(null);
    setFrontImageBase64(null);
    setBackImageBase64(null);
    setExtractedCccd('');
    setExtractedName('');
    setExtractedDob('');
    setExtractedGender('Nam');
    setExtractedAddress('');
    setExtractedIssueDate('');
    setExtractedIssuePlace('');
    setAssignedEmpCode('');
    setAssignedPhone('');
    setAssignedTeamLeader('');
    setAssignedDorm(defaultDorm || 1);
    setDormInputText(String(defaultDorm || 1));
    setAssignedRoom(defaultRoom || 1);
    setRoomInputText(String(defaultRoom || 1));
    setAssignedBed(1);
    setBedInputText('1');
    setAssignedStatus('Đang ở');
    setIsProcessingOcr(false);
    setOcrError(null);
    setQrExtracted(false);
    setIsSavingDirectly(false);
  };

  // Capture snapshot from Live Video
  const handleSnapFromCamera = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopCameraStream();

    const optimized = await optimizeImageForOcr(rawDataUrl);
    await handleImageReady(optimized);
  };

  // Upload from file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const rawDataUrl = event.target.result as string;
        const optimized = await optimizeImageForOcr(rawDataUrl);
        await handleImageReady(optimized);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle incoming image
  const handleImageReady = async (imageDataUrl: string) => {
    if (step === 'FRONT_CAPTURE') {
      setFrontImageBase64(imageDataUrl);
      setStep('FRONT_REVIEW');
      await runOcrRecognition(imageDataUrl, 'front');
    } else if (step === 'BACK_CAPTURE') {
      setBackImageBase64(imageDataUrl);
      setStep('FINAL_REVIEW');
      await runOcrRecognition(imageDataUrl, 'back');
    }
  };

  // Rotate image and re-run OCR
  const handleRotateImage = async (side: 'front' | 'back') => {
    const targetImage = side === 'front' ? frontImageBase64 : backImageBase64;
    if (!targetImage) return;

    const rotated = await rotateImage90Deg(targetImage);
    if (side === 'front') {
      setFrontImageBase64(rotated);
      await runOcrRecognition(rotated, 'front');
    } else {
      setBackImageBase64(rotated);
      await runOcrRecognition(rotated, 'back');
    }
  };

  // Call OCR backend API with instant QR scanner priority
  const runOcrRecognition = async (imageBase64: string, side: 'front' | 'back') => {
    setIsProcessingOcr(true);
    setOcrError(null);

    let foundQr = false;
    // 1. If scanning front side, attempt instant client-side QR decoding first
    if (side === 'front') {
      try {
        const qrData = await scanCccdQrFromImage(imageBase64);
        if (qrData && qrData.cccd) {
          foundQr = true;
          setQrExtracted(true);
          setExtractedCccd(normalizeCccdNumber(qrData.cccd));
          if (qrData.name) setExtractedName(normalizePersonName(qrData.name));
          if (qrData.dob) setExtractedDob(qrData.dob);
          if (qrData.gender) setExtractedGender(qrData.gender);
          if (qrData.address) setExtractedAddress(simplifyAddress(qrData.address));
          if (qrData.issueDate) setExtractedIssueDate(qrData.issueDate);
        }
      } catch (qrErr) {
        console.warn('QR scan warning:', qrErr);
      }
    }

    try {
      // Helper to execute OCR fetch with credentials: 'include' and automatic retry on GET-redirect artifact
      const doFetchOcr = async (attempt = 1): Promise<{ response: Response; result: any; rawText: string }> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        try {
          const res = await fetch('/api/ocr/cccd', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({ imageBase64, side }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const contentType = res.headers.get('content-type') || '';
          let resJson: any = null;
          let resText = '';

          if (contentType.includes('application/json')) {
            try {
              resJson = await res.json();
            } catch {
              resJson = null;
            }
          } else {
            try {
              resText = await res.text();
            } catch {
              resText = '';
            }
          }

          // If auth bridge proxy redirected the request and downgraded POST to GET,
          // or server returned needsPostRetry or 405, automatically retry once now that auth cookie is set!
          const isGetRedirectArtifact =
            res.redirected ||
            res.status === 405 ||
            Boolean(resJson?.needsPostRetry) ||
            (resJson?.error && String(resJson.error).includes('GET /api/ocr/cccd'));

          if (isGetRedirectArtifact && attempt < 3) {
            console.warn(`[OCR] Phát hiện chuyển hướng phiên làm việc (GET). Tự động gửi lại POST lần ${attempt + 1}...`);
            await new Promise((resolve) => setTimeout(resolve, 350));
            return await doFetchOcr(attempt + 1);
          }

          return { response: res, result: resJson, rawText: resText };
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
            throw new Error('Yêu cầu OCR AI quá thời gian chờ (25s). Bạn có thể thử lại hoặc nhập tay.');
          }
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            return await doFetchOcr(attempt + 1);
          }
          throw new Error('Không thể kết nối đến máy chủ OCR. Vui lòng kiểm tra lại kết nối mạng.');
        }
      };

      const { response, result, rawText } = await doFetchOcr();

      if (!response.ok || !result || !result.success) {
        // If QR already decoded all primary info, don't interrupt or show error to user
        if (foundQr) {
          return;
        }

        let errMsg = result?.error;
        if (!errMsg) {
          if (response.status === 413) {
            errMsg = 'Kích thước ảnh quá lớn đối với đường truyền. Vui lòng chụp lại hoặc tải ảnh nhỏ hơn.';
          } else if (response.status === 502 || response.status === 503 || response.status === 504) {
            errMsg = 'Máy chủ OCR AI tạm thời bận hoặc phản hồi chậm. Bạn có thể bấm Thử lại hoặc nhập tay thông tin.';
          } else if (response.status === 404) {
            errMsg = 'Dịch vụ OCR đang khởi động lại. Vui lòng thử lại sau vài giây.';
          } else if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
            errMsg = 'Máy chủ tạm thời bận. Bạn có thể chụp lại ảnh rõ nét hơn hoặc nhập tay thông tin.';
          } else {
            errMsg = `Máy chủ OCR trả về trạng thái ${response.status}. Bạn có thể quét mã QR hoặc nhập tay.`;
          }
        }
        throw new Error(errMsg);
      }

      if (result.data) {
        const d = result.data;
        if (side === 'front') {
          // If QR didn't set, or if field empty, fill with AI OCR
          setExtractedCccd((prev) => (prev ? prev : normalizeCccdNumber(String(d.cccd || ''))));
          setExtractedName((prev) => (prev ? prev : normalizePersonName(String(d.name || ''))));
          setExtractedDob((prev) => (prev ? prev : formatToDmy(String(d.dob || ''))));
          setExtractedGender((prev) => (prev ? prev : (String(d.gender || '').toLowerCase().includes('nữ') ? 'Nữ' : 'Nam')));
          setExtractedAddress((prev) => {
            if (prev) return prev;
            const rawAddr = (d.address || d.hometown || '').trim();
            return simplifyAddress(rawAddr);
          });
        } else {
          if (d.issueDate) setExtractedIssueDate(formatToDmy(String(d.issueDate)));
          if (d.issuePlace) setExtractedIssuePlace(String(d.issuePlace).trim());
        }
      }
    } catch (err: any) {
      console.warn('OCR error:', err);
      // Only show error if QR didn't already extract the data
      if (!foundQr) {
        const msg = String(err?.message || '');
        if (
          msg.includes('Unexpected token') ||
          msg.includes('is not valid JSON') ||
          msg.includes('<!doctype') ||
          msg.includes('<!DOCTYPE') ||
          msg.includes('<html')
        ) {
          setOcrError('Máy chủ OCR tạm thời gián đoạn kết nối. Bạn có thể chụp lại ảnh rõ nét hơn hoặc nhập tay thông tin.');
        } else {
          setOcrError(err.message || 'Không thể tự động nhận diện thông tin trên ảnh. Bạn có thể xoay lại ảnh hoặc nhập tay.');
        }
      }
    } finally {
      setIsProcessingOcr(false);
    }
  };

  // Option 1: Open AddEditWorkerModal with prefilled OCR data
  const handleTransferToFullModal = () => {
    onScanCompleted({
      name: normalizePersonName(extractedName),
      cccd: normalizeCccdNumber(extractedCccd),
      dob: extractedDob ? formatToDmy(extractedDob) : '',
      gender: extractedGender,
      address: extractedAddress.trim() ? simplifyAddress(extractedAddress) : '',
      issueDate: extractedIssueDate ? formatToDmy(extractedIssueDate) : '',
      issuePlace: extractedIssuePlace.trim(),
      frontImage: frontImageBase64 || undefined,
      backImage: backImageBase64 || undefined,
      dorm: assignedDorm,
      room: assignedRoom,
      bed: assignedBed,
      teamLeader: assignedTeamLeader.trim(),
      empCode: assignedEmpCode.trim(),
      phone: assignedPhone.trim(),
    });
    onClose();
  };

  // Option 2: Save worker directly into the dormitory database
  const handleSaveDirectlyToDorm = async () => {
    if (isRoomFull) {
      onErrorToast(`Phòng ${assignedRoom} (Dãy ${assignedDorm}) đã kín người (${config.maxBedsPerRoom} người). Vui lòng chọn phòng khác!`);
      return;
    }

    setIsSavingDirectly(true);
    try {
      const cleanName = extractedName.trim() ? normalizePersonName(extractedName) : 'Công nhân mới';
      const cleanEmpCode = assignedEmpCode.trim() ? assignedEmpCode.trim().toUpperCase() : `NV${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanCccd = extractedCccd.trim() ? normalizeCccdNumber(extractedCccd) : '';

      const res = await addWorker({
        name: cleanName,
        empCode: cleanEmpCode,
        cccd: cleanCccd,
        dob: extractedDob ? formatToDmy(extractedDob) : '',
        gender: extractedGender,
        phone: assignedPhone.trim(),
        address: extractedAddress.trim() ? simplifyAddress(extractedAddress) : '',
        dorm: assignedDorm,
        room: assignedRoom,
        bed: assignedBed,
        teamLeader: assignedTeamLeader.trim(),
        status: assignedStatus,
        entryDate: getTodayStr(),
        exitDate: '',
        issueDate: extractedIssueDate ? formatToDmy(extractedIssueDate) : '',
        issuePlace: extractedIssuePlace.trim(),
        cccdFrontImage: frontImageBase64 || undefined,
        cccdBackImage: backImageBase64 || undefined,
        note: `Nhập tự động qua OCR CCCD ngày ${new Date().toLocaleDateString('vi-VN')}`,
      });

      if (res.success) {
        if (onSuccessToast) {
          onSuccessToast(`Đã thêm thành công công nhân ${cleanName} vào Dãy ${assignedDorm} - Phòng ${assignedRoom}!`);
        }
        onClose();
      } else {
        onErrorToast(res.message || 'Lỗi khi lưu thông tin công nhân');
      }
    } catch (err: any) {
      console.error('Error saving directly:', err);
      onErrorToast('Lỗi khi lưu dữ liệu công nhân');
    } finally {
      setIsSavingDirectly(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Hidden File Input for Image Upload (Giữ nguyên) */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Hidden Camera Input (Mở thẳng đến máy ảnh - Bỏ khung) */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="bg-white dark:bg-[#111a2e] rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-[#223050] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#223050] flex items-center justify-between bg-slate-50 dark:bg-[#0c1322]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Chụp ảnh OCR Căn cước công dân
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Gemini
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'FRONT_CAPTURE' && 'Bước 1/4: Chụp hoặc tải ảnh Mặt Trước CCCD'}
                {step === 'FRONT_REVIEW' && 'Bước 2/4: Kiểm tra thông tin nhận diện Mặt Trước'}
                {step === 'BACK_CAPTURE' && 'Bước 3/4: Chụp hoặc tải ảnh Mặt Sau CCCD'}
                {step === 'FINAL_REVIEW' && 'Bước 4/4: Xác nhận hồ sơ & Lưu vào danh sách KTX'}
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4">
          
          {/* STEP 1: FRONT CAPTURE OR STEP 3: BACK CAPTURE */}
          {(step === 'FRONT_CAPTURE' || step === 'BACK_CAPTURE') && (
            <div className="space-y-4">
              
              {/* Capture Source Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-[#090f1f] p-1.5 rounded-xl border border-slate-200 dark:border-[#223050]">
                <button
                  type="button"
                  onClick={() => {
                    setCaptureSource('LIVE_CAMERA');
                    setShowWebcam(false);
                    if (cameraInputRef.current) {
                      cameraInputRef.current.click();
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    captureSource === 'LIVE_CAMERA'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Chụp ảnh bằng Máy ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCaptureSource('UPLOAD_FILE');
                    setShowWebcam(false);
                    stopCameraStream();
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    captureSource === 'UPLOAD_FILE'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải ảnh từ máy / Tệp</span>
                </button>
              </div>

              {/* LIVE CAMERA VIEW (MỞ THẲNG ĐẾN MÁY ẢNH - BỎ KHUNG) */}
              {captureSource === 'LIVE_CAMERA' && (
                <div className="space-y-3">
                  {!showWebcam ? (
                    <div
                      onClick={() => cameraInputRef.current?.click()}
                      className="p-8 sm:p-10 bg-gradient-to-b from-blue-600/15 via-slate-900/40 to-slate-900/80 rounded-2xl border-2 border-dashed border-blue-500/50 hover:border-blue-400 text-center space-y-4 cursor-pointer transition-all hover:bg-blue-500/20 group shadow-lg"
                    >
                      <div className="w-20 h-20 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-xl group-hover:scale-105 transition-transform">
                        <Camera className="w-10 h-10" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                          Chụp ảnh {step === 'FRONT_CAPTURE' ? 'Mặt trước' : 'Mặt sau'} CCCD
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                          Mở thẳng ứng dụng máy ảnh trên thiết bị để chụp toàn cảnh không bị giới hạn khung hình. Chụp rõ nét để AI tự động trích xuất thông tin.
                        </p>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cameraInputRef.current?.click();
                          }}
                          className="px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-xl inline-flex items-center gap-2.5 transition-all ring-4 ring-blue-500/20 cursor-pointer"
                        >
                          <Camera className="w-5 h-5" />
                          <span>Mở máy ảnh chụp ngay</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cameraError ? (
                        <div className="p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl text-center space-y-3">
                          <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto" />
                          <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                            {cameraError}
                          </p>
                          <button
                            type="button"
                            onClick={() => cameraInputRef.current?.click()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 mx-auto"
                          >
                            <Camera className="w-4 h-4" />
                            <span>Mở máy ảnh trên thiết bị</span>
                          </button>
                        </div>
                      ) : (
                        <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center shadow-lg border border-slate-800">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />

                          {/* BỎ KHUNG: KHÔNG CÒN KHUNG VIỀN ĐỨT ĐOẠN, MASK ĐEN HAY GÓC GIỚI HẠN */}

                          {/* Switch Camera Button (Front / Rear) */}
                          <button
                            type="button"
                            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                            className="absolute top-3 right-3 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs shadow-md transition-all cursor-pointer"
                            title="Đổi camera trước / sau"
                          >
                            <SwitchCamera className="w-5 h-5" />
                          </button>
                        </div>
                      )}

                      {/* Shutter Button for Live Webcam */}
                      {!cameraError && (
                        <div className="flex items-center justify-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={handleSnapFromCamera}
                            className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm shadow-xl flex items-center gap-2.5 transition-all cursor-pointer ring-4 ring-blue-500/20"
                          >
                            <Camera className="w-5 h-5" />
                            <span>Chụp ảnh {step === 'FRONT_CAPTURE' ? 'Mặt trước' : 'Mặt sau'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions & Webcam Switcher */}
                  <div className="flex items-center justify-between pt-1">
                    {!showWebcam ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowWebcam(true);
                          startCameraStream();
                        }}
                        className="text-xs text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400 underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        Hoặc mở xem trực tiếp qua Webcam máy tính
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowWebcam(false);
                          stopCameraStream();
                        }}
                        className="text-xs text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 underline underline-offset-2 transition-colors cursor-pointer"
                      >
                        Đóng Webcam &amp; Mở máy ảnh thiết bị
                      </button>
                    )}

                    {step === 'BACK_CAPTURE' && (
                      <button
                        type="button"
                        onClick={() => setStep('FINAL_REVIEW')}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors ml-auto"
                      >
                        Bỏ qua mặt sau &amp; Xem kết quả
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* UPLOAD FILE VIEW */}
              {captureSource === 'UPLOAD_FILE' && (
                <div className="space-y-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 sm:p-10 bg-gradient-to-b from-blue-500/10 via-slate-900/40 to-slate-900/80 rounded-2xl border-2 border-dashed border-blue-500/40 hover:border-blue-400 text-center space-y-3 cursor-pointer transition-all hover:bg-blue-500/15"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mx-auto shadow-inner">
                      <Upload className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white">
                        Nhấn để chọn ảnh {step === 'FRONT_CAPTURE' ? 'Mặt trước' : 'Mặt sau'} CCCD
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                        Hỗ trợ định dạng JPG, PNG, WEBP. Ảnh sắc nét, đầy đủ 4 góc thẻ sẽ giúp AI nhận diện đạt độ chính xác 100%.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Upload className="w-5 h-5" />
                      <span>Chọn ảnh từ máy tính / điện thoại</span>
                    </button>

                    {step === 'BACK_CAPTURE' && (
                      <button
                        type="button"
                        onClick={() => setStep('FINAL_REVIEW')}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                      >
                        Bỏ qua mặt sau & Xem kết quả
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* STEP 2: FRONT REVIEW & OCR ADJUSTMENT */}
          {step === 'FRONT_REVIEW' && (
            <div className="space-y-4">
              {isProcessingOcr ? (
                <div className="py-14 text-center space-y-3">
                  <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                    <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                    <Sparkles className="w-4 h-4 text-amber-400 absolute" />
                  </div>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                    AI Gemini đang trích xuất dữ liệu CCCD...
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Đang phân tích số CCCD 12 số, họ tên có dấu, ngày sinh, giới tính và nơi thường trú.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {qrExtracted && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-semibold">Đã quét thông tin chính xác 100% từ mã QR trên thẻ CCCD!</span>
                    </div>
                  )}

                  {ocrError && !qrExtracted && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{ocrError}</span>
                    </div>
                  )}

                  {/* Image and Fields Split */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                    {/* Front Image preview with Rotate option */}
                    {frontImageBase64 && (
                      <div className="sm:col-span-5 rounded-xl overflow-hidden border border-slate-200 dark:border-[#223050] bg-slate-900 flex flex-col items-center justify-center p-2 space-y-2">
                        <img
                          src={frontImageBase64}
                          alt="CCCD Mặt trước"
                          className="max-h-48 object-contain rounded-lg shadow-sm"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRotateImage('front')}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition-colors"
                            title="Xoay ảnh 90 độ và quét lại nếu ảnh bị ngược"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Xoay 90° & Quét lại</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Extracted Form Inputs */}
                    <div className="sm:col-span-7 space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Họ và tên công nhân (VIẾT HOA CÓ DẤU)
                        </label>
                        <input
                          type="text"
                          value={extractedName}
                          onChange={(e) => setExtractedName(e.target.value)}
                          placeholder="NGUYỄN VĂN A"
                          className="w-full px-3 py-2 text-sm font-bold uppercase rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Số CCCD (12 chữ số)
                          </label>
                          <input
                            type="text"
                            maxLength={12}
                            value={extractedCccd}
                            onChange={(e) => setExtractedCccd(normalizeCccdNumber(e.target.value))}
                            placeholder="001201012345"
                            className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-blue-600 dark:text-blue-400 outline-hidden focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center justify-between">
                            <span>Ngày sinh (dd/mm/yyyy)</span>
                            <span className="text-[9px] text-slate-400">dd/mm/yyyy</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={10}
                            value={extractedDob}
                            onChange={(e) => setExtractedDob(formatDateInputMask(e.target.value))}
                            onBlur={() => {
                              if (extractedDob) setExtractedDob(formatToDmy(extractedDob));
                            }}
                            placeholder="dd/mm/yyyy (ví dụ: 15/08/1996)"
                            className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Giới tính
                          </label>
                          <select
                            value={extractedGender}
                            onChange={(e) => setExtractedGender(e.target.value)}
                            className="w-full px-2.5 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                          >
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center justify-between">
                            <span>Thường trú (Xã/phường, Tỉnh)</span>
                            <span className="text-[9px] text-slate-400">Ví dụ: Cẩm Phả, Quảng Ninh</span>
                          </label>
                          <input
                            type="text"
                            value={extractedAddress}
                            onChange={(e) => setExtractedAddress(e.target.value)}
                            onBlur={() => {
                              if (extractedAddress) setExtractedAddress(simplifyAddress(extractedAddress));
                            }}
                            placeholder="Ví dụ: Cẩm Phả, Quảng Ninh hoặc Quảng Trạch, Quảng Bình"
                            className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Quick Dorm & Room Selection right in Step 2 */}
                      <div className="pt-2.5 border-t border-slate-200 dark:border-[#223050] space-y-2">
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <DoorOpen className="w-3.5 h-3.5 text-blue-500" />
                            <span>Chọn Dãy & Phòng KTX:</span>
                            <span className="text-blue-600 dark:text-blue-400 font-extrabold ml-1">
                              Dãy {assignedDorm} - Phòng {String(assignedRoom).padStart(2, '0')}
                            </span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {/* Dãy */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                              <span>Dãy KTX</span>
                              <span className="text-[9px] text-slate-400">1-{config?.numDorms || 8}</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <select
                                value={assignedDorm}
                                onChange={(e) => handleSelectDorm(Number(e.target.value) || 1)}
                                className="flex-1 min-w-0 px-2 py-1.5 text-xs font-bold rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                              >
                                {Array.from({ length: Math.max(config?.numDorms || 8, assignedDorm) }, (_, i) => i + 1).map((d) => (
                                  <option key={d} value={d}>Dãy {d}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={dormInputText}
                                onChange={(e) => handleDormTextChange(e.target.value)}
                                onBlur={handleDormTextBlur}
                                placeholder="Số dãy"
                                className="w-14 px-1 py-1.5 text-xs text-center font-bold rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                                title="Gõ trực tiếp số dãy KTX"
                              />
                            </div>
                          </div>

                          {/* Phòng */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                              <span>Phòng</span>
                              <span className="text-[9px] text-slate-400">1-{config?.roomsPerDorm || 20}</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <select
                                value={assignedRoom}
                                onChange={(e) => handleSelectRoom(Number(e.target.value) || 1)}
                                className="flex-1 min-w-0 px-2 py-1.5 text-xs font-bold rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                              >
                                {Array.from({ length: Math.max(config?.roomsPerDorm || 20, assignedRoom) }, (_, i) => i + 1).map((r) => (
                                  <option key={r} value={r}>Phòng {String(r).padStart(2, '0')}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={roomInputText}
                                onChange={(e) => handleRoomTextChange(e.target.value)}
                                onBlur={handleRoomTextBlur}
                                placeholder="Phòng"
                                className="w-14 px-1 py-1.5 text-xs text-center font-bold rounded-lg bg-slate-50 dark:bg-[#090f1f] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                                title="Gõ trực tiếp số phòng KTX"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-[#223050]">
                    <button
                      type="button"
                      onClick={() => setStep('FRONT_CAPTURE')}
                      className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Chụp lại mặt trước
                    </button>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTransferToFullModal}
                        className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                        title="Mở biểu mẫu chi tiết với dãy và phòng đã chọn"
                      >
                        Mở biểu mẫu chi tiết
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveDirectlyToDorm}
                        disabled={isSavingDirectly || isRoomFull}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Lưu ngay vào dãy và phòng đã chọn"
                      >
                        {isSavingDirectly ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Lưu ngay</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStep('FINAL_REVIEW')}
                        className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
                      >
                        Bỏ qua mặt sau
                      </button>

                      <button
                        type="button"
                        onClick={() => setStep('BACK_CAPTURE')}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-1.5 transition-all"
                      >
                        <span>Chụp mặt sau</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: FINAL REVIEW & SAVE TO DORM */}
          {step === 'FINAL_REVIEW' && (
            <div className="space-y-4">
              
              {/* Summary Card */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle className="w-5 h-5" />
                    <span>Dữ liệu OCR trích xuất thành công:</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Đã chuẩn hóa
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <div>Họ và tên: <strong className="text-slate-900 dark:text-white uppercase">{extractedName || '(Chưa có)'}</strong></div>
                  <div>Số CCCD: <strong className="font-mono text-blue-600 dark:text-blue-400">{extractedCccd || '(Chưa có)'}</strong></div>
                  <div>Ngày sinh: <strong>{extractedDob ? formatToDmy(extractedDob) : '(Chưa có)'}</strong></div>
                  <div>Giới tính: <strong>{extractedGender}</strong></div>
                  <div className="sm:col-span-2">Thường trú: <strong>{extractedAddress || '(Chưa có)'}</strong></div>
                  {extractedIssueDate && <div>Ngày cấp: <strong>{formatToDmy(extractedIssueDate)}</strong></div>}
                  {extractedIssuePlace && <div>Nơi cấp: <strong>{extractedIssuePlace}</strong></div>}
                </div>
              </div>

              {/* Fast Room & Bed Assignment Box */}
              <div className="p-4 bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-[#223050] rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                    <DoorOpen className="w-4 h-4 text-blue-500" />
                    <span>Xếp chỗ ở Ký túc xá:</span>
                    <span className="text-blue-600 dark:text-blue-400 font-extrabold ml-1">
                      Dãy {assignedDorm} - Phòng {String(assignedRoom).padStart(2, '0')} - Giường G.{assignedBed}
                    </span>
                  </div>
                  {isRoomFull && (
                    <span className="text-[11px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">
                      ⚠️ Phòng này đã đủ {config.maxBedsPerRoom} người
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Mã nhân viên
                    </label>
                    <input
                      type="text"
                      value={assignedEmpCode}
                      onChange={(e) => setAssignedEmpCode(e.target.value)}
                      placeholder="NV1234"
                      className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                      <span>Dãy KTX</span>
                      <span className="text-[10px] text-slate-400 font-normal">({config?.numDorms || 8} dãy)</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={assignedDorm}
                        onChange={(e) => handleSelectDorm(Number(e.target.value) || 1)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                      >
                        {Array.from({ length: Math.max(config?.numDorms || 8, assignedDorm) }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>Dãy {d}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={dormInputText}
                        onChange={(e) => handleDormTextChange(e.target.value)}
                        onBlur={handleDormTextBlur}
                        placeholder="Số dãy"
                        className="w-14 px-1 py-1.5 text-xs text-center font-bold rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                        title="Gõ trực tiếp số dãy KTX"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                      <span>Phòng</span>
                      <span className="text-[10px] text-slate-400 font-normal">({config?.roomsPerDorm || 20} phòng)</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={assignedRoom}
                        onChange={(e) => handleSelectRoom(Number(e.target.value) || 1)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                      >
                        {Array.from({ length: Math.max(config?.roomsPerDorm || 20, assignedRoom) }, (_, i) => i + 1).map((r) => (
                          <option key={r} value={r}>Phòng {String(r).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={roomInputText}
                        onChange={(e) => handleRoomTextChange(e.target.value)}
                        onBlur={handleRoomTextBlur}
                        placeholder="Phòng"
                        className="w-14 px-1 py-1.5 text-xs text-center font-bold rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                        title="Gõ trực tiếp số phòng KTX"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                      <span>Giường</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                        ({(config?.maxBedsPerRoom || 30) - occupiedBeds.size} trống)
                      </span>
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={assignedBed}
                        onChange={(e) => handleSelectBed(Number(e.target.value) || 1)}
                        className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                      >
                        {Array.from({ length: config?.maxBedsPerRoom || 30 }, (_, i) => i + 1).map((b) => {
                          const occupant = roomOccupants.find((w) => w.bed === b);
                          return (
                            <option key={b} value={b} disabled={Boolean(occupant)}>
                              G.{b} {occupant ? `(${occupant.name})` : '(Trống)'}
                            </option>
                          );
                        })}
                      </select>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={bedInputText}
                        onChange={(e) => handleBedTextChange(e.target.value)}
                        onBlur={handleBedTextBlur}
                        placeholder="G."
                        className="w-12 px-1 py-1.5 text-xs text-center font-bold rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white outline-hidden focus:border-blue-500"
                        title="Gõ trực tiếp số giường"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Số điện thoại liên hệ (Tùy chọn)
                    </label>
                    <input
                      type="tel"
                      value={assignedPhone}
                      onChange={(e) => setAssignedPhone(e.target.value)}
                      placeholder="0987654321"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Tổ trưởng quản lý (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={assignedTeamLeader}
                      onChange={(e) => setAssignedTeamLeader(e.target.value)}
                      placeholder="Tên tổ trưởng"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-[#111a2e] border border-slate-300 dark:border-[#223050] text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-[#223050]">
                <button
                  type="button"
                  onClick={() => setStep('FRONT_REVIEW')}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Sửa lại thông tin
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleTransferToFullModal}
                    className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    Mở biểu mẫu chi tiết
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDirectlyToDorm}
                    disabled={isSavingDirectly || isRoomFull}
                    className="flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isSavingDirectly ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Lưu vào KTX ngay</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
