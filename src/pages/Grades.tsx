import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Upload, Download, Save, Search, Filter, BookOpen, Calculator, Award, Users, Eye, Edit } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
// Helper function to format date
const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0]
}

const gradeSchema = z.object({
  grades: z.array(z.object({
    pupil_id: z.string(),
    final_grade: z.number().min(60).max(100, 'Grade must be between 60-100'),
  }))
})

type GradeFormData = z.infer<typeof gradeSchema>

interface GradeRecord {
  id: string
  pupil_id: string
  subject_id: string
  quarter: number
  final_grade: number
  teacher_id: string
  remarks?: string
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
  }
  subjects: {
    name: string
    code: string
  }
}

interface ClassAverages {
  pupil_id: string
  pupil_name: string
  q1_avg: number | null
  q2_avg: number | null
  q3_avg: number | null
  q4_avg: number | null
  final_avg: number | null
}

const Grades: React.FC = () => {
  const { user, isRole } = useAuth()
  const [grades, setGrades] = useState<GradeRecord[]>([])
  const [pupils, setPupils] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [selectedQuarter, setSelectedQuarter] = useState<string>('1')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [classGrades, setClassGrades] = useState<{[key: string]: number}>({})
  const [classAverages, setClassAverages] = useState<ClassAverages[]>([])
  const [viewMode, setViewMode] = useState<'entry' | 'view' | 'averages'>('entry')
  const [isEditingClass, setIsEditingClass] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GradeFormData>({
    resolver: zodResolver(gradeSchema),
  })

  useEffect(() => {
    fetchData()
  }, [selectedGrade, selectedSection, selectedQuarter, selectedSubject])

  useEffect(() => {
    if (viewMode === 'averages') {
      calculateClassAverages()
    }
  }, [viewMode, pupils, grades])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      // Fetch pupils based on filters
      let pupilsQuery = supabase
        .from('pupils')
        .select('*')
        .eq('archived', false)

      if (selectedGrade) {
        pupilsQuery = pupilsQuery.eq('grade_level', selectedGrade)
      }

      if (selectedSection) {
        pupilsQuery = pupilsQuery.eq('section', selectedSection)
      }

      // For teachers, get only their assigned classes
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

      const { data: pupilsData, error: pupilsError } = await pupilsQuery.order('last_name')
      
      if (pupilsError) throw pupilsError
      setPupils(pupilsData || [])

      // Fetch subjects
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

      const { data: subjectsData, error: subjectsError } = await subjectsQuery
      if (subjectsError) throw subjectsError
      setSubjects(subjectsData || [])

      // Fetch grades for the selected filters
      if (pupilsData && pupilsData.length > 0 && selectedSubject && selectedQuarter) {
        const pupilIds = pupilsData.map(pupil => pupil.id)
        
        const { data: gradesData, error: gradesError } = await supabase
          .from('grades')
          .select(`
            *,
            pupils!inner (
              pupil_id,
              first_name,
              last_name,
              middle_name,
              grade_level,
              section,
              profile_picture
            ),
            subjects!inner (
              name,
              code
            )
          `)
          .eq('quarter', selectedQuarter)
          .eq('subject_id', selectedSubject)
          .in('pupil_id', pupilIds)

        if (gradesError) throw gradesError
        setGrades(gradesData || [])

        // Initialize class grades for entry mode
        if (viewMode === 'entry') {
          const initialGrades: {[key: string]: number} = {}
          gradesData?.forEach(grade => {
            initialGrades[grade.pupil_id] = grade.final_grade
          })
          setClassGrades(initialGrades)
        }
      } else {
        setGrades([])
        setClassGrades({})
      }

    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error(error.message || 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateClassAverages = async () => {
    if (!pupils.length) return

    try {
      const averages: ClassAverages[] = []

      for (const pupil of pupils) {
        const quarters = [1, 2, 3, 4]
        const quarterAverages: {[key: string]: number | null} = {}

        for (const quarter of quarters) {
          const { data: pupilGrades } = await supabase
            .from('grades')
            .select('final_grade')
            .eq('pupil_id', pupil.id)
            .eq('quarter', quarter)

          if (pupilGrades && pupilGrades.length > 0) {
            const avg = pupilGrades.reduce((sum, g) => sum + g.final_grade, 0) / pupilGrades.length
            quarterAverages[`q${quarter}_avg`] = Math.round(avg * 100) / 100
          } else {
            quarterAverages[`q${quarter}_avg`] = null
          }
        }

        // Calculate final average from quarterly averages
        const validQuarters = Object.values(quarterAverages).filter(avg => avg !== null) as number[]
        const finalAvg = validQuarters.length > 0 
          ? validQuarters.reduce((sum, avg) => sum + avg, 0) / validQuarters.length
          : null

        averages.push({
          pupil_id: pupil.id,
          pupil_name: `${pupil.last_name}, ${pupil.first_name} ${pupil.middle_name ? pupil.middle_name.charAt(0) + '.' : ''}`.trim(),
          q1_avg: quarterAverages.q1_avg,
          q2_avg: quarterAverages.q2_avg,
          q3_avg: quarterAverages.q3_avg,
          q4_avg: quarterAverages.q4_avg,
          final_avg: finalAvg ? Math.round(finalAvg * 100) / 100 : null,
        })
      }

      setClassAverages(averages)
    } catch (error) {
      console.error('Error calculating averages:', error)
    }
  }

  const handleGradeChange = (pupilId: string, grade: number) => {
    setClassGrades(prev => ({
      ...prev,
      [pupilId]: grade
    }))
  }

  const saveClassGrades = async () => {
    if (!selectedSubject || !selectedQuarter) {
      toast.error('Please select subject and quarter')
      return
    }

    try {
      setIsLoading(true)

      const gradesToSave = Object.entries(classGrades).filter(([_, grade]) => grade > 0)

      for (const [pupilId, finalGrade] of gradesToSave) {
        const gradeData = {
          pupil_id: pupilId,
          subject_id: selectedSubject,
          quarter: parseInt(selectedQuarter),
          final_grade: finalGrade,
          teacher_id: user?.id,
          updated_at: new Date().toISOString(),
        }

        // Check if grade already exists
        const { data: existingGrade, error: checkError } = await supabase
          .from('grades')
          .select('id, final_grade')
          .eq('pupil_id', pupilId)
          .eq('subject_id', selectedSubject)
          .eq('quarter', parseInt(selectedQuarter))
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError
        }

        if (existingGrade) {
          // Update existing grade
          const { error } = await supabase
            .from('grades')
            .update(gradeData)
            .eq('id', existingGrade.id)

          if (error) throw error

          // Log audit event for grade change
          await supabase.from('audit_logs').insert({
            user_id: user?.id,
            action: 'update_grade',
            entity_type: 'grades',
            entity_id: existingGrade.id,
            old_values: { final_grade: existingGrade.final_grade },
            new_values: { final_grade: finalGrade },
          })
        } else {
          // Insert new grade
          const { data: newGrade, error } = await supabase
            .from('grades')
            .insert(gradeData)
            .select()
            .single()

          if (error) throw error

          // Log audit event for new grade
          await supabase.from('audit_logs').insert({
            user_id: user?.id,
            action: 'create_grade',
            entity_type: 'grades',
            entity_id: newGrade.id,
            new_values: gradeData,
          })
        }
      }

      toast.success('Class grades saved successfully')
      setIsEditingClass(false)
      fetchData()
    } catch (error: any) {
      console.error('Error saving grades:', error)
      toast.error(error.message || 'Failed to save grades')
    } finally {
      setIsLoading(false)
    }
  }

  const exportGrades = async () => {
    try {
      if (viewMode === 'averages') {
        // Export averages
        const headers = 'Pupil Name,Q1 Average,Q2 Average,Q3 Average,Q4 Average,Final Average\n'
        const csvContent = classAverages.map(avg => {
          return `"${avg.pupil_name}",${avg.q1_avg || ''},${avg.q2_avg || ''},${avg.q3_avg || ''},${avg.q4_avg || ''},${avg.final_avg || ''}`
        }).join('\n')

        const blob = new Blob([headers + csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `class_averages_Grade${selectedGrade}_${selectedSection}_${formatDate(new Date())}.csv`
        a.click()
      } else {
        // Export current grades
        const headers = 'Pupil ID,Pupil Name,Subject,Quarter,Final Grade,Remarks\n'
        const rows = grades.map(grade => [
          grade.pupils.pupil_id,
          `"${grade.pupils.first_name} ${grade.pupils.last_name}"`,
          grade.subjects.name,
          grade.quarter,
          grade.final_grade,
          `"${grade.remarks || ''}"`
        ])

        const csvContent = [headers, ...rows.map(row => row.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `grades_Q${selectedQuarter}_Grade${selectedGrade || 'All'}_${formatDate(new Date())}.csv`
        a.click()
      }
    } catch (error) {
      console.error('Error exporting grades:', error)
      toast.error('Failed to export grades')
    }
  }

  const filteredPupils = pupils.filter(pupil => {
    if (searchTerm) {
      const fullName = `${pupil.first_name} ${pupil.last_name}`.toLowerCase()
      return fullName.includes(searchTerm.toLowerCase()) ||
             pupil.pupil_id.toLowerCase().includes(searchTerm.toLowerCase())
    }
    return true
  })

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grade Management</h1>
          <p className="text-gray-600">Manage pupil grades and academic performance</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportGrades} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="card">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setViewMode('entry')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'entry'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Grade Entry
          </button>
          <button
            onClick={() => setViewMode('view')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'view'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            View Grades
          </button>
          <button
            onClick={() => setViewMode('averages')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'averages'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Class Averages
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          {viewMode !== 'averages' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quarter</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="input-field"
                >
                  <option value="1">1st Quarter</option>
                  <option value="2">2nd Quarter</option>
                  <option value="3">3rd Quarter</option>
                  <option value="4">4th Quarter</option>
                </select>
              </div>
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
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search pupil..."
                className="input-field pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === 'entry' && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Class Grade Entry - {subjects.find(s => s.id === selectedSubject)?.name} (Q{selectedQuarter})
            </h2>
            {selectedSubject && selectedQuarter && !isEditingClass && (
              <button
                onClick={() => setIsEditingClass(true)}
                className="btn-primary"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Class Grades
              </button>
            )}
            {isEditingClass && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsEditingClass(false)
                    fetchData() // Reset grades
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={saveClassGrades}
                  disabled={isLoading}
                  className="btn-primary"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? 'Saving...' : 'Save All Grades'}
                </button>
              </div>
            )}
          </div>

          {!selectedSubject || !selectedQuarter ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">Please select a subject and quarter to enter grades</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : filteredPupils.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No pupils found for the selected criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pupil
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final Grade
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPupils.map((pupil) => {
                    const currentGrade = classGrades[pupil.id] || ''
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
                                  <span className="text-gray-600 font-medium">
                                    {pupil.first_name.charAt(0)}{pupil.last_name.charAt(0)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-900">
                                {pupil.first_name} {pupil.middle_name ? pupil.middle_name.charAt(0) + '. ' : ''}{pupil.last_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {pupil.pupil_id} • Grade {pupil.grade_level}-{pupil.section}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {isEditingClass ? (
                            <input
                              type="number"
                              min="60"
                              max="100"
                              step="0.01"
                              value={currentGrade}
                              onChange={(e) => handleGradeChange(pupil.id, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="0"
                            />
                          ) : (
                            <span className={`text-lg font-bold ${currentGrade ? getGradeColor(currentGrade) : 'text-gray-400'}`}>
                              {currentGrade || 'No Grade'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {currentGrade ? (
                            <span className={`text-sm font-medium ${getGradeColor(currentGrade)}`}>
                              {getGradeLabel(currentGrade)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">Not Graded</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewMode === 'view' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Grade Records</h2>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : grades.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No grades found for the selected criteria</p>
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
                      Subject
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quarter
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final Grade
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {grades.map((grade) => (
                    <tr key={grade.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {grade.pupils.profile_picture ? (
                              <img 
                                src={grade.pupils.profile_picture} 
                                alt={`${grade.pupils.first_name} ${grade.pupils.last_name}`}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                                <span className="text-gray-600 font-medium">
                                  {grade.pupils.first_name.charAt(0)}{grade.pupils.last_name.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-900">
                              {grade.pupils.first_name} {grade.pupils.middle_name ? grade.pupils.middle_name.charAt(0) + '. ' : ''}{grade.pupils.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {grade.pupils.pupil_id} • Grade {grade.pupils.grade_level}-{grade.pupils.section}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {grade.subjects.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                        Q{grade.quarter}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`text-lg font-bold ${getGradeColor(grade.final_grade)}`}>
                          {grade.final_grade.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`text-sm font-medium ${getGradeColor(grade.final_grade)}`}>
                          {getGradeLabel(grade.final_grade)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewMode === 'averages' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Class Averages - Grade {selectedGrade} {selectedSection && `Section ${selectedSection}`}
          </h2>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : classAverages.length === 0 ? (
            <div className="text-center py-8">
              <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No grades available to calculate averages</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pupil Name
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Q1 Average
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Q2 Average
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Q3 Average
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Q4 Average
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final Average
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {classAverages.map((avg) => (
                    <tr key={avg.pupil_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {avg.pupil_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {avg.q1_avg ? (
                          <span className={`text-sm font-medium ${getGradeColor(avg.q1_avg)}`}>
                            {avg.q1_avg.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {avg.q2_avg ? (
                          <span className={`text-sm font-medium ${getGradeColor(avg.q2_avg)}`}>
                            {avg.q2_avg.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {avg.q3_avg ? (
                          <span className={`text-sm font-medium ${getGradeColor(avg.q3_avg)}`}>
                            {avg.q3_avg.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {avg.q4_avg ? (
                          <span className={`text-sm font-medium ${getGradeColor(avg.q4_avg)}`}>
                            {avg.q4_avg.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {avg.final_avg ? (
                          <span className={`text-lg font-bold ${getGradeColor(avg.final_avg)}`}>
                            {avg.final_avg.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Grades