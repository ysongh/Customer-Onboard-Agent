import { BrowserRouter, Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom'
import ChatWindow from './components/ChatWindow'
import AdminDashboard from './components/AdminDashboard'
import Navbar from './components/Navbar'

const OnboardPage = () => {
  const { slug = 'demo' } = useParams()
  return <ChatWindow businessSlug={slug} />
}

const AdminPage = () => {
  const { slug = 'demo' } = useParams()
  return <AdminDashboard businessSlug={slug} />
}

const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <Outlet />
    </div>
  )
}

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/onboard/:slug" element={<OnboardPage />} />
          <Route path="/admin/:slug" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/onboard/demo" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
