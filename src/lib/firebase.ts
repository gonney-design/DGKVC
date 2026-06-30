import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  getDocFromServer
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { Classroom, Student, AttendanceDay, AttendanceRecord, Asset, BorrowRecord, Setting } from "../types";

// Firebase Config from firebase-applet-config.json
const firebaseConfig = {
  projectId: "integrated-aileron-wxhgq",
  appId: "1:71612212791:web:16714a53c671f2b32fc1b2",
  apiKey: "AIzaSyDLDZH_8JbvBpxRLLhcjrmWFoc1t-tnVK8",
  authDomain: "integrated-aileron-wxhgq.firebaseapp.com",
  databaseId: "ai-studio-d592d853-a6ad-4e6f-a327-931de3df3245", // Firestore databaseId from config
  storageBucket: "integrated-aileron-wxhgq.firebasestorage.app",
  messagingSenderId: "71612212791"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
// Use the specific firestore database ID
export const db = getFirestore(app, firebaseConfig.databaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Sign in anonymously in the background to satisfy firestore.rules
export async function initializeFirebaseConnection() {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("Connected to Firebase anonymously:", userCredential.user.uid);
  } catch (error) {
    console.warn("Firebase Auth Anonymous Login failed (it might be disabled in console):", error);
  }

  try {
    // Validate connection to firestore according to SKILL.md guidelines
    await getDocFromServer(doc(db, 'settings', 'global')).catch(() => {});
    
    // Seed initial data if database is empty
    await seedInitialDataIfNeeded();
  } catch (error) {
    console.error("Failed to initialize Firestore connection/seeding:", error);
  }
}

// Default settings
export const DEFAULT_SETTINGS: Setting = {
  collegeLat: 16.425338, // Khon Kaen Vocational College
  collegeLng: 102.827471,
  checkInRadius: 150, // 150 meters
  adminPassword: "admin!@#pass"
};

// --- SETTINGS ---
export async function getSettings(): Promise<Setting> {
  const path = "settings/global";
  try {
    const docRef = doc(db, "settings", "global");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as Setting;
    } else {
      // Create default
      await setDoc(docRef, DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return DEFAULT_SETTINGS;
  }
}

export async function updateSettings(settings: Setting): Promise<void> {
  const path = "settings/global";
  try {
    const docRef = doc(db, "settings", "global");
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- CLASSROOMS ---
export async function getClassrooms(): Promise<Classroom[]> {
  const path = "classrooms";
  try {
    const colRef = collection(db, "classrooms");
    const snap = await getDocs(colRef);
    const rooms: Classroom[] = [];
    snap.forEach((d) => {
      rooms.push(d.data() as Classroom);
    });
    return rooms;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveClassroom(classroom: Classroom): Promise<void> {
  const path = `classrooms/${classroom.id}`;
  try {
    const docRef = doc(db, "classrooms", classroom.id);
    await setDoc(docRef, classroom);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteClassroom(id: string): Promise<void> {
  const path = `classrooms/${id}`;
  try {
    const docRef = doc(db, "classrooms", id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- STUDENTS ---
export async function getStudents(): Promise<Student[]> {
  const path = "students";
  try {
    const colRef = collection(db, "students");
    const snap = await getDocs(colRef);
    const students: Student[] = [];
    snap.forEach((d) => {
      students.push(d.data() as Student);
    });
    return students;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveStudent(student: Student): Promise<void> {
  const path = `students/${student.id}`;
  try {
    const docRef = doc(db, "students", student.id);
    await setDoc(docRef, student, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStudent(id: string): Promise<void> {
  const path = `students/${id}`;
  try {
    const docRef = doc(db, "students", id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- ATTENDANCE DAYS ---
export async function getAttendanceDays(): Promise<AttendanceDay[]> {
  const path = "attendanceDays";
  try {
    const colRef = collection(db, "attendanceDays");
    const snap = await getDocs(colRef);
    const days: AttendanceDay[] = [];
    snap.forEach((d) => {
      days.push(d.data() as AttendanceDay);
    });
    return days.sort((a, b) => b.date.localeCompare(a.date)); // descending
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveAttendanceDay(day: AttendanceDay): Promise<void> {
  const path = `attendanceDays/${day.date}`;
  try {
    const docRef = doc(db, "attendanceDays", day.date);
    await setDoc(docRef, day);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAttendanceDay(date: string): Promise<void> {
  const path = `attendanceDays/${date}`;
  try {
    const docRef = doc(db, "attendanceDays", date);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- ATTENDANCE RECORDS ---
export async function getAttendanceRecords(): Promise<AttendanceRecord[]> {
  const path = "attendanceRecords";
  try {
    const colRef = collection(db, "attendanceRecords");
    const snap = await getDocs(colRef);
    const records: AttendanceRecord[] = [];
    snap.forEach((d) => {
      records.push(d.data() as AttendanceRecord);
    });
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveAttendanceRecord(record: AttendanceRecord): Promise<void> {
  const path = `attendanceRecords/${record.id}`;
  try {
    const docRef = doc(db, "attendanceRecords", record.id);
    await setDoc(docRef, record);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAttendanceRecord(recordId: string): Promise<void> {
  const path = `attendanceRecords/${recordId}`;
  try {
    const docRef = doc(db, "attendanceRecords", recordId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- ASSETS ---
export async function getAssets(): Promise<Asset[]> {
  const path = "assets";
  try {
    const colRef = collection(db, "assets");
    const snap = await getDocs(colRef);
    const list: Asset[] = [];
    snap.forEach((d) => {
      list.push(d.data() as Asset);
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveAsset(asset: Asset): Promise<void> {
  const path = `assets/${asset.id}`;
  try {
    const docRef = doc(db, "assets", asset.id);
    await setDoc(docRef, asset);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAsset(id: string): Promise<void> {
  const path = `assets/${id}`;
  try {
    const docRef = doc(db, "assets", id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- BORROW RECORDS ---
export async function getBorrowRecords(): Promise<BorrowRecord[]> {
  const path = "borrowRecords";
  try {
    const colRef = collection(db, "borrowRecords");
    const snap = await getDocs(colRef);
    const list: BorrowRecord[] = [];
    snap.forEach((d) => {
      list.push(d.data() as BorrowRecord);
    });
    return list.sort((a, b) => b.borrowDate.localeCompare(a.borrowDate));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveBorrowRecord(record: BorrowRecord): Promise<void> {
  const path = `borrowRecords/${record.id}`;
  try {
    const docRef = doc(db, "borrowRecords", record.id);
    await setDoc(docRef, record);
    
    // Adjust asset availability
    const assetRef = doc(db, "assets", record.assetId);
    const assetSnap = await getDoc(assetRef);
    if (assetSnap.exists()) {
      const asset = assetSnap.data() as Asset;
      const allBorrowOfAsset = await getBorrowRecords();
      const activeBorrows = allBorrowOfAsset.filter(b => b.assetId === record.assetId && b.status === 'borrowed');
      const activeCount = activeBorrows.reduce((sum, b) => sum + b.qty, 0);
      const newAvailable = Math.max(0, asset.totalQty - activeCount);
      
      await setDoc(assetRef, { availableQty: newAvailable }, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}


// --- SEED INITIAL DATA IF EMPTY ---
async function seedInitialDataIfNeeded() {
  try {
    // Check if classrooms are empty
    const classroomsCol = collection(db, "classrooms");
    const classroomsSnap = await getDocs(classroomsCol);
    if (classroomsSnap.empty) {
      console.log("Seeding initial classrooms, students, assets and attendance...");
      
      const defaultRooms: Classroom[] = [
        { id: "DG_1_1", name: "สคด.1/1 (ดิจิทัลกราฟิก ปี 1)" },
        { id: "DG_2_1", name: "สคด.2/1 (ดิจิทัลกราฟิก ปี 2)" },
        { id: "DG_3_1", name: "สคด.3/1 (ดิจิทัลกราฟิก ปี 3)" }
      ];

      for (const r of defaultRooms) {
        await setDoc(doc(db, "classrooms", r.id), r);
      }

      const defaultStudents: Student[] = [
        { id: "66302040001", name: "ณัฐวุฒิ สมใจ", classroomId: "DG_3_1", barcode: "66302040001", faceRegistered: false },
        { id: "66302040002", name: "พิมลพรรณ ดีรักษ์", classroomId: "DG_3_1", barcode: "66302040002", faceRegistered: false },
        { id: "66302040003", name: "ศุภชัย ยอดคำ", classroomId: "DG_3_1", barcode: "66302040003", faceRegistered: false },
        { id: "67302040011", name: "ธนภัทร แสงทิพย์", classroomId: "DG_2_1", barcode: "67302040011", faceRegistered: false },
        { id: "67302040012", name: "กัญญารัตน์ สีขาว", classroomId: "DG_2_1", barcode: "67302040012", faceRegistered: false },
        { id: "68302040021", name: "จิรวัฒน์ บุญเกิด", classroomId: "DG_1_1", barcode: "68302040021", faceRegistered: false },
        { id: "68302040022", name: "สุดารัตน์ หอมนวล", classroomId: "DG_1_1", barcode: "68302040022", faceRegistered: false }
      ];

      for (const s of defaultStudents) {
        await setDoc(doc(db, "students", s.id), s);
      }

      // Pre-seed some attendance days
      const days: AttendanceDay[] = [
        { date: "2026-06-29", status: "active", notes: "เข้าแถววันจันทร์ปกติ" },
        { date: "2026-06-26", status: "active", notes: "เข้าแถววันศุกร์ปกติ" },
        { date: "2026-06-24", status: "active", notes: "เข้าแถววันพุธปกติ" },
        { date: "2026-06-22", status: "event", notes: "วันไหว้ครูประจำปี เลี่ยงการเข้าแถว" }
      ];

      for (const d of days) {
        await setDoc(doc(db, "attendanceDays", d.date), d);
      }

      // Pre-seed some attendance records
      const records: AttendanceRecord[] = [
        { id: "66302040001_2026-06-29", studentId: "66302040001", classroomId: "DG_3_1", date: "2026-06-29", timestamp: "2026-06-29T07:45:00.000Z", status: "present", method: "scan" },
        { id: "66302040002_2026-06-29", studentId: "66302040002", classroomId: "DG_3_1", date: "2026-06-29", timestamp: "2026-06-29T07:55:00.000Z", status: "present", method: "self", latitude: 16.425330, longitude: 102.827470 },
        { id: "66302040003_2026-06-29", studentId: "66302040003", classroomId: "DG_3_1", date: "2026-06-29", timestamp: "2026-06-29T08:05:00.000Z", status: "present", method: "manual" },
        { id: "66302040001_2026-06-26", studentId: "66302040001", classroomId: "DG_3_1", date: "2026-06-26", timestamp: "2026-06-26T07:38:00.000Z", status: "present", method: "scan" },
        { id: "66302040002_2026-06-26", studentId: "66302040002", classroomId: "DG_3_1", date: "2026-06-26", timestamp: "2026-06-26T07:42:00.000Z", status: "present", method: "self", latitude: 16.425335, longitude: 102.827472 },
        { id: "66302040003_2026-06-26", studentId: "66302040003", classroomId: "DG_3_1", date: "2026-06-26", timestamp: "2026-06-26T08:12:00.000Z", status: "present", method: "scan" },
        { id: "67302040011_2026-06-29", studentId: "67302040011", classroomId: "DG_2_1", date: "2026-06-29", timestamp: "2026-06-29T07:50:00.000Z", status: "present", method: "manual" },
        { id: "67302040012_2026-06-29", studentId: "67302040012", classroomId: "DG_2_1", date: "2026-06-29", timestamp: "2026-06-29T07:44:00.000Z", status: "present", method: "manual" }
      ];

      for (const r of records) {
        await setDoc(doc(db, "attendanceRecords", r.id), r);
      }

      const defaultAssets: Asset[] = [
        { id: "AST001", name: "Wacom Intuos Pro M", description: "เมาส์ปากกาสำหรับงานวาดกราฟิก ขนาด M", totalQty: 15, availableQty: 14, type: "durable" },
        { id: "AST002", name: "iPad Pro 11\" (M2)", description: "ไอแพดพร้อม Apple Pencil สำหรับออกแบบนอกสถานที่", totalQty: 8, availableQty: 8, type: "durable" },
        { id: "AST003", name: "Canon EOS R6 Mark II", description: "กล้อง Mirrorless สำหรับงานถ่ายภาพและวิดีโอสาขา", totalQty: 3, availableQty: 2, type: "durable" },
        { id: "AST004", name: "Sennheiser Wireless Mic", description: "ไมโครโฟนไร้สายสำหรับการสัมภาษณ์และทำคอนเทนต์", totalQty: 5, availableQty: 5, type: "durable" }
      ];

      for (const a of defaultAssets) {
        await setDoc(doc(db, "assets", a.id), a);
      }

      const defaultBorrows: BorrowRecord[] = [
        { id: "BRW001", assetId: "AST001", studentId: "66302040001", studentName: "ณัฐวุฒิ สมใจ", classroomId: "DG_3_1", borrowDate: "2026-06-29T09:30:00.000Z", status: "borrowed", qty: 1 },
        { id: "BRW002", assetId: "AST003", studentId: "66302040002", studentName: "พิมลพรรณ ดีรักษ์", classroomId: "DG_3_1", borrowDate: "2026-06-28T13:15:00.000Z", status: "borrowed", qty: 1 },
        { id: "BRW003", assetId: "AST001", studentId: "66302040003", studentName: "ศุภชัย ยอดคำ", classroomId: "DG_3_1", borrowDate: "2026-06-25T10:00:00.000Z", returnDate: "2026-06-25T16:30:00.000Z", status: "returned", qty: 1 }
      ];

      for (const b of defaultBorrows) {
        await setDoc(doc(db, "borrowRecords", b.id), b);
      }
    }
  } catch (error) {
    console.error("Error seeding initial data:", error);
  }
}
