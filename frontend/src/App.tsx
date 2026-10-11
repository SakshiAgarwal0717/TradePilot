import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { OverviewPage } from '@/pages/OverviewPage'
import { RiskGatekeeperPage } from '@/pages/RiskGatekeeperPage'
import { TradingJournalPage } from '@/pages/TradingJournalPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { EmptyState } from '@/components/ui/States'

const router = createBrowserRouter([
  // Public authentication routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },

  // Protected application routes
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <OverviewPage />,
          },
          {
            path: 'risk-gatekeeper',
            element: <RiskGatekeeperPage />,
          },
          {
            path: 'journal',
            element: <TradingJournalPage />,
          },
          {
            path: 'analytics',
            element: <AnalyticsPage />,
          },
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },

  // Catch-all 404
  {
    path: '*',
    element: (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <EmptyState
          title="Page Not Found"
          description="The requested route does not exist in TradePilot."
          actionLabel="Return to Platform"
          onAction={() => window.location.assign('/')}
        />
      </div>
    ),
  },
])

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
