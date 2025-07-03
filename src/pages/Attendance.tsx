import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Calendar, Check, X, Clock, AlertCircle, Download, Upload, User, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

interface AttendanceRecord {
  id: string
  pupil_id: string
  subject_id: string
  date: string
  time_in: string | null
  status: 'present' | 'absent' | 'late' | 'excused'
  remarks?: string
  excuse_reason?: string
  teacher_id: string
  created_at: string
  updated_at: string
  pupils: {
    pupil_id: string
    first_name: string
    last_name: string
    middle_name: string
    grade_level: number
    section: string
    profile_picture: string
    parent_id: string
  }
  subjects: {
    name: string
    code: string
  }
}

interface Subject {
  id: string
  name: string
  code: string
  grade_level: number
  start_time: string
  end_time: string
}

const Attendance: React.FC = () => {
  const { user, isRole } = useAuth()
  const [pupils, setPupils] = useState<any[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [excuseModal, setExcuseModal] = useState<{
    isOpen: boolean
    pupilId: string
    pupilName: string
    excuseReason: string
  }>({
    isOpen: false,
    pupilId: '',
    pupilName: '',
    excuseReason: ''
  })

  // Helper function to format date
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  // Helper function to get current time
  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Helper function to check if pupil is late (15 minutes after class start)
  const isLate = (timeIn: string, classStartTime: string) => {
    if (!timeIn || !classStartTime) return false
    
    const timeInDate = new Date(`2000-01-01T${timeIn}`)
    const startTimeDate = new Date(`2000-01-01T${classStartTime}`)
    const lateThreshold = new Date(startTimeDate.getTime() + 15 * 60000) // 15 minutes
    
    return timeInDate > lateThreshold
  }

  useEffect(() => {
    fetchData()
  }, [selectedDate, selectedGrade, selectedSection, selectedSubject])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const dateStr = formatDate(selectedDate)

      // Fetch pupils based on user role and filters
      let pupilsQuery = supabase.from('pupils').select('*').eq('archived', false)
      
      // If user is a parent, only show their children
      if (user && isRole('parent')) {
        pupilsQuery = pupilsQuery.eq('parent_id', user.id)
      } else {
        // For teachers and admins, apply grade/section filters if selected
        if (selectedGrade) {
          pupilsQuery = pupilsQuery.eq('grade_level', selectedGrade)
        }
        if (selectedSection) {
          pupilsQuery = pupilsQuery.eq('section', selectedSection)
        }

        // For teachers, only show their assigned classes
        if (isRole('teacher')) {
          const { data: teacherClasses } = await supabase
            .from('teacher_assignments')
            .select('grade_level, section')
            .eq('teacher_id', user?.id)

          if (teacherClasses && teacherClasses.length > 0) {
            const classFilters = teacherClasses.map(tc => 
              `and(grade_level.eq.${tc.grade_level},section.eq.${tc.section})`
            ).join(',')
            pupilsQuery = pupilsQuery.or(classFilters)
          }
        }
      }
      
      const { data: pupilsData, error: pupilsError } = await pupilsQuery.order('last_name')
      
      if (pupilsError) throw pupilsError
      setPupils(pupilsData || [])

      // Fetch subjects based on filters and teacher assignments
      let subjectsQuery = supabase.from('subjects').select('*')
      
      if (selectedGrade) {
        subjectsQuery = subjectsQuery.eq('grade_level', selectedGrade)
      }

      if (isRole('teacher')) {
        const { data: teacherSubjects } = await supabase
          .from('teacher_subjects')
          .select('subject_id')
          .eq('teacher_id', user?.id)

        if (teacherSubjects && teacherSubjects.length > 0) {
          const subjectIds = teacherSubjects.map(ts => ts.subject_id)
          subjectsQuery = subjectsQuery.in('id', subjectIds)
        }
      }

      const { data: subjectsData, error: subjectsError } = await subjectsQuery.order('name')
      if (subjectsError) throw subjectsError
      setSubjects(subjectsData || [])

      // Fetch attendance for selected date, subject, and pupils
      if (pupilsData && pupilsData.length > 0 && selectedSubject) {
        const pupilIds = pupilsData.map(pupil => pupil.id)
        
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select(`
            *,
            pupils!inner (
              pupil_id,
              first_name,
              last_name,
              middle_name,
              grade_level,
              section,
              profile_picture,
              parent_id
            ),
            subjects!inner (
              name,
              code
            )
          `)
          .eq('date', dateStr)
          .eq('subject_id', selectedSubject)
          .in('pupil_id', pupilIds)

        if (attendanceError) throw attendanceError
        setAttendance(attendanceData || [])
      } else {
        setAttendance([])
      }
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error(error.message || 'Failed to load attendance data')
    } finally {
      setIsLoading(false)
    }
  }

  const markAttendance = async (
    pupilId: string, 
    status: AttendanceRecord['status'], 
    timeIn?: string,
    remarks?: string
  ) => {
    // Only teachers and admins can mark attendance
    if (!user || isRole('parent')) {
      toast.error('You do not have permission to mark attendance')
      return
    }

    if (!selectedSubject) {
      toast.error('Please select a subject first')
      return
    }

    try {
      const currentTime = timeIn || getCurrentTime()
      const subject = subjects.find(s => s.id === selectedSubject)
      
      // Determine if pupil is late based on 15-minute rule
      let finalStatus = status
      if (status === 'present' && subject?.start_time) {
        if (isLate(currentTime, subject.start_time)) {
          finalStatus = 'late'
        }
      }

      const attendanceData = {
        pupil_id: pupilId,
        subject_id: selectedSubject,
        date: formatDate(selectedDate),
        time_in: status === 'present' || status === 'late' ? currentTime : null,
        status: finalStatus,
        remarks,
        teacher_id: user?.id,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('attendance')
        .upsert(attendanceData, {
          onConflict: 'pupil_id,subject_id,date'
        })
        .select()

      if (error) throw error

      // Log audit event
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'mark_attendance',
        entity_type: 'attendance',
        entity_id: data?.[0]?.id || '',
        new_values: attendanceData,
      })

      toast.success(`Attendance marked as ${finalStatus}`)
      fetchData()

      // Send notification for absence
      if (finalStatus === 'absent') {
        await sendAbsenceNotification(pupilId)
      }
    } catch (error: any) {
      console.error('Error marking attendance:', error)
      toast.error(error.message || 'Failed to mark attendance')
    }
  }

  const handleExcuseAbsence = async (pupilId: string, excuseReason: string) => {
    if (!excuseReason.trim()) {
      toast.error('Please provide a reason for the excuse')
      return
    }

    try {
      const attendanceData = {
        pupil_id: pupilId,
        subject_id: selectedSubject,
        date: formatDate(selectedDate),
        status: 'excused' as const,
        excuse_reason: excuseReason,
        teacher_id: user?.id,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from('attendance')
        .upsert(attendanceData, {
          onConflict: 'pupil_id,subject_id,date'
        })
        .select()

      if (error) throw error

      // Log audit event for changing from absent to excused
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'excuse_absence',
        entity_type: 'attendance',
        entity_id: data?.[0]?.id || '',
        old_values: { status: 'absent' },
        new_values: { status: 'excused', excuse_reason: excuseReason },
      })

      toast.success('Absence excused successfully')
      setExcuseModal({ isOpen: false, pupilId: '', pupilName: '', excuseReason: '' })
      fetchData()
    } catch (error: any) {
      console.error('Error excusing absence:', error)
      toast.error(error.message || 'Failed to excuse absence')
    }
  }

  const sendAbsenceNotification = async (pupilId: string) => {
    try {
      const pupil = pupils.find(p => p.id === pupilId)
      if (pupil?.parent_id) {
        const subject = subjects.find(s => s.id === selectedSubject)
        
        await supabase.from('notifications').insert({
          recipient_id: pupil.parent_id,
          type: 'attendance_alert',
          title: 'Attendance Alert',
          message: `Your child ${pupil.first_name} ${pupil.last_name} was marked absent in ${subject?.name || 'class'} today (${formatDate(selectedDate)}).`,
          sender_id: user?.id,
          created_at: new Date().toISOString(),
        })
      }
    } catch (error) {
      console.error('Error sending notification:', error)
    }
  }

  const exportAttendance = async () => {
    try {
      const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
      
      // Get pupil IDs based on user role
      let pupilIds: string[] = []
      if (user && isRole('parent')) {
        pupilIds = pupils.map(s => s.id)
      } else {
        const { data: allPupils } = await supabase
          .from('pupils')
          .select('id')
          .eq('archived', false)
        pupilIds = allPupils?.map(s => s.id) || []
      }

      if (pupilIds.length === 0) {
        toast.error('No pupils found to export')
        return
      }
      
      const { data: monthlyAttendance } = await supabase
        .from('attendance')
        .select(`
          *,
          pupils (
            pupil_id,
            first_name,
            last_name,
            middle_name,
            grade_level,
            section
          ),
          subjects (
            name,
            code
          )
        `)
        .gte('date', formatDate(start))
        .lte('date', formatDate(end))
        .in('pupil_id', pupilIds)
        .order('date')

      // Generate CSV
      const headers = 'Date,Pupil ID,Name,Grade,Section,Subject,Time In,Status,Excuse Reason,Remarks'
      const rows = monthlyAttendance?.map(record => {
        const pupilName = `${record.pupils.first_name} ${record.pupils.middle_name ? record.pupils.middle_name.charAt(0) + '. ' : ''}${record.pupils.last_name}`
        return [
          record.date,
          record.pupils.pupil_id,
          `"${pupilName}"`,
          record.pupils.grade_level,
          record.pupils.section,
          record.subjects.name,
          record.time_in || '',
          record.status,
          `"${record.excuse_reason || ''}"`,
          `"${record.remarks || ''}"`
        ].join(',')
      }) || []

      const csvContent = [headers, ...rows].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_${selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.csv`
      a.click()
    } catch (error) {
      console.error('Error exporting attendance:', error)
      toast.error('Failed to export attendance')
    }
  }

  const getStatusColor = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present': return 'text-green-600'
      case 'absent': return 'text-red-600'
      case 'late': return 'text-yellow-600'
      case 'excused': return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'present': return <Check className="w-5 h-5" />
      case 'absent': return <X className="w-5 h-5" />
      case 'late': return <Clock className="w-5 h-5" />
      case 'excused': return <AlertCircle className="w-5 h-5" />
      default: return null
    }
  }

  // Check if user has no assigned children (for parents)
  const hasNoChildren = user && isRole('parent') && pupils.length === 0

  // Get current subject info for time checking
  const currentSubject = subjects.find(s => s.id === selectedSubject)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {isRole('parent') ? 'Child Attendance' : 'Attendance Management'}
        </h1>
        <div className="flex gap-3">
          <button onClick={exportAttendance} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Show message if parent has no assigned children */}
      {hasNoChildren && (
        <div className="card">
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Children Assigned</h3>
            <p className="text-gray-600">
              You don't have any children assigned to your account. Please contact the school administrator.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      {!hasNoChildren && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
              <input
                type="date"
                value={formatDate(selectedDate)}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="input-field"
              />
            </div>
            {!isRole('parent') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
                  <select
                    value={selectedGrade || ''}
                    onChange={(e) => setSelectedGrade(e.target.value ? parseInt(e.target.value) : null)}
                    className="input-field"
                  >
                    <option value="">All Grades</option>
                    {[1, 2, 3, 4, 5, 6].map(grade => (
                      <option key={grade} value={grade}>Grade {grade}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                  <input
                    type="text"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    placeholder="Enter section"
                    className="input-field"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="input-field"
              >
                <option value="">Select Subject</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>
            {currentSubject && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Class Time</label>
                <div className="text-sm text-gray-600 mt-2">
                  <div>Start: {currentSubject.start_time}</div>
                  <div>End: {currentSubject.end_time}</div>
                  <div className="text-xs text-yellow-600 mt-1">
                    Late after: {new Date(`2000-01-01T${currentSubject.start_time}`).toLocaleTimeString('en-US', {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'UTC'
                    }).replace(/(\d{2}):(\d{2})/, (match, hours, minutes) => {
                      const totalMinutes = parseInt(hours) * 60 + parseInt(minutes) + 15
                      const newHours = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
                      const newMins = (totalMinutes % 60).toString().padStart(2, '0')
                      return `${newHours}:${newMins}`
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subject Selection Notice */}
      {!hasNoChildren && !selectedSubject && (
        <div className="card">
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Subject</h3>
            <p className="text-gray-600">
              Please select a subject to view or mark attendance. Attendance is tracked per subject.
            </p>
          </div>
        </div>
      )}

      {/* Attendance Summary */}
      {!hasNoChildren && selectedSubject && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Present</p>
                <p className="text-2xl font-bold text-green-600">
                  {attendance.filter(a => a.status === 'present').length}
                </p>
              </div>
              <Check className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Absent</p>
                <p className="text-2xl font-bold text-red-600">
                  {attendance.filter(a => a.status === 'absent').length}
                </p>
              </div>
              <X className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Late</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {attendance.filter(a => a.status === 'late').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Excused</p>
                <p className="text-2xl font-bold text-blue-600">
                  {attendance.filter(a => a.status === 'excused').length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      {!hasNoChildren && selectedSubject && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {isRole('parent') ? 'Attendance Records' : 'Mark Attendance'} - {currentSubject?.name}
          </h2>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : pupils.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No pupils found for the selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pupil
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grade & Section
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time In
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {!isRole('parent') && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pupils.map((pupil) => {
                    const record = attendance.find(a => a.pupil_id === pupil.id)
                    return (
                      <tr key={pupil.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              {pupil.profile_picture ? (
                                <img 
                                  src={pupil.profile_picture} 
                                  alt={`${pupil.first_name} ${pupil.last_name}`}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                                  <User className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {pupil.first_name} {pupil.middle_name ? pupil.middle_name.charAt(0) + '. ' : ''}{pupil.last_name}
                              </div>
                              <div className="text-sm text-gray-500">{pupil.pupil_id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          Grade {pupil.grade_level} - {pupil.section}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record?.time_in || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record ? (
                            <div>
                              <span className={`flex items-center gap-2 ${getStatusColor(record.status)}`}>
                                {getStatusIcon(record.status)}
                                <span className="capitalize">{record.status}</span>
                              </span>
                              {record.excuse_reason && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Reason: {record.excuse_reason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Not marked</span>
                          )}
                        </td>
                        {!isRole('parent') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex gap-2">
                              <button
                                onClick={() => markAttendance(pupil.id, 'present')}
                                className="text-green-600 hover:text-green-700"
                                title="Mark Present"
                              >
                                <Check className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => markAttendance(pupil.id, 'absent')}
                                className="text-red-600 hover:text-red-700"
                                title="Mark Absent"
                              >
                                <X className="w-5 h-5" />
                              </button>
                              {record?.status === 'absent' && (
                                <button
                                  onClick={() => setExcuseModal({
                                    isOpen: true,
                                    pupilId: pupil.id,
                                    pupilName: `${pupil.first_name} ${pupil.last_name}`,
                                    excuseReason: ''
                                  })}
                                  className="text-blue-600 hover:text-blue-700"
                                  title="Excuse Absence"
                                >
                                  <MessageSquare className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Excuse Absence Modal */}
      {excuseModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setExcuseModal({ isOpen: false, pupilId: '', pupilName: '', excuseReason: '' })}></div>
            
            <div className="relative bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Excuse Absence - {excuseModal.pupilName}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Excuse <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={excuseModal.excuseReason}
                    onChange={(e) => setExcuseModal(prev => ({ ...prev, excuseReason: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter the reason for excusing this absence..."
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setExcuseModal({ isOpen: false, pupilId: '', pupilName: '', excuseReason: '' })}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleExcuseAbsence(excuseModal.pupilId, excuseModal.excuseReason)}
                    disabled={!excuseModal.excuseReason.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Excuse Absence
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Attendance