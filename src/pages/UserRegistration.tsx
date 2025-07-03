import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, User, Mail, Lock, Phone, MapPin, Users, GraduationCap, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

const registrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
  full_name: z.string().min(2, 'Full name is required'),
  role: z.enum(['parent', 'teacher']),
  phone_number: z.string().min(10, 'Valid phone number is required'),
  address: z.string().min(5, 'Address is required'),
  
  // Parent-specific fields
  occupation: z.string().optional(),
  emergency_contact: z.string().optional(),
  emergency_phone: z.string().optional(),
  
  // Teacher-specific fields
  employee_id: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  specialization: z.string().optional(),
  education_level: z.string().optional(),
  years_experience: z.number().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => {
  if (data.role === 'teacher') {
    return data.employee_id && data.department && data.position
  }
  return true
}, {
  message: "All teacher fields are required",
  path: ["employee_id"],
}).refine((data) => {
  if (data.role === 'parent') {
    return data.occupation && data.emergency_contact && data.emergency_phone
  }
  return true
}, {
  message: "All parent fields are required",
  path: ["occupation"],
})

type RegistrationFormData = z.infer<typeof registrationSchema>

const UserRegistration: React.FC = () => {
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string>('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'parent' | 'teacher'>('parent')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      role: 'parent',
    }
  })

  const watchedRole = watch('role')

  React.useEffect(() => {
    setSelectedRole(watchedRole)
  }, [watchedRole])

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Image size must be less than 5MB')
        return
      }
      
      setProfilePicture(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfilePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadProfilePicture = async (): Promise<string | null> => {
    if (!profilePicture) return null

    try {
      const fileExt = profilePicture.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
      const filePath = `profile-pictures/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, profilePicture)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      return null
    }
  }

  const onSubmit = async (data: RegistrationFormData) => {
    try {
      setIsSubmitting(true)
      
      // Upload profile picture if provided
      const profilePictureUrl = await uploadProfilePicture()

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            role: data.role,
          }
        }
      })

      if (authError) throw authError

      if (authData.user) {
        // Create user profile
        const userProfile = {
          id: authData.user.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          phone_number: data.phone_number,
          address: data.address,
          profile_picture: profilePictureUrl,
          is_verified: false, // Requires admin approval
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const { error: profileError } = await supabase
          .from('users')
          .insert(userProfile)

        if (profileError) throw profileError

        // Create role-specific profile
        if (data.role === 'parent') {
          const parentProfile = {
            user_id: authData.user.id,
            occupation: data.occupation,
            emergency_contact: data.emergency_contact,
            emergency_phone: data.emergency_phone,
          }

          const { error: parentError } = await supabase
            .from('parent_profiles')
            .insert(parentProfile)

          if (parentError) console.error('Parent profile error:', parentError)
        } else if (data.role === 'teacher') {
          const teacherProfile = {
            user_id: authData.user.id,
            employee_id: data.employee_id,
            department: data.department,
            position: data.position,
            specialization: data.specialization,
            education_level: data.education_level,
            years_experience: data.years_experience,
          }

          const { error: teacherError } = await supabase
            .from('teacher_profiles')
            .insert(teacherProfile)

          if (teacherError) console.error('Teacher profile error:', teacherError)
        }

        // Send notification to admins
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .eq('is_verified', true)

        if (admins) {
          const notifications = admins.map(admin => ({
            recipient_id: admin.id,
            type: 'user_registration',
            title: 'New User Registration',
            message: `${data.full_name} (${data.role}) has registered and is waiting for approval.`,
            created_at: new Date().toISOString(),
          }))

          await supabase.from('notifications').insert(notifications)
        }

        // Log audit event
        await supabase.from('audit_logs').insert({
          user_id: authData.user.id,
          action: 'user_registration',
          entity_type: 'users',
          entity_id: authData.user.id,
          new_values: userProfile,
        })

        toast.success('Registration submitted successfully! Please wait for admin approval.')
        
        // Sign out the user since they need approval
        await supabase.auth.signOut()
        
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      toast.error(error.message || 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">User Registration</h2>
            <p className="mt-2 text-gray-600">
              Register for Anonang-Naguilian Community School System
            </p>
          </div>

          <div className="space-y-6">
            {/* Profile Picture */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                  {profilePreview ? (
                    <img src={profilePreview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-16 h-16 text-gray-400" />
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
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Registration Type</label>
              <div className="grid grid-cols-2 gap-4">
                <label className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedRole === 'parent' 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    {...register('role')}
                    type="radio"
                    value="parent"
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center">
                    <Users className="w-8 h-8 mb-2 text-primary-600" />
                    <span className="font-medium">Parent</span>
                    <span className="text-sm text-gray-500">Register as a parent/guardian</span>
                  </div>
                </label>
                <label className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedRole === 'teacher' 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    {...register('role')}
                    type="radio"
                    value="teacher"
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center">
                    <GraduationCap className="w-8 h-8 mb-2 text-primary-600" />
                    <span className="font-medium">Teacher</span>
                    <span className="text-sm text-gray-500">Register as a teacher/staff</span>
                  </div>
                </label>
              </div>
              {errors.role && (
                <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
              )}
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('full_name')}
                    type="text"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Enter your full name"
                  />
                </div>
                {errors.full_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('phone_number')}
                    type="tel"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="09XX XXX XXXX"
                  />
                </div>
                {errors.phone_number && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  {...register('email')}
                  type="email"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Complete Address</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <textarea
                  {...register('address')}
                  rows={3}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter your complete address"
                />
              </div>
              {errors.address && (
                <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
              )}
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>
            </div>

            {/* Role-specific Fields */}
            {selectedRole === 'parent' && (
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900">Parent Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Occupation</label>
                    <input
                      {...register('occupation')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Your occupation"
                    />
                    {errors.occupation && (
                      <p className="mt-1 text-sm text-red-600">{errors.occupation.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact Name</label>
                    <input
                      {...register('emergency_contact')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Emergency contact person"
                    />
                    {errors.emergency_contact && (
                      <p className="mt-1 text-sm text-red-600">{errors.emergency_contact.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Emergency Contact Phone</label>
                    <input
                      {...register('emergency_phone')}
                      type="tel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Emergency contact phone number"
                    />
                    {errors.emergency_phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.emergency_phone.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedRole === 'teacher' && (
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900">Teacher Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Employee ID</label>
                    <input
                      {...register('employee_id')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Your employee ID"
                    />
                    {errors.employee_id && (
                      <p className="mt-1 text-sm text-red-600">{errors.employee_id.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <select
                      {...register('department')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select Department</option>
                      <option value="Grade 1">Grade 1</option>
                      <option value="Grade 2">Grade 2</option>
                      <option value="Grade 3">Grade 3</option>
                      <option value="Grade 4">Grade 4</option>
                      <option value="Grade 5">Grade 5</option>
                      <option value="Grade 6">Grade 6</option>
                      <option value="Special Education">Special Education</option>
                      <option value="Administration">Administration</option>
                    </select>
                    {errors.department && (
                      <p className="mt-1 text-sm text-red-600">{errors.department.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                    <select
                      {...register('position')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select Position</option>
                      <option value="Teacher I">Teacher I</option>
                      <option value="Teacher II">Teacher II</option>
                      <option value="Teacher III">Teacher III</option>
                      <option value="Master Teacher I">Master Teacher I</option>
                      <option value="Master Teacher II">Master Teacher II</option>
                      <option value="Principal">Principal</option>
                      <option value="Assistant Principal">Assistant Principal</option>
                      <option value="Guidance Counselor">Guidance Counselor</option>
                    </select>
                    {errors.position && (
                      <p className="mt-1 text-sm text-red-600">{errors.position.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
                    <input
                      {...register('specialization')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Your teaching specialization"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Education Level</label>
                    <select
                      {...register('education_level')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select Education Level</option>
                      <option value="Bachelor's Degree">Bachelor's Degree</option>
                      <option value="Master's Degree">Master's Degree</option>
                      <option value="Doctorate">Doctorate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience</label>
                    <input
                      {...register('years_experience', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      max="50"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Years of teaching experience"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="w-full bg-primary-600 text-white py-3 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting Registration...' : 'Submit Registration'}
              </button>
            </div>

            <div className="text-center text-sm text-gray-600">
              <p>
                By registering, you agree to our Terms of Service and Privacy Policy.
                Your registration will be reviewed by administrators before approval.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UserRegistration