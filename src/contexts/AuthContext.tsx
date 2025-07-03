import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabase'
import { User, UserRole } from '../types'
import toast from 'react-hot-toast'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isRole: (role: UserRole) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  const fetchUserProfile = async (userId: string): Promise<User | null> => {
    console.log('fetchUserProfile: Starting for userId:', userId)
    try {
      // First try to get by ID
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      console.log('fetchUserProfile: Query by ID result:', { data, error })

      if (error && error.code !== 'PGRST116') {
        console.error('fetchUserProfile: Error fetching profile:', error)
        return null
      }
      
      if (data) {
        return data as User
      }
      
      // If not found by ID, try by email (in case of ID mismatch)
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        console.error('fetchUserProfile: Failed to get auth user')
        return null
      }
      
      console.log('fetchUserProfile: Trying to find by email:', authUser.email)
      
      const { data: emailData, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle()
      
      console.log('fetchUserProfile: Query by email result:', { emailData, emailError })
      
      if (emailData) {
        // Found by email but with different ID - update the ID
        console.log('fetchUserProfile: Found user by email, updating ID')
        
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ id: userId })
          .eq('email', authUser.email)
          .select()
          .single()
        
        if (updateError) {
          console.error('fetchUserProfile: Failed to update user ID:', updateError)
          // If can't update, just return the user as is
          return emailData as User
        }
        
        return updatedUser as User
      }
      
      console.log('fetchUserProfile: No user found by ID or email')
      return null
    } catch (error) {
      console.error('fetchUserProfile: Caught error:', error)
      return null
    }
  }

  // Initialize auth on mount
  useEffect(() => {
    let mounted = true
    
    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Initializing auth...')
        
        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        console.log('AuthContext: Initial session:', session, 'Error:', error)
        
        if (error) {
          console.error('AuthContext: Error getting session:', error)
          setLoading(false)
          setIsInitialized(true)
          return
        }
        
        if (session?.user) {
          setSession(session)
          
          // Fetch user profile
          const profile = await fetchUserProfile(session.user.id)
          
          if (!mounted) return
          
          if (profile) {
            console.log('AuthContext: Profile loaded:', profile)
            setUser(profile)
          } else {
            console.log('AuthContext: Failed to load profile')
            // Clear session if profile doesn't exist
            setSession(null)
            await supabase.auth.signOut()
          }
        } else {
          console.log('AuthContext: No session found')
          setSession(null)
          setUser(null)
        }
        
        setLoading(false)
        setIsInitialized(true)
        
      } catch (error) {
        console.error('AuthContext: Error initializing:', error)
        if (mounted) {
          setLoading(false)
          setIsInitialized(true)
        }
      }
    }

    // Only initialize once
    if (!isInitialized) {
      initializeAuth()
    }

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthContext: Auth state changed:', event, session)
      
      if (!mounted) return
      
      if (event === 'SIGNED_IN' && session?.user) {
        setSession(session)
        
        const profile = await fetchUserProfile(session.user.id)
        
        if (!mounted) return
        
        if (profile) {
          setUser(profile)
        } else {
          console.error('AuthContext: Failed to load profile after sign in')
          setUser(null)
          setSession(null)
        }
        
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setSession(null)
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session)
        // Don't refetch profile on token refresh to avoid unnecessary queries
      }
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [isInitialized])

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('SignIn error:', error)
        setLoading(false)
        throw error
      }
      
      console.log('SignIn successful:', data)
      
      if (data.user && data.session) {
        setSession(data.session)
        
        // Try to fetch the user profile
        let profile = await fetchUserProfile(data.user.id)
        
        // If profile doesn't exist, create it
        if (!profile) {
          console.log('SignIn: Creating user profile for:', data.user.id)
          
          // Create minimal profile first, let database handle defaults
          const newProfile = {
            id: data.user.id,
            email: data.user.email || email,
            full_name: data.user.user_metadata?.full_name || email.split('@')[0],
            role: 'admin'
          }
          
          console.log('SignIn: Attempting to insert profile:', newProfile)
          
          const { data: createdProfile, error: createError } = await supabase
            .from('users')
            .insert(newProfile)
            .select()
            .single()
          
          if (createError) {
            console.error('SignIn: Failed to create profile:', createError)
            
            // If duplicate email, try to fetch by email
            if (createError.code === '23505' && createError.message.includes('users_email_key')) {
              console.log('SignIn: Duplicate email error, fetching existing profile')
              
              const { data: existingProfile, error: fetchError } = await supabase
                .from('users')
                .select('*')
                .eq('email', data.user.email || email)
                .single()
              
              if (fetchError || !existingProfile) {
                console.error('SignIn: Failed to fetch existing profile:', fetchError)
                toast.error('Failed to load user profile')
                await supabase.auth.signOut()
                throw new Error('Failed to load user profile')
              }
              
              // Update the profile ID to match auth user
              console.log('SignIn: Updating profile ID to match auth user')
              const { data: updatedProfile, error: updateError } = await supabase
                .from('users')
                .update({ id: data.user.id })
                .eq('email', data.user.email || email)
                .select()
                .single()
              
              if (updateError) {
                console.error('SignIn: Failed to update profile ID:', updateError)
                // Use the existing profile anyway
                profile = existingProfile as User
              } else {
                profile = updatedProfile as User
              }
            } else {
              toast.error(`Failed to create user profile: ${createError.message}`)
              await supabase.auth.signOut()
              throw new Error(`Failed to create user profile: ${createError.message}`)
            }
          } else {
            profile = createdProfile as User
          }
        }
        
        setUser(profile)
        toast.success('Successfully signed in!')
      }
    } catch (error: any) {
      console.error('SignIn error:', error)
      toast.error(error.message || 'Failed to sign in')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setUser(null)
      setSession(null)
      toast.success('Successfully signed out!')
    } catch (error: any) {
      console.error('SignOut error:', error)
      toast.error(error.message || 'Failed to sign out')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const isRole = (role: UserRole) => {
    return user?.role === role
  }

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    isRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}