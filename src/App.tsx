import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/common/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Students from './pages/Students'
import Grades from './pages/Grades'
import Attendance from './pages/Attendance'
import Reports from './pages/Reports'
import MyChildren from './pages/MyChildren'
import AuditLogs from './pages/AuditLogs'
import ProfileSettings from './pages/ProfileSettings'

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactElement; requiredRole?: string[] }> = ({ 
  children, 
  requiredRole 
}) => {
  const { user, loading, isRole } = useAuth()

  console.log('ProtectedRoute: loading:', loading, 'user:', user)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    console.log('ProtectedRoute: No user, redirecting to login')
    return <Navigate to="/login" replace />
  }

  if (requiredRole && !requiredRole.some(role => isRole(role as any))) {
    console.log('ProtectedRoute: User lacks required role, redirecting to dashboard')
    return <Navigate to="/dashboard" replace />
  }

  return <Layout>{children}</Layout>
}

// Public Route Component
const PublicRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, loading } = useAuth()

  console.log('PublicRoute: loading:', loading, 'user:', user)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (user) {
    console.log('PublicRoute: User exists, redirecting to dashboard')
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      
      {/* Common Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfileSettings />
        </ProtectedRoute>
      } />
      <Route path="/grades" element={
        <ProtectedRoute>
          <Grades />
        </ProtectedRoute>
      } />
      <Route path="/attendance" element={
        <ProtectedRoute>
          <Attendance />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute>
          <Reports />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/users" element={
        <ProtectedRoute requiredRole={['admin']}>
          <Users />
        </ProtectedRoute>
      } />
      <Route path="/students" element={
        <ProtectedRoute requiredRole={['admin', 'teacher']}>
          <Students />
        </ProtectedRoute>
      } />
      <Route path="/audit-logs" element={
        <ProtectedRoute requiredRole={['admin']}>
          <AuditLogs />
        </ProtectedRoute>
      } />
      
      {/* Teacher Routes */}
      <Route path="/my-classes" element={
        <ProtectedRoute requiredRole={['teacher']}>
          <Students />
        </ProtectedRoute>
      } />
      
      {/* Parent Routes */}
      <Route path="/my-children" element={
        <ProtectedRoute requiredRole={['parent']}>
          <MyChildren />
        </ProtectedRoute>
      } />
      
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#22c55e',
              },
            },
            error: {
              style: {
                background: '#ef4444',
              },
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App