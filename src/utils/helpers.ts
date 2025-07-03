import { supabase } from '../lib/supabase'
import type { 
  UserRole, 
  AttendanceStatus, 
  GradeLevel, 
  Quarter, 
  Gender,
  Pupil,
  Grade,
  Attendance,
  AuditLog
} from '../types'
import { GRADE_BOUNDARIES, ATTENDANCE_RULES } from '../types'

// Audit log utilities
export const logAuditEvent = async (
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: Record<string, any> | null,
  newValues?: Record<string, any>
) => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      created_at: new Date().toISOString(),
    })

    if (error) throw error
  } catch (error) {
    console.error('Error logging audit event:', error)
  }
}

// Grade calculation utilities
export const calculateFinalGrade = (finalGrade: number): number => {
  // With the new system, only final grade is entered
  // This function validates and rounds the grade
  return Math.round(finalGrade * 100) / 100
}

export const getLetterGrade = (score: number): string => {
  if (score >= GRADE_BOUNDARIES.OUTSTANDING.min) return 'A'
  if (score >= GRADE_BOUNDARIES.VERY_SATISFACTORY.min) return 'B'
  if (score >= GRADE_BOUNDARIES.SATISFACTORY.min) return 'C'
  if (score >= GRADE_BOUNDARIES.FAIRLY_SATISFACTORY.min) return 'D'
  return 'F'
}

export const getGradeDescription = (score: number): string => {
  if (score >= GRADE_BOUNDARIES.OUTSTANDING.min) return GRADE_BOUNDARIES.OUTSTANDING.label
  if (score >= GRADE_BOUNDARIES.VERY_SATISFACTORY.min) return GRADE_BOUNDARIES.VERY_SATISFACTORY.label
  if (score >= GRADE_BOUNDARIES.SATISFACTORY.min) return GRADE_BOUNDARIES.SATISFACTORY.label
  if (score >= GRADE_BOUNDARIES.FAIRLY_SATISFACTORY.min) return GRADE_BOUNDARIES.FAIRLY_SATISFACTORY.label
  return GRADE_BOUNDARIES.DID_NOT_MEET.label
}

export const getGradeColor = (score: number): string => {
  if (score >= GRADE_BOUNDARIES.OUTSTANDING.min) return 'text-green-600'
  if (score >= GRADE_BOUNDARIES.VERY_SATISFACTORY.min) return 'text-blue-600'
  if (score >= GRADE_BOUNDARIES.SATISFACTORY.min) return 'text-yellow-600'
  if (score >= GRADE_BOUNDARIES.FAIRLY_SATISFACTORY.min) return 'text-orange-600'
  return 'text-red-600'
}

// Calculate class average for a specific quarter and subject
export const calculateClassAverage = async (
  gradeLevel: GradeLevel,
  section: string,
  subjectId: string,
  quarter: Quarter
): Promise<number | null> => {
  try {
    const { data: grades } = await supabase
      .from('grades')
      .select(`
        final_grade,
        pupils!inner (grade_level, section)
      `)
      .eq('subject_id', subjectId)
      .eq('quarter', quarter)
      .eq('pupils.grade_level', gradeLevel)
      .eq('pupils.section', section)

    if (!grades || grades.length === 0) return null

    const average = grades.reduce((sum, grade) => sum + grade.final_grade, 0) / grades.length
    return Math.round(average * 100) / 100
  } catch (error) {
    console.error('Error calculating class average:', error)
    return null
  }
}

// Calculate pupil's quarterly average
export const calculatePupilQuarterlyAverage = async (
  pupilId: string,
  quarter: Quarter
): Promise<number | null> => {
  try {
    const { data: grades } = await supabase
      .from('grades')
      .select('final_grade')
      .eq('pupil_id', pupilId)
      .eq('quarter', quarter)

    if (!grades || grades.length === 0) return null

    const average = grades.reduce((sum, grade) => sum + grade.final_grade, 0) / grades.length
    return Math.round(average * 100) / 100
  } catch (error) {
    console.error('Error calculating pupil quarterly average:', error)
    return null
  }
}

// Attendance utilities
export const isLateAttendance = (timeIn: string, classStartTime: string): boolean => {
  if (!timeIn || !classStartTime) return false

  const timeInDate = new Date(`2000-01-01T${timeIn}`)
  const startTimeDate = new Date(`2000-01-01T${classStartTime}`)
  const lateThreshold = new Date(startTimeDate.getTime() + ATTENDANCE_RULES.LATE_THRESHOLD_MINUTES * 60000)

  return timeInDate > lateThreshold
}

export const calculateAttendanceRate = (
  present: number,
  late: number,
  absent: number,
  excused: number
): number => {
  const total = present + late + absent + excused
  if (total === 0) return 0

  const attended = present + late // Late is still considered attended
  return Math.round((attended / total) * 10000) / 100 // Round to 2 decimal places
}

export const calculatePupilAttendanceRate = async (
  pupilId: string,
  startDate: string,
  endDate: string
): Promise<{
  present: number
  absent: number
  late: number
  excused: number
  total: number
  rate: number
}> => {
  try {
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status')
      .eq('pupil_id', pupilId)
      .gte('date', startDate)
      .lte('date', endDate)

    const stats = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
      rate: 0
    }

    if (attendance) {
      stats.present = attendance.filter(a => a.status === 'present').length
      stats.absent = attendance.filter(a => a.status === 'absent').length
      stats.late = attendance.filter(a => a.status === 'late').length
      stats.excused = attendance.filter(a => a.status === 'excused').length
      stats.total = attendance.length
      stats.rate = calculateAttendanceRate(stats.present, stats.late, stats.absent, stats.excused)
    }

    return stats
  } catch (error) {
    console.error('Error calculating pupil attendance rate:', error)
    return {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
      rate: 0
    }
  }
}

// Date utilities
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export const formatDateTime = (date: string | Date): string => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

export const getCurrentSchoolYear = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // JavaScript months are 0-indexed

  if (month >= 6) { // June onwards is new school year
    return `${year}-${year + 1}`
  } else {
    return `${year - 1}-${year}`
  }
}

// File export utilities
export const exportToCSV = (data: any[], filename: string, headers?: string[]) => {
  const csvContent = convertToCSV(data, headers)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${formatDateForInput(new Date())}.csv`)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const convertToCSV = (data: any[], customHeaders?: string[]): string => {
  if (data.length === 0) return ''

  const headers = customHeaders || Object.keys(data[0])
  const csvHeaders = headers.join(',')

  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      // Handle values that contain commas, quotes, or newlines
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value !== null && value !== undefined ? value : ''
    }).join(',')
  })

  return [csvHeaders, ...csvRows].join('\n')
}

// Image upload utilities
export const uploadImage = async (
  file: File,
  bucket: string,
  folder: string,
  filename?: string
): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = filename || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return publicUrl
  } catch (error) {
    console.error('Error uploading image:', error)
    return null
  }
}

export const deleteImage = async (
  bucket: string,
  filePath: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting image:', error)
    return false
  }
}

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const isValidPhoneNumber = (phone: string): boolean => {
  // Philippine phone number format
  const phoneRegex = /^(\+63|0)?9\d{9}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export const isValidPupilId = (pupilId: string): boolean => {
  // LRN format: 12 digits
  const lrnRegex = /^\d{12}$/
  return lrnRegex.test(pupilId)
}

export const isValidGrade = (grade: number): boolean => {
  return grade >= 0 && grade <= 100
}

// Permission utilities
export const hasPermission = (userRole: UserRole, action: string): boolean => {
  const permissions: Record<UserRole, string[]> = {
    admin: ['all'],
    teacher: [
      'view_pupils', 'edit_pupils_in_class', 'edit_grades', 'edit_attendance',
      'view_reports', 'export_class_data', 'mark_attendance', 'excuse_absence'
    ],
    parent: ['view_own_children', 'view_child_grades', 'view_child_attendance', 'view_notifications'],
  }

  if (permissions[userRole]?.includes('all')) return true
  return permissions[userRole]?.includes(action) || false
}

// Notification utilities
export const sendNotification = async (
  recipientId: string,
  type: string,
  title: string,
  message: string,
  senderId?: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('notifications').insert({
      recipient_id: recipientId,
      sender_id: senderId,
      type,
      title,
      message,
      read: false,
      created_at: new Date().toISOString(),
    })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error sending notification:', error)
    return false
  }
}

export const sendAbsenceNotification = async (
  pupilId: string,
  subjectName: string,
  date: string,
  teacherId: string
): Promise<boolean> => {
  try {
    // Get pupil and parent info
    const { data: pupil } = await supabase
      .from('pupils')
      .select('first_name, last_name, parent_id')
      .eq('id', pupilId)
      .single()

    if (pupil?.parent_id) {
      return await sendNotification(
        pupil.parent_id,
        'attendance_alert',
        'Attendance Alert',
        `Your child ${pupil.first_name} ${pupil.last_name} was marked absent in ${subjectName} on ${formatDate(date)}.`,
        teacherId
      )
    }

    return false
  } catch (error) {
    console.error('Error sending absence notification:', error)
    return false
  }
}

// Promotion utilities
export const promoteStudent = async (
  pupilId: string,
  fromGrade: GradeLevel,
  toGrade: GradeLevel | 7, // 7 represents graduation
  toSection: string,
  promotedBy: string
): Promise<boolean> => {
  try {
    if (toGrade === 7) {
      // Graduate the pupil
      await supabase
        .from('pupils')
        .update({
          archived: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pupilId)
    } else {
      // Promote to next grade
      await supabase
        .from('pupils')
        .update({
          grade_level: toGrade,
          section: toSection,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pupilId)
    }

    // Log promotion
    await logAuditEvent(
      promotedBy,
      toGrade === 7 ? 'graduate_pupil' : 'promote_pupil',
      'pupils',
      pupilId,
      { grade_level: fromGrade },
      { grade_level: toGrade, section: toSection }
    )

    return true
  } catch (error) {
    console.error('Error promoting pupil:', error)
    return false
  }
}

// Grade analysis utilities
export const getGradeTrend = (grades: number[]): 'improving' | 'declining' | 'stable' => {
  if (grades.length < 2) return 'stable'

  const firstHalf = grades.slice(0, Math.floor(grades.length / 2))
  const secondHalf = grades.slice(Math.floor(grades.length / 2))

  const firstAvg = firstHalf.reduce((sum, grade) => sum + grade, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, grade) => sum + grade, 0) / secondHalf.length

  const difference = secondAvg - firstAvg

  if (difference > 2) return 'improving'
  if (difference < -2) return 'declining'
  return 'stable'
}

// Report generation utilities
export const generateSF2Data = async (
  gradeLevel: GradeLevel,
  section: string,
  startDate: string,
  endDate: string
) => {
  try {
    const { data: pupils } = await supabase
      .from('pupils')
      .select('*')
      .eq('grade_level', gradeLevel)
      .eq('section', section)
      .eq('archived', false)
      .order('last_name')

    if (!pupils) return []

    const sf2Data = []

    for (const pupil of pupils) {
      const stats = await calculatePupilAttendanceRate(pupil.id, startDate, endDate)
      
      sf2Data.push({
        pupil_id: pupil.pupil_id,
        name: `${pupil.last_name}, ${pupil.first_name} ${pupil.middle_name ? pupil.middle_name.charAt(0) + '.' : ''}`.trim(),
        ...stats
      })
    }

    return sf2Data
  } catch (error) {
    console.error('Error generating SF2 data:', error)
    return []
  }
}

export const generateSF9Data = async (
  gradeLevel: GradeLevel,
  section: string
) => {
  try {
    const { data: pupils } = await supabase
      .from('pupils')
      .select('*')
      .eq('grade_level', gradeLevel)
      .eq('section', section)
      .eq('archived', false)
      .order('last_name')

    const { data: subjects } = await supabase
      .from('subjects')
      .select('*')
      .eq('grade_level', gradeLevel)

    if (!pupils || !subjects) return []

    const sf9Data = []

    for (const pupil of pupils) {
      const subjectGrades: any = {}
      let totalGrades = 0
      let gradeCount = 0

      for (const subject of subjects) {
        const quarters = [1, 2, 3, 4]
        const quarterGrades: any = { q1: null, q2: null, q3: null, q4: null, final: null }

        for (const quarter of quarters) {
          const { data: grade } = await supabase
            .from('grades')
            .select('final_grade')
            .eq('pupil_id', pupil.id)
            .eq('subject_id', subject.id)
            .eq('quarter', quarter)
            .single()

          if (grade) {
            quarterGrades[`q${quarter}`] = grade.final_grade
          }
        }

        // Calculate final grade for subject (average of quarters)
        const validGrades = Object.values(quarterGrades).filter(g => g !== null) as number[]
        if (validGrades.length > 0) {
          const subjectFinal = validGrades.reduce((sum, grade) => sum + grade, 0) / validGrades.length
          quarterGrades.final = Math.round(subjectFinal * 100) / 100
          totalGrades += subjectFinal
          gradeCount++
        }

        subjectGrades[subject.name] = quarterGrades
      }

      sf9Data.push({
        pupil_id: pupil.pupil_id,
        name: `${pupil.last_name}, ${pupil.first_name} ${pupil.middle_name ? pupil.middle_name.charAt(0) + '.' : ''}`.trim(),
        subjects: subjectGrades,
        general_average: gradeCount > 0 ? Math.round((totalGrades / gradeCount) * 100) / 100 : null
      })
    }

    return sf9Data
  } catch (error) {
    console.error('Error generating SF9 data:', error)
    return []
  }
}

// Utility functions for class-based grade entry
export const getClassPupils = async (
  gradeLevel: GradeLevel,
  section: string
): Promise<Pupil[]> => {
  try {
    const { data, error } = await supabase
      .from('pupils')
      .select('*')
      .eq('grade_level', gradeLevel)
      .eq('section', section)
      .eq('archived', false)
      .order('last_name')

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching class pupils:', error)
    return []
  }
}

export const saveClassGrades = async (
  grades: { pupilId: string; subjectId: string; quarter: Quarter; finalGrade: number }[],
  teacherId: string
): Promise<boolean> => {
  try {
    for (const grade of grades) {
      const gradeData = {
        pupil_id: grade.pupilId,
        subject_id: grade.subjectId,
        quarter: grade.quarter,
        final_grade: grade.finalGrade,
        teacher_id: teacherId,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('grades')
        .upsert(gradeData, {
          onConflict: 'pupil_id,subject_id,quarter'
        })

      if (error) throw error

      // Log audit event - Fixed: pass null instead of "null-here"
      await logAuditEvent(
        teacherId,
        'save_class_grade',
        'grades',
        grade.pupilId,
        null,
        gradeData
      )
    }

    return true
  } catch (error) {
    console.error('Error saving class grades:', error)
    return false
  }
}

// Search and filter utilities
export const searchPupils = async (
  searchTerm: string,
  filters: {
    gradeLevel?: GradeLevel
    section?: string
    gender?: Gender
    is4Ps?: boolean
  } = {}
): Promise<Pupil[]> => {
  try {
    let query = supabase
      .from('pupils')
      .select('*')
      .eq('archived', false)

    if (searchTerm) {
      query = query.or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,pupil_id.ilike.%${searchTerm}%`)
    }

    if (filters.gradeLevel) {
      query = query.eq('grade_level', filters.gradeLevel)
    }

    if (filters.section) {
      query = query.eq('section', filters.section)
    }

    if (filters.gender) {
      query = query.eq('gender', filters.gender)
    }

    if (filters.is4Ps !== undefined) {
      query = query.eq('is_4ps_beneficiary', filters.is4Ps)
    }

    const { data, error } = await query.order('last_name')

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error searching pupils:', error)
    return []
  }
}