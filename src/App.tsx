import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Classroom, Student, Setting } from "./types";
import { 
  initializeFirebaseConnection, 
  getSettings, 
  getClassrooms, 
  getStudents 
} from "./lib/firebase";
import StudentDashboard from "./components/StudentDashboard";
import AdminDashboard from "./components/AdminDashboard";
import { 
  Shield, 
  Sparkles, 
  User, 
  KeyRound, 
  ArrowRight, 
  RefreshCw, 
  Layers, 
  Lock,
  ChevronDown,
  Info
} from "lucide-react";

export default function App() {
  const [dbLoading, setDbLoading] = useState(true);
  const [settings, setSettings] = useState<Setting | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Login flow states
  const [loginMode, setLoginMode] = useState<"student" | "admin">("student");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [adminUsernameInput, setAdminUsernameInput] = useState("");
  const [adminPinInput, setAdminPinInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Authenticated state
  const [currentUser, setCurrentUser] = useState<Student | "admin" | null>(null);
  
  // Demo logs drawer/dropdown helper
  const [showDemoLogins, setShowDemoLogins] = useState(false);

  // Initialize and fetch collections
  const loadDatabase = async () => {
    try {
      setDbLoading(true);
      setLoginError(null);
      
      // Connect and seed
      await initializeFirebaseConnection();
      
      const [fetchedSettings, fetchedClassrooms, fetchedStudents] = await Promise.all([
        getSettings(),
        getClassrooms(),
        getStudents()
      ]);
      
      setSettings(fetchedSettings);
      setClassrooms(fetchedClassrooms);
      setStudents(fetchedStudents);
    } catch (err) {
      console.error("Initialization error:", err);
      setLoginError("ไม่สามารถเชื่อมต่อฐานข้อมูลระบบได้ในขณะนี้ กรุณาลองอีกครั้ง");
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  // Handle student login submit
  const handleStudentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const id = studentIdInput.trim();
    if (!id) return;

    const matchedStudent = students.find(s => s.id === id);
    if (matchedStudent) {
      setCurrentUser(matchedStudent);
    } else {
      setLoginError("ไม่พบรหัสนักเรียนนี้ในฐานข้อมูลสาขาวิชาดิจิทัลกราฟิก");
    }
  };

  // Handle admin login submit
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const username = adminUsernameInput.trim();
    const pin = adminPinInput.trim();
    if (!username || !pin) {
      setLoginError("กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน");
      return;
    }

    if (username === "adminkvc" && (pin === "admin!@#pass" || (settings && pin === settings.adminPassword))) {
      setCurrentUser("admin");
    } else {
      setLoginError("ชื่อผู้ใช้หรือรหัสผ่านแอดมินสำหรับกิจกรรมเสาธงไม่ถูกต้อง");
    }
  };

  // Quick Demo Login trigger
  const handleQuickLogin = (userType: "student" | "admin", idOrPin: string) => {
    setLoginError(null);
    if (userType === "student") {
      const matched = students.find(s => s.id === idOrPin);
      if (matched) {
        setCurrentUser(matched);
      }
    } else {
      setAdminUsernameInput("adminkvc");
      setAdminPinInput("admin!@#pass");
      setCurrentUser("admin");
    }
    setShowDemoLogins(false);
  };

  // Trigger reloading settings after updates in AdminDashboard
  const handleSettingsUpdated = (nextSettings: Setting) => {
    setSettings(nextSettings);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col justify-between select-none relative overflow-x-hidden">
      
      {/* Background Graphic Blobs */}
      <div className="absolute top-0 inset-x-0 h-[450px] bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none z-0"></div>
      <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-violet-500/5 blur-[100px] rounded-full pointer-events-none z-0"></div>

      {/* Main Container Stage */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-6 z-10 w-full">
        
        {dbLoading ? (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium font-heading">กำลังบูทระบบ DG-kvcdata และอัปเดตช่องสัญญาณ...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {!currentUser ? (
              // Login Panel Stage
              <motion.div
                key="login-stage"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="w-full max-w-md relative"
              >
                {/* Branding Heading */}
                <div className="text-center mb-8 space-y-3 flex flex-col items-center">
                  <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center p-2 mb-2 shadow-sm border border-indigo-100/50">
                    <img 
                      src="https://i.postimg.cc/KvtbhDHb/Logo-DG-color-01.png" 
                      alt="Digital Graphics Logo" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        // Fallback icon if logo.png is not found
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
                        }
                      }}
                    />
                  </div>
                  <div className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl px-4 py-1.5 text-[11px] font-bold tracking-wider uppercase shadow-md mb-2 font-mono">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    Digital Graphics
                  </div>
                  <h1 className="font-heading font-extrabold text-2xl text-slate-900 leading-tight">
                    สาขาวิชาดิจิทัลกราฟิก
                  </h1>
                  <p className="text-xs text-slate-500 font-medium font-sans">
                    วิทยาลัยอาชีวศึกษาขอนแก่น
                  </p>
                </div>

                {/* Login Form Card */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  
                  {/* Student/Admin Selector Toggles */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 mb-6">
                    <button
                      id="login-mode-student-btn"
                      onClick={() => { setLoginMode("student"); setLoginError(null); }}
                      className={`flex-1 text-center font-heading text-xs font-semibold py-2.5 rounded-xl transition-all cursor-pointer ${
                        loginMode === "student" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <User className="w-3.5 h-3.5 inline mr-1.5" />
                      เช็คชื่อนักเรียน
                    </button>
                    <button
                      id="login-mode-admin-btn"
                      onClick={() => { setLoginMode("admin"); setLoginError(null); }}
                      className={`flex-1 text-center font-heading text-xs font-semibold py-2.5 rounded-xl transition-all cursor-pointer ${
                        loginMode === "admin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 inline mr-1.5" />
                      ผู้ควบคุม (แอดมิน)
                    </button>
                  </div>

                  {/* Errors block */}
                  {loginError && (
                    <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold flex items-start gap-1.5 leading-relaxed animate-pulse">
                      <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  {/* Student Form */}
                  {loginMode === "student" ? (
                    <form onSubmit={handleStudentLogin} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">รหัสประจำตัวนักเรียน</label>
                        <div className="relative">
                          <User className="absolute left-4 top-3.5 text-slate-400 w-4.5 h-4.5" />
                          <input
                            type="text"
                            maxLength={11}
                            placeholder="กรอกรหัส 11 หลัก เช่น 66302040001"
                            value={studentIdInput}
                            onChange={(e) => setStudentIdInput(e.target.value.replace(/\D/g, ""))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-mono font-semibold focus:bg-white focus:border-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <button
                        id="student-login-submit"
                        type="submit"
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-heading text-xs font-semibold py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                      >
                        เข้าสู่ระบบเช็คชื่อรายบุคคล
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    // Admin Form
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">ชื่อผู้ใช้งานแอดมิน (Username)</label>
                        <div className="relative">
                          <User className="absolute left-4 top-3.5 text-slate-400 w-4.5 h-4.5" />
                          <input
                            type="text"
                            placeholder="กรอกชื่อผู้ใช้งาน"
                            value={adminUsernameInput}
                            onChange={(e) => setAdminUsernameInput(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-sans font-semibold focus:bg-white focus:border-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">รหัสผ่านสำหรับแอดมิน (Password)</label>
                        <div className="relative">
                          <KeyRound className="absolute left-4 top-3.5 text-slate-400 w-4.5 h-4.5" />
                          <input
                            type="password"
                            placeholder="กรอกรหัสผ่าน"
                            value={adminPinInput}
                            onChange={(e) => setAdminPinInput(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-mono font-semibold focus:bg-white focus:border-indigo-500 outline-none transition-all"
                          />
                        </div>
                      </div>

                      <button
                        id="admin-login-submit"
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading text-xs font-semibold py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                      >
                        เข้าสู่แผงควบคุมระบบกิจกรรม
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  )}

                </div>
              </motion.div>
            ) : currentUser === "admin" ? (
              // Admin Dashboard View
              <motion.div
                key="admin-stage"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35 }}
                className="w-full"
              >
                <AdminDashboard
                  settings={settings!}
                  onSettingsUpdate={handleSettingsUpdated}
                  onLogout={() => { setCurrentUser(null); setAdminPinInput(""); }}
                />
              </motion.div>
            ) : (
              // Student Dashboard View
              <motion.div
                key="student-stage"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35 }}
                className="w-full"
              >
                <StudentDashboard
                  student={currentUser as Student}
                  classrooms={classrooms}
                  settings={settings!}
                  onLogout={() => { setCurrentUser(null); setStudentIdInput(""); }}
                  onStudentUpdate={(updatedStudent: Student) => setCurrentUser(updatedStudent)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        )}

      </main>

      {/* Humble Footer info */}
      <footer className="py-6 border-t border-slate-100/60 text-center text-[11px] text-slate-400 font-mono no-print">
        <p>© 2026 Digital Graphics, Khon Kaen Vocational College • DG-kvcdata system</p>
      </footer>
    </div>
  );
}
