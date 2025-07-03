import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Users, BookOpen, Calendar, Bell, TrendingUp, Award, User, Eye, Download, Printer } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface Child {
  id: string
  pupil_id: string
  first_name: string
  last_name: string
  middle_name: string
  grade_level: number
  section: string
  profile_picture: string
  birth_date: string
  address: string
  is_4ps_beneficiary: boolean
  enrollment_date: string
}

interface GradeProgressData {
  quarter: string
  average: number | null
}

interface ChildRecord {
  child: Child
  grades: any[]
  attendance: any[]
  notifications: any[]
  gradeProgress: GradeProgressData[]
  attendanceStats: {
    present: number
    absent: number
    late: number
    excused: number
    total: number
    rate: number
  }
}

const MyChildren: React.FC = () => {
  const { user } = useAuth()
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<string>('')
  const [childRecords, setChildRecords] = useState<{[key: string]: ChildRecord}>({})
  const [selectedView, setSelectedView] = useState<'overview' | 'grades' | 'attendance' | 'records'>('overview')
  const [notifications, setNotifications] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedQuarter, setSelectedQuarter] = useState('1')
  const [attendanceDateRange, setAttendanceDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })

  // Helper function to format date
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  useEffect(() => {
    fetchChildren()
    fetchNotifications()
  }, [user])

  useEffect(() => {
    if (selectedChild) {
      fetchChildRecord(selectedChild)
    }
  }, [selectedChild, selectedQuarter, attendanceDateRange])

  const fetchChildren = async () => {
    try {
      const { data, error } = await supabase
        .from('pupils')
        .select('*')
        .eq('parent_id', user?.id)
        .eq('archived', false)
        .order('grade_level')
        .order('first_name')

      if (error) throw error
      setChildren(data || [])
      
      // Auto-select first child
      if (data && data.length > 0 && !selectedChild) {
        setSelectedChild(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching children:', error)
    }
  }

  const fetchChildRecord = async (childId: string) => {
    setIsLoading(true)
    try {
      const child = children.find(c => c.id === childId)
      if (!child) return

      // Fetch grades
      const { data: gradesData } = await supabase
        .from('grades')
        .select(`
          *,
          subjects (name, code)
        `)
        .eq('pupil_id', childId)
        .eq('quarter', selectedQuarter)
        .order('created_at', { ascending: false })

      // Calculate grade progress across quarters
      const quarters = [1, 2, 3, 4]
      const progressData: GradeProgressData[] = []

      for (const quarter of quarters) {
        const { data: quarterGrades } = await supabase
          .from('grades')
          .select('final_grade')
          .eq('pupil_id', childId)
          .eq('quarter', quarter)

        if (quarterGrades && quarterGrades.length > 0) {
          const average = quarterGrades.reduce((sum, g) => sum + g.final_grade, 0) / quarterGrades.length
          progressData.push({
            quarter: `Q${quarter}`,
            average: Math.round(average * 100) / 100
          })
        } else {
          progressData.push({
            quarter: `Q${quarter}`,
            average: null
          })
        }
      }

      // Fetch attendance for date range
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select(`
          *,
          subjects (name, code)
        `)
        .eq('pupil_id', childId)
        .gte('date', attendanceDateRange.start)
        .lte('date', attendanceDateRange.end)
        .order('date', { ascending: false })

      // Calculate attendance statistics
      const attendanceStats = {
        present: attendanceData?.filter(a => a.status === 'present').length || 0,
        absent: attendanceData?.filter(a => a.status === 'absent').length || 0,
        late: attendanceData?.filter(a => a.status === 'late').length || 0,
        excused: attendanceData?.filter(a => a.status === 'excused').length || 0,
        total: attendanceData?.length || 0,
        rate: 0
      }

      attendanceStats.rate = attendanceStats.total > 0 
        ? ((attendanceStats.present + attendanceStats.late) / attendanceStats.total * 100)
        : 0

      // Fetch child-specific notifications
      const { data: childNotifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user?.id)
        .ilike('message', `%${child.first_name}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      setChildRecords(prev => ({
        ...prev,
        [childId]: {
          child,
          grades: gradesData || [],
          attendance: attendanceData || [],
          notifications: childNotifications || [],
          gradeProgress: progressData,
          attendanceStats
        }
      }))

    } catch (error) {
      console.error('Error fetching child record:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const exportChildRecord = async () => {
    if (!selectedChild) return

    const record = childRecords[selectedChild]
    if (!record) return

    try {
      let csvContent = `CHILD ACADEMIC RECORD\n`
      csvContent += `Child: ${record.child.first_name} ${record.child.middle_name ? record.child.middle_name.charAt(0) + '. ' : ''}${record.child.last_name}\n`
      csvContent += `Pupil ID: ${record.child.pupil_id}\n`
      csvContent += `Grade: ${record.child.grade_level} - ${record.child.section}\n`
      csvContent += `School Year: ${new Date().getFullYear()}-${new Date().getFullYear() + 1}\n\n`

      // Grades section
      csvContent += `GRADES (Quarter ${selectedQuarter})\n`
      csvContent += `Subject,Final Grade,Remarks\n`
      record.grades.forEach(grade => {
        csvContent += `"${grade.subjects.name}",${grade.final_grade},"${grade.remarks || ''}"\n`
      })

      // Attendance section
      csvContent += `\nATTENDANCE SUMMARY\n`
      csvContent += `Present,Absent,Late,Excused,Total Days,Attendance Rate\n`
      csvContent += `${record.attendanceStats.present},${record.attendanceStats.absent},${record.attendanceStats.late},${record.attendanceStats.excused},${record.attendanceStats.total},${record.attendanceStats.rate.toFixed(1)}%\n`

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${record.child.first_name}_${record.child.last_name}_record_${formatDate(new Date())}.csv`
      a.click()
    } catch (error) {
      console.error('Error exporting record:', error)
    }
  }

  const selectedChildData = children.find(c => c.id === selectedChild)
  const currentRecord = selectedChild ? childRecords[selectedChild] : null

  const getGradeColor = (grade: number) => {
    if (grade >= 90) return 'text-green-600'
    if (grade >= 85) return 'text-blue-600'
    if (grade >= 80) return 'text-yellow-600'
    if (grade >= 75) return 'text-orange-600'
    return 'text-red-600'
  }

  const getGradeLabel = (grade: number) => {
    if (grade >= 90) return 'Outstanding'
    if (grade >= 85) return 'Very Satisfactory'
    if (grade >= 80) return 'Satisfactory'
    if (grade >= 75) return 'Fairly Satisfactory'
    return 'Did Not Meet Expectations'
  }

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6']

  if (children.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">My Children</h1>
        <div className="card">
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Children Assigned</h3>
            <p className="text-gray-600 max-w-md mx-auto">
              You don't have any children assigned to your account. Please contact the school administrator 
              to link your children's records to your parent account.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">My Children</h1>
        <div className="flex items-center gap-4">
          {selectedChild && (
            <div className="flex gap-2">
              <button
                onClick={exportChildRecord}
                className="btn-secondary"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Record
              </button>
              <button
                onClick={() => window.print()}
                className="btn-secondary"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </button>
            </div>
          )}
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="input-field min-w-[200px]"
          >
            {children.map(child => (
              <option key={child.id} value={child.id}>
                {child.first_name} {child.last_name} (Grade {child.grade_level})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedChildData && (
        <>
          {/* Child Profile Card */}
          <div className="card bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-6">
              <div className="relative">
                {selectedChildData.profile_picture ? (
                  <img 
                    src={selectedChildData.profile_picture} 
                    alt={`${selectedChildData.first_name} ${selectedChildData.last_name}`}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 border-4 border-white shadow-lg flex items-center justify-center">
                    <User className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  {selectedChildData.grade_level}
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedChildData.first_name} {selectedChildData.middle_name ? selectedChildData.middle_name.charAt(0) + '. ' : ''}{selectedChildData.last_name}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-600">Pupil ID:</span>
                    <p className="font-medium">{selectedChildData.pupil_id}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Grade & Section:</span>
                    <p className="font-medium">Grade {selectedChildData.grade_level} - {selectedChildData.section}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Birth Date:</span>
                    <p className="font-medium">{new Date(selectedChildData.birth_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">4P's Beneficiary:</span>
                    <p className={`font-medium ${selectedChildData.is_4ps_beneficiary ? 'text-blue-600' : 'text-gray-500'}`}>
                      {selectedChildData.is_4ps_beneficiary ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* View Selector */}
          <div className="card">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
              <button
                onClick={() => setSelectedView('overview')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'overview'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setSelectedView('grades')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'grades'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Grades
              </button>
              <button
                onClick={() => setSelectedView('attendance')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'attendance'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Attendance
              </button>
              <button
                onClick={() => setSelectedView('records')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedView === 'records'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Records
              </button>
            </div>
          </div>

          {/* Overview */}
          {selectedView === 'overview' && currentRecord && (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Current Average</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {currentRecord.grades.length > 0
                          ? (currentRecord.grades.reduce((sum, g) => sum + g.final_grade, 0) / currentRecord.grades.length).toFixed(1)
                          : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500">Quarter {selectedQuarter}</p>
                    </div>
                    <BookOpen className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Attendance Rate</p>
                      <p className="text-2xl font-bold text-gray-900">{currentRecord.attendanceStats.rate.toFixed(1)}%</p>
                      <p className="text-xs text-gray-500">Last 30 days</p>
                    </div>
                    <Calendar className="w-8 h-8 text-green-600" />
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Subjects</p>
                      <p className="text-2xl font-bold text-gray-900">{currentRecord.grades.length}</p>
                      <p className="text-xs text-gray-500">Current quarter</p>
                    </div>
                    <Award className="w-8 h-8 text-purple-600" />
                  </div>
                </div>

                <div className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Unread Alerts</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {notifications.filter(n => !n.read).length}
                      </p>
                      <p className="text-xs text-gray-500">Notifications</p>
                    </div>
                    <Bell className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Grade Progress Chart */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Progress</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentRecord.gradeProgress}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="quarter" />
                        <YAxis domain={[70, 100]} />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="average" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Attendance Distribution */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Present', value: currentRecord.attendanceStats.present },
                            { name: 'Absent', value: currentRecord.attendanceStats.absent },
                            { name: 'Late', value: currentRecord.attendanceStats.late },
                            { name: 'Excused', value: currentRecord.attendanceStats.excused }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'Present', value: currentRecord.attendanceStats.present },
                            { name: 'Absent', value: currentRecord.attendanceStats.absent },
                            { name: 'Late', value: currentRecord.attendanceStats.late },
                            { name: 'Excused', value: currentRecord.attendanceStats.excused }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Grades View */}
          {selectedView === 'grades' && (
            <div className="space-y-6">
              {/* Quarter Selector */}
              <div className="card">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Quarter:</label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="input-field w-auto"
                  >
                    <option value="1">1st Quarter</option>
                    <option value="2">2nd Quarter</option>
                    <option value="3">3rd Quarter</option>
                    <option value="4">4th Quarter</option>
                  </select>
                </div>
              </div>

              {/* Grades Table */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Subject Grades - Quarter {selectedQuarter}
                </h3>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : currentRecord?.grades.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No grades available for this quarter</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subject
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Final Grade
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Performance Level
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentRecord?.grades.map((grade) => (
                          <tr key={grade.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {grade.subjects.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {grade.subjects.code}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`text-xl font-bold ${getGradeColor(grade.final_grade)}`}>
                                {grade.final_grade.toFixed(2)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                grade.final_grade >= 90 ? 'bg-green-100 text-green-800' :
                                grade.final_grade >= 85 ? 'bg-blue-100 text-blue-800' :
                                grade.final_grade >= 80 ? 'bg-yellow-100 text-yellow-800' :
                                grade.final_grade >= 75 ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {getGradeLabel(grade.final_grade)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {grade.remarks || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Grade Progress Chart */}
              {currentRecord && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quarterly Progress</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={currentRecord.gradeProgress}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="quarter" />
                        <YAxis domain={[70, 100]} />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="average" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 6 }}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attendance View */}
          {selectedView === 'attendance' && (
            <div className="space-y-6">
              {/* Date Range Selector */}
              <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={attendanceDateRange.start}
                      onChange={(e) => setAttendanceDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={attendanceDateRange.end}
                      onChange={(e) => setAttendanceDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* Attendance Summary */}
              {currentRecord && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="card">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{currentRecord.attendanceStats.present}</div>
                      <div className="text-sm text-gray-600">Present</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{currentRecord.attendanceStats.absent}</div>
                      <div className="text-sm text-gray-600">Absent</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{currentRecord.attendanceStats.late}</div>
                      <div className="text-sm text-gray-600">Late</div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{currentRecord.attendanceStats.excused}</div>
                      <div className="text-sm text-gray-600">Excused</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Attendance Records */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Attendance</h3>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : currentRecord?.attendance.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500">No attendance records found for the selected period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Subject
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Time In
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {currentRecord?.attendance.slice(0, 20).map((record) => (
                          <tr key={record.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(record.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.subjects?.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {record.time_in || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                record.status === 'present' ? 'bg-green-100 text-green-800' :
                                record.status === 'absent' ? 'bg-red-100 text-red-800' :
                                record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {record.excuse_reason || record.remarks || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All Records View */}
          {selectedView === 'records' && (
            <div className="space-y-6">
              {/* Recent Notifications */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Notifications</h3>
                <div className="space-y-4">
                  {notifications.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No notifications</p>
                  ) : (
                    notifications.slice(0, 10).map(notification => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                          notification.read ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                        }`}
                        onClick={() => !notification.read && markNotificationAsRead(notification.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{notification.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(notification.created_at).toLocaleString()}
                            </p>
                          </div>
                          {!notification.read && (
                            <span className="ml-4 w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Academic Summary */}
              {currentRecord && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Academic Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Current Quarter Performance</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Average Grade:</span>
                          <span className="font-medium">
                            {currentRecord.grades.length > 0
                              ? (currentRecord.grades.reduce((sum, g) => sum + g.final_grade, 0) / currentRecord.grades.length).toFixed(1)
                              : 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Subjects Enrolled:</span>
                          <span className="font-medium">{currentRecord.grades.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Quarter:</span>
                          <span className="font-medium">{selectedQuarter}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Attendance Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Attendance Rate:</span>
                          <span className="font-medium">{currentRecord.attendanceStats.rate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Days:</span>
                          <span className="font-medium">{currentRecord.attendanceStats.total}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Days Present:</span>
                          <span className="font-medium">{currentRecord.attendanceStats.present}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MyChildren