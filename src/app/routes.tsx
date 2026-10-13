import type { RouteObject } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import PageContainer from '../components/layout/PageContainer'
import HomePage from '../pages/HomePage'
import NotFoundPage from '../pages/NotFoundPage'
import RepositoryPage from '../pages/RepositoryPage'
import RouteErrorPage from '../pages/RouteErrorPage'
import UserPage from '../pages/UserPage'

// Data mode without loaders or actions: pages load their own data from the URL.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    // Only reached when the layout itself fails, so it renders without the header.
    errorElement: (
      <PageContainer>
        <RouteErrorPage />
      </PageContainer>
    ),
    children: [
      {
        // Catches page render errors inside the layout, keeping the header usable.
        errorElement: <RouteErrorPage />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'users/:username', element: <UserPage /> },
          { path: 'users/:username/repos/:repoName', element: <RepositoryPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
