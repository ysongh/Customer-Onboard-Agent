import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

const Navbar = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const links = user
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/setup', label: 'Setup' },
      ]
    : []

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/" className="text-lg font-semibold text-gray-900 dark:text-white">
          Onboarding Agent
        </Link>
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const isActive = location.pathname.startsWith(link.to)
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
          {user && (
            <button
              onClick={handleSignOut}
              className="ml-2 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

export default Navbar
