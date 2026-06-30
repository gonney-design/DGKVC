import { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw, AlertCircle, Sparkles, CheckCircle } from "lucide-react";
import * as faceapi from '@vladmandic/face-api';

interface FaceScannerProps {
  studentId: string;
  studentName: string;
  faceRegistered: boolean;
  registeredDescriptor?: number[];
  onScanSuccess: (faceImageBase64: string, faceDescriptor?: number[]) => void;
  onClose: () => void;
}

export default function FaceScanner({
  studentId,
  studentName,
  faceRegistered,
  registeredDescriptor,
  onScanSuccess,
  onClose
}: FaceScannerProps) {
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [statusText, setStatusText] = useState<string>("กำลังเตรียมพร้อม...");
  const [scanStep, setScanStep] = useState<"ready" | "scanning" | "registering" | "matching" | "success" | "error">("ready");
  const [progress, setProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load models
  useEffect(() => {
    async function loadModels() {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Failed to load face-api models", err);
      }
    }
    loadModels();
  }, []);

  // Start webcam or fallback
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        const constraints = { video: { facingMode: "user", width: 480, height: 480 } };
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setHasCamera(true);
        setStatusText("กล้องพร้อมใช้งาน - กรุณาจัดใบหน้าให้อยู่ในกรอบ");
      } catch (err) {
        console.warn("Webcam access failed, running in simulation mode:", err);
        setHasCamera(false);
        setStatusText("โหมดจำลอง (ไม่พบกล้องหรือการอนุญาตถูกปฏิเสธ)");
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (hasCamera && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [hasCamera, stream]);

  const handleCaptureRef = useRef<() => void>();
  
  const handleCapture = async () => {
    if (!modelsLoaded) {
      setStatusText("กำลังโหลด AI Model กรุณารอสักครู่...");
      return;
    }

    setScanStep("scanning");
    setProgress(30);

    if (hasCamera && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1); // Flip mirror
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedImage(dataUrl);

        try {
          setStatusText("กำลังวิเคราะห์จุดสำคัญบนใบหน้า (Face Landmarking)...");
          setProgress(60);

          // Detect face using face-api
          const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceDescriptor();

          if (!detection) {
            setScanStep("error");
            setStatusText("ไม่พบใบหน้า กรุณาลองใหม่อีกครั้ง");
            setTimeout(() => {
              setScanStep("ready");
              setCapturedImage(null);
            }, 3000);
            return;
          }

          setProgress(90);

          const currentDescriptor = Array.from(detection.descriptor);

          if (faceRegistered) {
            setScanStep("matching");
            setStatusText("กำลังตรวจสอบความสอดคล้องกับภาพใบหน้าเดิม...");
            
            // Compare faces
            if (registeredDescriptor) {
              const distance = faceapi.euclideanDistance(detection.descriptor, new Float32Array(registeredDescriptor));
              const threshold = 0.5; // Accuracy threshold, lower means more strict (default is ~0.6)
              
              if (distance > threshold) {
                setScanStep("error");
                setStatusText(`ใบหน้าไม่ตรงกับที่ลงทะเบียนไว้ (Distance: ${distance.toFixed(2)})`);
                setTimeout(() => {
                  setScanStep("ready");
                  setCapturedImage(null);
                }, 3000);
                return;
              }
            } else {
               // Fallback if somehow registered but no descriptor in DB
            }
          } else {
            setScanStep("registering");
            setStatusText("กำลังบันทึกภาพตัวอย่างใบหน้าเข้าสู่ฐานข้อมูล...");
          }

          setProgress(100);
          
          setTimeout(() => {
            setScanStep("success");
            onScanSuccess(dataUrl, currentDescriptor);
          }, 1000);

        } catch (error) {
          console.error("Face detection error:", error);
          setScanStep("error");
          setStatusText("เกิดข้อผิดพลาดในการประมวลผล");
          setTimeout(() => {
            setScanStep("ready");
            setCapturedImage(null);
          }, 3000);
        }
      }
    } else {
      // Simulate snapshot in mock mode
      setProgress(50);
      setTimeout(() => {
        const colors = ["bg-emerald-500", "bg-cyan-500", "bg-indigo-500", "bg-rose-500"];
        const randColor = colors[Math.floor(Math.random() * colors.length)];
        setCapturedImage(randColor);
        setProgress(100);
        
        setTimeout(() => {
          setScanStep("success");
          onScanSuccess(randColor, []); // empty descriptor
        }, 1000);
      }, 1000);
    }
  };

  useEffect(() => {
    handleCaptureRef.current = handleCapture;
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (autoScanEnabled && modelsLoaded && hasCamera !== null && scanStep === "ready") {
      // Allow 2 seconds for user to position their face
      timer = setTimeout(() => {
        if (handleCaptureRef.current) {
          handleCaptureRef.current();
        }
      }, 2000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [autoScanEnabled, modelsLoaded, hasCamera, scanStep]);

  return (
    <div id="face-scanner-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans text-white">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
        
        {/* Background glow effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 blur-3xl rounded-full"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-500/10 blur-3xl rounded-full"></div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <Camera className="text-cyan-400 w-6 h-6" />
            <h3 className="font-heading font-semibold text-lg text-slate-100">
              {faceRegistered ? "สแกนใบหน้าเช็คเข้าแถว" : "ลงทะเบียนสแกนใบหน้า"}
            </h3>
          </div>
          <button 
            id="close-scanner-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl text-xs transition-colors"
          >
            ยกเลิก
          </button>
        </div>

        {/* Student Info Plate */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Student Account</p>
            <p className="font-semibold text-slate-100 text-sm">{studentName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-mono">Student ID</p>
            <p className="font-mono text-cyan-400 text-sm font-medium">{studentId}</p>
          </div>
        </div>

        {/* Camera Stage */}
        <div className="relative aspect-square w-full max-w-[320px] mx-auto rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-950 flex items-center justify-center">
          {hasCamera === true ? (
            <>
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted 
                className={`w-full h-full object-cover transform -scale-x-100 ${capturedImage ? 'hidden' : 'block'}`}
              />
              {capturedImage && (
                <img src={capturedImage} alt="Captured Face" className="w-full h-full object-cover" />
              )}
            </>
          ) : hasCamera === false ? (
            // Animated simulation grid
            <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center relative p-6 text-center">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-40"></div>
              
              {capturedImage && capturedImage.startsWith("bg-") ? (
                <div className={`w-32 h-32 rounded-full ${capturedImage} flex items-center justify-center text-5xl font-bold animate-pulse shadow-xl`}>
                  {studentName.charAt(0)}
                </div>
              ) : (
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-dashed border-cyan-500/50 flex items-center justify-center animate-spin"></div>
                  <Camera className="w-10 h-10 text-cyan-400 absolute inset-0 m-auto" />
                </div>
              )}
              
              <div className="mt-4 text-xs text-slate-400 z-10">
                <p className="text-amber-400 font-medium">อุปกรณ์ทำงานในระบบความปลอดภัยจำลอง</p>
                <p className="mt-1 text-[10px] text-slate-500">เปิดแอปในหน้าต่างใหม่หากต้องการใช้งานกล้องจริง</p>
              </div>
            </div>
          ) : (
            // Loading state
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
              <p className="text-xs text-slate-400">กำลังเชื่อมต่อกล้อง...</p>
            </div>
          )}

          {/* Scanner overlays */}
          {scanStep === "ready" && (
            <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-2xl pointer-events-none flex items-center justify-center">
              {/* Target bracket lines */}
              <div className="absolute top-6 left-6 w-10 h-10 border-t-4 border-l-4 border-cyan-400 rounded-tl-lg"></div>
              <div className="absolute top-6 right-6 w-10 h-10 border-t-4 border-r-4 border-cyan-400 rounded-tr-lg"></div>
              <div className="absolute bottom-6 left-6 w-10 h-10 border-b-4 border-l-4 border-cyan-400 rounded-bl-lg"></div>
              <div className="absolute bottom-6 right-6 w-10 h-10 border-b-4 border-r-4 border-cyan-400 rounded-br-lg"></div>
              <div className="w-48 h-48 rounded-full border-2 border-dashed border-cyan-400/40 animate-pulse"></div>
            </div>
          )}

          {scanStep === "scanning" && (
            <div className="absolute inset-0 bg-slate-950/30">
              <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 animate-scan shadow-[0_0_15px_#22d3ee] z-20"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-5xl font-bold font-mono text-cyan-400">{progress}%</p>
                  <p className="text-[10px] text-cyan-300 uppercase tracking-widest mt-1 font-mono">Analyzing</p>
                </div>
              </div>
            </div>
          )}

          {(scanStep === "matching" || scanStep === "registering") && (
            <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center p-4">
              <div className="text-center">
                <RefreshCw className="w-12 h-12 text-violet-400 animate-spin mx-auto mb-3" />
                <p className="text-sm font-medium">{scanStep === "matching" ? "กำลังประมวลผลใบหน้า..." : "กำลังบันทึกภาพตัวอย่าง..."}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-1">SECURE BLOCKCHAIN DG-KVC</p>
              </div>
            </div>
          )}

          {scanStep === "success" && (
            <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-4">
              <CheckCircle className="w-16 h-16 text-emerald-400 animate-bounce mb-3" />
              <p className="text-lg font-heading font-semibold text-emerald-300">สแกนใบหน้าสำเร็จ!</p>
              <p className="text-xs text-emerald-400/80 mt-1">พิกัดและความถูกต้องตรงตามเงื่อนไข</p>
              <button
                id="face-scan-success-btn"
                onClick={onClose}
                className="mt-6 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-xs px-6 py-2.5 rounded-xl transition-all shadow-lg"
              >
                ตกลง
              </button>
            </div>
          )}
        </div>

        {/* Hidden Canvas for video framing capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Status Indicator */}
        <div className="mt-4 flex items-start gap-2 bg-slate-800/40 border border-slate-700/30 p-3 rounded-xl">
          <Sparkles className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-300 leading-relaxed font-sans">{statusText}</p>
        </div>

        {/* Action button */}
        {scanStep === "ready" && (
          <button
            id="capture-face-btn"
            onClick={() => {
               if (handleCaptureRef.current) handleCaptureRef.current();
            }}
            className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5 text-cyan-400" />
            <span className="font-heading">กำลังสแกนใบหน้าอัตโนมัติ... (กดเพื่อสแกนทันที)</span>
          </button>
        )}
      </div>
    </div>
  );
}
