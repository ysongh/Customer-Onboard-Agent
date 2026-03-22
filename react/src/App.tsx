import { BrowserRouter, Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom'
import useAuth from './hooks/useAuth'
import ChatWindow from './components/ChatWindow'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SetupChat from './pages/SetupChat'
import Dashboard from './pages/Dashboard'
import CustomerDetail from './pages/CustomerDetail'

const OnboardPage = () => {
  const { slug = 'demo' } = useParams()
  return <ChatWindow businessSlug={slug} />
}

/** Wrapper that requires authentication — redirects to /login otherwise */
const AuthGuard = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

/** Redirect authenticated users away from login/signup */
const GuestGuard = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <Outlet />
    </div>
  )
}

const RootRedirect = () => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  return <Navigate to={user ? '/dashboard' : '/login'} replace />
}

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public: customer-facing onboarding chat */}
        <Route path="/onboard/:slug" element={
          <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
            <OnboardPage />
          </div>
        } />

        {/* Guest-only: login and signup */}
        <Route element={<GuestGuard />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        {/* Authenticated: setup, dashboard, customer detail */}
        <Route element={<AuthGuard />}>
          <Route element={<AuthLayout />}>
            <Route path="/setup" element={<SetupChat />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/:customerId" element={<CustomerDetail />} />
          </Route>
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
