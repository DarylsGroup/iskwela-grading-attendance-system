import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { UserPlus, Edit, Archive, ArchiveRestore, Search, Shield, ChevronLeft, ChevronRight, Bell, Check, X, Eye, FileImage, Trash2, RefreshCw } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'

// Types
type UserRole = 'admin' | 'teacher' | 'parent'

interface User {
  id: string
  email: string
  role: UserRole
  full_name: string
  profile_picture?: string | null
  created_at: string
  updated_at: string
  archived?: boolean
  phone_number?: string
  address?: string
}

interface PendingRegistration {
  id: string
  full_name: string
  email: string
  role: string
  status: string
  created_at: string
  phone_number?: string
  address?: string
  profile_picture?: string
  valid_id_document?: string
  reason_for_application?: string
}

const userSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  full_name: z.string().min(2, 'Full name is required'),
  role: z.enum(['admin', 'teacher', 'parent']),
})

type UserFormData = z.infer<typeof userSchema>

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [pendingRegistrations, setPendingRegistrations] = useState<PendingRegistration[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole | ''>('')
  const [showArchived, setShowArchived] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'archived'>('users')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [selectedRegistration, setSelectedRegistration] = useState<PendingRegistration | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rejectionReason, setRejectionReason] = useState('')
  const itemsPerPage = 10

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  })

  useEffect(() => {
    fetchUsers()
    fetchPendingRegistrations()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, selectedRole, activeTab])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPendingRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('user_registrations')
        .select('*')
        .in('status', ['pending', 'under_review'])
        .order('created_at', { ascending: false })

      if (error) throw error
      setPendingRegistrations(data || [])
    } catch (error) {
      console.error('Error fetching pending registrations:', error)
    }
  }

  const filterUsers = () => {
    let filtered = users

    // Filter by tab (active/archived)
    if (activeTab === 'archived') {
      filtered = filtered.filter(user => user.archived === true)
    } else if (activeTab === 'users') {
      filtered = filtered.filter(user => user.archived !== true)
    }

    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedRole) {
      filtered = filtered.filter(user => user.role === selectedRole)
    }

    setFilteredUsers(filtered)
    setCurrentPage(1)
  }

  const onSubmit = async (data: UserFormData) => {
    try {
      setIsLoading(true)

      if (editingUser) {
        // Update existing user
        const updateData = {
          full_name: data.full_name,
          role: data.role,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id)

        if (error) throw error

        // Get current user for audit log
        const { data: { user } } = await supabase.auth.getUser()
        
        // Log audit event
        if (user) {
          await supabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'update_user',
            entity_type: 'users',
            entity_id: editingUser.id,
            old_values: editingUser,
            new_values: { ...editingUser, ...updateData },
          })
        }

        toast.success('User updated successfully')
      } else {
        // Create new user - first create Auth user, then user profile
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast.error('You must be logged in to create users')
          return
        }

        // First create the Auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password!,
          options: {
            data: {
              full_name: data.full_name,
              role: data.role,
            }
          }
        })

        if (authError) throw authError

        if (authData.user) {
          // Create user profile using database function
          const { data: result, error } = await supabase.rpc('create_user_by_admin', {
            user_email: data.email,
            user_password: data.password!,
            user_full_name: data.full_name,
            user_role: data.role,
            admin_user_id: user.id
          })

          if (error) {
            console.error('Error calling create user function:', error)
            throw error
          }

          if (!result.success) {
            throw new Error(result.error || 'Failed to create user profile')
          }

          // Update the user profile with the correct auth user ID
          await supabase
            .from('users')
            .update({ id: authData.user.id })
            .eq('id', result.user_id)

          toast.success('User created successfully')
        }
      }

      fetchUsers()
      handleCloseModal()
    } catch (error: any) {
      console.error('Error saving user:', error)
      toast.error(error.message || 'Failed to save user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleArchive = async (userId: string, archive: boolean = true) => {
    const action = archive ? 'archive' : 'restore'
    const user = users.find(u => u.id === userId)
    
    if (!window.confirm(`Are you sure you want to ${action} ${user?.full_name}?`)) return

    try {
      setIsLoading(true)
      
      // Get current user (admin) ID
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        toast.error('You must be logged in to perform this action')
        return
      }

      // Use database function to archive/restore user
      const { data, error } = await supabase.rpc('archive_user', {
        target_user_id: userId,
        should_archive: archive,
        admin_user_id: currentUser.id
      })

      if (error) {
        console.error('Error calling archive function:', error)
        throw error
      }

      if (!data.success) {
        throw new Error(data.error || `Failed to ${action} user`)
      }

      // If archiving, also try to disable the auth user
      if (archive) {
        try {
          // Note: This requires service role to work properly in production
          const { error: authError } = await supabase.auth.admin.updateUserById(
            userId,
            { ban_duration: 'indefinite' }
          )
          
          if (authError) {
            console.warn('Could not disable auth user:', authError)
            // Continue anyway since the main archive succeeded
          }
        } catch (authError) {
          console.warn('Auth user disable failed:', authError)
        }
      } else {
        // If restoring, enable the auth user
        try {
          const { error: authError } = await supabase.auth.admin.updateUserById(
            userId,
            { ban_duration: 'none' }
          )
          
          if (authError) {
            console.warn('Could not enable auth user:', authError)
          }
        } catch (authError) {
          console.warn('Auth user enable failed:', authError)
        }
      }

      toast.success(data.message)
      fetchUsers()
    } catch (error: any) {
      console.error(`Error ${action}ing user:`, error)
      toast.error(error.message || `Failed to ${action} user`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId)
    
    if (!window.confirm(`Are you sure you want to permanently delete ${user?.full_name}? This action cannot be undone.`)) return

    try {
      setIsLoading(true)
      
      // Get current user (admin) ID
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        toast.error('You must be logged in to perform this action')
        return
      }

      // Use database function to delete user
      const { data, error } = await supabase.rpc('delete_user_permanently', {
        target_user_id: userId,
        admin_user_id: currentUser.id
      })

      if (error) {
        console.error('Error calling delete function:', error)
        throw error
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete user')
      }

      // Try to delete auth user too
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(userId)
        if (authError) {
          console.warn('Could not delete auth user:', authError)
        }
      } catch (authError) {
        console.warn('Auth user deletion failed:', authError)
      }

      toast.success(data.message)
      fetchUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast.error(error.message || 'Failed to delete user')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApproveRegistration = async (registration: PendingRegistration) => {
    try {
      setIsLoading(true)

      // Get current user (admin) ID
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in to approve registrations')
        return
      }

      // Debug: Check registration status first
      console.log('Attempting to approve registration:', registration.id)
      const { data: debugData, error: debugError } = await supabase.rpc('debug_registration_status', {
        registration_id: registration.id
      })

      if (debugError) {
        console.error('Debug error:', debugError)
      } else {
        console.log('Registration debug info:', debugData)
      }

      // Step 1: Approve the registration and get registration data
      const { data, error } = await supabase.rpc('approve_user_registration', {
        registration_id: registration.id,
        admin_user_id: user.id
      })

      if (error) {
        console.error('Error calling approve function:', error)
        throw error
      }

      if (!data.success) {
        // Show more specific error message
        console.error('Approval failed:', data.error)
        throw new Error(data.error || 'Failed to approve registration')
      }

      const regData = data.registration_data

      // Check if user already exists
      if (data.already_exists) {
        // User already exists, show email confirmation message
        toast.success('Registration approved! Please check email for confirmation.', { 
          duration: 8000,
          icon: '📧'
        })
        alert(`Registration for ${regData.full_name} has been approved!\n\nEmail: ${regData.email}\n\n📧 Please confirm your email in Google Mail App to complete the setup.\n\nAfter email confirmation, you can login with your chosen password.`)
        
        // Refresh the data
        fetchUsers()
        fetchPendingRegistrations()
        setSelectedRegistration(null)
        return
      }

      // Step 2: Create Auth user with their chosen password (only if user doesn't exist)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regData.email,
        password: regData.password,
        options: {
          data: {
            full_name: regData.full_name,
            role: regData.role
          }
        }
      })

      if (authError) {
        console.error('Auth user creation error:', authError)
        // Revert registration status if auth creation fails
        await supabase
          .from('user_registrations')
          .update({ status: 'pending' })
          .eq('id', registration.id)
        throw new Error('Failed to create user account: ' + authError.message)
      }

      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      // Step 3: Create user profile with the auth user's ID
      const { data: profileData, error: profileError } = await supabase.rpc('create_user_profile_after_auth', {
        auth_user_id: authData.user.id,
        user_email: regData.email,
        user_full_name: regData.full_name,
        user_role: regData.role,
        user_phone: regData.phone_number,
        user_address: regData.address,
        user_profile_picture: regData.profile_picture
      })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Note: Auth user is already created at this point
        throw new Error('Failed to create user profile: ' + profileError.message)
      }

      if (!profileData.success) {
        throw new Error(profileData.error || 'Failed to create user profile')
      }

      // Show success message
      toast.success('Registration approved! Please check email for confirmation.', { 
        duration: 8000,
        icon: '📧'
      })

      // Show confirmation
      alert(`User ${regData.full_name} has been approved successfully!\n\nEmail: ${regData.email}\n\n📧 Please confirm your email in Google Mail App to complete the setup.\n\nAfter email confirmation, you can login with your chosen password.`)

      // Refresh the data
      fetchUsers()
      fetchPendingRegistrations()
      setSelectedRegistration(null)
      
    } catch (error: any) {
      console.error('Error approving registration:', error)
      
      // Show specific error messages
      if (error.message.includes('already processed')) {
        toast.error('This registration has already been processed. Please refresh the page.')
        fetchPendingRegistrations() // Refresh to show current status
      } else if (error.message.includes('does not exist')) {
        toast.error('Registration not found. Please refresh the page.')
        fetchPendingRegistrations()
      } else if (error.message.includes('duplicate key') || error.message.includes('already exists')) {
        toast.success('Registration approved! Please check email for confirmation.', { 
          duration: 8000,
          icon: '📧'
        })
        alert('Registration approved!\n\n📧 Please confirm your email in Google Mail App to complete the setup.\n\nAfter email confirmation, you can login with your chosen password.')
        fetchUsers() // Refresh users list
        fetchPendingRegistrations()
      } else {
        toast.error(error.message || 'Failed to approve registration')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRejectRegistration = async (registrationId: string, reason: string) => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    try {
      setIsLoading(true)

      // Get current user (admin) ID
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('You must be logged in to reject registrations')
        return
      }

      // Call the database function to reject registration
      const { data, error } = await supabase.rpc('reject_user_registration', {
        registration_id: registrationId,
        rejection_reason: reason,
        admin_user_id: user.id
      })

      if (error) {
        console.error('Error calling reject function:', error)
        throw error
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to reject registration')
      }

      toast.success('Registration rejected successfully')
      fetchPendingRegistrations()
      setSelectedRegistration(null)
      setRejectionReason('')
      
    } catch (error: any) {
      console.error('Error rejecting registration:', error)
      toast.error(error.message || 'Failed to reject registration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    reset({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    })
    setIsModalOpen(true)
  }

  const handleViewUser = (user: User) => {
    setSelectedUser(user)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingUser(null)
    setSelectedRegistration(null)
    setSelectedUser(null)
    setRejectionReason('')
    reset()
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800'
      case 'teacher':
        return 'bg-blue-100 text-blue-800'
      case 'parent':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Active Users ({users.filter(u => !u.archived).length})
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'archived'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Archived Users ({users.filter(u => u.archived).length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } relative`}
            >
              Pending Registrations ({pendingRegistrations.length})
              {pendingRegistrations.length > 0 && (
                <Bell className="w-4 h-4 inline-block ml-1 text-orange-500" />
              )}
            </button>
          </nav>
        </div>

        {/* Users Tab (Active and Archived) */}
        {(activeTab === 'users' || activeTab === 'archived') && (
          <div className="p-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole | '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchUsers}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Users Table */}
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created At
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedUsers.map((user) => (
                        <tr key={user.id} className={user.archived ? 'bg-gray-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                {user.profile_picture ? (
                                  <img 
                                    src={user.profile_picture} 
                                    alt={user.full_name}
                                    className="h-10 w-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-blue-600 font-medium">
                                      {user.full_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {user.full_name}
                                </div>
                                {user.phone_number && (
                                  <div className="text-sm text-gray-500">
                                    {user.phone_number}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.archived 
                                ? 'bg-red-100 text-red-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {user.archived ? 'Archived' : 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleViewUser(user)}
                                className="text-blue-600 hover:text-blue-900"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(user)}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="Edit User"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {user.archived ? (
                                <>
                                  <button
                                    onClick={() => handleArchive(user.id, false)}
                                    className="text-green-600 hover:text-green-900"
                                    title="Restore User"
                                  >
                                    <ArchiveRestore className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete Permanently"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleArchive(user.id, true)}
                                  className="text-orange-600 hover:text-orange-900"
                                  title="Archive User"
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

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredUsers.length)} of{' '}
                    {filteredUsers.length} results
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Pending Registrations Tab */}
        {activeTab === 'pending' && (
          <div className="p-6">
            {pendingRegistrations.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Registrations</h3>
                <p className="text-gray-500">All registration requests have been processed.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingRegistrations.map((registration) => (
                  <div key={registration.id} className="bg-white border rounded-lg p-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {registration.profile_picture ? (
                          <img 
                            src={registration.profile_picture} 
                            alt={registration.full_name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                              {registration.full_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-gray-900">{registration.full_name}</h4>
                          <p className="text-sm text-gray-500">{registration.email}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        registration.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {registration.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <p className="text-sm"><span className="font-medium">Role:</span> {registration.role}</p>
                      <p className="text-sm"><span className="font-medium">Phone:</span> {registration.phone_number || 'Not provided'}</p>
                      <p className="text-sm"><span className="font-medium">Applied:</span> {new Date(registration.created_at).toLocaleDateString()}</p>
                      {registration.reason_for_application && (
                        <p className="text-sm"><span className="font-medium">Reason:</span> {registration.reason_for_application}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedRegistration(registration)}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700 flex items-center justify-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </button>
                      {registration.valid_id_document && (
                        <button
                          onClick={() => window.open(registration.valid_id_document, '_blank')}
                          className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 flex items-center justify-center"
                          title="View ID Document"
                        >
                          <FileImage className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCloseModal}></div>
            
            <div className="relative bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    {...register('full_name')}
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter full name"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email"
                    disabled={!!editingUser}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      {...register('password')}
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter password"
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role
                  </label>
                  <select 
                    {...register('role')} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="parent">Parent</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                  {errors.role && (
                    <p className="mt-1 text-sm text-red-600">{errors.role.message}</p>
                  )}
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
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
                  >
                    {isLoading ? 'Saving...' : editingUser ? 'Update' : 'Create'} User
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCloseModal}></div>
            
            <div className="relative bg-white rounded-lg max-w-2xl w-full p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                User Details - {selectedUser.full_name}
              </h2>
              
              <div className="space-y-6">
                {/* User Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <p className="text-sm text-gray-900">{selectedUser.full_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-sm text-gray-900">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="text-sm text-gray-900 capitalize">{selectedUser.role}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      selectedUser.archived 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedUser.archived ? 'Archived' : 'Active'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="text-sm text-gray-900">{selectedUser.phone_number || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Created</label>
                    <p className="text-sm text-gray-900">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {selectedUser.address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <p className="text-sm text-gray-900">{selectedUser.address}</p>
                  </div>
                )}

                {/* Profile Picture */}
                {selectedUser.profile_picture && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                    <img 
                      src={selectedUser.profile_picture} 
                      alt="Profile"
                      className="w-32 h-32 rounded-lg object-cover"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(null)
                      handleEdit(selectedUser)
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                  >
                    Edit User
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Review Modal */}
      {selectedRegistration && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCloseModal}></div>
            
            <div className="relative bg-white rounded-lg max-w-2xl w-full p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Registration Review - {selectedRegistration.full_name}
              </h2>
              
              <div className="space-y-6">
                {/* User Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <p className="text-sm text-gray-900">{selectedRegistration.full_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-sm text-gray-900">{selectedRegistration.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <p className="text-sm text-gray-900 capitalize">{selectedRegistration.role}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <p className="text-sm text-gray-900">{selectedRegistration.phone_number || 'Not provided'}</p>
                  </div>
                </div>

                {selectedRegistration.address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <p className="text-sm text-gray-900">{selectedRegistration.address}</p>
                  </div>
                )}

                {selectedRegistration.reason_for_application && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason for Application</label>
                    <p className="text-sm text-gray-900">{selectedRegistration.reason_for_application}</p>
                  </div>
                )}

                {/* Profile Picture */}
                {selectedRegistration.profile_picture && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                    <img 
                      src={selectedRegistration.profile_picture} 
                      alt="Profile"
                      className="w-32 h-32 rounded-lg object-cover"
                    />
                  </div>
                )}

                {/* Valid ID Document */}
                {selectedRegistration.valid_id_document && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valid ID Document</label>
                    <img 
                      src={selectedRegistration.valid_id_document} 
                      alt="Valid ID"
                      className="w-64 h-40 rounded-lg object-cover cursor-pointer"
                      onClick={() => window.open(selectedRegistration.valid_id_document, '_blank')}
                    />
                  </div>
                )}

                {/* Rejection Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason (if rejecting)
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter reason for rejection..."
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRejectRegistration(selectedRegistration.id, rejectionReason)}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md flex items-center gap-2 disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveRegistration(selectedRegistration)}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md flex items-center gap-2 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Approve
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

export default Users