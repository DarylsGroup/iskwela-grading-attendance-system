export type UserRole = 'admin' | 'teacher' | 'parent'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type GradeLevel = 1 | 2 | 3 | 4 | 5 | 6
export type Quarter = 1 | 2 | 3 | 4
export type Gender = 'male' | 'female'

export interface User {
  id: string
  email: string
  role: UserRole
  full_name: string
  profile_picture?: string | null
  created_at: string
  updated_at: string
}

// Updated to match utility file expectations (using 'Pupil' instead of 'Student')
export interface Pupil {
  id: string
  pupil_id: string // Changed from student_id to pupil_id
  first_name: string
  last_name: string
  middle_name?: string | null
  grade_level: GradeLevel // Updated type
  section: string
  gender: Gender
  date_of_birth: string
  address?: string | null
  contact_number?: string | null
  emergency_contact?: string | null
  is_4ps_beneficiary: boolean
  parent_id?: string | null
  archived: boolean
  created_at: string
  updated_at: string
  parent?: {
    id: string
    full_name: string
    email: string
  } | null
}

// Keep Student interface for backward compatibility if needed
export interface Student {
  id: string
  student_id: string
  first_name: string
  last_name: string
  middle_name?: string | null
  grade_level: number
  section: string
  parent_id?: string | null
  created_at: string
  updated_at: string
  parent?: {
    id: string
    full_name: string
    email: string
  } | null
}

export interface Subject {
  id: string
  name: string
  code: string
  grade_level: GradeLevel // Updated type
  created_at: string
}

export interface Grade {
  id: string
  pupil_id: string // Changed from student_id to pupil_id
  subject_id: string
  quarter: Quarter // Updated type
  written_work?: number | null
  performance_task?: number | null
  quarterly_exam?: number | null
  final_grade: number
  teacher_id: string
  created_at: string
  updated_at: string
}

export interface Attendance {
  id: string
  pupil_id: string // Changed from student_id to pupil_id
  date: string
  status: AttendanceStatus // Updated type
  time_in?: string | null
  time_out?: string | null
  remarks?: string | null
  teacher_id: string
  created_at: string
}

export interface Notification {
  id: string
  recipient_id: string
  sender_id?: string
  type: 'grade_update' | 'attendance_alert' | 'announcement' | 'message'
  title: string
  message: string
  read: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string
  old_values?: Record<string, any> | null
  new_values?: Record<string, any> | null
  created_at: string
  user?: {
    full_name: string
    email: string
    role: UserRole
  }
}

// Grade boundaries constants
export const GRADE_BOUNDARIES = {
  OUTSTANDING: { 
    min: 90, 
    max: 100, 
    label: 'Outstanding' 
  },
  VERY_SATISFACTORY: { 
    min: 85, 
    max: 89, 
    label: 'Very Satisfactory' 
  },
  SATISFACTORY: { 
    min: 80, 
    max: 84, 
    label: 'Satisfactory' 
  },
  FAIRLY_SATISFACTORY: { 
    min: 75, 
    max: 79, 
    label: 'Fairly Satisfactory' 
  },
  DID_NOT_MEET: { 
    min: 0, 
    max: 74, 
    label: 'Did Not Meet Expectations' 
  }
} as const

// Attendance rules constants
export const ATTENDANCE_RULES = {
  LATE_THRESHOLD_MINUTES: 15,
  GRACE_PERIOD_MINUTES: 5,
  MINIMUM_ATTENDANCE_RATE: 75
} as const

// Utility type for grade boundary keys
export type GradeBoundaryKey = keyof typeof GRADE_BOUNDARIES

// Database table names (useful for audit logs)
export const TABLE_NAMES = {
  USERS: 'users',
  PUPILS: 'pupils',
  SUBJECTS: 'subjects',
  GRADES: 'grades',
  ATTENDANCE: 'attendance',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'audit_logs'
} as const

// Common validation rules
export const VALIDATION_RULES = {
  LRN_LENGTH: 12,
  MIN_GRADE: 0,
  MAX_GRADE: 100,
  PHONE_REGEX: /^(\+63|0)?9\d{9}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
} as const

// School year helper
export interface SchoolYear {
  start_year: number
  end_year: number
  label: string
  is_current: boolean
}

// Report types
export interface ClassSummary {
  grade_level: GradeLevel
  section: string
  total_pupils: number
  present_today: number
  absent_today: number
  late_today: number
  excused_today: number
  class_average?: number
}

export interface PupilSummary {
  pupil: Pupil
  current_average: number
  attendance_rate: number
  quarter_grades: {
    q1?: number
    q2?: number
    q3?: number
    q4?: number
  }
  subjects_count: number
}

// Form validation interfaces
export interface PupilFormData {
  pupil_id: string
  first_name: string
  last_name: string
  middle_name?: string
  grade_level: GradeLevel
  section: string
  gender: Gender
  date_of_birth: string
  address?: string
  contact_number?: string
  emergency_contact?: string
  is_4ps_beneficiary: boolean
  parent_id?: string
}

export interface GradeFormData {
  pupil_id: string
  subject_id: string
  quarter: Quarter
  written_work?: number
  performance_task?: number
  quarterly_exam?: number
  final_grade: number
}

export interface AttendanceFormData {
  pupil_id: string
  date: string
  status: AttendanceStatus
  time_in?: string
  time_out?: string
  remarks?: string
}