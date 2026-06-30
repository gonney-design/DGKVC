export interface Classroom {
  id: string;
  name: string;
}

export interface Student {
  id: string; // e.g. 66302040001
  name: string;
  classroomId: string;
  barcode: string;
  faceImageUrl?: string;
  faceRegistered: boolean;
}

export interface AttendanceDay {
  date: string; // YYYY-MM-DD
  status: 'active' | 'cancelled' | 'event';
  notes?: string;
}

export interface AttendanceRecord {
  id: string; // studentId_date
  studentId: string;
  classroomId: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO String
  status: 'present' | 'late' | 'absent';
  method: 'manual' | 'scan' | 'self';
  latitude?: number;
  longitude?: number;
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  totalQty: number;
  availableQty: number;
}

export interface BorrowRecord {
  id: string;
  assetId: string;
  studentId: string;
  studentName: string;
  classroomId: string;
  borrowDate: string; // ISO string
  returnDate?: string; // ISO string if returned
  status: 'borrowed' | 'returned';
  qty: number;
}

export interface Setting {
  collegeLat: number;
  collegeLng: number;
  checkInRadius: number; // meters
  adminPassword?: string;
}
