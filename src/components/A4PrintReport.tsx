import { Classroom, Student, AttendanceRecord } from "../types";
import { Printer, X, Download } from "lucide-react";

interface A4PrintReportProps {
  title: string;
  subtitle: string;
  classroomName?: string;
  records: AttendanceRecord[];
  students: Student[];
  classrooms: Classroom[];
  onClose: () => void;
}

export default function A4PrintReport({
  title,
  subtitle,
  classroomName = "ทั้งหมด",
  records,
  students,
  classrooms,
  onClose
}: A4PrintReportProps) {
  
  // Map students for quick lookup
  const studentMap = new Map<string, Student>();
  students.forEach(s => studentMap.set(s.id, s));

  // Map classrooms for quick lookup
  const classroomMap = new Map<string, Classroom>();
  classrooms.forEach(c => classroomMap.set(c.id, c));

  // Get current Date in Thai format
  const printDate = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  // Calculate statistics
  const total = records.length;
  const present = records.filter(r => r.status === "present").length;
  const late = records.filter(r => r.status === "late").length;
  const absent = records.filter(r => r.status === "absent").length;
  const presentRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans overflow-y-auto">
      
      {/* Controls Container (Hidden on Print) */}
      <div className="absolute top-4 right-4 flex gap-2 no-print">
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-heading text-sm px-4 py-2.5 rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          พิมพ์รายงาน (A4)
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-heading text-sm px-4 py-2.5 rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
          ปิด
        </button>
      </div>

      {/* The Printable Page (Fits exactly on A4) */}
      <div className="bg-white text-slate-900 rounded-2xl shadow-2xl p-8 max-w-[210mm] w-full min-h-[297mm] my-8 overflow-x-auto print:shadow-none print:my-0 print:p-0 font-sans print:rounded-none">
        
        {/* Report Header */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-300">
          
          {/* Mock College Seal */}
          <div className="w-16 h-16 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-full flex items-center justify-center text-white mb-3 shadow-md">
            <span className="font-heading font-bold text-xl tracking-tight">KVC</span>
          </div>
          
          <h1 className="font-heading font-bold text-lg md:text-xl text-slate-900 leading-tight">
            รายงานการเข้าแถวทำกิจกรรมหน้าเสาธง
          </h1>
          <h2 className="font-heading font-semibold text-sm md:text-base text-slate-700 mt-1">
            สาขาวิชาดิจิทัลกราฟิก วิทยาลัยอาชีวศึกษาขอนแก่น
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-mono">DG-KVC Data & Attendance Management System</p>
          
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 bg-slate-100 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700">
            <span>ประเภท: {title}</span>
            <span>ช่วงเวลา/ข้อมูล: {subtitle}</span>
            <span>ห้องเรียน: {classroomName}</span>
          </div>
        </div>

        {/* Attendance Statistics Summary Grid */}
        <div className="grid grid-cols-4 gap-4 my-6 text-center">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">เช็คชื่อทั้งหมด</p>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{total} <span className="text-xs font-normal text-slate-500">คน-ครั้ง</span></p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">มาทันเวลา</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">{present} <span className="text-xs font-normal text-emerald-500">ครั้ง</span></p>
          </div>
          <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider text-amber-600 font-bold">มาสาย</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{late} <span className="text-xs font-normal text-slate-500">ครั้ง</span></p>
          </div>
          <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl">
            <p className="text-[10px] uppercase tracking-wider text-rose-600 font-bold">ขาดแถว</p>
            <p className="text-xl font-bold text-rose-700 mt-0.5">{absent} <span className="text-xs font-normal text-slate-500">ครั้ง</span></p>
          </div>
        </div>

        {/* Dynamic Data Table */}
        <div className="overflow-x-auto border border-slate-300 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-heading font-bold text-[11px]">
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-10">ลำดับ</th>
                <th className="py-2.5 px-3 border-r border-slate-300 w-24">รหัสนักเรียน</th>
                <th className="py-2.5 px-3 border-r border-slate-300 w-44">ชื่อ - นามสกุล</th>
                <th className="py-2.5 px-3 border-r border-slate-300 w-28">ห้องเรียน</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-24">วันที่เช็ค</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-16">เวลาเช็ค</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-20">ช่องทาง</th>
                <th className="py-2.5 px-3 border-r border-slate-300 text-center w-16">สถานะ</th>
                <th className="py-2.5 px-3">พิกัด / หมายเหตุ (กรณีเช็คชื่อตนเอง)</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                    ไม่พบข้อมูลการเข้าแถวในช่วงเวลาที่เลือก
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const student = studentMap.get(r.studentId);
                  const room = student ? classroomMap.get(student.classroomId) : null;
                  const roomName = room ? room.name.split(" ")[0] : "ไม่ระบุ";
                  const checkTime = new Date(r.timestamp).toLocaleTimeString("th-TH", {
                    hour: "2-digit",
                    minute: "2-digit"
                  }) + " น.";

                  // Status badge style for printing
                  let statusText = "มาปกติ";
                  let statusColor = "text-emerald-700 font-bold";
                  if (r.status === "late") {
                    statusText = "สาย";
                    statusColor = "text-amber-700 font-bold";
                  } else if (r.status === "absent") {
                    statusText = "ขาด";
                    statusColor = "text-rose-700 font-bold";
                  }

                  // Method translate
                  let methodText = "แมนนวล";
                  if (r.method === "scan") methodText = "สแกนโค้ด";
                  else if (r.method === "self") methodText = "เช็คเอง";

                  return (
                    <tr key={r.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono">{r.studentId}</td>
                      <td className="py-2 px-3 border-r border-slate-200 font-semibold">{student?.name || "ไม่ทราบชื่อ"}</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600">{roomName}</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-600 font-mono">{r.date}</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center font-mono">{checkTime}</td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center text-slate-500">{methodText}</td>
                      <td className={`py-2 px-3 border-r border-slate-200 text-center ${statusColor}`}>{statusText}</td>
                      <td className="py-2 px-3 text-[10px] text-slate-500 font-mono">
                        {r.method === "self" && r.latitude && r.longitude ? (
                          <span className="text-cyan-700 bg-cyan-50/50 px-1.5 py-0.5 rounded border border-cyan-100">
                            GPS: {r.latitude.toFixed(6)}, {r.longitude.toFixed(6)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Verification & Signatures Panel */}
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <p className="text-slate-500 font-medium">ผู้รายงาน / ครูประจำชั้น</p>
            <div className="h-16 border-b border-slate-300 w-48 mx-auto mt-4"></div>
            <p className="mt-2 text-slate-700 font-semibold">(........................................................)</p>
            <p className="text-[10px] text-slate-400 mt-1">ตำแหน่ง ครูประจำวิชาดิจิทัลกราฟิก</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium">ผู้ตรวจสอบกิจกรรมกลาง</p>
            <div className="h-16 border-b border-slate-300 w-48 mx-auto mt-4"></div>
            <p className="mt-2 text-slate-700 font-semibold">(........................................................)</p>
            <p className="text-[10px] text-slate-400 mt-1">หัวหน้างานกิจกรรม / ตัวแทนคณะกรรมการ</p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-12 pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-mono">
          <span>ระบบพิมพ์รายงานอัตโนมัติ (พิมพ์เมื่อ: {printDate})</span>
          <span>หน้า 1 จาก 1</span>
        </div>
      </div>
    </div>
  );
}
