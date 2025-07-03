import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Users, BookOpen, Calendar, TrendingUp, AlertCircle, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface DashboardStats {
  totalPupils: number
  totalTeachers: number
  todayAttendance: number
  averageGrade: number
}

interface PendingRegistration {
  id: string
  full_name: string
  email: string
  role: string
  created_at: string
}

const Dashboard: React.FC = () => {
  const { user, isRole } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    totalPupils: 0,
    totalTeachers: 0,
    todayAttendance: 0,
    averageGrade: 0,
  })
  const [enrollmentTrends, setEnrollmentTrends] = useState<any[]>([])
  const [gradeDistribution, setGradeDistribution] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([])
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardData()
    if (isRole('admin')) {
      fetchPendingRegistrations()
      fetchNotifications()
    }
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch pupils count
      const { count: pupilCount } = await supabase
        .from('pupils')
        .select('*', { count: 'exact', head: true })
        .eq('archived', false)

      // Fetch teachers count
      const { count: teacherCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher')
        .neq('archived', true)

      // Fetch today's attendance
      const today = new Date().toISOString().split('T')[0]
      const { count: attendanceCount } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', today)
        .eq('status', 'present')

      // Fetch average grade
      const { data: grades } = await supabase
        .from('grades')
        .select('final_grade')
      
      const avgGrade = grades?.length 
        ? grades.reduce((acc, curr) => acc + curr.final_grade, 0) / grades.length
        : 0

      setStats({
        totalPupils: pupilCount || 0,
        totalTeachers: teacherCount || 0,
        todayAttendance: attendanceCount || 0,
        averageGrade: avgGrade,
      })

      // Fetch 5-year enrollment trends
      await fetchEnrollmentTrends()
      
      // Fetch other dashboard data
      fetchGradeDistribution()
      fetchAttendanceData()
      fetchRecentActivities()
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    }
  }

  const fetchEnrollmentTrends = async () => {
    try {
      const currentYear = new Date().getFullYear()
      const years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i)
      
      const enrollmentData: any[] = []

      for (const year of years) {
        // Get enrollment data for each school year
        const { data: pupils } = await supabase
          .from('pupils')
          .select('gender, grade_level, is_4ps_beneficiary, enrollment_date')
          .gte('enrollment_date', `${year}-06-01`) // School year starts in June
          .lt('enrollment_date', `${year + 1}-06-01`)

        if (pupils) {
          const total = pupils.length
          const male = pupils.filter(p => p.gender === 'male').length
          const female = pupils.filter(p => p.gender === 'female').length
          const fourPs = pupils.filter(p => p.is_4ps_beneficiary).length
          
          // Grade level distribution
          const gradeDistribution = [1, 2, 3, 4, 5, 6].map(grade => ({
            grade,
            count: pupils.filter(p => p.grade_level === grade).length
          }))

          enrollmentData.push({
            year: `SY ${year}-${year + 1}`,
            total,
            male,
            female,
            fourPs,
            gradeDistribution,
          })
        }
      }

      setEnrollmentTrends(enrollmentData)
    } catch (error) {
      console.error('Error fetching enrollment trends:', error)
    }
  }

  const fetchPendingRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_registrations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPendingRegistrations(data || [])

      // Create notifications for new registrations
      if (data && data.length > 0) {
        const latestRegistration = data[0]
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        
        if (latestRegistration.created_at > oneHourAgo) {
          // This is a recent registration, show notification
          setNotifications(prev => [{
            id: `reg-${latestRegistration.id}`,
            title: 'New User Registration',
            message: `${latestRegistration.full_name} has registered as a ${latestRegistration.role}`,
            type: 'registration',
            created_at: latestRegistration.created_at
          }, ...prev])
        }
      }
    } catch (error) {
      console.error('Error fetching pending registrations:', error)
    }
  }

  const fetchNotifications = async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user?.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(5)

      setNotifications(prev => [...prev, ...(data || [])])
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const fetchGradeDistribution = async () => {
    try {
      const { data: grades } = await supabase
        .from('grades')
        .select('final_grade')

      if (grades) {
        const distribution = {
          'Outstanding (90-100)': 0,
          'Very Satisfactory (85-89)': 0,
          'Satisfactory (80-84)': 0,
          'Fairly Satisfactory (75-79)': 0,
          'Did Not Meet Expectations (Below 75)': 0,
        }

        grades.forEach(({ final_grade }) => {
          if (final_grade >= 90) distribution['Outstanding (90-100)']++
          else if (final_grade >= 85) distribution['Very Satisfactory (85-89)']++
          else if (final_grade >= 80) distribution['Satisfactory (80-84)']++
          else if (final_grade >= 75) distribution['Fairly Satisfactory (75-79)']++
          else distribution['Did Not Meet Expectations (Below 75)']++
        })

        const chartData = Object.entries(distribution).map(([grade, count]) => ({
          grade,
          count,
        }))

        setGradeDistribution(chartData)
      }
    } catch (error) {
      console.error('Error fetching grade distribution:', error)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      // Fetch last 7 days attendance
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - i)
        return date.toISOString().split('T')[0]
      }).reverse()

      const attendancePromises = last7Days.map(async (date) => {
        const { count: present } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('date', date)
          .eq('status', 'present')

        const { count: total } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('date', date)

        return {
          date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          present: present || 0,
          absent: (total || 0) - (present || 0),
          attendanceRate: total ? ((present || 0) / total * 100) : 0
        }
      })

      const data = await Promise.all(attendancePromises)
      setAttendanceData(data)
    } catch (error) {
      console.error('Error fetching attendance data:', error)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      setRecentActivities(logs || [])
    } catch (error) {
      console.error('Error fetching recent activities:', error)
    }
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.full_name}!</h1>
            <p className="text-primary-100 mt-1">
              Here's what's happening at Anonang-Naguilian Community School today.
            </p>
          </div>
          {isRole('admin') && notifications.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="bg-white/20 rounded-lg p-3">
                <Bell className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications.length}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Notifications */}
      {isRole('admin') && notifications.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">Recent Notifications</h3>
          <div className="space-y-2">
            {notifications.slice(0, 3).map((notification) => (
              <div key={notification.id} className="text-sm text-yellow-700">
                <strong>{notification.title}:</strong> {notification.message}
              </div>
            ))}
          </div>
          {pendingRegistrations.length > 0 && (
            <div className="mt-3">
              <a href="/users" className="text-yellow-800 font-medium hover:underline">
                Review {pendingRegistrations.length} pending registration(s) →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pupils</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPupils}</p>
            </div>
            <Users className="w-10 h-10 text-primary-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Teachers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTeachers}</p>
            </div>
            <Users className="w-10 h-10 text-secondary-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Attendance</p>
              <p className="text-2xl font-bold text-gray-900">{stats.todayAttendance}</p>
            </div>
            <Calendar className="w-10 h-10 text-success-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Grade</p>
              <p className="text-2xl font-bold text-gray-900">{stats.averageGrade.toFixed(1)}%</p>
            </div>
            <TrendingUp className="w-10 h-10 text-warning-600" />
          </div>
        </div>
      </div>

      {/* 5-Year Enrollment Trends */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">5-Year Enrollment Trends</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={enrollmentTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#3b82f6" 
                strokeWidth={3}
                name="Total Enrollment"
              />
              <Line 
                type="monotone" 
                dataKey="male" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Male"
              />
              <Line 
                type="monotone" 
                dataKey="female" 
                stroke="#f59e0b" 
                strokeWidth={2}
                name="Female"
              />
              <Line 
                type="monotone" 
                dataKey="fourPs" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                name="4P's Beneficiaries"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Attendance */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Attendance Rate</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value}%`, 'Attendance Rate']} />
                <Line 
                  type="monotone" 
                  dataKey="attendanceRate" 
                  stroke="#10b981" 
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      {isRole('admin') && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h3>
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.action}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard