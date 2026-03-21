import { Link, useLocation, useParams } from 'react-router-dom'

const Navbar = () => {
  const location = useLocation()
  const { slug = 'demo' } = useParams()

  const links = [
    { to: `/onboard/${slug}`, label: 'Onboard' },
    { to: `/admin/${slug}`, label: 'Admin' },
  ]

  return (
    <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <span className="text-lg font-semibold text-gray-900 dark:text-white">
          Onboarding Agent
        </span>
        <div className="flex gap-1">
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
        </div>
      </div>
    </nav>
  )
}

export default Navbar
