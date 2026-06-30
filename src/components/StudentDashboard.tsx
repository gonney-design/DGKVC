import { useState, useEffect } from "react";
import { Student, Classroom, AttendanceRecord, Asset, BorrowRecord, Setting } from "../types";
import { QRCodeCanvas } from "qrcode.react";
import { 
  getAttendanceRecords, 
  saveAttendanceRecord, 
  getAssets, 
  getBorrowRecords, 
  saveBorrowRecord,
  saveStudent
} from "../lib/firebase";
import { 
  User, 
  QrCode, 
  MapPin, 
  Clock, 
  Calendar, 
  Package, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle,
  PlusCircle,
  RefreshCw,
  Camera
} from "lucide-react";
import FaceScanner from "./FaceScanner";
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY' && GOOGLE_MAPS_API_KEY !== '';

function MapCircle({ center, radius }: { center: { lat: number; lng: number }; radius: number }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const circle = new google.maps.Circle({
      map,
      center,
      radius,
      fillColor: '#6366f1',
      fillOpacity: 0.15,
      strokeColor: '#4f46e5',
      strokeOpacity: 0.8,
      strokeWeight: 1.5,
    });
    return () => {
      circle.setMap(null);
    };
  }, [map, center, radius]);

  return null;
}


interface StudentDashboardProps {
  student: Student;
  classrooms: Classroom[];
  settings: Setting;
  onLogout: () => void;
}

export default function StudentDashboard({
  student,
  classrooms,
  settings,
  onLogout
}: StudentDashboardProps) {
  const [activeTab, setActiveTab] = useState<"card" | "checkin" | "history" | "assets">("card");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [myBorrows, setMyBorrows] = useState<BorrowRecord[]>([]);
  
  // Geolocation states
  const [geoLoading, setGeoLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinRadius, setIsWithinRadius] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  
  // Scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [selfCheckInSuccess, setSelfCheckInSuccess] = useState<string | null>(null);
  
  // Borrow form state
  const [showBorrowForm, setShowBorrowForm] = useState<string | null>(null); // assetId
  const [borrowQty, setBorrowQty] = useState(1);
  const [borrowLoading, setBorrowLoading] = useState(false);
  
  // General local state loading
  const [loading, setLoading] = useState(true);

  // Classroom Name
  const classroom = classrooms.find(c => c.id === student.classroomId);
  const classroomName = classroom ? classroom.name : "ไม่ระบุห้องเรียน";

  // Haversine Distance Calculator (meters)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Fetch student specific records, assets and borrowings
  const fetchData = async () => {
    try {
      setLoading(true);
      const allRecords = await getAttendanceRecords();
      const myRecords = allRecords.filter(r => r.studentId === student.id)
        .sort((a, b) => b.date.localeCompare(a.date));
      setRecords(myRecords);

      const allAssets = await getAssets();
      setAssets(allAssets);

      const allBorrows = await getBorrowRecords();
      const myActiveBorrows = allBorrows.filter(b => b.studentId === student.id);
      setMyBorrows(myActiveBorrows);
    } catch (error) {
      console.error("Error fetching student dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [student.id]);

  // Request browser location
  const handleGetLocation = () => {
    setGeoLoading(true);
    setGeoError(null);
    setUserCoords(null);
    setDistance(null);

    if (!navigator.geolocation) {
      setGeoError("เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่งพิกัด (Geolocation)");
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });

        const dist = calculateDistance(
          latitude,
          longitude,
          settings.collegeLat,
          settings.collegeLng
        );
        setDistance(dist);
        setIsWithinRadius(dist <= settings.checkInRadius);
        setGeoLoading(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMsg = "ไม่สามารถเข้าถึงตำแหน่งของคุณได้ กรุณาอนุญาตสิทธิ์การเข้าถึงตำแหน่งพิกัด";
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = "คุณได้ปฏิเสธการเข้าถึงพิกัด กรุณาตั้งค่าเพื่ออนุญาตสิทธิ์ตำแหน่งในเบราว์เซอร์";
        }
        setGeoError(errorMsg);
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Face scanner callback
  const handleFaceScanSuccess = async (faceImgBase64: string) => {
    try {
      // 1. Update student profile face registers if not registered yet
      if (!student.faceRegistered) {
        const updatedStudent: Student = {
          ...student,
          faceRegistered: true,
          faceImageUrl: faceImgBase64
        };
        await saveStudent(updatedStudent);
        student.faceRegistered = true;
        student.faceImageUrl = faceImgBase64;
      }

      // 2. Add Attendance Record
      const todayStr = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local
      const currentTime = new Date();
      const hours = currentTime.getHours();
      const minutes = currentTime.getMinutes();
      const timeVal = hours * 100 + minutes;

      // Class starts at 08:00 AM (800)
      const status: "present" | "late" = timeVal <= 800 ? "present" : "late";

      const recordId = `${student.id}_${todayStr}`;
      const newRecord: AttendanceRecord = {
        id: recordId,
        studentId: student.id,
        classroomId: student.classroomId,
        date: todayStr,
        timestamp: currentTime.toISOString(),
        status: status,
        method: "self",
        latitude: userCoords?.lat || settings.collegeLat,
        longitude: userCoords?.lng || settings.collegeLng
      };

      await saveAttendanceRecord(newRecord);
      setSelfCheckInSuccess(status === "present" ? "ลงชื่อเข้าแถวสำเร็จ! (ทันเวลา)" : "ลงชื่อเข้าแถวสำเร็จ! (สาย)");
      fetchData();
    } catch (err) {
      console.error("Self check-in save failed:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกการเข้าแถว");
    }
  };

  // Handle borrow request
  const handleBorrowRequest = async (asset: Asset) => {
    if (borrowQty <= 0 || borrowQty > asset.availableQty) {
      alert("จำนวนไม่ถูกต้อง หรือ อุปกรณ์เหลือไม่เพียงพอ");
      return;
    }

    try {
      setBorrowLoading(true);
      const recordId = `BRW_${Date.now()}`;
      const newBorrow: BorrowRecord = {
        id: recordId,
        assetId: asset.id,
        studentId: student.id,
        studentName: student.name,
        classroomId: student.classroomId,
        borrowDate: new Date().toISOString(),
        status: "borrowed",
        qty: borrowQty
      };

      await saveBorrowRecord(newBorrow);
      setShowBorrowForm(null);
      setBorrowQty(1);
      alert(`ยืม ${asset.name} จำนวน ${borrowQty} รายการ สำเร็จ!`);
      fetchData();
    } catch (err) {
      console.error("Borrow failed:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลยืม");
    } finally {
      setBorrowLoading(false);
    }
  };

  // Handle return item
  const handleReturnRequest = async (borrow: BorrowRecord) => {
    try {
      const updatedBorrow: BorrowRecord = {
        ...borrow,
        returnDate: new Date().toISOString(),
        status: "returned"
      };
      await saveBorrowRecord(updatedBorrow);
      alert("คืนอุปกรณ์สำเร็จแล้ว เจ้าหน้าที่หรือครูประจำสาขาจะทำการรับอุปกรณ์คืนต่อหน้า");
      fetchData();
    } catch (err) {
      console.error("Return failed:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกการคืน");
    }
  };

  // Calculate statistics
  const statsTotal = records.length;
  const statsPresent = records.filter(r => r.status === "present").length;
  const statsLate = records.filter(r => r.status === "late").length;
  const statsAbsent = records.filter(r => r.status === "absent").length;

  return (
    <div className="w-full max-w-4xl mx-auto font-sans p-4 md:p-6 text-slate-800">
      
      {/* Top Welcome Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-heading font-bold text-xl">
            {student.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-slate-900 leading-tight">สวัสดี, {student.name}</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">สาขาวิชาดิจิทัลกราฟิก • {classroomName}</p>
          </div>
        </div>
        <button 
          id="logout-btn"
          onClick={onLogout}
          className="flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-heading text-xs font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </button>
      </div>

      {/* Primary Dashboard Navigation Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 mb-6 overflow-x-auto">
        <button
          id="student-tab-card"
          onClick={() => { setActiveTab("card"); setSelfCheckInSuccess(null); }}
          className={`flex items-center justify-center gap-1.5 font-heading text-xs font-semibold px-4 py-2.5 rounded-xl flex-1 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "card" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          <QrCode className="w-4 h-4" />
          บัตรกิจกรรม (QR)
        </button>
        <button
          id="student-tab-checkin"
          onClick={() => { setActiveTab("checkin"); setSelfCheckInSuccess(null); }}
          className={`flex items-center justify-center gap-1.5 font-heading text-xs font-semibold px-4 py-2.5 rounded-xl flex-1 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "checkin" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          <MapPin className="w-4 h-4" />
          เช็คชื่อด้วยตัวเอง (GPS)
        </button>
        <button
          id="student-tab-history"
          onClick={() => { setActiveTab("history"); setSelfCheckInSuccess(null); }}
          className={`flex items-center justify-center gap-1.5 font-heading text-xs font-semibold px-4 py-2.5 rounded-xl flex-1 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "history" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          <Clock className="w-4 h-4" />
          สถิติการเช็คชื่อ ({statsTotal})
        </button>
        <button
          id="student-tab-assets"
          onClick={() => { setActiveTab("assets"); setSelfCheckInSuccess(null); }}
          className={`flex items-center justify-center gap-1.5 font-heading text-xs font-semibold px-4 py-2.5 rounded-xl flex-1 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "assets" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:bg-slate-200/50"
          }`}
        >
          <Package className="w-4 h-4" />
          ยืมคืนอุปกรณ์ของใช้
        </button>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">กำลังเรียกข้อมูล...</p>
          </div>
        ) : (
          <>
            {/* TAB: Student QR Card */}
            {activeTab === "card" && (
              <div className="flex flex-col items-center py-6 text-center max-w-sm mx-auto">
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl w-full flex flex-col items-center shadow-inner relative overflow-hidden">
                  
                  {/* Digital Graphics decorative element */}
                  <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 to-violet-600"></div>
                  
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Student Pass • KVC</p>
                  
                  {/* Student ID QR Code */}
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 flex items-center justify-center">
                    <QRCodeCanvas 
                      value={student.id} 
                      size={180}
                      level="H"
                      fgColor="#0f172a"
                      includeMargin={false}
                    />
                  </div>

                  <p className="font-mono text-indigo-600 font-semibold text-lg tracking-wider mb-1">{student.id}</p>
                  <h3 className="font-heading font-bold text-slate-900 text-base">{student.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{classroomName}</p>

                  <div className="mt-5 w-full bg-slate-100 py-2.5 px-4 rounded-xl text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
                    <QrCode className="w-3.5 h-3.5 text-slate-400" />
                    ยื่นหน้าจอนี้ให้คุณครูสแกนเพื่อเช็คกิจกรรมหน้าเสาธง
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Self Check-In with GPS & Facial recognition */}
            {activeTab === "checkin" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">เช็คเข้าแถวด้วยตนเอง (GPS & ใบหน้า)</h3>
                  <p className="text-xs text-slate-500 mt-1">ผู้ใช้ต้องยืนอยูในรัศมี {settings.checkInRadius} เมตรรอบวิทยาลัยอาชีวศึกษาขอนแก่น และทำการถ่ายรูปสแกนใบหน้า</p>
                </div>

                {selfCheckInSuccess ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl text-center space-y-3 max-w-md mx-auto">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h4 className="font-heading font-bold text-emerald-800 text-base">บันทึกข้อมูลเรียบร้อยแล้ว</h4>
                    <p className="text-xs text-emerald-700 font-medium leading-relaxed">{selfCheckInSuccess}</p>
                    <button
                      onClick={() => setSelfCheckInSuccess(null)}
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-heading text-xs font-semibold px-6 py-2.5 rounded-xl cursor-pointer"
                    >
                      เช็คชื่อใหม่อีกครั้ง
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    
                    {/* Geolocation Checker Module */}
                    <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="text-indigo-500 w-5 h-5" />
                          <h4 className="font-heading font-bold text-slate-900 text-sm">การตรวจสอบพิกัด (GPS)</h4>
                        </div>
                        
                        <p className="text-xs text-slate-600 leading-relaxed">
                          วิทยาลัยอาชีวศึกษาขอนแก่น ตั้งพิกัดไว้ที่: <br />
                          <span className="font-mono text-[11px] font-bold text-slate-500">Lat: {settings.collegeLat}, Lng: {settings.collegeLng}</span>
                        </p>
                      </div>

                      {userCoords ? (
                        <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-100">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ตำแหน่งของคุณปัจจุบัน</p>
                            <p className="font-mono text-xs text-slate-700 mt-0.5">Lat: {userCoords.lat.toFixed(6)}, Lng: {userCoords.lng.toFixed(6)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ระยะห่างจากรัศมีเช็คอิน</p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">
                              {distance !== null ? `${distance.toFixed(1)} เมตร` : "กำลังคำนวณ..."}
                              <span className="text-xs font-medium text-slate-500 block mt-0.5">
                                (รัศมีที่อนุญาต: {settings.checkInRadius} เมตร)
                              </span>
                            </p>
                          </div>

                          {isWithinRadius ? (
                            <div className="bg-emerald-50 text-emerald-700 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-semibold">
                              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                              อยู่ในเขตระยะเช็คอินของวิทยาลัย
                            </div>
                          ) : (
                            <div className="bg-rose-50 text-rose-700 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 font-semibold">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                              อยู่นอกเขตรัศมีที่กำหนด ({distance ? (distance - settings.checkInRadius).toFixed(0) : "N/A"} ม.)
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-100 p-4 rounded-2xl flex flex-col items-center justify-center py-6 text-center">
                          <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-xs text-slate-500">กรุณากดเปิดพิกัดเพื่อเริ่มตรวจสอบตำแหน่งของคุณ</p>
                        </div>
                      )}

                      {geoError && (
                        <p className="text-xs font-semibold text-rose-500 bg-rose-50 border border-rose-100 p-3 rounded-xl leading-relaxed">
                          {geoError}
                        </p>
                      )}

                      <button
                        onClick={handleGetLocation}
                        disabled={geoLoading}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {geoLoading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            กำลังระบุพิกัด...
                          </>
                        ) : (
                          <>
                            <MapPin className="w-4 h-4" />
                            {userCoords ? "ระบุตำแหน่งอีกครั้ง" : "กดระบุพิกัดตำแหน่ง (GPS)"}
                          </>
                        )}
                      </button>
                    </div>

                    {/* Facial Scanner Lock Indicator */}
                    <div className="border border-slate-100 p-6 rounded-3xl flex flex-col justify-between items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center">
                        <Camera className="w-8 h-8" />
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="font-heading font-bold text-slate-900 text-sm">การสแกนใบหน้า (Face Scan)</h4>
                        <p className="text-xs text-slate-500 leading-relaxed px-4">
                          {student.faceRegistered 
                            ? "สแกนใบหน้าเพื่อระบุตัวตนยืนยันตนเองว่ามาเรียนที่คณะ" 
                            : "คุณยังไม่เคยลงทะเบียนใบหน้า กรุณาสแกนใบหน้าในระบบครั้งแรกเพื่อบันทึกโครงหน้า"}
                        </p>
                      </div>

                      <button
                        onClick={() => setShowScanner(true)}
                        disabled={!isWithinRadius}
                        className={`w-full py-3.5 rounded-xl font-heading text-xs font-semibold transition-all flex items-center justify-center gap-2 ${
                          isWithinRadius 
                            ? "bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white shadow-md cursor-pointer" 
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <Camera className="w-4 h-4" />
                        {student.faceRegistered ? "เริ่มสแกนใบหน้าเช็คชื่อ" : "เริ่มลงทะเบียนสแกนใบหน้าครั้งแรก"}
                      </button>
                    </div>

                  </div>

                  {/* Google Map Card */}
                  <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4 mt-6">
                    <div>
                      <h4 className="font-heading font-bold text-slate-800 text-sm">แผนที่แสดงขอบเขตและตำแหน่งเช็คอินจริง (Check-in Map)</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        วงกลมสีน้ำเงินแสดงระยะรัศมีเช็คอิน {settings.checkInRadius} เมตรรอบพิกัดสถาบันที่กำหนด หากคุณอยู่นอกวงกลม คุณจะไม่สามารถสแกนใบหน้าเช็คชื่อได้
                      </p>
                    </div>

                    {hasValidMapsKey ? (
                      <div className="h-[300px] bg-slate-200 border border-slate-300 rounded-2xl relative overflow-hidden">
                        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                          <Map
                            center={{ lat: settings.collegeLat, lng: settings.collegeLng }}
                            defaultZoom={17}
                            mapId="DEMO_MAP_ID"
                            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                            style={{ width: '100%', height: '100%' }}
                          >
                            {/* Marker for College Location */}
                            <AdvancedMarker position={{ lat: settings.collegeLat, lng: settings.collegeLng }}>
                              <Pin background="#4f46e5" glyphColor="#fff" />
                            </AdvancedMarker>

                            {/* Circle for Check-in Radius */}
                            <MapCircle center={{ lat: settings.collegeLat, lng: settings.collegeLng }} radius={settings.checkInRadius} />

                            {/* Marker for Student current location */}
                            {userCoords && (
                              <AdvancedMarker position={{ lat: userCoords.lat, lng: userCoords.lng }}>
                                <Pin background="#10b981" glyphColor="#fff" scale={1.2} />
                              </AdvancedMarker>
                            )}
                          </Map>
                        </APIProvider>
                        <div className="absolute bottom-2 left-2 right-2 flex justify-between gap-2 pointer-events-none">
                          <span className="bg-slate-900/95 text-white text-[9px] px-2 py-1 rounded-lg backdrop-blur font-semibold">
                            🔵 จุดศูนย์กลางสถาบัน
                          </span>
                          {userCoords && (
                            <span className="bg-emerald-900/95 text-white text-[9px] px-2 py-1 rounded-lg backdrop-blur font-semibold">
                              🟢 ตำแหน่งปัจจุบันของคุณ
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          ต้องการเปิดดูแผนที่พิกัดเช็คอินจริงแบบเรียลไทม์?
                        </p>
                        <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                          <strong>วิธีแสดงแผนที่:</strong><br/>
                          - <strong>บน AI Studio:</strong> เปิด Settings (ขวาบน) &rarr; Secrets เพิ่มคีย์ <code>GOOGLE_MAPS_PLATFORM_KEY</code><br/>
                          - <strong>บน Vercel/ผู้ให้บริการอื่นๆ:</strong> ไปที่ Settings &rarr; Environment Variables แล้วเพิ่ม <code>VITE_GOOGLE_MAPS_PLATFORM_KEY</code> พร้อมระบุ API Key ของคุณ
                        </p>
                      </div>
                    )}
                  </div>
                  </>
                )}
              </div>
            )}

            {/* TAB: Attendance Stats & History */}
            {activeTab === "history" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">ประวัติและสรุปการเข้าแถวทำกิจกรรม</h3>
                  <p className="text-xs text-slate-500 mt-1">ข้อมูลสรุปจำนวนครั้งในการมาเข้าแถวทั้งหมดของคุณในเทอมนี้</p>
                </div>

                {/* Progress Ring Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">มาแถวปกติ</p>
                      <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{statsPresent}</p>
                    </div>
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">มาสาย</p>
                      <p className="text-2xl font-bold text-amber-700 mt-1 font-mono">{statsLate}</p>
                    </div>
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                      <Clock className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">ขาดแถว</p>
                      <p className="text-2xl font-bold text-rose-700 mt-1 font-mono">{statsAbsent}</p>
                    </div>
                    <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Detailed Logs List */}
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-100 px-4 py-3">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">บันทึกสถิติรายวัน ({statsTotal} ครั้ง)</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {records.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs font-medium">ยังไม่มีข้อมูลการเข้าแถวสำหรับคุณ</div>
                    ) : (
                      records.map((r) => {
                        const checkTime = new Date(r.timestamp).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit"
                        }) + " น.";
                        
                        let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
                        let statusText = "มาทันเวลา";
                        if (r.status === "late") {
                          badgeStyle = "bg-amber-50 text-amber-700 border-amber-100";
                          statusText = "มาสาย";
                        } else if (r.status === "absent") {
                          badgeStyle = "bg-rose-50 text-rose-700 border-rose-100";
                          statusText = "ขาดแถว";
                        }

                        let methodText = "เช็คแถวโดยครู (แมนนวล)";
                        if (r.method === "scan") methodText = "เช็คชื่อผ่านการสแกน QR บัตร";
                        else if (r.method === "self") methodText = "เช็คชื่อตนเองพิกัดวิทยาลัย";

                        return (
                          <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40">
                            <div className="flex items-start gap-3">
                              <div className="bg-slate-100 text-slate-500 w-9 h-9 rounded-xl flex items-center justify-center font-mono text-xs">
                                <Calendar className="w-4 h-4 text-slate-400" />
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 text-sm">{r.date}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{methodText} • {checkTime}</p>
                              </div>
                            </div>
                            <span className={`text-[11px] font-semibold border px-2.5 py-1 rounded-xl ${badgeStyle}`}>
                              {statusText}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Asset Borrowing Module */}
            {activeTab === "assets" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-slate-900">ระบบเบิกยืม-คืน อุปกรณ์ของใช้สาขา</h3>
                    <p className="text-xs text-slate-500 mt-1">ยืมแท็บเล็ตวาดรูป กล้อง หรือของใช้ส่วนกลางของดิจิทัลกราฟิกได้ในวิทยาลัย</p>
                  </div>
                  <span className="bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase tracking-wider border border-cyan-100 px-2.5 py-1 rounded-xl">
                    DG-kvcdata
                  </span>
                </div>

                {/* My Active Borrows Section */}
                {myBorrows.filter(b => b.status === "borrowed").length > 0 && (
                  <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/10 p-5 rounded-3xl space-y-3">
                    <h4 className="font-heading font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 text-indigo-700">
                      <Clock className="w-4 h-4" />
                      อุปกรณ์ที่คุณกำลังยืมอยู่ในปัจจุบัน
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {myBorrows.filter(b => b.status === "borrowed").map((b) => {
                        const asset = assets.find(a => a.id === b.assetId);
                        const borrowTime = new Date(b.borrowDate).toLocaleDateString("th-TH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        });
                        return (
                          <div key={b.id} className="bg-white border border-indigo-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{asset?.name || b.assetId}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">จำนวน: {b.qty} รายการ • ยืมเมื่อ: {borrowTime}</p>
                            </div>
                            <button
                              onClick={() => handleReturnRequest(b)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-heading text-[10px] font-semibold px-3 py-1.5 rounded-xl cursor-pointer"
                            >
                              กดขอคืนของ
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* List of Available Assets */}
                <div className="space-y-4">
                  <h4 className="font-heading font-bold text-slate-900 text-sm">รายการวัสดุอุปกรณ์ของสาขา</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {assets.length === 0 ? (
                      <p className="text-slate-400 text-xs py-4 text-center col-span-2">ไม่มีรายการวัสดุอุปกรณ์ในระบบ</p>
                    ) : (
                      assets.map((item) => (
                        <div key={item.id} className="border border-slate-100 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-200 hover:shadow-sm transition-all bg-slate-50/50">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <h5 className="font-bold text-slate-900 text-sm">{item.name}</h5>
                              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                item.availableQty > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              }`}>
                                {item.availableQty > 0 ? `พร้อมยืม: ${item.availableQty}` : "ของหมด"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description || "ไม่มีคำอธิบายอุปกรณ์"}</p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100/60 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-mono">ID: {item.id} • ทั้งหมด: {item.totalQty}</span>
                            
                            {showBorrowForm === item.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={item.availableQty}
                                  value={borrowQty}
                                  onChange={(e) => setBorrowQty(Math.min(item.availableQty, Math.max(1, parseInt(e.target.value) || 1)))}
                                  className="w-12 text-center text-xs border border-slate-200 rounded px-1 py-1 font-mono"
                                />
                                <button
                                  onClick={() => handleBorrowRequest(item)}
                                  disabled={borrowLoading}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer"
                                >
                                  ยันยืน
                                </button>
                                <button
                                  onClick={() => { setShowBorrowForm(null); setBorrowQty(1); }}
                                  className="bg-slate-200 text-slate-600 text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setShowBorrowForm(item.id); setBorrowQty(1); }}
                                disabled={item.availableQty <= 0}
                                className={`flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-xl cursor-pointer ${
                                  item.availableQty > 0 
                                    ? "bg-slate-900 text-white hover:bg-slate-800" 
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                }`}
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                ทำเรื่องขอยืม
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* History of my borrows */}
                {myBorrows.filter(b => b.status === "returned").length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-heading font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 text-slate-400">ประวัติการคืนวัสดุอุปกรณ์ของท่าน</h4>
                    <div className="border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden text-xs">
                      {myBorrows.filter(b => b.status === "returned").map((b) => {
                        const asset = assets.find(a => a.id === b.assetId);
                        const retDate = b.returnDate ? new Date(b.returnDate).toLocaleDateString("th-TH") : "-";
                        return (
                          <div key={b.id} className="p-3 flex justify-between items-center hover:bg-slate-50/20">
                            <div>
                              <p className="font-bold text-slate-800">{asset?.name || b.assetId} (x{b.qty})</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">คืนสำเร็จเมื่อ: {retDate}</p>
                            </div>
                            <span className="bg-slate-100 text-slate-500 font-semibold text-[10px] px-2 py-0.5 rounded-lg">คืนแล้ว</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Face Scanner overlay */}
      {showScanner && (
        <FaceScanner
          studentId={student.id}
          studentName={student.name}
          faceRegistered={student.faceRegistered}
          onScanSuccess={handleFaceScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
