import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { OverviewPage } from '@/pages/OverviewPage'
import { RiskGatekeeperPage } from '@/pages/RiskGatekeeperPage'
import { TradingJournalPage } from '@/pages/TradingJournalPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { AuthProvider } from '@/context/AuthContext'

// Mock global fetch for AuthProvider session check
vi.stubGlobal(
  'fetch',
  vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    })
  )
)

describe('TradePilot Application Shell & Pages', () => {
  it('renders sidebar navigation items correctly', () => {
    render(
      <MemoryRouter>
        <Sidebar isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    )

    expect(screen.getByText('TradePilot')).toBeInTheDocument()
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Risk Gatekeeper')).toBeInTheDocument()
    expect(screen.getByText('Trading Journal')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders Overview page with placeholder metrics and empty table state', () => {
    render(
      <MemoryRouter>
        <OverviewPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Platform Overview')).toBeInTheDocument()
    expect(screen.getByText('Risk Gate Status')).toBeInTheDocument()
    expect(screen.getByText('No recent trades recorded')).toBeInTheDocument()
  })

  it('renders Risk Gatekeeper page with pre-flight form and active rules matrix', () => {
    render(
      <MemoryRouter>
        <RiskGatekeeperPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Rule-based Risk Gatekeeper')).toBeInTheDocument()
    expect(screen.getByText('Active Rule Matrix')).toBeInTheDocument()
    expect(screen.getByText('Run Gatekeeper Evaluation')).toBeInTheDocument()
  })

  it('renders Trading Journal page with empty table and Add Trade action', async () => {
    render(
      <MemoryRouter>
        <TradingJournalPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Trading Journal')).toBeInTheDocument()
    expect(await screen.findByText('No trade entries found')).toBeInTheDocument()
    expect(screen.getAllByText('Add Trade').length).toBeGreaterThan(0)
  })

  it('renders Analytics page with zero fabricated data notice and empty chart states', () => {
    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Trading Analytics')).toBeInTheDocument()
    expect(screen.getByText(/Zero Fabricated Data:/i)).toBeInTheDocument()
    expect(screen.getByText('No equity data to plot')).toBeInTheDocument()
  })

  it('renders Settings page with risk preference parameters', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Settings & Preferences')).toBeInTheDocument()
    expect(screen.getByText('Max Risk Per Trade (%)')).toBeInTheDocument()
    expect(screen.getByText('Max Daily Loss Limit (%)')).toBeInTheDocument()
  })

  it('renders Login page matching design system', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    )

    expect(await screen.findByText('Sign In to TradePilot')).toBeInTheDocument()
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument()
  })

  it('renders Register page with password requirements', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    )

    expect(await screen.findByText('Create TradePilot Account')).toBeInTheDocument()
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Trader Username/i)).toBeInTheDocument()
    expect(screen.getByText(/Must include uppercase, lowercase, and a number/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Complete Registration/i })).toBeInTheDocument()
  })

  it('renders TopBar with user profile and logout button', async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <TopBar onMenuClick={() => {}} />
        </MemoryRouter>
      </AuthProvider>
    )

    expect(await screen.findByTitle('Log Out')).toBeInTheDocument()
  })
})
