import React, { useState, useEffect } from "react";
import { Classroom, Student, AttendanceRecord, AttendanceDay, Asset, BorrowRecord, Setting } from "../types";
import { 
  getStudents, 
  saveStudent, 
  deleteStudent,
  getClassrooms, 
  saveClassroom, 
  deleteClassroom,
  getAttendanceDays,
  saveAttendanceDay,
  getAttendanceRecords,
  saveAttendanceRecord,
  getAssets,
  saveAsset,
  deleteAsset,
  getBorrowRecords,
  saveBorrowRecord,
  updateSettings
} from "../lib/firebase";
import { 
  Users, 
  BookOpen, 
  Calendar as CalendarIcon, 
  Printer, 
  Settings as SettingsIcon, 
  Package, 
  Plus, 
  Trash2, 
  Upload, 
  Search, 
  Check, 
  X, 
  Clock, 
  MapPin, 
  QrCode, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Edit,
  ArrowRightLeft,
  Download
} from "lucide-react";
import * as XLSX from "xlsx";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import A4PrintReport from "./A4PrintReport";
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';

const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
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


interface AdminDashboardProps {
  settings: Setting;
  onSettingsUpdate: (settings: Setting) => void;
  onLogout: () => void;
}

export default function AdminDashboard({
  settings,
  onSettingsUpdate,
  onLogout
}: AdminDashboardProps) {
  // Tabs: overview, attendance, students, schedule, assets, reports, settings
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "students" | "schedule" | "assets" | "reports" | "settings">("overview");
  
  // Database States
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [borrowLogs, setBorrowLogs] = useState<BorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassroom, setSelectedClassroom] = useState("all");

  // --- Attendance Check Subtab ---
  const [attSubtab, setAttSubtab] = useState<"manual" | "scan">("manual");
  const [attClassroom, setAttClassroom] = useState("");
  const [attDate, setAttDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [localAttendanceMap, setLocalAttendanceMap] = useState<{ [studentId: string]: "present" | "late" | "absent" }>({});
  
  // Scanning Sim state
  const [scanInputId, setScanInputId] = useState("");
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [scannedSessionLogs, setScannedSessionLogs] = useState<{ studentId: string; name: string; time: string; status: string }[]>([]);

  // --- Classrooms & Students Editor states ---
  const [newRoomId, setNewRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentRoomId, setNewStudentRoomId] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importClassroomId, setImportClassroomId] = useState("auto");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkTargetClassroom, setBulkTargetClassroom] = useState("");

  // --- Schedule sub tab states ---
  const [selectedMonth, setSelectedMonth] = useState("2026-06");
  const [schedNotes, setSchedNotes] = useState("");

  // --- Report and Export states ---
  const [repType, setRepType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [repClassroom, setRepClassroom] = useState("all");
  const [repDate, setRepDate] = useState(new Date().toLocaleDateString("sv-SE"));
  const [repMonth, setRepMonth] = useState("2026-06");
  const [repWeek, setRepWeek] = useState("2026-W27");
  const [printableRecords, setPrintableRecords] = useState<AttendanceRecord[]>([]);
  const [showA4Modal, setShowA4Modal] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportSubtitle, setReportSubtitle] = useState("");

  // --- Settings states ---
  const [latInput, setLatInput] = useState(settings.collegeLat);
  const [lngInput, setLngInput] = useState(settings.collegeLng);
  const [radInput, setRadInput] = useState(settings.checkInRadius);
  const [passInput, setPassInput] = useState(settings.adminPassword || "kvc");

  // --- Assets states ---
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetId, setNewAssetId] = useState("");
  const [newAssetQty, setNewAssetQty] = useState(1);
  const [newAssetDesc, setNewAssetDesc] = useState("");
  const [newAssetType, setNewAssetType] = useState<"consumable" | "durable">("durable");

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [rooms, studs, days, recs, items, borrows] = await Promise.all([
        getClassrooms(),
        getStudents(),
        getAttendanceDays(),
        getAttendanceRecords(),
        getAssets(),
        getBorrowRecords()
      ]);
      
      setClassrooms(rooms);
      setStudents(studs);
      setAttendanceDays(days);
      setRecords(recs);
      setAssets(items);
      setBorrowLogs(borrows);

      if (rooms.length > 0 && !attClassroom) {
        setAttClassroom(rooms[0].id);
      }
    } catch (error) {
      console.error("Error loading administrative data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Update attendance check grid when room or date changes
  useEffect(() => {
    if (!attClassroom) return;
    // Find existing records for this class on this date
    const dayRecords = records.filter(r => r.classroomId === attClassroom && r.date === attDate);
    const map: { [studentId: string]: "present" | "late" | "absent" } = {};
    
    // Fill with default "absent" or existing record status
    students.filter(s => s.classroomId === attClassroom).forEach(s => {
      const match = dayRecords.find(r => r.studentId === s.id);
      map[s.id] = match ? match.status : "absent";
    });
    setLocalAttendanceMap(map);
  }, [attClassroom, attDate, records, students]);

  // Handle Manual Attendance Change
  const handleToggleStatus = (studentId: string, status: "present" | "late" | "absent") => {
    setLocalAttendanceMap(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Save manual checked attendance
  const handleSaveAttendance = async () => {
    try {
      // Register or update day in calendar
      const dayExists = attendanceDays.some(d => d.date === attDate);
      if (!dayExists) {
        await saveAttendanceDay({
          date: attDate,
          status: "active",
          notes: "เช็คชื่อกลุ่มชั้นเรียนโดยครู"
        });
      }

      // Save records
      const promises = Object.entries(localAttendanceMap).map(([studentId, status]) => {
        const recordId = `${studentId}_${attDate}`;
        const newRec: AttendanceRecord = {
          id: recordId,
          studentId: studentId,
          classroomId: attClassroom,
          date: attDate,
          timestamp: new Date().toISOString(),
          status: status as "present" | "late" | "absent",
          method: "manual"
        };
        return saveAttendanceRecord(newRec);
      });

      await Promise.all(promises);
      alert("บันทึกการเช็คชื่อเข้าแถวสำเร็จ!");
      loadAllData();
    } catch (err) {
      console.error("Manual save failed:", err);
      alert("ไม่สามารถบันทึกข้อมูลได้");
    }
  };

  // Scan Code attendance simulation
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanMessage(null);
    const id = scanInputId.trim();
    if (!id) return;

    const student = students.find(s => s.id === id || s.barcode === id);
    if (!student) {
      setScanMessage({ type: "error", text: `ไม่พบรหัสนักเรียน: ${id} ในระบบสาขา` });
      setScanInputId("");
      return;
    }

    try {
      const todayStr = new Date().toLocaleDateString("sv-SE");
      const currentTime = new Date();
      const hours = currentTime.getHours();
      const minutes = currentTime.getMinutes();
      const timeVal = hours * 100 + minutes;

      // Late after 08:00
      const status: "present" | "late" = timeVal <= 800 ? "present" : "late";
      const recordId = `${student.id}_${todayStr}`;
      
      const newRec: AttendanceRecord = {
        id: recordId,
        studentId: student.id,
        classroomId: student.classroomId,
        date: todayStr,
        timestamp: currentTime.toISOString(),
        status: status,
        method: "scan"
      };

      await saveAttendanceRecord(newRec);
      
      // Update session log list
      const timeStr = currentTime.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";
      setScannedSessionLogs(prev => [
        {
          studentId: student.id,
          name: student.name,
          time: timeStr,
          status: status === "present" ? "มาปกติ" : "สาย"
        },
        ...prev
      ]);

      setScanMessage({ type: "success", text: `สแกนสำเร็จ! ${student.name} เช็คสถานะ: ${status === "present" ? "มาปกติ" : "สาย"}` });
      setScanInputId("");
      loadAllData();
    } catch (err) {
      console.error("Barcode check-in failed:", err);
      setScanMessage({ type: "error", text: "เกิดข้อผิดพลาดในการบันทึกข้อมูลสแกน" });
    }
  };

  // Excel Template Download
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "รหัสนักเรียน": "69000000001",
        "ชื่อ-นามสกุล": "ทดสอบ ทดสอบ",
        "ห้องเรียน": "ม.1/1"
      },
      {
        "รหัสนักเรียน": "69000000002",
        "ชื่อ-นามสกุล": "นักเรียน ตัวอย่าง",
        "ห้องเรียน": "ม.1/1"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    
    XLSX.writeFile(workbook, "student_template.xlsx");
  };

  // Excel Upload Import
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus("กำลังประมวลผลไฟล์ Excel...");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert worksheet rows to JSON
        // Columns can be in Thai or English: "รหัสนักเรียน" or "studentId", "ชื่อ" or "name", "ห้อง" or "classroomId"
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);
        
        if (rawRows.length === 0) {
          setImportStatus("ข้อผิดพลาด: ไฟล์ Excel ว่างเปล่า");
          return;
        }

        let importedCount = 0;
        let createdRooms = 0;
        const seenClassrooms = new Set<string>();

        for (const row of rawRows) {
          // Flexible mapping
          const id = String(row["รหัสนักเรียน"] || row["id"] || row["รหัสประจำตัว"] || "").trim();
          const name = String(row["ชื่อ-นามสกุล"] || row["ชื่อ"] || row["name"] || "").trim();
          let roomVal = String(row["ห้องเรียน"] || row["ห้อง"] || row["classroomId"] || "").trim();

          if (!id || !name) continue;

          let cleanRoomId = "";

          if (importClassroomId !== "auto") {
            cleanRoomId = importClassroomId;
          } else {
            if (!roomVal) continue;
            // Normalize Classroom ID (e.g., replace slash to underscore for document ID)
            cleanRoomId = roomVal.replace("/", "_").replace(".", "_");
            
            // If classroom does not exist yet, auto create it
            const roomExists = classrooms.some(c => c.id === cleanRoomId) || seenClassrooms.has(cleanRoomId);
            if (!roomExists) {
              const newRoom: Classroom = {
                id: cleanRoomId,
                name: roomVal
              };
              await saveClassroom(newRoom);
              seenClassrooms.add(cleanRoomId);
              createdRooms++;
            }
          }

          const studentData: Student = {
            id: id,
            name: name,
            classroomId: cleanRoomId,
            barcode: id,
            faceRegistered: false
          };

          await saveStudent(studentData);
          importedCount++;
        }

        setImportStatus(`นำเข้าข้อมูลเรียบร้อย! นักเรียนใหม่ ${importedCount} คน, ห้องเรียนใหม่ ${createdRooms} ห้อง`);
        loadAllData();
      } catch (err) {
        console.error("Excel import processing error:", err);
        setImportStatus("เกิดข้อผิดพลาดในการอ่านไฟล์ กรุณาตรวจสอบฟอร์แมตแถวของไฟล์");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Add Classroom manually
  const handleAddClassroom = async () => {
    if (!newRoomId || !newRoomName) {
      alert("กรุณากรอกข้อมูลห้องเรียนให้ครบ");
      return;
    }
    try {
      const room: Classroom = {
        id: newRoomId.trim().replace("/", "_"),
        name: newRoomName.trim()
      };
      await saveClassroom(room);
      setNewRoomId("");
      setNewRoomName("");
      alert("เพิ่มห้องเรียนสำเร็จ!");
      loadAllData();
    } catch (err) {
      alert("ไม่สามารถเพิ่มห้องเรียนได้");
    }
  };

  // Add Student manually
  const handleAddStudent = async () => {
    if (!newStudentId || !newStudentName || !newStudentRoomId) {
      alert("กรุณากรอกข้อมูลนักเรียนให้ครบ");
      return;
    }
    try {
      const stud: Student = {
        id: newStudentId.trim(),
        name: newStudentName.trim(),
        classroomId: newStudentRoomId,
        barcode: newStudentId.trim(),
        faceRegistered: false
      };
      await saveStudent(stud);
      setNewStudentId("");
      setNewStudentName("");
      alert("เพิ่มข้อมูลนักเรียนสำเร็จ!");
      loadAllData();
    } catch (err) {
      alert("ไม่สามารถเพิ่มข้อมูลนักเรียนได้");
    }
  };

  // Delete Classroom
  const handleDeleteClassroom = async (id: string) => {
    if (!confirm("คุณต้องการลบห้องเรียนนี้ใช่หรือไม่? ข้อมูลนักเรียนในห้องจะยังไม่ถูกลบ แต่จะขาดการระบุห้อง")) return;
    try {
      await deleteClassroom(id);
      loadAllData();
    } catch (err) {
      alert("ลบห้องเรียนไม่สำเร็จ");
    }
  };

  // Delete Student
  const handleDeleteStudent = async (id: string) => {
    if (!confirm("ต้องการลบนักเรียนคนนี้ออกจากฐานข้อมูลใช่หรือไม่?")) return;
    try {
      await deleteStudent(id);
      loadAllData();
    } catch (err) {
      alert("ลบข้อมูลนักเรียนไม่สำเร็จ");
    }
  };

  const handleBulkDeleteStudents = async () => {
    if (selectedStudentIds.length === 0) return;
    if (!confirm(`ต้องการลบนักเรียนที่เลือกจำนวน ${selectedStudentIds.length} คนใช่หรือไม่?`)) return;
    try {
      for (const id of selectedStudentIds) {
        await deleteStudent(id);
      }
      setSelectedStudentIds([]);
      loadAllData();
      alert("ลบข้อมูลนักเรียนที่เลือกสำเร็จ");
    } catch (err) {
      alert("ลบข้อมูลนักเรียนบางคนไม่สำเร็จ");
    }
  };

  const handleBulkMoveStudents = async () => {
    if (selectedStudentIds.length === 0) return;
    if (!bulkTargetClassroom) {
      alert("กรุณาเลือกห้องเรียนที่ต้องการย้ายไป");
      return;
    }
    if (!confirm(`ต้องการย้ายนักเรียน ${selectedStudentIds.length} คนไปที่ห้องใหม่ใช่หรือไม่?`)) return;
    try {
      const room = classrooms.find(c => c.id === bulkTargetClassroom);
      if(!room) {
        alert("ไม่พบข้อมูลห้องเรียนที่ระบุ " + bulkTargetClassroom);
        return;
      }

      let count = 0;
      for (const id of selectedStudentIds) {
        const student = students.find(s => s.id === id);
        if (student) {
          await saveStudent({
            ...student,
            classroomId: bulkTargetClassroom
          });
          count++;
        }
      }
      setSelectedStudentIds([]);
      setBulkTargetClassroom("");
      loadAllData();
      alert(`ย้ายห้องเรียนสำเร็จ ${count} คน`);
    } catch (err) {
      alert("ย้ายห้องเรียนบางคนไม่สำเร็จ: " + (err as Error).message);
    }
  };

  // Create Assets
  const handleAddAsset = async () => {
    if (!newAssetId || !newAssetName || newAssetQty < 1) {
      alert("กรุณากรอกข้อมูลอุปกรณ์ให้ครบถ้วน");
      return;
    }
    try {
      const item: Asset = {
        id: newAssetId.trim(),
        name: newAssetName.trim(),
        description: newAssetDesc.trim(),
        totalQty: newAssetQty,
        availableQty: newAssetQty,
        type: newAssetType
      };
      await saveAsset(item);
      setNewAssetId("");
      setNewAssetName("");
      setNewAssetQty(1);
      setNewAssetDesc("");
      setNewAssetType("durable");
      alert("บันทึกวัสดุอุปกรณ์สำเร็จ!");
      loadAllData();
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  // Delete Asset
  const handleDeleteAsset = async (id: string) => {
    if (!confirm("ต้องการลบอุปกรณ์นี้ออกจากระบบใช่หรือไม่?")) return;
    try {
      await deleteAsset(id);
      loadAllData();
    } catch (err) {
      alert("ไม่สามารถลบข้อมูลได้");
    }
  };

  // Confirm Borrow Return
  const handleConfirmReturn = async (log: BorrowRecord) => {
    try {
      const updatedLog: BorrowRecord = {
        ...log,
        returnDate: new Date().toISOString(),
        status: "returned"
      };
      await saveBorrowRecord(updatedLog);
      
      const assetObj = assets.find(a => a.id === log.assetId);
      if (assetObj) {
        const updatedAsset = { ...assetObj, availableQty: assetObj.availableQty + log.qty };
        await saveAsset(updatedAsset);
      }

      alert("ยืนยันการรับคืนอุปกรณ์เรียบร้อยแล้ว คลังอุปกรณ์ได้รับการปรับปรุงพัสดุเรียบร้อย");
      loadAllData();
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการคืนของ");
    }
  };

  // Auto Generate Calendar days for selected month
  const handleGenerateSchedules = async () => {
    if (!selectedMonth) return;
    
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      let count = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dayOfWeek = currentDate.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
        
        // Match Mon, Wed, Fri (1, 3, 5)
        if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
          const dateStr = currentDate.toLocaleDateString("sv-SE");
          const dayName = dayOfWeek === 1 ? "จันทร์" : dayOfWeek === 3 ? "พุธ" : "ศุกร์";
          
          await saveAttendanceDay({
            date: dateStr,
            status: "active",
            notes: `เข้าแถววัน${dayName}อัตโนมัติ`
          });
          count++;
        }
      }
      alert(`สร้างวันเข้าแถวอัตโนมัติของเดือนนี้สำเร็จ ทั้งหมด ${count} วัน (จันทร์, พุธ, ศุกร์)`);
      loadAllData();
    } catch (err) {
      console.error("Generate schedules failed:", err);
      alert("เกิดข้อผิดพลาดในการสร้างวันเข้าแถว");
    }
  };

  // Save specific day settings manually
  const handleSaveDayStatus = async (dateStr: string, status: "active" | "cancelled" | "event") => {
    try {
      await saveAttendanceDay({
        date: dateStr,
        status: status,
        notes: schedNotes || "อัปเดตสถานะวันเข้าแถวโดยอาจารย์"
      });
      setSchedNotes("");
      alert("อัปเดตวันทำกิจกรรมเสร็จสมบูรณ์");
      loadAllData();
    } catch (err) {
      alert("เกิดข้อผิดพลาด");
    }
  };

  // Settings Save
  const handleSaveSettings = async () => {
    try {
      const nextSettings: Setting = {
        collegeLat: parseFloat(String(latInput)),
        collegeLng: parseFloat(String(lngInput)),
        checkInRadius: parseInt(String(radInput)),
        adminPassword: passInput
      };
      await updateSettings(nextSettings);
      onSettingsUpdate(nextSettings);
      alert("อัปเดตการตั้งค่าพิกัดความปลอดภัยวิทยาลัยสำเร็จ!");
    } catch (err) {
      alert("บันทึกการตั้งค่าล้มเหลว");
    }
  };

  const [adminLocLoading, setAdminLocLoading] = useState(false);
  const [adminLocError, setAdminLocError] = useState<string | null>(null);

  const handleUseCurrentLocation = () => {
    setAdminLocLoading(true);
    setAdminLocError(null);
    if (!navigator.geolocation) {
      setAdminLocError("เบราว์เซอร์ของคุณไม่รองรับ Geolocation");
      setAdminLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatInput(position.coords.latitude);
        setLngInput(position.coords.longitude);
        setAdminLocLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setAdminLocError("กรุณาอนุญาตสิทธิ์และเปิด GPS ในเบราว์เซอร์เพื่อดึงตำแหน่งพิกัดของคุณ");
        setAdminLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Generate A4 Report Print Query
  const handleGenerateReportQuery = () => {
    let filtered = [...records];
    let subtitleLabel = "";

    if (repType === "daily") {
      filtered = filtered.filter(r => r.date === repDate);
      subtitleLabel = `ประจำวันที่ ${repDate}`;
    } else if (repType === "weekly") {
      // Simple week lookup
      // repWeek format: '2026-W27'
      const [yearStr, weekStr] = repWeek.split("-W");
      const targetWeek = parseInt(weekStr);
      
      // Filter by records in that estimated week
      filtered = filtered.filter(r => {
        const recordDate = new Date(r.date);
        // Get week number
        const oneJan = new Date(recordDate.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((recordDate.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
        const recordWeek = Math.ceil((recordDate.getDay() + 1 + numberOfDays) / 7);
        return recordWeek === targetWeek && recordDate.getFullYear() === parseInt(yearStr);
      });
      subtitleLabel = `สัปดาห์ที่ ${targetWeek} ปี พ.ศ. ${parseInt(yearStr) + 543}`;
    } else if (repType === "monthly") {
      filtered = filtered.filter(r => r.date.startsWith(repMonth));
      subtitleLabel = `ประจำเดือน ${repMonth}`;
    }

    // Filter by classroom
    if (repClassroom !== "all") {
      filtered = filtered.filter(r => r.classroomId === repClassroom);
    }

    setPrintableRecords(filtered);
    setReportTitle(repType === "daily" ? "รายงานการเข้าแถวรายวัน" : repType === "weekly" ? "รายงานการเข้าแถวรายสัปดาห์" : "รายงานการเข้าแถวรายเดือน");
    setReportSubtitle(subtitleLabel);
    setShowA4Modal(true);
  };

  // Analytics helper stats
  const totalStudents = students.length;
  const todayStr = new Date().toLocaleDateString("sv-SE");
  const todayRecords = records.filter(r => r.date === todayStr);
  const presentToday = todayRecords.filter(r => r.status === "present").length;
  const lateToday = todayRecords.filter(r => r.status === "late").length;
  const absentToday = totalStudents - presentToday - lateToday;

  // Render Charts Data (Weekly trend)
  const daysInPast7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString("sv-SE");
  }).reverse();

  // Calculate Asset stats for overview
  let durableBorrowed = 0;
  let consumableConsumed = 0;
  
  borrowLogs.forEach(log => {
    const assetObj = assets.find(a => a.id === log.assetId);
    if (assetObj) {
      if (assetObj.type === 'durable' && log.status === 'borrowed') {
        durableBorrowed += log.qty;
      } else if (assetObj.type === 'consumable' && log.status === 'consumed') {
        consumableConsumed += log.qty;
      }
    }
  });

  const assetChartData = [
    { name: 'วัสดุคงทน (กำลังยืม)', qty: durableBorrowed },
    { name: 'วัสดุสิ้นเปลือง (เบิกใช้)', qty: consumableConsumed }
  ];

  const chartData = daysInPast7.map(dateStr => {
    const dayRecs = records.filter(r => r.date === dateStr);
    const pres = dayRecs.filter(r => r.status === "present").length;
    const lat = dayRecs.filter(r => r.status === "late").length;
    const abs = totalStudents > 0 ? Math.max(0, totalStudents - pres - lat) : 0;
    return {
      name: dateStr.split("-").slice(1).join("/"), // MM/DD
      มาทัน: pres,
      สาย: lat,
      ขาด: abs
    };
  });

  return (
    <div className="w-full max-w-6xl mx-auto font-sans bg-white border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row text-slate-800 no-print-container">
      
      {/* Left Sidebar Menu */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800/80 no-print">
        {/* Brand Logo and Title */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20 overflow-hidden p-0.5">
              <img 
                src="https://i.postimg.cc/KvtbhDHb/Logo-DG-color-01.png" 
                alt="Logo" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="w-full h-full bg-indigo-600 rounded-lg flex items-center justify-center font-heading font-bold text-xl">DG</div>';
                  }
                }}
              />
            </div>
            <div>
              <h1 className="font-heading font-bold text-white text-sm leading-tight">DG-kvcdata</h1>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-sans">Digital Graphics</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 font-sans">เมนูผู้ควบคุม</p>
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold font-heading transition-all cursor-pointer ${
              activeTab === "overview" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            ภาพรวมระบบ
          </button>
          <button
            onClick={() => setActiveTab("attendance")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold font-heading transition-all cursor-pointer ${
              activeTab === "attendance" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            เช็คชื่อเข้าแถว
          </button>
          <button
            onClick={() => setActiveTab("students")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold font-heading transition-all cursor-pointer ${
              activeTab === "students" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            ห้องเรียน & นักเรียน
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold font-heading transition-all cursor-pointer ${
              activeTab === "schedule" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <CalendarIcon className="w-4 h-4" />
            จัดตารางกิจกรรม
          </button>
          <button
            onClick={() => setActiveTab("assets")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold font-heading transition-all cursor-pointer ${
              activeTab === "assets" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Package className="w-4 h-4" />
            ยืมคืนพัสดุสาขา
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold font-heading transition-all cursor-pointer ${
              activeTab === "reports" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <Printer className="w-4 h-4" />
            ออกรายงาน (A4)
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold font-heading transition-all cursor-pointer ${
              activeTab === "settings" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            ตั้งค่า GPS มหาลัย
          </button>
        </nav>

        {/* Connected DB footer block */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-950/20">
          <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-800/40 text-center">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-sans">Connected DB</p>
            <p className="text-xs text-indigo-400 font-mono mt-0.5">Firebase: DG-kvcdata</p>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col bg-slate-50/50 min-w-0">
        {/* Right Header Bar */}
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold font-heading text-slate-800">
              {activeTab === "overview" && "แผงสารสนเทศภาพรวมทั้งสาขา"}
              {activeTab === "attendance" && "เช็คชื่อเข้าแถว (Attendance Monitor)"}
              {activeTab === "students" && "จัดการห้องเรียน & นำเข้ารายชื่อนักเรียน"}
              {activeTab === "schedule" && "จัดตารางและวันเวลาทำกิจกรรมหน้าเสาธง"}
              {activeTab === "assets" && "ระบบยืมคืนพัสดุและวัสดุอุปกรณ์ภายในสาขา"}
              {activeTab === "reports" && "สรุปผลรายงานและพิมพ์เอกสารทางวิชาการ (A4)"}
              {activeTab === "settings" && "ตั้งค่าขอบเขตพิกัดความปลอดภัยสำหรับผู้ใช้นักเรียน"}
            </h2>
            <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Database
            </span>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-heading text-[11px] font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            ออกจากระบบ
          </button>
        </header>

        {/* Scrollable active content block */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium font-heading">กำลังเรียกข้อมูลสารสนเทศทั้งหมด...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h3 className="font-heading font-bold text-lg text-slate-900">แผงสารสนเทศภาพรวมทั้งสาขา</h3>
                    <p className="text-xs text-slate-500 mt-1">สรุปการเข้าเรียน การมาสาย และขาดกิจกรรมของนักเรียนสาขาดิจิทัลกราฟิก ณ ปัจจุบัน</p>
                  </div>

                  {/* Dashboard Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">นักเรียนทั้งหมด</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1 font-mono">{totalStudents}</p>
                    <p className="text-[10px] text-slate-400 mt-1">ในระบบสาขา</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">มาแถววันนี้</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{presentToday}</p>
                    <p className="text-[10px] text-emerald-500 mt-1">เข้าแถวทันเวลา</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">มาสายวันนี้</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1 font-mono">{lateToday}</p>
                    <p className="text-[10px] text-amber-500 mt-1">หลังเวลา 08.00 น.</p>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                    <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider">ขาดแถววันนี้</p>
                    <p className="text-2xl font-bold text-rose-700 mt-1 font-mono">{Math.max(0, absentToday)}</p>
                    <p className="text-[10px] text-rose-500 mt-1">ไม่พบการล็อกอิน</p>
                  </div>
                  <div className="bg-cyan-50 border border-cyan-100 p-4 rounded-2xl col-span-2 md:col-span-1">
                    <p className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider">จำนวนห้องเรียน</p>
                    <p className="text-2xl font-bold text-cyan-700 mt-1 font-mono">{classrooms.length}</p>
                    <p className="text-[10px] text-cyan-500 mt-1">กลุ่มชั้นเรียน active</p>
                  </div>
                </div>

                {/* Analytical Charts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 md:col-span-2 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-heading font-bold text-slate-800 text-sm">สถิติอัตราส่วนเข้าเสาธงย้อนหลัง 7 วัน</h4>
                      <span className="text-[10px] font-mono text-slate-400">DG Trend Chart</span>
                    </div>
                    <div className="h-[240px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <Tooltip />
                          <Legend />
                          <Area type="monotone" dataKey="มาทัน" stroke="#10b981" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={2} />
                          <Area type="monotone" dataKey="สาย" stroke="#f59e0b" fillOpacity={1} fill="url(#colorLate)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4 flex flex-col justify-between">
                    <div>
                      <h4 className="font-heading font-bold text-slate-800 text-sm mb-3">ตรวจสอบการเข้าแถววันนี้</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">มีนักเรียนเช็คชื่อแล้วทั้งสิ้น {todayRecords.length} คน โดยผ่านวิธีกระบวนการตรวจสอบดังนี้:</p>
                    </div>

                    <div className="space-y-3 my-4">
                      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-cyan-500" />
                          สแกน QR Code หน้าแถว
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800">{todayRecords.filter(r => r.method === "scan").length} คน</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          เช็คชื่อตนเองด้วย GPS
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800">{todayRecords.filter(r => r.method === "self").length} คน</span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <Edit className="w-3.5 h-3.5 text-amber-500" />
                          คุณครูบันทึกด้วยมือ
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800">{todayRecords.filter(r => r.method === "manual").length} คน</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab("attendance")}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      ไปหน้าเช็คชื่อเข้าแถว
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-heading font-bold text-slate-800 text-sm">การใช้งานพัสดุและวัสดุสาขา</h4>
                    </div>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={assetChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="qty" fill="#6366f1" radius={[4, 4, 0, 0]} name="จำนวน (ชิ้น)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                    <h4 className="font-heading font-bold text-slate-800 text-sm mb-3">รายการเบิกยืม-ใช้งานล่าสุด</h4>
                    <div className="space-y-3 overflow-y-auto max-h-[200px] pr-2">
                      {borrowLogs.slice(0, 5).map(log => {
                        const assetObj = assets.find(a => a.id === log.assetId);
                        const isConsumable = assetObj?.type === 'consumable';
                        return (
                          <div key={log.id} className="bg-white p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
                            <div>
                              <p className="font-bold text-slate-800 text-xs">{assetObj?.name || log.assetId}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">{log.studentName} • {log.qty} ชิ้น</p>
                            </div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                              log.status === "borrowed" 
                                ? "bg-amber-50 text-amber-700 border-amber-200" 
                                : log.status === "consumed"
                                ? "bg-orange-50 text-orange-600 border-orange-100"
                                : "bg-slate-100 text-slate-500"
                            }`}>
                              {log.status === "borrowed" ? "กำลังยืม" : log.status === "consumed" ? "เบิกใช้งาน" : "คืนแล้ว"}
                            </span>
                          </div>
                        );
                      })}
                      {borrowLogs.length === 0 && (
                        <p className="text-center text-xs text-slate-400 py-4">ยังไม่มีประวัติการเบิก-ยืม</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ATTENDANCE CHECK */}
            {activeTab === "attendance" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-slate-900">กระบวนการเช็คชื่อเข้าแถวหน้าเสาธง</h3>
                    <p className="text-xs text-slate-500 mt-1">สามารถเลือกเช็คด้วยตัวเอง (แมนนวลรายห้อง) หรือจะรับสแกนคิวอาร์โค้ดประจำตัว</p>
                  </div>

                  {/* Sub tab selectors */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setAttSubtab("manual")}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        attSubtab === "manual" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      เช็คชื่อแมนนวลรายห้อง
                    </button>
                    <button
                      onClick={() => setAttSubtab("scan")}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        attSubtab === "scan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                      }`}
                    >
                      สแกนบาร์โค้ด / QR บัตร
                    </button>
                  </div>
                </div>

                {/* SUB TAB: Manual Grid */}
                {attSubtab === "manual" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">เลือกกลุ่มชั้นเรียน</label>
                        <select
                          value={attClassroom}
                          onChange={(e) => setAttClassroom(e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                        >
                          {classrooms.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">วันที่ต้องการเช็คแถว</label>
                        <input
                          type="date"
                          value={attDate}
                          onChange={(e) => setAttDate(e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white font-mono"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={handleSaveAttendance}
                          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-heading text-xs font-semibold py-2.5 px-4 rounded-xl shadow transition-colors cursor-pointer"
                        >
                          บันทึกการเช็คชื่อห้องนี้
                        </button>
                      </div>
                    </div>

                    {/* Students list for selected class */}
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 font-heading font-bold text-slate-700 text-[11px]">
                            <th className="py-3 px-4 w-28 font-mono">รหัสนักเรียน</th>
                            <th className="py-3 px-4">ชื่อ - นามสกุล</th>
                            <th className="py-3 px-4 text-center">สแกนใบหน้าแล้ว</th>
                            <th className="py-3 px-4 text-center w-[250px]">บันทึกสถานะการมา</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {students.filter(s => s.classroomId === attClassroom).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                ไม่พบนักเรียนในห้องเรียนนี้ กรุณาเพิ่มรายชื่อนักเรียนก่อน
                              </td>
                            </tr>
                          ) : (
                            students.filter(s => s.classroomId === attClassroom).map((s) => {
                              const currentStatus = localAttendanceMap[s.id] || "absent";
                              return (
                                <tr key={s.id} className="hover:bg-slate-50/50">
                                  <td className="py-3 px-4 font-mono font-medium text-slate-600">{s.id}</td>
                                  <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                                  <td className="py-3 px-4 text-center">
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg ${
                                      s.faceRegistered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
                                    }`}>
                                      {s.faceRegistered ? "ลงทะเบียนแล้ว" : "ยังไม่ได้ลง"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex bg-slate-100 p-0.5 rounded-xl gap-0.5">
                                      <button
                                        onClick={() => handleToggleStatus(s.id, "present")}
                                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg flex-1 cursor-pointer transition-all ${
                                          currentStatus === "present" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-600"
                                        }`}
                                      >
                                        มาปกติ
                                      </button>
                                      <button
                                        onClick={() => handleToggleStatus(s.id, "late")}
                                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg flex-1 cursor-pointer transition-all ${
                                          currentStatus === "late" ? "bg-amber-500 text-white shadow-sm" : "text-slate-600"
                                        }`}
                                      >
                                        สาย
                                      </button>
                                      <button
                                        onClick={() => handleToggleStatus(s.id, "absent")}
                                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg flex-1 cursor-pointer transition-all ${
                                          currentStatus === "absent" ? "bg-rose-500 text-white shadow-sm" : "text-slate-600"
                                        }`}
                                      >
                                        ขาด
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB TAB: QR/Barcode Scanning simulation */}
                {attSubtab === "scan" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                    
                    {/* Simulated Scanner camera frame */}
                    <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col justify-between items-center text-center relative overflow-hidden aspect-square max-w-[360px] mx-auto border-2 border-slate-800">
                      {/* Grid background */}
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:24px_24px] opacity-25"></div>
                      
                      {/* Scan frame target lines */}
                      <div className="absolute top-8 left-8 w-8 h-8 border-t-4 border-l-4 border-cyan-400"></div>
                      <div className="absolute top-8 right-8 w-8 h-8 border-t-4 border-r-4 border-cyan-400"></div>
                      <div className="absolute bottom-8 left-8 w-8 h-8 border-b-4 border-l-4 border-cyan-400"></div>
                      <div className="absolute bottom-8 right-8 w-8 h-8 border-b-4 border-r-4 border-cyan-400"></div>

                      <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 animate-scan shadow-[0_0_15px_#22d3ee] z-10"></div>

                      <div className="my-auto z-10 space-y-3">
                        <QrCode className="w-16 h-16 text-cyan-400 animate-pulse mx-auto" />
                        <h4 className="font-heading font-bold text-sm text-slate-200">เครื่องสแกนบาร์โค้ดจำลอง</h4>
                        <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                          พิมพ์รหัสนักเรียนหรือนำเครื่องสแกนยิงบาร์โค้ดลงในช่องอินพุตเพื่อทดสอบจำลองเสมือนจริงในชั้นเรียน
                        </p>
                      </div>

                      <form onSubmit={handleBarcodeSubmit} className="w-full relative z-10 mt-2">
                        <input
                          type="text"
                          value={scanInputId}
                          onChange={(e) => setScanInputId(e.target.value)}
                          placeholder="พิมพ์รหัสนักเรียน หรือ ยิงบาร์โค้ด..."
                          className="w-full text-center text-xs font-mono border border-slate-700 bg-slate-950 text-white rounded-xl py-2.5 px-4 outline-none focus:border-cyan-400 transition-colors"
                        />
                      </form>
                    </div>

                    {/* Scan session records logs */}
                    <div className="flex flex-col justify-between space-y-4">
                      <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl flex-1 space-y-3">
                        <h4 className="font-heading font-bold text-slate-900 text-sm flex items-center gap-2">
                          <CheckCircle className="text-emerald-500 w-5 h-5" />
                          รายการที่สแกนเข้าแถวในเซสชั่นนี้
                        </h4>
                        
                        {scanMessage && (
                          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                            scanMessage.type === "success" 
                              ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                              : "bg-rose-50 border-rose-100 text-rose-700"
                          }`}>
                            {scanMessage.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            {scanMessage.text}
                          </div>
                        )}

                        <div className="border border-slate-200 rounded-2xl h-[180px] overflow-y-auto divide-y divide-slate-100 bg-white">
                          {scannedSessionLogs.length === 0 ? (
                            <p className="text-slate-400 text-xs py-12 text-center">ยังไม่มีข้อมูลการยิงสแกนบาร์โค้ดหน้าแถว</p>
                          ) : (
                            scannedSessionLogs.map((log, idx) => (
                              <div key={idx} className="p-3 flex justify-between items-center text-xs hover:bg-slate-50/50">
                                <div>
                                  <p className="font-bold text-slate-900">{log.name}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">รหัส: {log.studentId} • เวลาสแกน: {log.time}</p>
                                </div>
                                <span className={`font-semibold text-[10px] px-2 py-0.5 rounded ${
                                  log.status === "มาปกติ" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                                }`}>
                                  {log.status}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CLASSROOMS & STUDENTS */}
            {activeTab === "students" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-lg text-slate-900">จัดการข้อมูลห้องเรียนและรายชื่อนักเรียน</h3>
                    <p className="text-xs text-slate-500 mt-1">อัปเดตแก้ไขรายชื่อรายบุคคล หรือทำการนำเข้ายกห้องผ่านไฟล์แผนงาน Excel</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button 
                      onClick={handleDownloadTemplate}
                      className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-heading text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      ดาวน์โหลดไฟล์ต้นแบบ
                    </button>
                    <select
                      value={importClassroomId}
                      onChange={(e) => setImportClassroomId(e.target.value)}
                      className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    >
                      <option value="auto">สร้างห้องอัตโนมัติตามไฟล์ Excel</option>
                      {classrooms.map(c => (
                        <option key={`import-${c.id}`} value={c.id}>
                          นำเข้าสู่ห้อง: {c.name}
                        </option>
                      ))}
                    </select>
                    {/* Excel import upload button */}
                    <label className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold px-4 py-2.5 rounded-xl shadow transition-colors cursor-pointer">
                      <Upload className="w-4 h-4" />
                      นำเข้าไฟล์รายชื่อจาก Excel
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleExcelImport}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {importStatus && (
                  <div className="bg-cyan-50 border border-cyan-100 text-cyan-800 p-3 rounded-xl text-xs font-semibold">
                    {importStatus}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                  
                  {/* Left panel: Classrooms List & Add */}
                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h4 className="font-heading font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <BookOpen className="text-cyan-500 w-4 h-4" />
                        รายชื่อห้องเรียนทั้งหมด ({classrooms.length})
                      </h4>
                      
                      <div className="border border-slate-200 rounded-2xl max-h-[220px] overflow-y-auto bg-white divide-y divide-slate-100">
                        {classrooms.map((c) => (
                          <div key={c.id} className="p-3 flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-800">{c.name}</span>
                            <button
                              onClick={() => handleDeleteClassroom(c.id)}
                              className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Manual room addition */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เพิ่มห้องเรียนใหม่แมนนวล</p>
                      <input
                        type="text"
                        placeholder="รหัสห้อง (e.g., DG_1_1)"
                        value={newRoomId}
                        onChange={(e) => setNewRoomId(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      />
                      <input
                        type="text"
                        placeholder="ชื่อห้องเรียน (e.g., สคด.1/1)"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2"
                      />
                      <button
                        onClick={handleAddClassroom}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-2.5 rounded-lg transition-all cursor-pointer"
                      >
                        เพิ่มห้องเรียน
                      </button>
                    </div>
                  </div>

                  {/* Right panel: Students list table with search filter & Add */}
                  <div className="md:col-span-2 bg-slate-50 border border-slate-100 p-5 rounded-3xl flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h4 className="font-heading font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <Users className="text-indigo-500 w-4 h-4" />
                          บัญชีรายชื่อนักเรียน ({students.length} คน)
                        </h4>
                        
                        {/* Filters */}
                        <div className="flex gap-2 w-full sm:w-auto">
                          <input
                            type="text"
                            placeholder="ค้นหาชื่อ / รหัส..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white border border-slate-200 text-xs px-3 py-1.5 rounded-xl w-full sm:w-40"
                          />
                          <select
                            value={selectedClassroom}
                            onChange={(e) => setSelectedClassroom(e.target.value)}
                            className="bg-white border border-slate-200 text-xs px-2 py-1.5 rounded-xl"
                          >
                            <option value="all">ทุกชั้นเรียน</option>
                            {classrooms.map(c => (
                              <option key={c.id} value={c.id}>{c.name.split(" ")[0]}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Students table & Bulk actions */}
                      {selectedStudentIds.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center gap-2 bg-indigo-50 border border-indigo-100 p-3 rounded-2xl">
                          <span className="text-xs font-semibold text-indigo-700">เลือก {selectedStudentIds.length} รายการ</span>
                          <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
                            <select
                              value={bulkTargetClassroom}
                              onChange={(e) => setBulkTargetClassroom(e.target.value)}
                              className="bg-white border border-indigo-200 text-xs px-2 py-1.5 rounded-xl w-full sm:w-auto text-slate-700"
                            >
                              <option value="">-- เลือกห้องเพื่อย้าย --</option>
                              {classrooms.map(c => (
                                <option key={`bulk-${c.id}`} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={handleBulkMoveStudents}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                            >
                              ย้ายห้อง
                            </button>
                            <button
                              onClick={handleBulkDeleteStudents}
                              className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                            >
                              ลบทั้งหมด
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="border border-slate-200 rounded-2xl max-h-[250px] overflow-y-auto bg-white">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                              <th className="py-2.5 px-3 w-8">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  onChange={(e) => {
                                    const filtered = students.filter(s => {
                                      const matchesSearch = s.name.includes(searchQuery) || s.id.includes(searchQuery);
                                      const matchesRoom = selectedClassroom === "all" || s.classroomId === selectedClassroom;
                                      return matchesSearch && matchesRoom;
                                    });
                                    if (e.target.checked) {
                                      setSelectedStudentIds(filtered.map(s => s.id));
                                    } else {
                                      setSelectedStudentIds([]);
                                    }
                                  }}
                                  checked={
                                    students.filter(s => {
                                      const matchesSearch = s.name.includes(searchQuery) || s.id.includes(searchQuery);
                                      const matchesRoom = selectedClassroom === "all" || s.classroomId === selectedClassroom;
                                      return matchesSearch && matchesRoom;
                                    }).length > 0 &&
                                    selectedStudentIds.length === students.filter(s => {
                                      const matchesSearch = s.name.includes(searchQuery) || s.id.includes(searchQuery);
                                      const matchesRoom = selectedClassroom === "all" || s.classroomId === selectedClassroom;
                                      return matchesSearch && matchesRoom;
                                    }).length
                                  }
                                />
                              </th>
                              <th className="py-2.5 px-3 font-mono">ID</th>
                              <th className="py-2.5 px-3">ชื่อ</th>
                              <th className="py-2.5 px-3">ห้อง</th>
                              <th className="py-2.5 px-3 text-center">จัดการ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {students
                              .filter(s => {
                                const matchesSearch = s.name.includes(searchQuery) || s.id.includes(searchQuery);
                                const matchesRoom = selectedClassroom === "all" || s.classroomId === selectedClassroom;
                                return matchesSearch && matchesRoom;
                              })
                              .map(s => {
                                const room = classrooms.find(c => c.id === s.classroomId);
                                const isSelected = selectedStudentIds.includes(s.id);
                                return (
                                  <tr key={s.id} className={`hover:bg-slate-50/40 ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                                    <td className="py-2 px-3">
                                      <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedStudentIds(prev => [...prev, s.id]);
                                          } else {
                                            setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                                          }
                                        }}
                                      />
                                    </td>
                                    <td className="py-2 px-3 font-mono text-slate-500">{s.id}</td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">{s.name}</td>
                                    <td className="py-2 px-3 text-slate-500">{room ? room.name.split(" ")[0] : "ไม่ระบุ"}</td>
                                    <td className="py-2 px-3 text-center">
                                      <button
                                        onClick={() => handleDeleteStudent(s.id)}
                                        className="text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Manual student addition */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">เพิ่มข้อมูลนักเรียนใหม่แมนนวล</p>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          placeholder="รหัสประจำตัวนักเรียน"
                          value={newStudentId}
                          onChange={(e) => setNewStudentId(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 font-mono sm:col-span-1"
                        />
                        <input
                          type="text"
                          placeholder="ชื่อ-นามสกุล"
                          value={newStudentName}
                          onChange={(e) => setNewStudentName(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 sm:col-span-2"
                        />
                        <select
                          value={newStudentRoomId}
                          onChange={(e) => setNewStudentRoomId(e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white"
                        >
                          <option value="">เลือกกลุ่มห้องเรียน</option>
                          {classrooms.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handleAddStudent}
                        className="mt-3 w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-2.5 rounded-lg transition-all cursor-pointer"
                      >
                        บันทึกบัญชีนักเรียนใหม่
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: SCHEDULE SETTINGS */}
            {activeTab === "schedule" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">ตารางและปฏิทินปฎิบัติกิจกรรมหน้าเสาธง</h3>
                  <p className="text-xs text-slate-500 mt-1">กำหนดวันเข้าแถว ยกเว้น วันหยุด หรือเปลี่ยนสถานะกิจกรรมของสาขาวิชา</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  
                  {/* Auto Generator Box */}
                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl space-y-4">
                    <h4 className="font-heading font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <CalendarIcon className="text-cyan-500 w-4 h-4" />
                      เครื่องมือช่วยสร้างวันอัตโนมัติ
                    </h4>
                    
                    <p className="text-xs text-slate-500 leading-relaxed">
                      ปกติแล้วนักเรียนจะเข้าแถวในวัน <span className="font-bold text-slate-700">จันทร์ พุธ และ ศุกร์</span> ท่านสามารถระบุเดือนเพื่อสร้างวันทั้งหมดในเดือนนั้น ๆ อัตโนมัติในฐานข้อมูลเพื่อรอนักเรียนล็อกอิน
                    </p>

                    <div className="space-y-3 pt-2">
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white font-mono"
                      />
                      <button
                        onClick={handleGenerateSchedules}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-2.5 rounded-xl cursor-pointer"
                      >
                        สร้างวันอัตโนมัติ (จ. พ. ศ.)
                      </button>
                    </div>
                  </div>

                  {/* List/Schedule Control List */}
                  <div className="md:col-span-2 bg-slate-50 border border-slate-100 p-5 rounded-3xl space-y-4">
                    <h4 className="font-heading font-bold text-slate-800 text-sm">ปฏิทินวันกิจกรรมที่บันทึกแล้ว</h4>
                    
                    <div className="bg-white p-3 rounded-2xl border border-slate-100">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">กรอกหมายเหตุ หรือกิจกรรม (เมื่อเปลี่ยนวันงดเว้น/วันกิจกรรม)</label>
                      <input
                        type="text"
                        placeholder="เช่น วันหยุดราชการ, วันไหว้ครู, กิจกรรมกีฬาสี"
                        value={schedNotes}
                        onChange={(e) => setSchedNotes(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="border border-slate-200 rounded-2xl bg-white p-4">
                      {/* Calendar View */}
                      <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                        {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d, i) => (
                          <div key={i} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {(() => {
                          const [yStr, mStr] = selectedMonth.split("-");
                          if (!yStr || !mStr) return null;
                          const year = parseInt(yStr);
                          const month = parseInt(mStr) - 1;
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const firstDay = new Date(year, month, 1).getDay();
                          const days = [];
                          for (let i = 0; i < firstDay; i++) days.push(null);
                          for (let i = 1; i <= daysInMonth; i++) days.push(i);
                          
                          return days.map((d, i) => {
                            if (d === null) return <div key={i} className="h-16 md:h-20"></div>;
                            
                            const dateStr = `${yStr}-${mStr}-${String(d).padStart(2, '0')}`;
                            const dayData = attendanceDays.find(x => x.date === dateStr);
                            
                            let bgClass = "bg-slate-50 border border-slate-100";
                            let icon = null;
                            if (dayData) {
                              if (dayData.status === 'active') {
                                bgClass = "bg-emerald-50 border border-emerald-200 text-emerald-800";
                                icon = <Check className="w-3 h-3 text-emerald-600" />;
                              } else if (dayData.status === 'cancelled') {
                                bgClass = "bg-rose-50 border border-rose-200 text-rose-800";
                                icon = <X className="w-3 h-3 text-rose-600" />;
                              } else if (dayData.status === 'event') {
                                bgClass = "bg-amber-50 border border-amber-200 text-amber-800";
                                icon = <AlertTriangle className="w-3 h-3 text-amber-600" />;
                              }
                            }
                            
                            return (
                              <div key={i} className={`h-16 md:h-20 rounded-xl p-1.5 flex flex-col relative group transition-colors hover:shadow-sm ${bgClass}`}>
                                <div className="flex justify-between items-start">
                                  <span className="text-xs font-bold font-mono">{d}</span>
                                  {icon}
                                </div>
                                {dayData?.notes && (
                                  <div className="text-[9px] leading-tight mt-1 truncate" title={dayData.notes}>
                                    {dayData.notes}
                                  </div>
                                )}
                                
                                {/* Hover Actions */}
                                <div className="absolute inset-x-0 bottom-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                                  <div className="flex bg-slate-900/90 p-0.5 rounded-lg shadow-md scale-90 gap-0.5">
                                    <button onClick={(e) => { e.stopPropagation(); handleSaveDayStatus(dateStr, "active"); }} className="p-1 hover:bg-slate-800 rounded text-emerald-400" title="เข้าแถวปกติ">
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleSaveDayStatus(dateStr, "cancelled"); }} className="p-1 hover:bg-slate-800 rounded text-rose-400" title="งดเข้าแถว">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleSaveDayStatus(dateStr, "event"); }} className="p-1 hover:bg-slate-800 rounded text-amber-400" title="กิจกรรม">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 5: ASSET AND BORROWINGS */}
            {activeTab === "assets" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">ระบบควบคุมพัสดุ และ จัดการยืมคืนของใช้</h3>
                  <p className="text-xs text-slate-500 mt-1">คอยเช็ค ยอมรับ หรือ ปฏิเสธ การเบิกยืมอุปกรณ์กราฟิกและสื่อส่วนกลางของสาขา</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Asset list manager with addition form */}
                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl space-y-4">
                    <h4 className="font-heading font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <Package className="text-cyan-500 w-4 h-4" />
                      คลังพัสดุอุปกรณ์สาขา ({assets.length} รายการ)
                    </h4>

                    {/* Manual Asset addition form */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">เพิ่มพัสดุใหม่ในฐานข้อมูล</p>
                      <input
                        type="text"
                        placeholder="รหัสพัสดุ (e.g. AST001)"
                        value={newAssetId}
                        onChange={(e) => setNewAssetId(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 font-mono"
                      />
                      <input
                        type="text"
                        placeholder="ชื่อรายการพัสดุ/อุปกรณ์"
                        value={newAssetName}
                        onChange={(e) => setNewAssetName(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2"
                      />
                      <select
                        value={newAssetType}
                        onChange={(e) => setNewAssetType(e.target.value as "consumable" | "durable")}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-medium"
                      >
                        <option value="durable">วัสดุคงทน (ต้องคืน)</option>
                        <option value="consumable">วัสดุใช้แล้วหมดไป (ไม่ต้องคืน)</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        placeholder="จำนวนพัสดุที่มีทั้งหมด"
                        value={newAssetQty}
                        onChange={(e) => setNewAssetQty(parseInt(e.target.value) || 1)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2"
                      />
                      <textarea
                        placeholder="คำอธิบายสั้นๆ เกี่ยวกับสเปกอุปกรณ์..."
                        value={newAssetDesc}
                        onChange={(e) => setNewAssetDesc(e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 h-16 resize-none"
                      />
                      <button
                        onClick={handleAddAsset}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-2.5 rounded-lg transition-all cursor-pointer"
                      >
                        ลงทะเบียนอุปกรณ์
                      </button>
                    </div>

                    {/* Small list to review */}
                    <div className="border border-slate-200 rounded-2xl max-h-[160px] overflow-y-auto bg-white divide-y divide-slate-100">
                      {assets.map((item) => (
                        <div key={item.id} className="p-3 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                              {item.name}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                item.type === 'consumable' 
                                  ? 'bg-orange-50 text-orange-600 border-orange-100'
                                  : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                              }`}>
                                {item.type === 'consumable' ? 'ใช้แล้วหมดไป' : 'คงทน'}
                              </span>
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">คงเหลือ: {item.availableQty}/{item.totalQty}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteAsset(item.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active Borrow Records Log Table */}
                  <div className="lg:col-span-2 bg-slate-50 border border-slate-100 p-5 rounded-3xl space-y-4">
                    <h4 className="font-heading font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <ArrowRightLeft className="text-indigo-500 w-4 h-4" />
                      สมุดบันทึกรายการยืม-คืนอุปกรณ์ดิจิทัลกราฟิก
                    </h4>

                    <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-heading font-bold text-slate-600 text-[10px] uppercase tracking-wider">
                            <th className="py-2.5 px-3">พัสดุ</th>
                            <th className="py-2.5 px-3">ผู้ยืม / ห้องเรียน</th>
                            <th className="py-2.5 px-3">วันที่ยืม</th>
                            <th className="py-2.5 px-3 text-center">สถานะ</th>
                            <th className="py-2.5 px-3 text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {borrowLogs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                                ยังไม่มีประวัติการเบิกยืมพัสดุในระบบสาขา
                              </td>
                            </tr>
                          ) : (
                            borrowLogs.map((log) => {
                              const assetObj = assets.find(a => a.id === log.assetId);
                              const roomObj = classrooms.find(c => c.id === log.classroomId);
                              const borrowDay = new Date(log.borrowDate).toLocaleDateString("th-TH", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                              });

                              return (
                                <tr key={log.id} className="hover:bg-slate-50/30">
                                  <td className="py-3 px-3">
                                    <p className="font-bold text-slate-800">{assetObj?.name || log.assetId}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">จำนวน: {log.qty} ชิ้น</p>
                                  </td>
                                  <td className="py-3 px-3">
                                    <p className="font-semibold text-slate-700">{log.studentName}</p>
                                    <p className="text-[10px] text-slate-500 font-medium">{roomObj ? roomObj.name.split(" ")[0] : "ไม่ระบุ"}</p>
                                  </td>
                                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{borrowDay}</td>
                                  <td className="py-3 px-3 text-center">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                                      log.status === "borrowed" 
                                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                                        : log.status === "consumed"
                                        ? "bg-orange-50 text-orange-600 border-orange-100"
                                        : "bg-slate-100 text-slate-500"
                                    }`}>
                                      {log.status === "borrowed" ? "กำลังยืม" : log.status === "consumed" ? "เบิกใช้งาน" : "คืนแล้ว"}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    {log.status === "borrowed" ? (
                                      <button
                                        onClick={() => handleConfirmReturn(log)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                      >
                                        ยืนยันรับคืน
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-medium">เสร็จสิ้น</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 6: REPORTS & PRINTING */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">กระบวนการรายงานและการพิมพ์รายงาน (A4 PDF)</h3>
                  <p className="text-xs text-slate-500 mt-1">คัดกรองข้อมูลตามวัน สัปดาห์ หรือรายเดือน และห้องเรียน เพื่อทำการส่งออกและสั่งพิมพ์รายงาน</p>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ประเภทรายงาน</label>
                    <select
                      value={repType}
                      onChange={(e) => setRepType(e.target.value as any)}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                    >
                      <option value="daily">รายงานรายวัน (Daily)</option>
                      <option value="weekly">รายงานรายสัปดาห์ (Weekly)</option>
                      <option value="monthly">รายงานรายเดือน (Monthly)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">คัดกรองห้องเรียน</label>
                    <select
                      value={repClassroom}
                      onChange={(e) => setRepClassroom(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                    >
                      <option value="all">นักเรียนทั้งหมด (ทุกห้อง)</option>
                      {classrooms.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Period Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ช่วงเวลาที่เลือก</label>
                    {repType === "daily" && (
                      <input
                        type="date"
                        value={repDate}
                        onChange={(e) => setRepDate(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono"
                      />
                    )}
                    {repType === "weekly" && (
                      <input
                        type="week"
                        value={repWeek}
                        onChange={(e) => setRepWeek(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono"
                      />
                    )}
                    {repType === "monthly" && (
                      <input
                        type="month"
                        value={repMonth}
                        onChange={(e) => setRepMonth(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono"
                      />
                    )}
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleGenerateReportQuery}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-2.5 px-4 rounded-xl shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      เปิดหน้าพรีวิวพร้อมพิมพ์ A4
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl flex flex-col items-center justify-center py-10 text-center text-slate-400">
                  <Printer className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">คู่มือการใช้กระบวนการส่งออก PDF</p>
                  <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                    ระบบรายงานเช็คกิจกรรมหน้าเสาธงถูกออกแบบขนาด CSS หน้ากระดาษให้ <span className="font-bold">พอดีกับกรอบ A4 มาตรฐานพอดี</span> เมื่อเปิดหน้าพรีวิวพัสดุแล้ว สามารถใช้ปุ่ม "พิมพ์รายงาน" เพื่อสั่งพิมพ์หรือ บันทึกเป็นไฟล์ PDF ลงเครื่องคอมพิวเตอร์ของคุณได้
                  </p>
                </div>
              </div>
            )}

            {/* TAB 7: SETTINGS & GEOFENCING */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-heading font-bold text-lg text-slate-900">ตั้งค่าความปลอดภัย และ รัศมีเช็คอินของวิทยาลัย</h3>
                  <p className="text-xs text-slate-500 mt-1">กำหนดพิกัดละติจูด ลองจิจูด และรัศมี (เมตร) ในรัศมีของวิทยาลัยอาชีวศึกษาขอนแก่น</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  
                  {/* Configuration Form */}
                  <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center gap-2">
                      <h4 className="font-heading font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <MapPin className="text-cyan-500 w-5 h-5" />
                        พิกัด GPS ประจำสถาบันการศึกษา
                      </h4>
                      <button
                        onClick={handleUseCurrentLocation}
                        disabled={adminLocLoading}
                        className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {adminLocLoading ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            กำลังดึงพิกัด...
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3 h-3" />
                            ใช้พิกัดปัจจุบันของคุณ
                          </>
                        )}
                      </button>
                    </div>

                    {adminLocError && (
                      <p className="text-[11px] text-rose-500 font-semibold bg-rose-50 border border-rose-100 px-3 py-2 rounded-xl">
                        ⚠️ {adminLocError}
                      </p>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ละติจูด (Latitude)</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={latInput}
                          onChange={(e) => setLatInput(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ลองจิจูด (Longitude)</label>
                        <input
                          type="number"
                          step="0.000001"
                          value={lngInput}
                          onChange={(e) => setLngInput(parseFloat(e.target.value) || 0)}
                          className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">รัศมีการอนุญาตเช็คชื่อตนเอง (เมตร)</label>
                        <input
                          type="number"
                          value={radInput}
                          onChange={(e) => setRadInput(parseInt(e.target.value) || 0)}
                          className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">รหัสผ่านแอดมินสำรองเข้าแผงนี้</label>
                        <input
                          type="text"
                          value={passInput}
                          onChange={(e) => setPassInput(e.target.value)}
                          className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white font-mono"
                        />
                      </div>

                      <button
                        onClick={handleSaveSettings}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-3 rounded-xl cursor-pointer"
                      >
                        บันทึกพิกัดระบบใหม่
                      </button>
                    </div>
                  </div>

                  {/* Geofence Map Card */}
                  <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
                    <div>
                      <h4 className="font-heading font-bold text-slate-800 text-sm">แผนที่และขอบเขตพิกัดสำหรับการเช็คอิน</h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        นักเรียนที่จะเข้าเช็คชื่อได้จะต้องอยู่ในวงกลมรัศมีสีน้ำเงินรอบพิกัดที่กำหนดไว้
                      </p>
                    </div>

                    {hasValidMapsKey ? (
                      <div className="h-[280px] bg-slate-200 border border-slate-300 rounded-2xl relative overflow-hidden">
                        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                          <Map
                            center={{ lat: latInput, lng: lngInput }}
                            defaultZoom={17}
                            mapId="DEMO_MAP_ID"
                            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                            style={{ width: '100%', height: '100%' }}
                            onClick={(e) => {
                              if (e.detail.latLng) {
                                setLatInput(e.detail.latLng.lat);
                                setLngInput(e.detail.latLng.lng);
                              }
                            }}
                          >
                            <AdvancedMarker
                              position={{ lat: latInput, lng: lngInput }}
                              draggable={true}
                              onDragEnd={(e) => {
                                if (e.latLng) {
                                  setLatInput(e.latLng.lat());
                                  setLngInput(e.latLng.lng());
                                }
                              }}
                            >
                              <Pin background="#ef4444" glyphColor="#fff" />
                            </AdvancedMarker>
                            <MapCircle center={{ lat: latInput, lng: lngInput }} radius={radInput} />
                          </Map>
                        </APIProvider>
                        <div className="absolute bottom-2 left-2 right-2 bg-slate-900/95 text-white text-[9.5px] px-2.5 py-1.5 rounded-xl backdrop-blur font-semibold text-center pointer-events-none">
                          💡 คลิกที่ใดก็ได้บนแผนที่ หรือ ลากหมุดสีแดง เพื่อเปลี่ยนตำแหน่งสถาบัน
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="h-[200px] bg-slate-200 border border-slate-300 rounded-2xl relative overflow-hidden flex items-center justify-center">
                          {/* Simple mock vector grid styled map */}
                          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1.5px)] [background-size:12px_12px] opacity-70"></div>
                          
                          {/* Geofence Circle Overlay */}
                          <div className="w-32 h-32 rounded-full bg-cyan-400/20 border-2 border-dashed border-cyan-500 flex items-center justify-center animate-pulse z-0">
                            <span className="text-[10px] text-cyan-700 font-bold font-mono">ขอบเขต {radInput} ม.</span>
                          </div>

                          <div className="absolute flex flex-col items-center gap-1 z-10">
                            <MapPin className="w-8 h-8 text-rose-500 filter drop-shadow animate-bounce" />
                            <span className="bg-slate-900 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow">วิทยาลัยอาชีวศึกษาขอนแก่น</span>
                          </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                            <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
                            ต้องการดูพรีวิวแผนที่จริงแบบเรียลไทม์?
                          </p>
                          <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                            <strong>วิธีแสดงแผนที่:</strong><br/>
                            - <strong>บน AI Studio:</strong> เปิด Settings (ขวาบน) &rarr; Secrets เพิ่มคีย์ <code>GOOGLE_MAPS_PLATFORM_KEY</code><br/>
                            - <strong>บน Vercel/ผู้ให้บริการอื่นๆ:</strong> ไปที่ Settings &rarr; Environment Variables แล้วเพิ่ม <code>VITE_GOOGLE_MAPS_PLATFORM_KEY</code> พร้อมระบุ API Key ของคุณ
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>

      {/* A4 Printable Modal Overlay */}
      {showA4Modal && (
        <A4PrintReport
          title={reportTitle}
          subtitle={reportSubtitle}
          classroomName={repClassroom === "all" ? "ทุกห้องเรียน" : classrooms.find(c => c.id === repClassroom)?.name}
          records={printableRecords}
          students={students}
          classrooms={classrooms}
          onClose={() => setShowA4Modal(false)}
        />
      )}
    </div>
  );
}
