import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { FileText, Download, Calendar, Filter, TrendingUp, Users, BookOpen, Printer, Award, BarChart3, FileCheck, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
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

interface ReportData {
  gradeDistribution: any[]
  attendanceOverview: any[]
  subjectPerformance: any[]
  studentProgress: any[]
  enrollmentTrends: any[]
  genderDistribution: any[]
  fourPsData: any[]
  classList: any[]
}

interface SF2Data {
  pupil_id: string
  name: string
  total_days: number
  present: number
  absent: number
  late: number
  excused: number
  attendance_rate: number
}

interface SF9Data {
  pupil_id: string
  name: string
  subjects: {
    [subject: string]: {
      q1: number | null
      q2: number | null
      q3: number | null
      q4: number | null
      final: number | null
    }
  }
  general_average: number | null
}

const ComprehensiveReports: React.FC = () => {
  const { user, isRole } = useAuth()
  const [reportType, setReportType] = useState('grade')
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [selectedQuarter, setSelectedQuarter] = useState('1')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  })
  const [reportData, setReportData] = useState<ReportData>({
    gradeDistribution: [],
    attendanceOverview: [],
    subjectPerformance: [],
    studentProgress: [],
    enrollmentTrends: [],
    genderDistribution: [],
    fourPsData: [],
    classList: [],
  })
  const [subjects, setSubjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pupils, setPupils] = useState<any[]>([])
  const [sf2Data, setSf2Data] = useState<SF2Data[]>([])
  const [sf9Data, setSf9Data] = useState<SF9Data[]>([])
  const [currentSchoolYear, setCurrentSchoolYear] = useState('')

  // Helper function to format date
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  // Get current school year
  const getCurrentSchoolYear = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1 // JavaScript months are 0-indexed
    
    if (month >= 6) { // June onwards is new school year
      return `${year}-${year + 1}`
    } else {
      return `${year - 1}-${year}`
    }
  }

  useEffect(() => {
    setCurrentSchoolYear(getCurrentSchoolYear())
    fetchSubjects()
    fetchPupils()
  }, [selectedGrade])

  useEffect(() => {
    generateReport()
  }, [reportType, selectedGrade, selectedSection, selectedQuarter, selectedSubject, dateRange])

  const fetchSubjects = async () => {
    try {
      let query = supabase.from('subjects').select('*')
      if (selectedGrade) {
        query = query.eq('grade_level', selectedGrade)
      }
      const { data, error } = await query
      if (error) throw error
      setSubjects(data || [])
    } catch (error) {
      console.error('Error fetching subjects:', error)
    }
  }

  const fetchPupils = async () => {
    try {
      let query = supabase.from('pupils').select('*').eq('archived', false)
      if (selectedGrade) {
        query = query.eq('grade_level', selectedGrade)
      }
      if (selectedSection) {
        query = query.eq('section', selectedSection)
      }
      const { data, error } = await query.order('last_name')
      if (error) throw error
      setPupils(data || [])
    } catch (error) {
      console.error('Error fetching pupils:', error)
    }
  }

  const generateReport = async () => {
    try {
      setIsLoading(true)

      switch (reportType) {
        case 'grade':
          await generateGradeReport()
          break
        case 'attendance':
          await generateAttendanceReport()
          break
        case 'progress':
          await generateProgressReport()
          break
        case 'sf2':
          await generateSF2Report()
          break
        case 'sf9':
          await generateSF9Report()
          break
        case 'trend':
          await generateTrendAnalysis()
          break
        case 'demographics':
          await generateDemographicsReport()
          break
        case 'class_list':
          await generateClassListReport()
          break
        case 'certification':
          await generateCertificationReport()
          break
        case 'comprehensive':
          await generateComprehensiveReport()
          break
      }
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setIsLoading(false)
    }
  }

  const generateGradeReport = async () => {
    try {
      let gradesQuery = supabase
        .from('grades')
        .select(`
          *,
          pupils (grade_level, gender),
          subjects (name)
        `)
        .eq('quarter', selectedQuarter)

      if (selectedGrade) {
        gradesQuery = gradesQuery.eq('pupils.grade_level', selectedGrade)
      }

      if (selectedSubject) {
        gradesQuery = gradesQuery.eq('subject_id', selectedSubject)
      }

      const { data: grades } = await gradesQuery

      if (grades) {
        const distribution = {
          'Outstanding (90-100)': 0,
          'Very Satisfactory (85-89)': 0,
          'Satisfactory (80-84)': 0,
          'Fairly Satisfactory (75-79)': 0,
          'Did Not Meet Expectations (Below 75)': 0,
        }

        grades.forEach(grade => {
          if (grade.final_grade >= 90) distribution['Outstanding (90-100)']++
          else if (grade.final_grade >= 85) distribution['Very Satisfactory (85-89)']++
          else if (grade.final_grade >= 80) distribution['Satisfactory (80-84)']++
          else if (grade.final_grade >= 75) distribution['Fairly Satisfactory (75-79)']++
          else distribution['Did Not Meet Expectations (Below 75)']++
        })

        const gradeDistribution = Object.entries(distribution).map(([grade, count]) => ({
          grade,
          count,
          percentage: grades.length > 0 ? (count / grades.length * 100).toFixed(1) : '0'
        }))

        const subjectData: Record<string, { total: number, count: number }> = {}
        grades.forEach(grade => {
          const subject = grade.subjects.name
          if (!subjectData[subject]) {
            subjectData[subject] = { total: 0, count: 0 }
          }
          subjectData[subject].total += grade.final_grade
          subjectData[subject].count++
        })

        const subjectPerformance = Object.entries(subjectData).map(([subject, data]) => ({
          subject,
          average: (data.total / data.count).toFixed(1)
        }))

        setReportData(prev => ({
          ...prev,
          gradeDistribution,
          subjectPerformance,
        }))
      }
    } catch (error) {
      console.error('Error generating grade report:', error)
    }
  }

  const generateSF2Report = async () => {
    try {
      if (!selectedGrade || !selectedSection) {
        toast.error('Please select grade level and section for SF2 report')
        return
      }

      const { data: classPupils } = await supabase
        .from('pupils')
        .select('*')
        .eq('grade_level', selectedGrade)
        .eq('section', selectedSection)
        .eq('archived', false)
        .order('last_name')

      if (!classPupils) return

      const sf2Records: SF2Data[] = []

      for (const pupil of classPupils) {
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .eq('pupil_id', pupil.id)
          .gte('date', dateRange.start)
          .lte('date', dateRange.end)

        const totalDays = attendance?.length || 0
        const present = attendance?.filter(a => a.status === 'present').length || 0
        const absent = attendance?.filter(a => a.status === 'absent').length || 0
        const late = attendance?.filter(a => a.status === 'late').length || 0
        const excused = attendance?.filter(a => a.status === 'excused').length || 0
        const attendanceRate = totalDays > 0 ? ((present + late) / totalDays * 100) : 0

        sf2Records.push({
          pupil_id: pupil.pupil_id,
          name: `${pupil.last_name}, ${pupil.first_name} ${pupil.middle_name ? pupil.middle_name.charAt(0) + '.' : ''}`.trim(),
          total_days: totalDays,
          present,
          absent,
          late,
          excused,
          attendance_rate: Math.round(attendanceRate * 100) / 100
        })
      }

      setSf2Data(sf2Records)
    } catch (error) {
      console.error('Error generating SF2 report:', error)
    }
  }

  const generateSF9Report = async () => {
    try {
      if (!selectedGrade || !selectedSection) {
        toast.error('Please select grade level and section for SF9 report')
        return
      }

      const { data: classPupils } = await supabase
        .from('pupils')
        .select('*')
        .eq('grade_level', selectedGrade)
        .eq('section', selectedSection)
        .eq('archived', false)
        .order('last_name')

      const { data: gradeSubjects } = await supabase
        .from('subjects')
        .select('*')
        .eq('grade_level', selectedGrade)

      if (!classPupils || !gradeSubjects) return

      const sf9Records: SF9Data[] = []

      for (const pupil of classPupils) {
        const subjectGrades: { [subject: string]: any } = {}
        let totalGrades = 0
        let gradeCount = 0

        for (const subject of gradeSubjects) {
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

        sf9Records.push({
          pupil_id: pupil.pupil_id,
          name: `${pupil.last_name}, ${pupil.first_name} ${pupil.middle_name ? pupil.middle_name.charAt(0) + '.' : ''}`.trim(),
          subjects: subjectGrades,
          general_average: gradeCount > 0 ? Math.round((totalGrades / gradeCount) * 100) / 100 : null
        })
      }

      setSf9Data(sf9Records)
    } catch (error) {
      console.error('Error generating SF9 report:', error)
    }
  }

  const generateClassListReport = async () => {
    try {
      const { data: pupils } = await supabase
        .from('pupils')
        .select('*')
        .eq('archived', false)
        .order('grade_level', { ascending: true })
        .order('section', { ascending: true })
        .order('last_name', { ascending: true })

      const classList = pupils?.map(pupil => ({
        pupil_id: pupil.pupil_id,
        name: `${pupil.last_name}, ${pupil.first_name} ${pupil.middle_name ? pupil.middle_name.charAt(0) + '.' : ''}`.trim(),
        grade_level: pupil.grade_level,
        section: pupil.section,
        gender: pupil.gender,
        is_4ps: pupil.is_4ps_beneficiary,
        birth_date: pupil.birth_date,
        address: pupil.address
      })) || []

      setReportData(prev => ({ ...prev, classList }))
    } catch (error) {
      console.error('Error generating class list report:', error)
    }
  }

  const generateDemographicsReport = async () => {
    try {
      const { data: allPupils } = await supabase
        .from('pupils')
        .select('*')
        .eq('archived', false)

      if (allPupils) {
        const genderDistribution = [
          {
            gender: 'Male',
            count: allPupils.filter(p => p.gender === 'male').length,
          },
          {
            gender: 'Female',
            count: allPupils.filter(p => p.gender === 'female').length,
          }
        ]

        const fourPsData = [
          {
            category: '4P\'s Beneficiaries',
            count: allPupils.filter(p => p.is_4ps_beneficiary).length,
          },
          {
            category: 'Non-4P\'s',
            count: allPupils.filter(p => !p.is_4ps_beneficiary).length,
          }
        ]

        setReportData(prev => ({
          ...prev,
          genderDistribution,
          fourPsData,
        }))
      }
    } catch (error) {
      console.error('Error generating demographics report:', error)
    }
  }

  const generateTrendAnalysis = async () => {
    try {
      const currentYear = new Date().getFullYear()
      const years = Array.from({ length: 5 }, (_, i) => currentYear - 4 + i)
      
      const enrollmentData: any[] = []

      for (const year of years) {
        const { data: pupils } = await supabase
          .from('pupils')
          .select('gender, grade_level, is_4ps_beneficiary, enrollment_date')
          .gte('enrollment_date', `${year}-06-01`)
          .lt('enrollment_date', `${year + 1}-06-01`)

        if (pupils) {
          const total = pupils.length
          const male = pupils.filter(p => p.gender === 'male').length
          const female = pupils.filter(p => p.gender === 'female').length
          const fourPs = pupils.filter(p => p.is_4ps_beneficiary).length
          
          enrollmentData.push({
            year: `SY ${year}-${year + 1}`,
            total,
            male,
            female,
            fourPs,
          })
        }
      }

      setReportData(prev => ({
        ...prev,
        enrollmentTrends: enrollmentData,
      }))
    } catch (error) {
      console.error('Error generating trend analysis:', error)
    }
  }

  const generateAttendanceReport = async () => {
    try {
      const { data: attendance } = await supabase
        .from('attendance')
        .select(`
          *,
          pupils (grade_level, gender, section)
        `)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)

      if (attendance) {
        const dailyData: Record<string, any> = {}
        attendance.forEach(record => {
          if (!dailyData[record.date]) {
            dailyData[record.date] = {
              date: record.date,
              present: 0,
              absent: 0,
              late: 0,
              excused: 0,
            }
          }
          dailyData[record.date][record.status]++
        })

        const attendanceOverview = Object.values(dailyData)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map(day => ({
            ...day,
            date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            total: day.present + day.absent + day.late + day.excused,
            attendanceRate: ((day.present + day.late) / (day.present + day.absent + day.late + day.excused) * 100).toFixed(1)
          }))

        setReportData(prev => ({
          ...prev,
          attendanceOverview,
        }))
      }
    } catch (error) {
      console.error('Error generating attendance report:', error)
    }
  }

  const generateProgressReport = async () => {
    try {
      const quarters = ['1', '2', '3', '4']
      const progressData: any[] = []

      for (const quarter of quarters) {
        let gradesQuery = supabase
          .from('grades')
          .select(`
            *,
            pupils (id, first_name, last_name, grade_level),
            subjects (name)
          `)
          .eq('quarter', quarter)

        if (selectedGrade) {
          gradesQuery = gradesQuery.eq('pupils.grade_level', selectedGrade)
        }

        const { data: grades } = await gradesQuery

        if (grades) {
          const pupilAverages: Record<string, { total: number, count: number }> = {}
          
          grades.forEach(grade => {
            const pupilId = grade.pupil_id
            if (!pupilAverages[pupilId]) {
              pupilAverages[pupilId] = { total: 0, count: 0 }
            }
            pupilAverages[pupilId].total += grade.final_grade
            pupilAverages[pupilId].count++
          })

          const quarterAverage = Object.values(pupilAverages).reduce((sum, pupil) => {
            return sum + (pupil.total / pupil.count)
          }, 0) / Object.keys(pupilAverages).length

          progressData.push({
            quarter: `Q${quarter}`,
            average: quarterAverage.toFixed(1)
          })
        }
      }

      setReportData(prev => ({
        ...prev,
        studentProgress: progressData,
      }))
    } catch (error) {
      console.error('Error generating progress report:', error)
    }
  }

  const generateCertificationReport = async () => {
    // This would generate certification templates
    toast.success('Certification templates ready for printing')
  }

  const generateComprehensiveReport = async () => {
    await Promise.all([
      generateGradeReport(),
      generateAttendanceReport(),
      generateProgressReport(),
      generateTrendAnalysis(),
      generateDemographicsReport(),
      generateClassListReport(),
    ])
  }

  const exportReport = async (format: 'pdf' | 'csv') => {
    try {
      if (format === 'csv') {
        let csvContent = ''
        const currentDate = new Date().toISOString().split('T')[0]

        if (reportType === 'sf2') {
          csvContent = await generateSF2CSV()
        } else if (reportType === 'sf9') {
          csvContent = await generateSF9CSV()
        } else if (reportType === 'class_list') {
          csvContent = await generateClassListCSV()
        } else {
          // Standard reports
          if (reportType === 'grade' || reportType === 'comprehensive') {
            csvContent += 'Grade Distribution\n'
            csvContent += 'Grade Level,Count,Percentage\n'
            reportData.gradeDistribution.forEach(item => {
              csvContent += `${item.grade},${item.count},${item.percentage}%\n`
            })
            csvContent += '\n'
          }

          if (reportType === 'demographics' || reportType === 'comprehensive') {
            csvContent += 'Gender Distribution\n'
            csvContent += 'Gender,Count\n'
            reportData.genderDistribution.forEach(item => {
              csvContent += `${item.gender},${item.count}\n`
            })
            csvContent += '\n4P\'s Beneficiaries\n'
            csvContent += 'Category,Count\n'
            reportData.fourPsData.forEach(item => {
              csvContent += `${item.category},${item.count}\n`
            })
          }
        }

        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportType}_report_${currentDate}.csv`
        a.click()
      } else {
        toast('PDF export feature coming soon!')
      }
    } catch (error) {
      console.error('Error exporting report:', error)
      toast.error('Failed to export report')
    }
  }

  const generateSF2CSV = (): string => {
    let csvContent = 'SCHOOL FORM 2 - DAILY ATTENDANCE REPORT OF LEARNERS\n'
    csvContent += `School: Anonang-Naguilian Community School\n`
    csvContent += `School Year: ${currentSchoolYear}\n`
    csvContent += `Grade Level: ${selectedGrade}, Section: ${selectedSection}\n`
    csvContent += `Period: ${dateRange.start} to ${dateRange.end}\n\n`
    csvContent += 'Pupil ID,Name,Total Days,Present,Absent,Late,Excused,Attendance Rate\n'
    
    sf2Data.forEach(record => {
      csvContent += `${record.pupil_id},"${record.name}",${record.total_days},${record.present},${record.absent},${record.late},${record.excused},${record.attendance_rate}%\n`
    })

    csvContent += '\n\nPrepared by: ____________________\n'
    csvContent += 'Class Adviser\n\n'
    csvContent += 'Checked by: ____________________\n'
    csvContent += 'Principal\n'
    
    return csvContent
  }

  const generateSF9CSV = (): string => {
    let csvContent = 'SCHOOL FORM 9 - LEARNER\'S PERMANENT ACADEMIC RECORD\n'
    csvContent += `School: Anonang-Naguilian Community School\n`
    csvContent += `School Year: ${currentSchoolYear}\n`
    csvContent += `Grade Level: ${selectedGrade}, Section: ${selectedSection}\n\n`
    
    // Headers
    const subjectNames = Object.keys(sf9Data[0]?.subjects || {})
    csvContent += 'Pupil ID,Name,' + subjectNames.map(s => `${s}_Q1,${s}_Q2,${s}_Q3,${s}_Q4,${s}_Final`).join(',') + ',General Average\n'
    
    sf9Data.forEach(record => {
      let row = `${record.pupil_id},"${record.name}"`
      
      subjectNames.forEach(subject => {
        const grades = record.subjects[subject]
        row += `,${grades.q1 || ''},${grades.q2 || ''},${grades.q3 || ''},${grades.q4 || ''},${grades.final || ''}`
      })
      
      row += `,${record.general_average || ''}\n`
      csvContent += row
    })

    csvContent += '\n\nClass Adviser: ____________________\n'
    csvContent += 'Principal: ____________________\n'
    
    return csvContent
  }

  const generateClassListCSV = (): string => {
    let csvContent = 'CLASS LIST REPORT\n'
    csvContent += `School: Anonang-Naguilian Community School\n`
    csvContent += `School Year: ${currentSchoolYear}\n`
    if (selectedGrade) csvContent += `Grade Level: ${selectedGrade}\n`
    if (selectedSection) csvContent += `Section: ${selectedSection}\n`
    csvContent += '\n'
    
    csvContent += 'Pupil ID,Name,Grade,Section,Gender,4P\'s Beneficiary,Birth Date,Address\n'
    
    reportData.classList.forEach(pupil => {
      csvContent += `${pupil.pupil_id},"${pupil.name}",${pupil.grade_level},${pupil.section},${pupil.gender},${pupil.is_4ps ? 'Yes' : 'No'},${pupil.birth_date},"${pupil.address || ''}"\n`
    })
    
    return csvContent
  }

  const printReport = () => {
    window.print()
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
        <div className="flex gap-3">
          <button onClick={printReport} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button onClick={() => exportReport('csv')} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={() => exportReport('pdf')} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Report Type Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Report Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <button
            onClick={() => setReportType('grade')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'grade'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <BookOpen className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">Grade Report</p>
            <p className="text-sm text-gray-500">Performance analysis</p>
          </button>
          
          <button
            onClick={() => setReportType('attendance')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'attendance'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Calendar className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">Attendance Report</p>
            <p className="text-sm text-gray-500">Attendance patterns</p>
          </button>
          
          <button
            onClick={() => setReportType('sf2')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'sf2'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <FileCheck className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">SF2 Report</p>
            <p className="text-sm text-gray-500">Daily attendance</p>
          </button>
          
          <button
            onClick={() => setReportType('sf9')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'sf9'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <GraduationCap className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">SF9 Report</p>
            <p className="text-sm text-gray-500">Report cards</p>
          </button>
          
          <button
            onClick={() => setReportType('class_list')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'class_list'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Users className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">Class List</p>
            <p className="text-sm text-gray-500">Pupil roster</p>
          </button>

          <button
            onClick={() => setReportType('trend')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'trend'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <TrendingUp className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">Trend Analysis</p>
            <p className="text-sm text-gray-500">5-year trends</p>
          </button>
          
          <button
            onClick={() => setReportType('demographics')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'demographics'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Users className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">Demographics</p>
            <p className="text-sm text-gray-500">Gender & 4P's data</p>
          </button>
          
          <button
            onClick={() => setReportType('progress')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'progress'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <BarChart3 className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">Progress Report</p>
            <p className="text-sm text-gray-500">Quarter trends</p>
          </button>

          <button
            onClick={() => setReportType('certification')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'certification'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Award className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">Certification</p>
            <p className="text-sm text-gray-500">Certificates</p>
          </button>
          
          <button
            onClick={() => setReportType('comprehensive')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              reportType === 'comprehensive'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <FileText className="w-6 h-6 mb-2 mx-auto text-blue-600" />
            <p className="font-medium">Comprehensive</p>
            <p className="text-sm text-gray-500">All reports</p>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level</label>
            <select
              value={selectedGrade || ''}
              onChange={(e) => setSelectedGrade(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {(reportType === 'grade' || reportType === 'comprehensive') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Quarter</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">1st Quarter</option>
                <option value="2">2nd Quarter</option>
                <option value="3">3rd Quarter</option>
                <option value="4">4th Quarter</option>
              </select>
            </div>
          )}
          
          {(reportType === 'attendance' || reportType === 'sf2' || reportType === 'comprehensive') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SF2 Report */}
          {reportType === 'sf2' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">SCHOOL FORM 2</h2>
                <h3 className="text-lg font-semibold">DAILY ATTENDANCE REPORT OF LEARNERS</h3>
                <div className="mt-4 text-sm">
                  <p><strong>School:</strong> Anonang-Naguilian Community School</p>
                  <p><strong>School Year:</strong> {currentSchoolYear}</p>
                  <p><strong>Grade Level:</strong> {selectedGrade} <strong>Section:</strong> {selectedSection}</p>
                  <p><strong>Period:</strong> {dateRange.start} to {dateRange.end}</p>
                </div>
              </div>

              {sf2Data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-400">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 px-4 py-2">No.</th>
                        <th className="border border-gray-400 px-4 py-2">PUPIL ID</th>
                        <th className="border border-gray-400 px-4 py-2">NAME</th>
                        <th className="border border-gray-400 px-4 py-2">TOTAL DAYS</th>
                        <th className="border border-gray-400 px-4 py-2">PRESENT</th>
                        <th className="border border-gray-400 px-4 py-2">ABSENT</th>
                        <th className="border border-gray-400 px-4 py-2">LATE</th>
                        <th className="border border-gray-400 px-4 py-2">EXCUSED</th>
                        <th className="border border-gray-400 px-4 py-2">ATTENDANCE RATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sf2Data.map((record, index) => (
                        <tr key={record.pupil_id}>
                          <td className="border border-gray-400 px-4 py-2 text-center">{index + 1}</td>
                          <td className="border border-gray-400 px-4 py-2">{record.pupil_id}</td>
                          <td className="border border-gray-400 px-4 py-2">{record.name}</td>
                          <td className="border border-gray-400 px-4 py-2 text-center">{record.total_days}</td>
                          <td className="border border-gray-400 px-4 py-2 text-center">{record.present}</td>
                          <td className="border border-gray-400 px-4 py-2 text-center">{record.absent}</td>
                          <td className="border border-gray-400 px-4 py-2 text-center">{record.late}</td>
                          <td className="border border-gray-400 px-4 py-2 text-center">{record.excused}</td>
                          <td className="border border-gray-400 px-4 py-2 text-center">{record.attendance_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Please select grade and section to generate SF2 report</p>
              )}

              <div className="mt-8 grid grid-cols-2 gap-8">
                <div>
                  <p className="font-medium">Prepared by:</p>
                  <div className="mt-8 border-b border-gray-400"></div>
                  <p className="text-center text-sm">Class Adviser</p>
                </div>
                <div>
                  <p className="font-medium">Checked by:</p>
                  <div className="mt-8 border-b border-gray-400"></div>
                  <p className="text-center text-sm">Principal</p>
                </div>
              </div>
            </div>
          )}

          {/* SF9 Report */}
          {reportType === 'sf9' && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold">SCHOOL FORM 9</h2>
                <h3 className="text-lg font-semibold">LEARNER'S PERMANENT ACADEMIC RECORD</h3>
                <div className="mt-4 text-sm">
                  <p><strong>School:</strong> Anonang-Naguilian Community School</p>
                  <p><strong>School Year:</strong> {currentSchoolYear}</p>
                  <p><strong>Grade Level:</strong> {selectedGrade} <strong>Section:</strong> {selectedSection}</p>
                </div>
              </div>

              {sf9Data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-400 text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-400 px-2 py-2" rowSpan={2}>No.</th>
                        <th className="border border-gray-400 px-2 py-2" rowSpan={2}>PUPIL ID</th>
                        <th className="border border-gray-400 px-2 py-2" rowSpan={2}>NAME</th>
                        {Object.keys(sf9Data[0]?.subjects || {}).map(subject => (
                          <th key={subject} className="border border-gray-400 px-2 py-2" colSpan={5}>
                            {subject}
                          </th>
                        ))}
                        <th className="border border-gray-400 px-2 py-2" rowSpan={2}>GENERAL AVERAGE</th>
                      </tr>
                      <tr className="bg-gray-100">
                        {Object.keys(sf9Data[0]?.subjects || {}).map(subject => (
                          <React.Fragment key={subject}>
                            <th className="border border-gray-400 px-1 py-1">Q1</th>
                            <th className="border border-gray-400 px-1 py-1">Q2</th>
                            <th className="border border-gray-400 px-1 py-1">Q3</th>
                            <th className="border border-gray-400 px-1 py-1">Q4</th>
                            <th className="border border-gray-400 px-1 py-1">Final</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sf9Data.map((record, index) => (
                        <tr key={record.pupil_id}>
                          <td className="border border-gray-400 px-2 py-2 text-center">{index + 1}</td>
                          <td className="border border-gray-400 px-2 py-2">{record.pupil_id}</td>
                          <td className="border border-gray-400 px-2 py-2">{record.name}</td>
                          {Object.entries(record.subjects).map(([subject, grades]) => (
                            <React.Fragment key={subject}>
                              <td className="border border-gray-400 px-1 py-2 text-center">{grades.q1 || '-'}</td>
                              <td className="border border-gray-400 px-1 py-2 text-center">{grades.q2 || '-'}</td>
                              <td className="border border-gray-400 px-1 py-2 text-center">{grades.q3 || '-'}</td>
                              <td className="border border-gray-400 px-1 py-2 text-center">{grades.q4 || '-'}</td>
                              <td className="border border-gray-400 px-1 py-2 text-center font-semibold">{grades.final || '-'}</td>
                            </React.Fragment>
                          ))}
                          <td className="border border-gray-400 px-2 py-2 text-center font-bold">{record.general_average || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">Please select grade and section to generate SF9 report</p>
              )}

              <div className="mt-8 grid grid-cols-2 gap-8">
                <div>
                  <p className="font-medium">Class Adviser:</p>
                  <div className="mt-8 border-b border-gray-400"></div>
                  <p className="text-center text-sm">Signature over Printed Name</p>
                </div>
                <div>
                  <p className="font-medium">Principal:</p>
                  <div className="mt-8 border-b border-gray-400"></div>
                  <p className="text-center text-sm">Signature over Printed Name</p>
                </div>
              </div>
            </div>
          )}

          {/* Other report types with charts and data... */}
          {/* Grade Distribution */}
          {(reportType === 'grade' || reportType === 'comprehensive') && reportData.gradeDistribution.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.gradeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="grade" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Enrollment Trends */}
          {(reportType === 'trend' || reportType === 'comprehensive') && reportData.enrollmentTrends.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">5-Year Enrollment Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData.enrollmentTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={3} />
                    <Line type="monotone" dataKey="male" stroke="#10b981" name="Male" />
                    <Line type="monotone" dataKey="female" stroke="#f59e0b" name="Female" />
                    <Line type="monotone" dataKey="fourPs" stroke="#8b5cf6" name="4P's Beneficiaries" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Demographics */}
          {(reportType === 'demographics' || reportType === 'comprehensive') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {reportData.genderDistribution.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={reportData.genderDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.gender}: ${entry.count}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {reportData.genderDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {reportData.fourPsData.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">4P's Beneficiaries</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.fourPsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8b5cf6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Class List */}
          {reportType === 'class_list' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Class List</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pupil ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">4P's</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reportData.classList.map((pupil, index) => (
                      <tr key={pupil.pupil_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pupil.pupil_id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pupil.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pupil.grade_level}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{pupil.section}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">{pupil.gender}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            pupil.is_4ps ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {pupil.is_4ps ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Certification Template */}
          {reportType === 'certification' && (
            <div className="bg-white rounded-lg shadow p-8">
              <div className="text-center border-2 border-gray-400 p-8">
                <h2 className="text-2xl font-bold mb-4">CERTIFICATE OF ENROLLMENT</h2>
                <div className="mb-6">
                  <img src="/school-logo.png" alt="School Logo" className="w-20 h-20 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold">ANONANG-NAGUILIAN COMMUNITY SCHOOL</h3>
                  <p className="text-sm">Barangay Anonang, Baguio City</p>
                </div>
                
                <div className="text-left space-y-4 mb-6">
                  <p><strong>TO WHOM IT MAY CONCERN:</strong></p>
                  <p>This is to certify that <strong>_________________________</strong> is currently enrolled as a Grade <strong>____</strong> pupil in this school for School Year <strong>{currentSchoolYear}</strong>.</p>
                  <p>This certification is issued for whatever legal purpose it may serve.</p>
                </div>

                <div className="grid grid-cols-2 gap-8 mt-12">
                  <div>
                    <p className="font-medium">Issued by:</p>
                    <div className="mt-8 border-b border-gray-400"></div>
                    <p className="text-center text-sm">School Registrar</p>
                  </div>
                  <div>
                    <p className="font-medium">Approved by:</p>
                    <div className="mt-8 border-b border-gray-400"></div>
                    <p className="text-center text-sm">School Principal</p>
                  </div>
                </div>

                <p className="text-sm mt-8">Date Issued: _______________</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ComprehensiveReports