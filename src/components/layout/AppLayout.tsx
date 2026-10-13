import { Outlet } from 'react-router-dom'
import AppHeader from './AppHeader'
import PageContainer from './PageContainer'

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <PageContainer>
        <Outlet />
      </PageContainer>
    </div>
  )
}

export default AppLayout
