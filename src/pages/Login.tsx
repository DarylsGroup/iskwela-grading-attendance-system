import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Lock, Eye, EyeOff, User, Mail, Phone, MapPin, FileText, Upload, ArrowLeft, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'

// Schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const registerSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string().min(6, 'Please confirm your password'),
  phone_number: z.string().optional(),
  address: z.string().optional(),
  role: z.enum(['teacher', 'parent'], { required_error: 'Please select a role' }),
  reason_for_application: z.string().min(10, 'Please provide a reason (minimum 10 characters)'),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
})

type LoginFormData = z.infer<typeof loginSchema>
type RegisterFormData = z.infer<typeof registerSchema>

const Login: React.FC = () => {
  const { signIn, user, session } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login')
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [validIdDocument, setValidIdDocument] = useState<File | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null)

  // Form hooks
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  useEffect(() => {
    if (user && session) {
      console.log('Login: User authenticated, redirecting to dashboard')
      navigate('/dashboard', { replace: true })
    }
  }, [user, session, navigate])

  const handleLogin = async (data: LoginFormData) => {
    try {
      setIsLoading(true)
      await signIn(data.email, data.password)
    } catch (error) {
      setIsLoading(false)
    }
  }

  const uploadFile = async (file: File, bucket: string, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
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
      console.error('Error uploading file:', error)
      return null
    }
  }

  const handleRegister = async (data: RegisterFormData) => {
    try {
      setIsLoading(true)

      // Check email availability using the new function
      const { data: availability, error: availabilityError } = await supabase.rpc('check_email_availability', {
        email_to_check: data.email
      })

      if (availabilityError) {
        console.error('Error checking email availability:', availabilityError)
        toast.error('Failed to check email availability')
        return
      }

      if (!availability.available) {
        toast.error(availability.reason)
        return
      }

      // Upload files
      let profilePictureUrl = null
      let validIdDocumentUrl = null

      if (profilePicture) {
        profilePictureUrl = await uploadFile(profilePicture, 'profiles', 'profile_pictures')
      }

      if (validIdDocument) {
        validIdDocumentUrl = await uploadFile(validIdDocument, 'documents', 'valid_ids')
      }

      // Create registration record with password
      const { error } = await supabase
        .from('user_registrations')
        .insert({
          full_name: data.full_name,
          email: data.email,
          password: data.password, // Store password for later use during approval
          phone_number: data.phone_number || null,
          address: data.address || null,
          role: data.role,
          reason_for_application: data.reason_for_application,
          profile_picture: profilePictureUrl,
          valid_id_document: validIdDocumentUrl,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (error) throw error

      toast.success('Registration submitted successfully! Please wait for admin approval.')
      
      // Reset form and switch back to login
      registerForm.reset()
      setProfilePicture(null)
      setValidIdDocument(null)
      setProfilePicturePreview(null)
      setCurrentView('login')
      
    } catch (error: any) {
      console.error('Registration error:', error)
      toast.error(error.message || 'Failed to submit registration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'id') => {
    const file = e.target.files?.[0]
    if (file) {
      if (type === 'profile') {
        setProfilePicture(file)
        const reader = new FileReader()
        reader.onload = (e) => {
          setProfilePicturePreview(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setValidIdDocument(file)
      }
    }
  }

  const switchToRegister = () => {
    setCurrentView('register')
  }

  const switchToLogin = () => {
    setCurrentView('login')
    registerForm.reset()
    setProfilePicture(null)
    setValidIdDocument(null)
    setProfilePicturePreview(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden bg-blue-600 text-white p-4 flex items-center justify-between relative z-50">
        <div className="flex items-center space-x-3">
          <img 
            src={logo}
            alt="iSKWELA Logo" 
            className="w-8 h-8 object-contain"
          />
          <h1 className="text-xl font-bold">iSKWELA</h1>
        </div>
        <div className="text-sm">
          {currentView === 'login' ? 'Login' : 'Register'}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex h-screen lg:h-screen relative overflow-hidden">
        {/* Left Panel - Forms Container */}
        <div className="w-full lg:w-1/2 relative bg-gray-50 pt-16 lg:pt-0">
          {/* Login Form */}
          <div className={`absolute inset-0 flex items-center justify-center p-6 lg:p-8 transition-all duration-700 ease-in-out transform ${
            currentView === 'login' ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
          }`}>
            <div className="w-full max-w-md mx-auto space-y-6 lg:space-y-8 relative z-10">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 animate-slide-in-left">Login</h2>
                <p className="mt-2 text-gray-600 animate-slide-in-left delay-100">Enter your account details</p>
              </div>

              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 lg:space-y-6">
                <div className="animate-fade-in delay-200">
                  <label htmlFor="email" className="block text-gray-700 mb-2 text-sm lg:text-base">
                    Username
                  </label>
                  <input
                    {...loginForm.register('email')}
                    type="email"
                    id="email"
                    className="w-full px-3 py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 focus:-translate-y-1 text-sm lg:text-base bg-transparent"
                    placeholder="Enter your email"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="mt-1 text-sm text-red-600 animate-fade-in">{loginForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="animate-fade-in delay-300">
                  <label htmlFor="password" className="block text-gray-700 mb-2 text-sm lg:text-base">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      {...loginForm.register('password')}
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      className="w-full px-3 py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 focus:-translate-y-1 text-sm lg:text-base bg-transparent"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110 z-20"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="mt-1 text-sm text-red-600 animate-fade-in">{loginForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="text-right animate-fade-in delay-400">
                  <a href="#" className="text-xs lg:text-sm text-gray-500 hover:text-gray-700 transition-colors duration-200">
                    Forgot Password?
                  </a>
                </div>

                <div className="pt-4 animate-fade-in delay-500">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 text-sm lg:text-base relative z-30 ${
                      isLoading ? 'animate-pulse' : ''
                    }`}
                  >
                    {isLoading ? 'Signing in...' : 'Login'}
                  </button>
                </div>
              </form>

              <div className="text-center mt-4 lg:mt-6 animate-fade-in delay-600">
                <p className="text-gray-600 text-sm lg:text-base">
                  Don't have an account?{' '}
                  <button
                    onClick={switchToRegister}
                    className="text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200 relative z-30"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* Registration Form */}
          <div className={`absolute inset-0 flex items-center justify-center p-6 lg:p-8 transition-all duration-700 ease-in-out transform ${
            currentView === 'register' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}>
            <div className="w-full max-w-md mx-auto space-y-4 lg:space-y-6 relative z-10">
              <div>
                <button
                  onClick={switchToLogin}
                  className="flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors duration-200 relative z-30"
                >
                  <ArrowLeft size={18} className="mr-2" />
                  <span className="text-sm lg:text-base">Back to Login</span>
                </button>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Register</h2>
                <p className="mt-2 text-gray-600 text-sm lg:text-base">Create your account and wait for admin approval</p>
              </div>

              <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                <div className="max-h-72 sm:max-h-80 lg:max-h-96 overflow-y-auto pr-2 space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      <User size={14} className="inline mr-2" />
                      Full Name
                    </label>
                    <input
                      {...registerForm.register('full_name')}
                      type="text"
                      className="w-full px-3 py-2 lg:py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 focus:-translate-y-1 text-sm lg:text-base bg-transparent"
                      placeholder="Enter your full name"
                    />
                    {registerForm.formState.errors.full_name && (
                      <p className="mt-1 text-xs lg:text-sm text-red-600">{registerForm.formState.errors.full_name.message}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      <Mail size={14} className="inline mr-2" />
                      Email
                    </label>
                    <input
                      {...registerForm.register('email')}
                      type="email"
                      className="w-full px-3 py-2 lg:py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 focus:-translate-y-1 text-sm lg:text-base bg-transparent"
                      placeholder="Enter your email"
                    />
                    {registerForm.formState.errors.email && (
                      <p className="mt-1 text-xs lg:text-sm text-red-600">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      <Lock size={14} className="inline mr-2" />
                      Password
                    </label>
                    <div className="relative">
                      <input
                        {...registerForm.register('password')}
                        type={showRegisterPassword ? 'text' : 'password'}
                        className="w-full px-3 py-2 lg:py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 focus:-translate-y-1 text-sm lg:text-base bg-transparent"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110 z-20"
                      >
                        {showRegisterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {registerForm.formState.errors.password && (
                      <p className="mt-1 text-xs lg:text-sm text-red-600">{registerForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      <Lock size={14} className="inline mr-2" />
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        {...registerForm.register('confirm_password')}
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="w-full px-3 py-2 lg:py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 focus:-translate-y-1 text-sm lg:text-base bg-transparent"
                        placeholder="Confirm your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110 z-20"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {registerForm.formState.errors.confirm_password && (
                      <p className="mt-1 text-xs lg:text-sm text-red-600">{registerForm.formState.errors.confirm_password.message}</p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      <Phone size={14} className="inline mr-2" />
                      Phone Number (Optional)
                    </label>
                    <input
                      {...registerForm.register('phone_number')}
                      type="tel"
                      className="w-full px-3 py-2 lg:py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 focus:-translate-y-1 text-sm lg:text-base bg-transparent"
                      placeholder="Enter your phone number"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      <MapPin size={14} className="inline mr-2" />
                      Address (Optional)
                    </label>
                    <input
                      {...registerForm.register('address')}
                      type="text"
                      className="w-full px-3 py-2 lg:py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 focus:-translate-y-1 text-sm lg:text-base bg-transparent"
                      placeholder="Enter your address"
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      <UserPlus size={14} className="inline mr-2" />
                      Role
                    </label>
                    <select
                      {...registerForm.register('role')}
                      className="w-full px-3 py-2 lg:py-3 border-b border-gray-300 focus:border-blue-500 outline-none transition-all duration-300 bg-transparent text-sm lg:text-base"
                    >
                      <option value="">Select your role</option>
                      <option value="teacher">Teacher</option>
                      <option value="parent">Parent</option>
                    </select>
                    {registerForm.formState.errors.role && (
                      <p className="mt-1 text-xs lg:text-sm text-red-600">{registerForm.formState.errors.role.message}</p>
                    )}
                  </div>

                  {/* Reason for Application */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      <FileText size={14} className="inline mr-2" />
                      Reason for Application
                    </label>
                    <textarea
                      {...registerForm.register('reason_for_application')}
                      rows={2}
                      className="w-full px-3 py-2 lg:py-3 border border-gray-300 rounded-md focus:border-blue-500 outline-none transition-all duration-300 resize-none text-sm lg:text-base"
                      placeholder="Please explain why you want to register for this account"
                    />
                    {registerForm.formState.errors.reason_for_application && (
                      <p className="mt-1 text-xs lg:text-sm text-red-600">{registerForm.formState.errors.reason_for_application.message}</p>
                    )}
                  </div>

                  {/* Profile Picture */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      Profile Picture (Optional)
                    </label>
                    <div className="flex items-center space-x-3">
                      {profilePicturePreview ? (
                        <img
                          src={profilePicturePreview}
                          alt="Profile Preview"
                          className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover border-2 border-gray-300"
                        />
                      ) : (
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-300">
                          <User size={16} className="text-gray-400" />
                        </div>
                      )}
                      <label className="cursor-pointer bg-blue-50 text-blue-600 px-2 py-1 lg:px-3 lg:py-2 rounded-md hover:bg-blue-100 transition-colors duration-200 flex items-center text-xs lg:text-sm relative z-30">
                        <Upload size={12} className="mr-1 lg:mr-2" />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'profile')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Valid ID Document */}
                  <div>
                    <label className="block text-gray-700 mb-2 text-sm lg:text-base">
                      Valid ID Document (Optional)
                    </label>
                    <div className="flex items-center space-x-3">
                      <label className="cursor-pointer bg-green-50 text-green-600 px-2 py-1 lg:px-3 lg:py-2 rounded-md hover:bg-green-100 transition-colors duration-200 flex items-center text-xs lg:text-sm relative z-30">
                        <Upload size={12} className="mr-1 lg:mr-2" />
                        {validIdDocument ? 
                          (validIdDocument.name.length > 12 ? 
                            validIdDocument.name.substring(0, 12) + '...' : 
                            validIdDocument.name) : 
                          'Upload ID'
                        }
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileChange(e, 'id')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 text-sm lg:text-base relative z-30 ${
                      isLoading ? 'animate-pulse' : ''
                    }`}
                  >
                    {isLoading ? 'Submitting...' : 'Submit Registration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Right Panel - Welcome Screen for Login */}
        <div className={`hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 to-blue-700 relative overflow-hidden transition-all duration-700 ease-in-out transform ${
          currentView === 'login' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}>
          <div className="h-full flex items-center justify-center w-full">
            <div className="relative z-10 text-center text-white px-8">
              <div className="mb-8 flex justify-center animate-bounce-in">
                <div className="w-32 h-32 xl:w-40 xl:h-40 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform duration-300 hover:scale-105">
                  <img 
                    src={logo}
                    alt="iSKWELA Logo" 
                    className="w-24 h-24 xl:w-32 xl:h-32 object-contain animate-fade-in"
                  />
                </div>
              </div>
              <h1 className="text-4xl xl:text-5xl font-bold mb-2 animate-slide-in-up delay-200">Welcome</h1>
              <p className="text-2xl xl:text-3xl mb-8 animate-slide-in-up delay-300">to iSKWELA</p>
              <p className="text-base xl:text-lg opacity-90 animate-fade-in delay-400">
                Academic Grade Management and<br />
                Monitoring System for Anonang-Naguilian Community School
              </p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 animate-wave">
              <svg viewBox="0 0 1440 320" className="w-full">
                <path fill="rgba(255,255,255,0.1)" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,176C384,171,480,181,576,202.7C672,224,768,256,864,261.3C960,267,1056,245,1152,218.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
              </svg>
            </div>
          </div>
        </div>

        {/* Right Panel - Welcome Screen for Register */}
        <div className={`hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 to-blue-700 absolute top-0 right-0 h-full items-center justify-center transition-all duration-700 ease-in-out transform ${
          currentView === 'register' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}>
          <div className="relative z-10 text-center text-white px-8">
            <div className="mb-8 flex justify-center animate-bounce-in">
              <div className="w-32 h-32 xl:w-40 xl:h-40 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm transition-transform duration-300 hover:scale-105">
                <img 
                  src={logo}
                  alt="iSKWELA Logo" 
                  className="w-24 h-24 xl:w-32 xl:h-32 object-contain animate-fade-in"
                />
              </div>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold mb-2 animate-slide-in-up delay-200">Join Us</h1>
            <p className="text-2xl xl:text-3xl mb-8 animate-slide-in-up delay-300">at iSKWELA</p>
            <p className="text-base xl:text-lg opacity-90 animate-fade-in delay-400">
              Submit your registration and wait for admin approval to access the system
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 animate-wave">
            <svg viewBox="0 0 1440 320" className="w-full">
              <path fill="rgba(255,255,255,0.1)" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,176C384,171,480,181,576,202.7C672,224,768,256,864,261.3C960,267,1056,245,1152,218.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login