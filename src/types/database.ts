export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'teacher' | 'parent'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type GradeLevel = 1 | 2 | 3 | 4 | 5 | 6
export type Quarter = 1 | 2 | 3 | 4
export type Gender = 'male' | 'female'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: UserRole
          full_name: string
          profile_picture: string | null
          phone_number: string | null
          address: string | null
          created_at: string
          updated_at: string
          archived: boolean
        }
        Insert: {
          id?: string
          email: string
          role: UserRole
          full_name: string
          profile_picture?: string | null
          phone_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
          archived?: boolean
        }
        Update: {
          id?: string
          email?: string
          role?: UserRole
          full_name?: string
          profile_picture?: string | null
          phone_number?: string | null
          address?: string | null
          created_at?: string
          updated_at?: string
          archived?: boolean
        }
      }
      pupils: {
        Row: {
          id: string
          pupil_id: string
          first_name: string
          last_name: string
          middle_name: string | null
          grade_level: GradeLevel
          section: string
          parent_id: string | null
          gender: Gender
          birth_date: string
          address: string | null
          profile_picture: string | null
          is_4ps_beneficiary: boolean
          enrollment_date: string
          created_at: string
          updated_at: string
          archived: boolean
        }
        Insert: {
          id?: string
          pupil_id: string
          first_name: string
          last_name: string
          middle_name?: string | null
          grade_level: GradeLevel
          section: string
          parent_id?: string | null
          gender: Gender
          birth_date: string
          address?: string | null
          profile_picture?: string | null
          is_4ps_beneficiary?: boolean
          enrollment_date?: string
          created_at?: string
          updated_at?: string
          archived?: boolean
        }
        Update: {
          id?: string
          pupil_id?: string
          first_name?: string
          last_name?: string
          middle_name?: string | null
          grade_level?: GradeLevel
          section?: string
          parent_id?: string | null
          gender?: Gender
          birth_date?: string
          address?: string | null
          profile_picture?: string | null
          is_4ps_beneficiary?: boolean
          enrollment_date?: string
          created_at?: string
          updated_at?: string
          archived?: boolean
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          code: string
          grade_level: GradeLevel
          description: string | null
          start_time: string | null
          end_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          grade_level: GradeLevel
          description?: string | null
          start_time?: string | null
          end_time?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          grade_level?: GradeLevel
          description?: string | null
          start_time?: string | null
          end_time?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      grades: {
        Row: {
          id: string
          pupil_id: string
          subject_id: string
          quarter: Quarter
          final_grade: number
          teacher_id: string
          remarks: string | null
          is_finalized: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pupil_id: string
          subject_id: string
          quarter: Quarter
          final_grade: number
          teacher_id: string
          remarks?: string | null
          is_finalized?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pupil_id?: string
          subject_id?: string
          quarter?: Quarter
          final_grade?: number
          teacher_id?: string
          remarks?: string | null
          is_finalized?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          pupil_id: string
          subject_id: string
          date: string
          time_in: string | null
          status: AttendanceStatus
          remarks: string | null
          excuse_reason: string | null
          teacher_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pupil_id: string
          subject_id: string
          date: string
          time_in?: string | null
          status: AttendanceStatus
          remarks?: string | null
          excuse_reason?: string | null
          teacher_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pupil_id?: string
          subject_id?: string
          date?: string
          time_in?: string | null
          status?: AttendanceStatus
          remarks?: string | null
          excuse_reason?: string | null
          teacher_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          sender_id: string | null
          type: 'grade_update' | 'attendance_alert' | 'announcement' | 'message' | 'registration_approved' | 'registration_rejected'
          title: string
          message: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          sender_id?: string | null
          type: 'grade_update' | 'attendance_alert' | 'announcement' | 'message' | 'registration_approved' | 'registration_rejected'
          title: string
          message: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          sender_id?: string | null
          type?: 'grade_update' | 'attendance_alert' | 'announcement' | 'message' | 'registration_approved' | 'registration_rejected'
          title?: string
          message?: string
          read?: boolean
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string
          old_values: Json | null
          new_values: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action: string
          entity_type: string
          entity_id: string
          old_values?: Json | null
          new_values?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action?: string
          entity_type?: string
          entity_id?: string
          old_values?: Json | null
          new_values?: Json | null
          created_at?: string
        }
      }
      user_registrations: {
        Row: {
          id: string
          full_name: string
          email: string
          role: UserRole
          phone_number: string | null
          address: string | null
          profile_picture: string | null
          valid_id_document: string | null
          reason_for_application: string | null
          status: 'pending' | 'under_review' | 'approved' | 'rejected'
          reviewed_at: string | null
          approved_at: string | null
          rejected_at: string | null
          approved_by: string | null
          rejected_by: string | null
          rejection_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email: string
          role: UserRole
          phone_number?: string | null
          address?: string | null
          profile_picture?: string | null
          valid_id_document?: string | null
          reason_for_application?: string | null
          status?: 'pending' | 'under_review' | 'approved' | 'rejected'
          reviewed_at?: string | null
          approved_at?: string | null
          rejected_at?: string | null
          approved_by?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          role?: UserRole
          phone_number?: string | null
          address?: string | null
          profile_picture?: string | null
          valid_id_document?: string | null
          reason_for_application?: string | null
          status?: 'pending' | 'under_review' | 'approved' | 'rejected'
          reviewed_at?: string | null
          approved_at?: string | null
          rejected_at?: string | null
          approved_by?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      teacher_assignments: {
        Row: {
          id: string
          teacher_id: string
          grade_level: GradeLevel
          section: string
          school_year: string
          is_class_adviser: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          grade_level: GradeLevel
          section: string
          school_year: string
          is_class_adviser?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          grade_level?: GradeLevel
          section?: string
          school_year?: string
          is_class_adviser?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      teacher_subjects: {
        Row: {
          id: string
          teacher_id: string
          subject_id: string
          grade_level: GradeLevel
          section: string
          school_year: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          subject_id: string
          grade_level: GradeLevel
          section: string
          school_year: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          subject_id?: string
          grade_level?: GradeLevel
          section?: string
          school_year?: string
          created_at?: string
          updated_at?: string
        }
      }
      system_config: {
        Row: {
          id: string
          key: string
          value: string
          description: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          description?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          description?: string | null
          updated_at?: string
          updated_by?: string
        }
      }
      school_info: {
        Row: {
          id: string
          name: string
          address: string
          contact_number: string | null
          email: string | null
          logo_url: string | null
          principal_name: string | null
          school_id: string
          division: string
          district: string
          region: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address: string
          contact_number?: string | null
          email?: string | null
          logo_url?: string | null
          principal_name?: string | null
          school_id: string
          division: string
          district: string
          region: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string
          contact_number?: string | null
          email?: string | null
          logo_url?: string | null
          principal_name?: string | null
          school_id?: string
          division?: string
          district?: string
          region?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      attendance_status: AttendanceStatus
      gender: Gender
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}