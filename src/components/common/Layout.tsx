import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LogOut, User, Home, Users, BookOpen, Calendar, FileText, Settings } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut, isRole } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const adminLinks = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/users', icon: Users, label: 'User Management' },
    { to: '/students', icon: Users, label: 'Pupils' },
    { to: '/grades', icon: BookOpen, label: 'Grades' },
    { to: '/attendance', icon: Calendar, label: 'Attendance' },
    { to: '/reports', icon: FileText, label: 'Reports' },
    { to: '/audit-logs', icon: Settings, label: 'Audit Logs' },
  ]

  const teacherLinks = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/my-classes', icon: Users, label: 'My Classes' },
    { to: '/grades', icon: BookOpen, label: 'Grades' },
    { to: '/attendance', icon: Calendar, label: 'Attendance' },
    { to: '/reports', icon: FileText, label: 'Reports' },
  ]

  const parentLinks = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/my-children', icon: Users, label: 'My Child' },
    { to: '/grades', icon: BookOpen, label: 'Grades' },
    { to: '/attendance', icon: Calendar, label: 'Attendance' },
  ]

  const getNavigationLinks = () => {
    if (isRole('admin')) return adminLinks
    if (isRole('teacher')) return teacherLinks
    if (isRole('parent')) return parentLinks
    return []
  }

  const navigationLinks = getNavigationLinks()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-40">
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-primary-600">iSKWELA</h1>
            <p className="text-sm text-gray-600 mt-1">ANNACS Grade System</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigationLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center space-x-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
              >
                <link.icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="px-6 py-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {navigationLinks.find(link => link.to === window.location.pathname)?.label || 'Page'}
            </h2>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout