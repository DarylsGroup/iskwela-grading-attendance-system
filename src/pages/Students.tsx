import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { UserPlus, Edit, Archive, ArchiveRestore, Search, GraduationCap, Upload, Download, Camera, ArrowUp, Users, CheckSquare, Square } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

const pupilSchema = z.object({
  pupil_id: z.string().min(1, 'Pupil ID is required'),
  first_name: z.string().min(2, 'First name is required'),
  last_name: z.string().min(2, 'Last name is required'),
  middle_name: z.string().optional().nullable(),
  grade_level: z.number().min(1).max(6),
  section: z.string().min(1, 'Section is required'),
  parent_id: z.string().optional().nullable(),
  gender: z.enum(['male', 'female']),
  birth_date: z.string().min(1, 'Birth date is required'),
  address: z.string().optional().nullable(),
  is_4ps_beneficiary: z.boolean().default(false),
})

type PupilFormData = z.infer<typeof pupilSchema>

interface Pupil {
  id: string
  pupil_id: string
  first_name: string
  last_name: string
  middle_name: string | null
  grade_level: number
  section: string
  parent_id: string | null
  gender: 'male' | 'female'
  birth_date: string
  address: string | null
  is_4ps_beneficiary: boolean
  profile_picture: string | null
  enrollment_date: string
  created_at: string
  updated_at: string
  archived: boolean
  parent?: {
    id: string
    full_name: string
    email: string
  } | null
}

const Pupils: React.FC = () => {
  const [pupils, setPupils] = useState<Pupil[]>([])
  const [filteredPupils, setFilteredPupils] = useState<Pupil[]>([])
  const [parents, setParents] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [showArchived, setShowArchived] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false)
  const [editingPupil, setEditingPupil] = useState<Pupil | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState<string>('')
  const [selectedPupilsForPromotion, setSelectedPupilsForPromotion] = useState<Set<string>>(new Set())
  const [promotionFromGrade, setPromotionFromGrade] = useState<number | null>(null)
  const [promotionToGrade, setPromotionToGrade] = useState<number | null>(null)
  const [promotionToSection, setPromotionToSection] = useState<string>('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PupilFormData>({
    resolver: zodResolver(pupilSchema),
  })

  useEffect(() => {
    fetchPupils()
    fetchParents()
  }, [])

  useEffect(() => {
    filterPupils()
  }, [pupils, searchTerm, selectedGrade, selectedSection, showArchived])

  const fetchPupils = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('pupils')
        .select(`
          *,
          parent:users!parent_id (
            id,
            full_name,
            email
          )
        `)
        .order('grade_level', { ascending: true })
        .order('section', { ascending: true })
        .order('last_name', { ascending: true })

      if (error) throw error
      setPupils(data || [])
    } catch (error) {
      console.error('Error fetching pupils:', error)
      toast.error('Failed to load pupils')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchParents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'parent')
        .neq('archived', true)
        .order('full_name')

      if (error) throw error
      setParents(data || [])
    } catch (error) {
      console.error('Error fetching parents:', error)
    }
  }

  const filterPupils = () => {
    let filtered = pupils

    // Filter by archived status
    if (showArchived) {
      filtered = filtered.filter(pupil => pupil.archived === true)
    } else {
      filtered = filtered.filter(pupil => pupil.archived !== true)
    }

    if (searchTerm) {
      filtered = filtered.filter(pupil =>
        `${pupil.first_name} ${pupil.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pupil.pupil_id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedGrade) {
      filtered = filtered.filter(pupil => pupil.grade_level === selectedGrade)
    }

    if (selectedSection) {
      filtered = filtered.filter(pupil => pupil.section.toLowerCase().includes(selectedSection.toLowerCase()))
    }

    setFilteredPupils(filtered)
  }

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setProfilePicture(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadProfilePicture = async (pupilId: string): Promise<string | null> => {
    if (!profilePicture) return null

    try {
      const fileExt = profilePicture.name.split('.').pop()
      const fileName = `${pupilId}-${Date.now()}.${fileExt}`
      const filePath = `pupil-pictures/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('pupil-images')
        .upload(filePath, profilePicture)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('pupil-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      return null
    }
  }

  const onSubmit = async (data: PupilFormData) => {
    try {
      setIsLoading(true)

      const pupilData = {
        pupil_id: data.pupil_id,
        first_name: data.first_name,
        last_name: data.last_name,
        middle_name: data.middle_name || null,
        grade_level: data.grade_level,
        section: data.section,
        parent_id: data.parent_id || null,
        gender: data.gender,
        birth_date: data.birth_date,
        address: data.address || null,
        is_4ps_beneficiary: data.is_4ps_beneficiary,
        updated_at: new Date().toISOString(),
      }

      let pupilId = editingPupil?.id

      if (editingPupil) {
        // Update existing pupil
        const { error } = await supabase
          .from('pupils')
          .update(pupilData)
          .eq('id', editingPupil.id)

        if (error) throw error
        toast.success('Pupil updated successfully')
      } else {
        // Create new pupil
        const { data: newPupil, error } = await supabase
          .from('pupils')
          .insert({
            ...pupilData,
            enrollment_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) throw error
        pupilId = newPupil.id
        toast.success('Pupil created successfully')
      }

      // Upload profile picture if provided
      if (profilePicture && pupilId) {
        const pictureUrl = await uploadProfilePicture(pupilId)
        if (pictureUrl) {
          await supabase
            .from('pupils')
            .update({ profile_picture: pictureUrl })
            .eq('id', pupilId)
        }
      }

      // Log audit event
      await supabase.from('audit_logs').insert({
        user_id: 'current_user_id', // Replace with actual user ID
        action: editingPupil ? 'update_pupil' : 'create_pupil',
        entity_type: 'pupils',
        entity_id: pupilId,
        old_values: editingPupil || null,
        new_values: pupilData,
      })

      fetchPupils()
      handleCloseModal()
    } catch (error: any) {
      console.error('Error saving pupil:', error)
      toast.error(error.message || 'Failed to save pupil')
    } finally {
      setIsLoading(false)
    }
  }

  const handleArchive = async (pupilId: string, archive: boolean = true) => {
    const action = archive ? 'archive' : 'restore'
    if (!window.confirm(`Are you sure you want to ${action} this pupil?`)) return

    try {
      setIsLoading(true)
      
      const { error } = await supabase
        .from('pupils')
        .update({ 
          archived: archive,
          updated_at: new Date().toISOString()
        })
        .eq('id', pupilId)

      if (error) throw error

      // Log audit event
      await supabase.from('audit_logs').insert({
        user_id: 'current_user_id',
        action: archive ? 'archive_pupil' : 'restore_pupil',
        entity_type: 'pupils',
        entity_id: pupilId,
        old_values: { archived: !archive },
        new_values: { archived: archive },
      })

      toast.success(`Pupil ${archive ? 'archived' : 'restored'} successfully`)
      fetchPupils()
    } catch (error: any) {
      console.error(`Error ${action}ing pupil:`, error)
      toast.error(error.message || `Failed to ${action} pupil`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (pupil: Pupil) => {
    setEditingPupil(pupil)
    setProfilePicturePreview(pupil.profile_picture || '')
    reset({
      pupil_id: pupil.pupil_id,
      first_name: pupil.first_name,
      last_name: pupil.last_name,
      middle_name: pupil.middle_name || undefined,
      grade_level: pupil.grade_level,
      section: pupil.section,
      parent_id: pupil.parent_id || undefined,
      gender: pupil.gender,
      birth_date: pupil.birth_date,
      address: pupil.address || undefined,
      is_4ps_beneficiary: pupil.is_4ps_beneficiary,
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setIsPromotionModalOpen(false)
    setEditingPupil(null)
    setProfilePicture(null)
    setProfilePicturePreview('')
    setSelectedPupilsForPromotion(new Set())
    setPromotionFromGrade(null)
    setPromotionToGrade(null)
    setPromotionToSection('')
    reset()
  }

  const handlePromotionGradeSelect = (grade: number) => {
    setPromotionFromGrade(grade)
    setSelectedPupilsForPromotion(new Set())
    // Auto-select all pupils from the selected grade
    const pupilsInGrade = filteredPupils.filter(p => p.grade_level === grade && !p.archived)
    setSelectedPupilsForPromotion(new Set(pupilsInGrade.map(p => p.id)))
  }

  const handlePupilSelectionToggle = (pupilId: string) => {
    const newSelection = new Set(selectedPupilsForPromotion)
    if (newSelection.has(pupilId)) {
      newSelection.delete(pupilId)
    } else {
      newSelection.add(pupilId)
    }
    setSelectedPupilsForPromotion(newSelection)
  }

  const handlePromotePupils = async () => {
    if (!promotionToGrade || !promotionToSection || selectedPupilsForPromotion.size === 0) {
      toast.error('Please select destination grade, section, and pupils to promote')
      return
    }

    try {
      setIsLoading(true)

      const selectedPupilIds = Array.from(selectedPupilsForPromotion)
      
      // Update all selected pupils
      const { error } = await supabase
        .from('pupils')
        .update({
          grade_level: promotionToGrade,
          section: promotionToSection,
          updated_at: new Date().toISOString(),
        })
        .in('id', selectedPupilIds)

      if (error) throw error

      // Log audit events for each promoted pupil
      for (const pupilId of selectedPupilIds) {
        await supabase.from('audit_logs').insert({
          user_id: 'current_user_id',
          action: 'promote_pupil',
          entity_type: 'pupils',
          entity_id: pupilId,
          old_values: { grade_level: promotionFromGrade },
          new_values: { grade_level: promotionToGrade, section: promotionToSection },
        })
      }

      toast.success(`Successfully promoted ${selectedPupilIds.length} pupils to Grade ${promotionToGrade} - ${promotionToSection}`)
      fetchPupils()
      handleCloseModal()
    } catch (error: any) {
      console.error('Error promoting pupils:', error)
      toast.error(error.message || 'Failed to promote pupils')
    } finally {
      setIsLoading(false)
    }
  }

  const exportPupils = async () => {
    try {
      const csvContent = filteredPupils.map(pupil => {
        return [
          pupil.pupil_id,
          pupil.last_name,
          pupil.first_name,
          pupil.middle_name || '',
          pupil.grade_level,
          pupil.section,
          pupil.gender,
          pupil.birth_date,
          pupil.is_4ps_beneficiary ? 'Yes' : 'No',
          pupil.parent?.full_name || '',
          pupil.parent?.email || ''
        ].join(',')
      }).join('\n')

      const headers = 'Pupil ID,Last Name,First Name,Middle Name,Grade Level,Section,Gender,Birth Date,4Ps Beneficiary,Parent Name,Parent Email\n'
      const blob = new Blob([headers + csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pupils_Grade${selectedGrade || 'All'}_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
    } catch (error) {
      console.error('Error exporting pupils:', error)
      toast.error('Failed to export pupils')
    }
  }

  const pupilsForPromotion = promotionFromGrade 
    ? filteredPupils.filter(p => p.grade_level === promotionFromGrade && !p.archived)
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Pupil Management</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setIsPromotionModalOpen(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <ArrowUp className="w-4 h-4" />
            Promote Pupils
          </button>
          <button onClick={exportPupils} className="btn-secondary">
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Pupil
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or ID..."
                className="input-field pl-10"
              />
            </div>
          </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={showArchived ? 'archived' : 'active'}
              onChange={(e) => setShowArchived(e.target.value === 'archived')}
              className="input-field"
            >
              <option value="active">Active Pupils</option>
              <option value="archived">Archived Pupils</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full">
              <p className="text-sm font-medium text-gray-700 mb-2">Total: {filteredPupils.length}</p>
              <div className="text-xs text-gray-500">
                4P's: {filteredPupils.filter(p => p.is_4ps_beneficiary).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pupils Table */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pupil ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade & Section
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gender
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    4P's
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPupils.map((pupil) => (
                  <tr key={pupil.id} className={pupil.archived ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {pupil.pupil_id}
                    </td>
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
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <GraduationCap className="w-5 h-5 text-primary-600" />
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {pupil.first_name} {pupil.middle_name ? pupil.middle_name.charAt(0) + '. ' : ''}{pupil.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            Born: {new Date(pupil.birth_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      Grade {pupil.grade_level} - {pupil.section}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                      {pupil.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pupil.is_4ps_beneficiary ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          Yes
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {pupil.parent ? (
                        <div>
                          <div>{pupil.parent.full_name}</div>
                          <div className="text-xs text-gray-400">{pupil.parent.email}</div>
                        </div>
                      ) : (
                        'No parent assigned'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(pupil)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Edit Pupil"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {pupil.archived ? (
                          <button
                            onClick={() => handleArchive(pupil.id, false)}
                            className="text-green-600 hover:text-green-900"
                            title="Restore Pupil"
                          >
                            <ArchiveRestore className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchive(pupil.id, true)}
                            className="text-orange-600 hover:text-orange-900"
                            title="Archive Pupil"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Pupil Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCloseModal}></div>
            
            <div className="relative bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {editingPupil ? 'Edit Pupil' : 'Add New Pupil'}
              </h2>
              
              <div className="space-y-4">
                {/* Profile Picture Upload */}
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200">
                      {profilePicturePreview ? (
                        <img
                          src={profilePicturePreview}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <GraduationCap className="w-12 h-12" />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-primary-600 text-white p-2 rounded-full cursor-pointer hover:bg-primary-700">
                      <Camera className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePictureChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Upload pupil's photo</p>
                    <p className="text-xs text-gray-500">Recommended: 300x300px, max 2MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pupil ID (LRN)
                    </label>
                    <input
                      {...register('pupil_id')}
                      type="text"
                      className="input-field"
                      placeholder="Enter pupil ID/LRN"
                    />
                    {errors.pupil_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.pupil_id.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select {...register('gender')} className="input-field">
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      {...register('first_name')}
                      type="text"
                      className="input-field"
                      placeholder="First name"
                    />
                    {errors.first_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Middle Name
                    </label>
                    <input
                      {...register('middle_name')}
                      type="text"
                      className="input-field"
                      placeholder="Middle name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      {...register('last_name')}
                      type="text"
                      className="input-field"
                      placeholder="Last name"
                    />
                    {errors.last_name && (
                      <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grade Level
                    </label>
                    <select
                      {...register('grade_level', { valueAsNumber: true })}
                      className="input-field"
                    >
                      {[1, 2, 3, 4, 5, 6].map(grade => (
                        <option key={grade} value={grade}>Grade {grade}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Section
                    </label>
                    <input
                      {...register('section')}
                      type="text"
                      className="input-field"
                      placeholder="Section"
                    />
                    {errors.section && (
                      <p className="mt-1 text-sm text-red-600">{errors.section.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Birth Date
                    </label>
                    <input
                      {...register('birth_date')}
                      type="date"
                      className="input-field"
                    />
                    {errors.birth_date && (
                      <p className="mt-1 text-sm text-red-600">{errors.birth_date.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <textarea
                    {...register('address')}
                    rows={2}
                    className="input-field"
                    placeholder="Complete address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parent (Optional)
                    </label>
                    <select 
                      {...register('parent_id')} 
                      className="input-field"
                      defaultValue=""
                    >
                      <option value="">No parent assigned</option>
                      {parents.map(parent => (
                        <option key={parent.id} value={parent.id}>
                          {parent.full_name} ({parent.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      {...register('is_4ps_beneficiary')}
                      type="checkbox"
                      id="is_4ps_beneficiary"
                      className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                    />
                    <label htmlFor="is_4ps_beneficiary" className="text-sm font-medium text-gray-700">
                      4P's Beneficiary
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    disabled={isLoading}
                    className="btn-primary"
                  >
                    {isLoading ? 'Saving...' : editingPupil ? 'Update' : 'Create'} Pupil
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Promotion Modal */}
      {isPromotionModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCloseModal}></div>
            
            <div className="relative bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Promote Pupils to Next Grade Level
              </h2>
              
              <div className="space-y-6">
                {/* Step 1: Select Grade to Promote From */}
                <div>
                  <h3 className="text-md font-medium text-gray-900 mb-3">Step 1: Select Grade Level to Promote From</h3>
                  <div className="grid grid-cols-6 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(grade => (
                      <button
                        key={grade}
                        onClick={() => handlePromotionGradeSelect(grade)}
                        className={`p-3 rounded-lg border text-center ${
                          promotionFromGrade === grade
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium">Grade {grade}</div>
                        <div className="text-sm text-gray-500">
                          {pupils.filter(p => p.grade_level === grade && !p.archived).length} pupils
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Select Destination */}
                {promotionFromGrade && (
                  <div>
                    <h3 className="text-md font-medium text-gray-900 mb-3">Step 2: Select Destination</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Promote to Grade Level
                        </label>
                        <select
                          value={promotionToGrade || ''}
                          onChange={(e) => setPromotionToGrade(e.target.value ? parseInt(e.target.value) : null)}
                          className="input-field"
                        >
                          <option value="">Select grade</option>
                          {[promotionFromGrade + 1, promotionFromGrade + 2].filter(g => g <= 7).map(grade => (
                            <option key={grade} value={grade}>
                              {grade <= 6 ? `Grade ${grade}` : 'Graduated'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Section
                        </label>
                        <input
                          type="text"
                          value={promotionToSection}
                          onChange={(e) => setPromotionToSection(e.target.value)}
                          className="input-field"
                          placeholder="Enter section name"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Select Pupils */}
                {promotionFromGrade && pupilsForPromotion.length > 0 && (
                  <div>
                    <h3 className="text-md font-medium text-gray-900 mb-3">
                      Step 3: Select Pupils to Promote ({selectedPupilsForPromotion.size} selected)
                    </h3>
                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left">
                              <button
                                onClick={() => {
                                  if (selectedPupilsForPromotion.size === pupilsForPromotion.length) {
                                    setSelectedPupilsForPromotion(new Set())
                                  } else {
                                    setSelectedPupilsForPromotion(new Set(pupilsForPromotion.map(p => p.id)))
                                  }
                                }}
                                className="flex items-center space-x-2"
                              >
                                {selectedPupilsForPromotion.size === pupilsForPromotion.length ? (
                                  <CheckSquare className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="text-xs font-medium text-gray-500 uppercase">Select All</span>
                              </button>
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Pupil ID
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Section
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pupilsForPromotion.map(pupil => (
                            <tr key={pupil.id}>
                              <td className="px-4 py-2">
                                <button
                                  onClick={() => handlePupilSelectionToggle(pupil.id)}
                                  className="flex items-center"
                                >
                                  {selectedPupilsForPromotion.has(pupil.id) ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-gray-400" />
                                  )}
                                </button>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {pupil.pupil_id}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {pupil.first_name} {pupil.last_name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500">
                                {pupil.section}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePromotePupils}
                    disabled={isLoading || !promotionToGrade || !promotionToSection || selectedPupilsForPromotion.size === 0}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <ArrowUp className="w-4 h-4" />
                    {isLoading ? 'Promoting...' : `Promote ${selectedPupilsForPromotion.size} Pupils`}
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

export default Pupils