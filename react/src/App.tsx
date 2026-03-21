import ChatWindow from './components/ChatWindow'

const getSlugFromPath = (): string => {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const onboardIndex = parts.indexOf('onboard')
  if (onboardIndex !== -1 && parts[onboardIndex + 1]) {
    return parts[onboardIndex + 1]
  }
  return 'demo'
}

const App = () => {
  const businessSlug = getSlugFromPath()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <ChatWindow businessSlug={businessSlug} />
    </div>
  )
}

export default App
