import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { RiskGatekeeperPage } from '@/pages/RiskGatekeeperPage'
import { TradingJournalPage } from '@/pages/TradingJournalPage'
import { SettingsPage } from '@/pages/SettingsPage'

describe('TradePilot User Journey & Usability Flows', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // Journey 1: Register -> Login
  it('Journey 1: Register and login input validation and submission flow', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/register') || url.includes('/auth/login')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              access_token: 'fake-token',
              user: {
                id: 1,
                email: 'journey_user@tradepilot.io',
                username: 'journey_trader',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            }),
        })
      }
      return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    // Render Register Page
    const { unmount } = render(
      <AuthProvider>
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      </AuthProvider>
    )

    expect(screen.getByText('Create TradePilot Account')).toBeInTheDocument()

    // Fill registration form
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'journey_user@tradepilot.io' },
    })
    fireEvent.change(screen.getByLabelText(/Trader Username/i), {
      target: { value: 'journey_trader' },
    })
    fireEvent.change(screen.getByLabelText(/^Password/i), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), {
      target: { value: 'SecurePass123!' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Complete Registration/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    unmount()

    // Render Login Page
    render(
      <AuthProvider>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>
    )

    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'journey_user@tradepilot.io' },
    })
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'SecurePass123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  // Journey 2: Evaluate a trade -> review rule results -> save approved trade
  it('Journey 2: Evaluate trade in Gatekeeper and save approved trade to journal', async () => {
    const mockEvaluation = {
      evaluation_id: 42,
      outcome: 'APPROVED',
      account_equity: '50000.00',
      risk_budget: '500.00',
      risk_percentage: '1.00',
      per_unit_risk: '50.00',
      raw_quantity: '10.0',
      recommended_quantity: '10.0',
      projected_loss: '500.00',
      reward_to_risk_ratio: '3.00',
      stop_distance: '50.00',
      rules: [
        { rule_name: 'Mandatory Stop Loss', status: 'PASS', message: 'Stop loss present' },
        { rule_name: 'Reward-to-Risk Ratio', status: 'PASS', message: 'R:R is 3.0:1' },
      ],
      summary: 'All mandatory risk boundaries satisfied.',
    }

    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/settings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ max_risk_per_trade_pct: '1.00', max_daily_loss_pct: '2.00' }),
        })
      }
      if (url.includes('/gatekeeper/evaluate')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockEvaluation),
        })
      }
      if (url.includes('/trades/') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 99, symbol: 'NQ', status: 'OPEN' }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <RiskGatekeeperPage />
      </MemoryRouter>
    )

    // Run evaluation
    fireEvent.click(screen.getByRole('button', { name: /Run Gatekeeper Evaluation/i }))

    expect(await screen.findByText('CLEARANCE APPROVED')).toBeInTheDocument()
    expect(screen.getByText('Recommended Size')).toBeInTheDocument()

    // Save approved trade
    const saveButton = screen.getByRole('button', { name: /Record Approved Trade in Journal/i })
    fireEvent.click(saveButton)

    expect(await screen.findByText(/Trade successfully logged in Trading Journal!/i)).toBeInTheDocument()
    expect(screen.getByText('View in Journal')).toBeInTheDocument()
  })

  // Journey 3: Journal -> edit trade -> close trade -> verify realized outcome
  it('Journey 3: Edit open trade in Journal, close it, and view realized outcome', async () => {
    const mockOpenTrade = {
      id: 7,
      user_id: 1,
      symbol: 'AAPL',
      side: 'LONG',
      status: 'OPEN',
      quantity: '10.0',
      entry_price: '150.00',
      stop_loss: '145.00',
      take_profit: '160.00',
      fees: '2.00',
      realized_pnl: null,
      r_multiple: null,
      entry_time: '2026-10-10T10:00:00Z',
      created_at: '2026-10-10T10:00:00Z',
    }

    const mockClosedTrade = {
      ...mockOpenTrade,
      status: 'CLOSED',
      exit_price: '158.00',
      realized_pnl: '78.00', // (158 - 150)*10 - 2 = 78
      r_multiple: '1.56',
    }

    let tradeState: any = mockOpenTrade

    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/trades/') && opts?.method === 'PUT') {
        tradeState = mockClosedTrade
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(mockClosedTrade),
        })
      }
      if (url.includes('/trades/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ items: [tradeState], total: 1, skip: 0, limit: 15 }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <TradingJournalPage />
      </MemoryRouter>
    )

    // Open trade row is rendered
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('OPEN')).toBeInTheDocument()

    // Click edit button
    const editBtn = screen.getByLabelText(/Edit trade 7 AAPL/i)
    fireEvent.click(editBtn)

    expect(screen.getByText('Edit Trade #7')).toBeInTheDocument()

    // Change status to CLOSED and fill Exit Price
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'CLOSED' } })
    fireEvent.change(screen.getByLabelText(/Exit Price/i), { target: { value: '158.00' } })

    fireEvent.click(screen.getByRole('button', { name: /Update Trade/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/trades/7'),
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  // Journey 5: Settings -> update risk parameter -> save preferences
  it('Journey 5: Update risk settings and verify persistence call', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/settings') && opts?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              max_risk_per_trade_pct: '0.50',
              max_daily_loss_pct: '1.50',
              max_open_positions: 2,
              enforce_mandatory_stop_loss: true,
              base_currency: 'USD',
            }),
        })
      }
      if (url.includes('/settings')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              max_risk_per_trade_pct: '1.00',
              max_daily_loss_pct: '2.00',
              max_open_positions: 3,
              enforce_mandatory_stop_loss: true,
              base_currency: 'USD',
            }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Settings & Preferences')).toBeInTheDocument()

    // Wait for settings to hydrate from backend
    const riskInput = await screen.findByDisplayValue('1.00')

    // Update Max Risk Per Trade to 0.50
    fireEvent.change(riskInput, { target: { value: '0.50' } })

    // Submit the form
    const form = riskInput.closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/settings'),
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"max_risk_per_trade_pct":"0.50"'),
        })
      )
    })

    expect(await screen.findByText(/Risk preferences successfully saved/i)).toBeInTheDocument()
  })
})
