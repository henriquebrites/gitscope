import { Outlet } from 'react-router-dom'
import GitHubProvider from '../../context/GitHubProvider'
import AppHeader from './AppHeader'
import PageContainer from './PageContainer'

function AppLayout() {
  return (
    // Inside the route tree, so the app and the route tests share one assembly.
    <GitHubProvider>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <PageContainer>
          <Outlet />
        </PageContainer>
      </div>
    </GitHubProvider>
  )
}

export default AppLayout
