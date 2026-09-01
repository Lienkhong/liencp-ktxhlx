import React, { useState, useRef, useEffect } from 'react';
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
  Edit2,
  FileCheck,
} from 'lucide-react';
import { normalizeCccdNumber, normalizePersonName, normalizeDateInput } from '../../utils/helpers';

interface CccdScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanCompleted: (extractedData: {
    name?: string;
    cccd?: string;
    dob?: string;
    address?: string;
    issueDate?: string;
    issuePlace?: string;
    frontImage?: string;
    backImage?: string;
  }) => void;
  onErrorToast: (msg: string) => void;
}

type ScanStep = 'FRONT_CAPTURE' | 'FRONT_REVIEW' | 'BACK_CAPTURE' | 'FINAL_REVIEW';

export const CccdScanModal: React.FC<CccdScanModalProps> = ({
  isOpen,
  onClose,
  onScanCompleted,
  onErrorToast,
}) => {
  const [step, setStep] = useState<ScanStep>('FRONT_CAPTURE');
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Images
  const [frontImageBase64, setFrontImageBase64] = useState<string | null>(null);
  const [backImageBase64, setBackImageBase64] = useState<string | null>(null);

  // Extracted data
  const [extractedCccd, setExtractedCccd] = useState('');
  const [extractedName, setExtractedName] = useState('');
  const [extractedDob, setExtractedDob] = useState('');
  const [extractedAddress, setExtractedAddress] = useState('');
  const [extractedIssueDate, setExtractedIssueDate] = useState('');
  const [extractedIssuePlace, setExtractedIssuePlace] = useState('');

  // Camera stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      resetState();
    } else {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const resetState = () => {
    setStep('FRONT_CAPTURE');
    setFrontImageBase64(null);
    setBackImageBase64(null);
    setExtractedCccd('');
    setExtractedName('');
    setExtractedDob('');
    setExtractedAddress('');
    setExtractedIssueDate('');
    setExtractedIssuePlace('');
    setIsProcessingOcr(false);
    setOcrError(null);
  };

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraActive(true);
        }
      }
    } catch (err) {
      console.warn('Camera access error or permission denied:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      handleImageCaptured(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleImageCaptured(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageCaptured = async (imageDataUrl: string) => {
    if (step === 'FRONT_CAPTURE') {
      setFrontImageBase64(imageDataUrl);
      await processOcr(imageDataUrl, 'front');
      setStep('FRONT_REVIEW');
    } else if (step === 'BACK_CAPTURE') {
      setBackImageBase64(imageDataUrl);
      await processOcr(imageDataUrl, 'back');
      setStep('FINAL_REVIEW');
    }
  };

  const processOcr = async (imageBase64: string, side: 'front' | 'back') => {
    setIsProcessingOcr(true);
    setOcrError(null);

    try {
      const response = await fetch('/api/ocr/cccd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, side }),
      });

      if (!response.ok) {
        throw new Error('Không thể kết nối máy chủ OCR');
      }

      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        if (side === 'front') {
          if (d.cccd) setExtractedCccd(normalizeCccdNumber(d.cccd));
          if (d.name) setExtractedName(normalizePersonName(d.name));
          if (d.dob) setExtractedDob(normalizeDateInput(d.dob));
          if (d.address || d.hometown) {
            setExtractedAddress(d.address || d.hometown || '');
          }
        } else {
          if (d.issueDate) setExtractedIssueDate(normalizeDateInput(d.issueDate));
          if (d.issuePlace) setExtractedIssuePlace(d.issuePlace);
        }
      }
    } catch (err: any) {
      console.warn('OCR error:', err);
      setOcrError('Không thể tự động nhận diện thông tin qua AI. Bạn có thể nhập tay thông tin bên dưới.');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleFinishAndFill = () => {
    onScanCompleted({
      name: normalizePersonName(extractedName),
      cccd: normalizeCccdNumber(extractedCccd),
      dob: normalizeDateInput(extractedDob),
      address: extractedAddress.trim(),
      issueDate: extractedIssueDate,
      issuePlace: extractedIssuePlace,
      frontImage: frontImageBase64 || undefined,
      backImage: backImageBase64 || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                Quét & Nhận diện CCCD (AI OCR)
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                  Gemini Flash
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {step === 'FRONT_CAPTURE' && 'Bước 1/4: Chụp hoặc tải ảnh Mặt Trước CCCD'}
                {step === 'FRONT_REVIEW' && 'Bước 2/4: Kiểm tra & Chỉnh sửa thông tin Mặt Trước'}
                {step === 'BACK_CAPTURE' && 'Bước 3/4: Chụp hoặc tải ảnh Mặt Sau CCCD'}
                {step === 'FINAL_REVIEW' && 'Bước 4/4: Hoàn tất & Điền vào hồ sơ công nhân'}
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
        <div className="p-6 space-y-5">
          
          {/* STEP 1: Front Capture OR STEP 3: Back Capture */}
          {(step === 'FRONT_CAPTURE' || step === 'BACK_CAPTURE') && (
            <div className="space-y-4">
              <div className="relative aspect-video max-h-[320px] w-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-blue-400/60 shadow-inner">
                
                {/* Camera View */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />
                
                <canvas ref={canvasRef} className="hidden" />

                {/* CCCD Alignment Overlay Box */}
                <div className="absolute inset-4 sm:inset-8 border-2 border-blue-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-3 bg-blue-500/5">
                  <div className="flex justify-between items-center text-[11px] font-bold text-white bg-blue-600/80 px-2 py-0.5 rounded backdrop-blur-xs w-fit">
                    <CreditCard className="w-3.5 h-3.5 mr-1" />
                    <span>{step === 'FRONT_CAPTURE' ? 'MẶT TRƯỚC CCCD' : 'MẶT SAU CCCD'}</span>
                  </div>
                  <div className="text-center text-xs font-semibold text-white bg-slate-950/60 px-3 py-1 rounded-full backdrop-blur-xs mx-auto">
                    Căn chỉnh thẻ CCCD vừa khít khung viền
                  </div>
                </div>

                {!cameraActive && (
                  <div className="text-center text-slate-400 p-6">
                    <Camera className="w-10 h-10 mx-auto mb-2 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-200">Không tìm thấy Camera hoặc chưa cấp quyền</p>
                    <p className="text-xs text-slate-400 mt-1">Vui lòng tải ảnh từ thiết bị của bạn</p>
                  </div>
                )}
              </div>

              {/* Capture & Upload controls */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                {cameraActive && (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg flex items-center justify-center gap-2 transition-all"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Chụp ảnh {step === 'FRONT_CAPTURE' ? 'Mặt trước' : 'Mặt sau'}</span>
                  </button>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Chọn ảnh từ máy / điện thoại</span>
                </button>

                {step === 'BACK_CAPTURE' && (
                  <button
                    type="button"
                    onClick={() => setStep('FINAL_REVIEW')}
                    className="text-xs text-slate-500 hover:text-slate-700 underline py-2"
                  >
                    Bỏ qua mặt sau
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Front Review & OCR Edit */}
          {step === 'FRONT_REVIEW' && (
            <div className="space-y-4">
              {isProcessingOcr ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Đang quét và trích xuất dữ liệu bằng AI...
                  </p>
                  <p className="text-xs text-slate-500">
                    Tự động nhận dạng Số CCCD, Họ tên, Ngày sinh, Nơi thường trú...
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ocrError && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{ocrError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Front Image preview */}
                    {frontImageBase64 && (
                      <div className="sm:col-span-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-48 bg-slate-900 flex items-center justify-center">
                        <img
                          src={frontImageBase64}
                          alt="CCCD Mặt trước"
                          className="max-h-48 object-contain"
                        />
                      </div>
                    )}

                    {/* Họ và tên */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Họ và tên (Tự động viết HOA)
                      </label>
                      <input
                        type="text"
                        value={extractedName}
                        onChange={(e) => setExtractedName(e.target.value)}
                        className="w-full px-3 py-2 text-sm uppercase font-bold rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Số CCCD */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Số CCCD (12 chữ số)
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        value={extractedCccd}
                        onChange={(e) => setExtractedCccd(normalizeCccdNumber(e.target.value))}
                        className="w-full px-3 py-2 text-sm font-mono font-bold rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Ngày sinh */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ngày sinh (YYYY-MM-DD)
                      </label>
                      <input
                        type="text"
                        value={extractedDob}
                        onChange={(e) => setExtractedDob(e.target.value)}
                        placeholder="1995-08-15"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Nơi thường trú */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nơi đăng ký thường trú / Quê quán
                      </label>
                      <input
                        type="text"
                        value={extractedAddress}
                        onChange={(e) => setExtractedAddress(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setStep('FRONT_CAPTURE')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                    >
                      Chụp lại mặt trước
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setStep('BACK_CAPTURE')}
                      className="px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-1.5"
                    >
                      <span>Tiếp tục: Chụp mặt sau</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Final Review */}
          {step === 'FINAL_REVIEW' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  <FileCheck className="w-5 h-5" />
                  <span>Xác nhận thông tin quét từ CCCD:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <div>Họ và tên: <strong className="text-slate-900 dark:text-white">{extractedName || '(Chưa có)'}</strong></div>
                  <div>Số CCCD: <strong className="font-mono text-blue-600">{extractedCccd || '(Chưa có)'}</strong></div>
                  <div>Ngày sinh: <strong>{extractedDob || '(Chưa có)'}</strong></div>
                  <div>Thường trú: <strong>{extractedAddress || '(Chưa có)'}</strong></div>
                  {extractedIssueDate && <div>Ngày cấp: <strong>{extractedIssueDate}</strong></div>}
                  {extractedIssuePlace && <div>Nơi cấp: <strong>{extractedIssuePlace}</strong></div>}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setStep('FRONT_REVIEW')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
                >
                  Sửa lại
                </button>
                <button
                  type="button"
                  onClick={handleFinishAndFill}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Điền vào biểu mẫu Thêm công nhân</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
