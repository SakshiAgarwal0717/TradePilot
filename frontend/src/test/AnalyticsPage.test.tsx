import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnalyticsPage } from '@/pages/AnalyticsPage'

const mockEmptyAnalytics = {
  total_trades: 0,
  closed_trades: 0,
  open_trades: 0,
  draft_trades: 0,
  winning_trades: 0,
  losing_trades: 0,
  breakeven_trades: 0,
  win_rate_pct: null,
  gross_profit: '0',
  gross_loss: '0',
  total_fees: '0',
  net_realized_pnl: '0',
  avg_win: null,
  avg_loss: null,
  profit_factor: null,
  avg_reward_to_risk: null,
  max_drawdown_amount: '0',
  max_drawdown_pct: '0',
  total_evaluations: 0,
  approved_evaluations: 0,
  rejected_evaluations: 0,
  warning_evaluations: 0,
  violation_rate_pct: null,
  equity_curve: [],
}

const mockPopulatedAnalytics = {
  total_trades: 4,
  closed_trades: 3,
  open_trades: 1,
  draft_trades: 0,
  winning_trades: 2,
  losing_trades: 1,
  breakeven_trades: 0,
  win_rate_pct: '66.67',
  gross_profit: '500.00',
  gross_loss: '150.00',
  total_fees: '10.00',
  net_realized_pnl: '340.00',
  avg_win: '250.00',
  avg_loss: '150.00',
  profit_factor: '3.33',
  avg_reward_to_risk: '2.50',
  max_drawdown_amount: '150.00',
  max_drawdown_pct: '30.00',
  total_evaluations: 5,
  approved_evaluations: 4,
  rejected_evaluations: 1,
  warning_evaluations: 0,
  violation_rate_pct: '20.00',
  equity_curve: [
    {
      trade_id: 1,
      symbol: 'AAPL',
      exit_time: '2026-10-10T10:00:00Z',
      pnl: '300.00',
      cumulative_pnl: '300.00',
      running_peak: '300.00',
      drawdown: '0.00',
      drawdown_pct: '0.00',
    },
    {
      trade_id: 2,
      symbol: 'TSLA',
      exit_time: '2026-10-10T12:00:00Z',
      pnl: '-150.00',
      cumulative_pnl: '150.00',
      running_peak: '300.00',
      drawdown: '150.00',
      drawdown_pct: '50.00',
    },
    {
      trade_id: 3,
      symbol: 'NVDA',
      exit_time: '2026-10-10T14:00:00Z',
      pnl: '190.00',
      cumulative_pnl: '340.00',
      running_peak: '340.00',
      drawdown: '0.00',
      drawdown_pct: '0.00',
    },
  ],
}

describe('AnalyticsPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders zero fabricated data notice and empty states when no closed trades exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockEmptyAnalytics),
      })
    )

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Trading Analytics')).toBeInTheDocument()
    expect(screen.getByText(/Zero Fabricated Data:/i)).toBeInTheDocument()
    expect(await screen.findByText('No equity data to plot')).toBeInTheDocument()
    expect(screen.getByText('Awaiting closed trades')).toBeInTheDocument()
  })

  it('renders populated authoritative metrics, KPIs, and chart titles when closed trades exist', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockPopulatedAnalytics),
      })
    )

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    )

    // Net P&L card
    expect(await screen.findByText('$340.00')).toBeInTheDocument()
    // Win Rate
    expect(screen.getByText('66.7%')).toBeInTheDocument()
    // Profit Factor
    expect(screen.getByText('3.33')).toBeInTheDocument()
    // Realized Equity Curve Card Title
    expect(screen.getByText('Realized Equity Curve')).toBeInTheDocument()
    // Underwater Drawdown Card Title
    expect(screen.getByText('Underwater Drawdown Profile')).toBeInTheDocument()
    // Outcome Breakdown
    expect(screen.getByText('Trade Outcome Breakdown')).toBeInTheDocument()
  })

  it('supports date filtering presets', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockEmptyAnalytics),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    )

    await screen.findByText('Trading Analytics')

    const last30DaysBtn = screen.getByRole('button', { name: /Last 30 Days/i })
    fireEvent.click(last30DaysBtn)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(fetchMock.mock.calls[1][0]).toContain('start_date=')
    })
  })
})
