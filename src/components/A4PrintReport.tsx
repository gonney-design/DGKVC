import { Classroom, Student, AttendanceRecord, AttendanceDay } from "../types";
import { Printer, X, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useReactToPrint } from "react-to-print";
import { useRef } from "react";

interface A4PrintReportProps {
  title: string;
  subtitle: string;
  classroomName?: string;
  classroomId?: string;
  records: AttendanceRecord[];
  students: Student[];
  classrooms: Classroom[];
  attendanceDays: AttendanceDay[];
  repStartDate: string;
  repEndDate: string;
  onClose: () => void;
}

export default function A4PrintReport({
  title,
  subtitle,
  classroomName = "ทั้งหมด",
  classroomId = "all",
  records,
  students,
  classrooms,
  attendanceDays,
  repStartDate,
  repEndDate,
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

  let uniqueDates: string[] = [];
  if (attendanceDays && attendanceDays.length > 0) {
    uniqueDates = attendanceDays
      .filter(d => d.date >= repStartDate && d.date <= repEndDate && d.status !== 'cancelled')
      .map(d => d.date)
      .sort();
  }
  // Fallback if no attendanceDays matches
  if (uniqueDates.length === 0) {
    uniqueDates = Array.from(new Set(records.map(r => r.date))).sort();
  }

  // Filter students to show in the report
  let displayStudents = students;
  if (classroomId !== "all") {
    displayStudents = displayStudents.filter(s => s.classroomId === classroomId);
  }

  // Calculate summary per student
  const studentStats = displayStudents.map(student => {
    const studentRecords = records.filter(r => r.studentId === student.id && uniqueDates.includes(r.date));
    const sPresent = studentRecords.filter(r => r.status === "present").length;
    const sLate = studentRecords.filter(r => r.status === "late").length;
    const sAbsent = studentRecords.filter(r => r.status === "absent").length;
    return {
      student,
      present: sPresent,
      late: sLate,
      absent: sAbsent,
      total: sPresent + sLate + sAbsent
    };
  });

  const contentRef = useRef<HTMLDivElement>(null);
  
  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: `Attendance_Report_${classroomName}`,
    onAfterPrint: () => console.log('Printed successfully'),
  });

  const handleExportExcel = () => {
    const headers = ["เลขที่", "รหัสนักเรียน", "ชื่อ - นามสกุล", ...uniqueDates, "มา", "สาย", "ขาด", "รวม"];
    const rows = studentStats.map((stat, idx) => {
      const rowData: any[] = [
        idx + 1,
        stat.student.id,
        stat.student.name,
      ];
      
      uniqueDates.forEach(date => {
        const rec = records.find(r => r.studentId === stat.student.id && r.date === date);
        let mark = "";
        if (rec) {
          if (rec.status === "present") mark = "/";
          else if (rec.status === "late") mark = "ส";
          else if (rec.status === "absent") mark = "ข";
        }
        rowData.push(mark);
      });
      
      rowData.push(stat.present, stat.late, stat.absent, stat.total);
      return rowData;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "AttendanceReport");
    XLSX.writeFile(workbook, `Attendance_Report_${classroomName}.xlsx`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 font-sans overflow-y-auto print:p-0 print:bg-white print:block">
      
      {/* Controls Container (Hidden on Print) */}
      <div className="fixed top-4 right-4 flex gap-2 no-print z-[60] bg-white/10 p-2 rounded-2xl backdrop-blur-md border border-white/20">
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-heading text-sm px-4 py-2.5 rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          ส่งออก Excel
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-heading text-sm px-4 py-2.5 rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          ส่งออก PDF (พิมพ์)
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-heading text-sm px-4 py-2.5 rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
          ปิด
        </button>
      </div>

      {/* The Printable Page (Fits exactly on A4 Landscape) */}
      <div ref={contentRef} id="print-content" className="bg-white text-slate-900 rounded-2xl shadow-2xl p-4 md:p-8 max-w-full md:max-w-[297mm] w-full min-h-[210mm] mt-20 mb-8 overflow-x-auto print:shadow-none print:m-0 print:p-0 font-sans print:rounded-none print-landscape">
        
        {/* Report Header */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-300">
          
          {/* Branch Logo */}
          <div className="w-20 h-20 rounded-full mb-3 shadow-sm border-2 border-slate-100 bg-gradient-to-br from-sky-600 to-indigo-600 flex items-center justify-center text-white print:border-slate-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <span className="font-heading font-bold text-3xl">DG</span>
          </div>
          
          <h1 className="font-heading font-bold text-lg md:text-xl text-slate-900 leading-tight max-w-[90%] mx-auto">
            รายงานการเข้าแถวสาขาวิชาดิจิทัลกราฟิก ชั้น {classroomName} {subtitle.includes('ถึง') ? `ระหว่างวันที่ ${subtitle.replace('ตั้งแต่วันที่ ', '')}` : subtitle}
          </h1>
          <p className="text-xs text-slate-500 mt-2 font-mono">DG-KVC Data & Attendance Management System</p>
          
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 bg-slate-100 px-4 py-2 rounded-xl text-[10px] md:text-xs font-semibold text-slate-700">
            <span>ประเภท: {title}</span>
            <span>ข้อมูลสรุป: {subtitle}</span>
          </div>
        </div>

        {/* Dynamic Data Table */}
        <div className="overflow-x-auto print:overflow-hidden border border-slate-300 rounded-xl print:border-none print:rounded-none w-full mt-6">
          <table className="w-full text-left text-xs border-collapse print:text-[8px]" style={{ tableLayout: 'auto' }}>
            <thead className="print:table-header-group">
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-heading font-bold text-[11px] print:text-[8px]">
                <th className="py-1.5 px-1 border-r border-slate-300 text-center w-8 print:w-4">เลขที่</th>
                <th className="py-1.5 px-1 border-r border-slate-300 w-16 print:w-10">รหัส</th>
                <th className="py-1.5 px-1 border-r border-slate-300 min-w-[120px] print:min-w-[60px] max-w-[150px] truncate">ชื่อ - นามสกุล</th>
                {uniqueDates.map(d => (
                  <th key={d} className="py-1 px-0 border-r border-slate-300 text-center align-bottom border-b-0 print:p-0">
                    <div className="whitespace-nowrap overflow-visible text-[7px] print:text-[6px] mx-auto pb-0.5 transform -rotate-90 origin-bottom-left" style={{ width: '6px', height: '24px' }}>
                      {d.split("-").slice(1).join("/")}
                    </div>
                  </th>
                ))}
                <th className="py-1.5 px-0.5 border-r border-slate-300 text-center w-6 print:w-4">มา</th>
                <th className="py-1.5 px-0.5 border-r border-slate-300 text-center w-6 print:w-4">สาย</th>
                <th className="py-1.5 px-0.5 border-r border-slate-300 text-center w-6 print:w-4">ขาด</th>
                <th className="py-1.5 px-0.5 text-center w-6 print:w-4">รวม</th>
              </tr>
            </thead>
            <tbody>
              {studentStats.length === 0 ? (
                <tr>
                  <td colSpan={8 + uniqueDates.length} className="py-8 text-center text-slate-400 font-medium">
                    ไม่พบข้อมูลนักเรียน
                  </td>
                </tr>
              ) : (
                studentStats.map((stat, idx) => {
                  return (
                    <tr key={stat.student.id} className="border-b border-slate-200 hover:bg-slate-50/50">
                      <td className="py-1 px-1 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                      <td className="py-1 px-1 border-r border-slate-200 font-mono text-[9px] print:text-[8px]">{stat.student.id}</td>
                      <td className="py-1 px-1 border-r border-slate-200 font-semibold text-[10px] print:text-[8px] truncate max-w-[120px] print:max-w-[60px]">{stat.student.name}</td>
                      {uniqueDates.map(date => {
                        const rec = records.find(r => r.studentId === stat.student.id && r.date === date);
                        let mark = "";
                        let color = "text-slate-200 print:text-slate-300";
                        if (rec) {
                          if (rec.status === "present") { mark = "/"; color = "text-emerald-700 print:text-black"; }
                          else if (rec.status === "late") { mark = "ส"; color = "text-amber-700 print:text-black"; }
                          else if (rec.status === "absent") { mark = "ข"; color = "text-rose-700 print:text-black"; }
                        }
                        return (
                          <td key={date} className={`py-1 px-0 border-r border-slate-200 text-center font-bold text-[8px] print:text-[7px] ${color}`}>
                            {mark}
                          </td>
                        );
                      })}
                      <td className="py-1 px-0.5 border-r border-slate-200 text-center text-emerald-700 print:text-black font-bold">{stat.present}</td>
                      <td className="py-1 px-0.5 border-r border-slate-200 text-center text-amber-700 print:text-black font-bold">{stat.late}</td>
                      <td className="py-1 px-0.5 border-r border-slate-200 text-center text-rose-700 print:text-black font-bold">{stat.absent}</td>
                      <td className="py-1 px-0.5 text-center text-slate-800 print:text-black font-bold">{stat.total}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Verification & Signatures Panel */}
        <div className="mt-12 flex justify-end text-center text-xs">
          <div>
            <p className="text-slate-500 font-medium text-sm">ผู้รายงาน / ครูที่ปรึกษา</p>
            <div className="h-16 w-72 mx-auto mt-4 flex items-end justify-center">
              <p className="text-slate-700 font-semibold text-sm">(......................................................................................)</p>
            </div>
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
