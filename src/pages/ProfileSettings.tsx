import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Camera, Lock, Mail, User, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

const profileSchema = z.object({
  full_name: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address'),
})

const passwordSchema = z.object({
  current_password: z.string().min(6, 'Current password is required'),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
})

type ProfileFormData = z.infer<typeof profileSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

const ProfileSettings: React.FC = () => {
  const { user } = useAuth()
  const [profilePicture, setProfilePicture] = useState<string>('')
  const [isUploadingPicture, setIsUploadingPicture] = useState(false)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    reset: resetProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  })

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  useEffect(() => {
    if (user) {
      resetProfile({
        full_name: user.full_name,
        email: user.email,
      })
      setProfilePicture(user.profile_picture || '')
    }
  }, [user, resetProfile])

  const handleProfileUpdate = async (data: ProfileFormData) => {
    try {
      setIsUpdatingProfile(true)

      const { error } = await supabase
        .from('users')
        .update({
          full_name: data.full_name,
          email: data.email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id)

      if (error) throw error

      // Update auth email if changed
      if (data.email !== user?.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: data.email,
        })
        if (authError) throw authError
      }

      toast.success('Profile updated successfully')
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handlePasswordUpdate = async (data: PasswordFormData) => {
    try {
      setIsUpdatingPassword(true)

      const { error } = await supabase.auth.updateUser({
        password: data.new_password,
      })

      if (error) throw error

      toast.success('Password updated successfully')
      resetPassword()
    } catch (error: any) {
      console.error('Error updating password:', error)
      toast.error(error.message || 'Failed to update password')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handlePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploadingPicture(true)

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const filePath = `profile-pictures/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update user profile with picture URL
      const { error: updateError } = await supabase
        .from('users')
        .update({
          profile_picture: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id)

      if (updateError) throw updateError

      setProfilePicture(publicUrl)
      toast.success('Profile picture updated successfully')
    } catch (error: any) {
      console.error('Error uploading profile picture:', error)
      toast.error(error.message || 'Failed to upload profile picture')
    } finally {
      setIsUploadingPicture(false)
    }
  }

  const handleRemovePicture = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          profile_picture: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user?.id)

      if (error) throw error

      setProfilePicture('')
      toast.success('Profile picture removed')
    } catch (error: any) {
      console.error('Error removing profile picture:', error)
      toast.error(error.message || 'Failed to remove profile picture')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>

      {/* Profile Picture */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Picture</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <User className="w-12 h-12" />
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-primary-600 text-white p-2 rounded-full cursor-pointer hover:bg-primary-700">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handlePictureUpload}
                className="hidden"
                disabled={isUploadingPicture}
              />
            </label>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Upload a profile picture. Max size: 5MB. Supported formats: JPG, PNG
            </p>
            {profilePicture && (
              <button
                onClick={handleRemovePicture}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove picture
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
        <form onSubmit={handleSubmitProfile(handleProfileUpdate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                {...registerProfile('full_name')}
                type="text"
                className="input-field pl-10"
                placeholder="Enter your full name"
              />
            </div>
            {profileErrors.full_name && (
              <p className="mt-1 text-sm text-red-600">{profileErrors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                {...registerProfile('email')}
                type="email"
                className="input-field pl-10"
                placeholder="Enter your email"
              />
            </div>
            {profileErrors.email && (
              <p className="mt-1 text-sm text-red-600">{profileErrors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <input
              type="text"
              value={user?.role || ''}
              disabled
              className="input-field capitalize bg-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdatingProfile}
            className="btn-primary"
          >
            <Save className="w-4 h-4 mr-2" />
            {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handleSubmitPassword(handlePasswordUpdate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                {...registerPassword('current_password')}
                type="password"
                className="input-field pl-10"
                placeholder="Enter current password"
              />
            </div>
            {passwordErrors.current_password && (
              <p className="mt-1 text-sm text-red-600">{passwordErrors.current_password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                {...registerPassword('new_password')}
                type="password"
                className="input-field pl-10"
                placeholder="Enter new password"
              />
            </div>
            {passwordErrors.new_password && (
              <p className="mt-1 text-sm text-red-600">{passwordErrors.new_password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                {...registerPassword('confirm_password')}
                type="password"
                className="input-field pl-10"
                placeholder="Confirm new password"
              />
            </div>
            {passwordErrors.confirm_password && (
              <p className="mt-1 text-sm text-red-600">{passwordErrors.confirm_password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isUpdatingPassword}
            className="btn-primary"
          >
            <Lock className="w-4 h-4 mr-2" />
            {isUpdatingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication (Admin Only) */}
      {user?.role === 'admin' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Two-Factor Authentication</h2>
          <p className="text-sm text-gray-600 mb-4">
            Add an extra layer of security to your account by enabling two-factor authentication.
          </p>
          <button className="btn-secondary">
            Enable 2FA
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileSettings