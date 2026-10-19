import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AiTradeReviewModal } from '@/components/journal/AiTradeReviewModal'
import { TradingJournalPage } from '@/pages/TradingJournalPage'
import { MemoryRouter } from 'react-router-dom'
import * as apiModule from '@/lib/api'

describe('AI Trade Review Assistant Frontend Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const mockReviewResponse = {
    trade_id: 42,
    symbol: 'AAPL',
    strengths: [
      'Stop loss respected cleanly according to pre-trade risk budget.',
      'Positive reward-to-risk ratio achieved upon exit.',
    ],
    improvement_areas: [
      'Commission fees slightly eroded net gains on small position sizing.',
    ],
    evidence: [
      'Entry price $150.00, stop loss $148.00, exit price $155.00.',
      'Realized P&L was $48.00 after $2.00 in execution fees.',
    ],
    lessons_learned: [
      'Consistent risk discipline preserves emotional capital during consolidation.',
    ],
    disclaimer:
      'This review is an educational decision-support summary derived strictly from recorded trade data.',
  }

  // 1. The AI Review action appears in the trade detail context
  it('renders the "Review Trade with AI" action inside the trade details view', async () => {
    const mockTrade = {
      id: 42,
      user_id: 1,
      symbol: 'AAPL',
      side: 'LONG',
      status: 'CLOSED',
      quantity: '10.0',
      entry_price: '150.00',
      exit_price: '155.00',
      fees: '2.00',
      realized_pnl: '48.00',
      r_multiple: '2.40',
      notes: 'Breakout trade test',
      entry_time: '2026-10-18T10:00:00Z',
      created_at: '2026-10-18T10:00:00Z',
    }

    vi.spyOn(apiModule, 'apiRequest').mockImplementation((url: string) => {
      if (url.includes('/trades/')) {
        return Promise.resolve({ items: [mockTrade], total: 1, skip: 0, limit: 15 }) as any
      }
      return Promise.resolve({}) as any
    })

    render(
      <MemoryRouter>
        <TradingJournalPage />
      </MemoryRouter>
    )

    // Wait for trade to load
    expect(await screen.findByText('AAPL')).toBeInTheDocument()

    // Click view trade details
    const viewBtn = screen.getByLabelText(/View details for trade 42 AAPL/i)
    fireEvent.click(viewBtn)

    // Expect modal to show "Review Trade with AI"
    expect(screen.getByRole('button', { name: /Review Trade with AI/i })).toBeInTheDocument()
  })

  // 2. Clicking it invokes the correct API endpoint with correct body
  it('invokes the correct API endpoint with trade_id and focus_area', async () => {
    const apiSpy = vi.spyOn(apiModule, 'apiRequest').mockResolvedValue(mockReviewResponse)

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={() => {}}
      />
    )

    await waitFor(() => {
      expect(apiSpy).toHaveBeenCalledWith(
        '/ai-review/trade/42',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ focus_area: 'general' }),
        })
      )
    })
  })

  // 3. A successful response renders all review sections with counts and disclaimer
  it('renders all review sections upon successful response', async () => {
    vi.spyOn(apiModule, 'apiRequest').mockResolvedValue(mockReviewResponse)

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={() => {}}
      />
    )

    // Check header info
    expect(await screen.findByText(/AI Trade Review Assistant/i)).toBeInTheDocument()

    // Section 1: Strengths
    expect(screen.getByText('Observed Strengths')).toBeInTheDocument()
    expect(screen.getByText('2 points')).toBeInTheDocument()
    expect(
      screen.getByText('Stop loss respected cleanly according to pre-trade risk budget.')
    ).toBeInTheDocument()

    // Section 2: Areas for Improvement
    expect(screen.getByText('Areas for Improvement')).toBeInTheDocument()
    expect(screen.getByText('1 point')).toBeInTheDocument()
    expect(
      screen.getByText('Commission fees slightly eroded net gains on small position sizing.')
    ).toBeInTheDocument()

    // Section 3: Evidence
    expect(screen.getByText('Cited Trade Evidence')).toBeInTheDocument()
    expect(screen.getByText('2 items')).toBeInTheDocument()
    expect(
      screen.getByText('Entry price $150.00, stop loss $148.00, exit price $155.00.')
    ).toBeInTheDocument()

    // Section 4: Lessons Learned
    expect(screen.getByText(/Lessons Learned & Takeaways/i)).toBeInTheDocument()
    expect(screen.getByText('1 lesson')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Consistent risk discipline preserves emotional capital during consolidation.'
      )
    ).toBeInTheDocument()

    // Section 5: Disclaimer
    expect(
      screen.getByText(
        'This review is an educational decision-support summary derived strictly from recorded trade data.'
      )
    ).toBeInTheDocument()
  })

  // 4. Loading state is visible and duplicate requests prevented
  it('displays loading state and prevents duplicate requests while pending', async () => {
    let resolvePromise: (val: any) => void = () => {}
    const slowPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    const apiSpy = vi.spyOn(apiModule, 'apiRequest').mockReturnValue(slowPromise as any)

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(screen.getByText('Generating Trade Review...')).toBeInTheDocument()
    expect(apiSpy).toHaveBeenCalledTimes(1)

    // Complete the call
    resolvePromise(mockReviewResponse)
    expect(await screen.findByText('Observed Strengths')).toBeInTheDocument()
  })

  // 5. Backend configuration error (503) is displayed clearly
  it('displays a clear missing configuration error when backend returns HTTP 503', async () => {
    const error503 = new apiModule.ApiException(
      {
        code: 'HTTP_503',
        message: 'AI Review Assistant is not configured. OPENROUTER_API_KEY is not set.',
      },
      503
    )
    vi.spyOn(apiModule, 'apiRequest').mockRejectedValue(error503)

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(await screen.findByText('AI Assistant Not Configured')).toBeInTheDocument()
    expect(
      screen.getByText('AI Review Assistant is not configured. OPENROUTER_API_KEY is not set.')
    ).toBeInTheDocument()
    expect(screen.getAllByText(/OPENROUTER_API_KEY/i).length).toBeGreaterThan(0)
  })

  // 6. Provider or network error is displayed safely with retry button
  it('displays a safe error message and retry button on upstream failure', async () => {
    const error502 = new apiModule.ApiException(
      {
        code: 'HTTP_502',
        message: 'AI provider returned an upstream error (HTTP 500).',
      },
      502
    )
    const apiSpy = vi.spyOn(apiModule, 'apiRequest').mockRejectedValueOnce(error502)

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(await screen.findByText('Review Generation Failed')).toBeInTheDocument()
    expect(
      screen.getByText('AI provider returned an upstream error (HTTP 500).')
    ).toBeInTheDocument()

    // Test retry action
    apiSpy.mockResolvedValueOnce(mockReviewResponse)
    const retryBtn = screen.getByRole('button', { name: /Retry Review/i })
    fireEvent.click(retryBtn)

    expect(await screen.findByText('Observed Strengths')).toBeInTheDocument()
  })

  // 7. A review for one trade is not displayed after switching to another trade, and late responses ignored
  it('resets state and loads new review when tradeId changes, ignoring late responses', async () => {
    let resolveFirst: (val: any) => void = () => {}
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })

    const apiSpy = vi.spyOn(apiModule, 'apiRequest').mockImplementation((url: string) => {
      if (url.includes('/trade/42')) {
        return firstPromise as any
      }
      if (url.includes('/trade/99')) {
        return Promise.resolve({
          ...mockReviewResponse,
          trade_id: 99,
          symbol: 'TSLA',
          strengths: ['TSLA Disciplined Sizing'],
        }) as any
      }
      return Promise.resolve({}) as any
    })

    const { rerender } = render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(screen.getByText('Generating Trade Review...')).toBeInTheDocument()

    // Switch to trade 99 while trade 42 is still loading
    rerender(
      <AiTradeReviewModal
        tradeId={99}
        symbol="TSLA"
        isOpen={true}
        onClose={() => {}}
      />
    )

    // TSLA review finishes and renders
    expect(await screen.findByText('TSLA Disciplined Sizing')).toBeInTheDocument()

    // Now late response for trade 42 resolves
    resolveFirst({
      ...mockReviewResponse,
      trade_id: 42,
      symbol: 'AAPL',
      strengths: ['AAPL Stale Finding Should Not Render'],
    })

    // Confirm trade 42's late response did not overwrite trade 99
    expect(screen.queryByText('AAPL Stale Finding Should Not Render')).not.toBeInTheDocument()
    expect(screen.getByText('TSLA Disciplined Sizing')).toBeInTheDocument()
    expect(apiSpy).toHaveBeenCalledWith('/ai-review/trade/99', expect.anything())
  })

  // 8. Closing the review modal invokes onClose and returns without error
  it('invokes onClose when the close button or header cross is clicked', async () => {
    vi.spyOn(apiModule, 'apiRequest').mockResolvedValue(mockReviewResponse)
    const handleClose = vi.fn()

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={handleClose}
      />
    )

    expect(await screen.findByText('Observed Strengths')).toBeInTheDocument()

    const closeBtn = screen.getByRole('button', { name: /Close review dialog/i })
    fireEvent.click(closeBtn)

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  // 9. Displays empty findings state without fabricating data when all lists are empty
  it('displays empty findings state clearly without fabricating data when no findings returned', async () => {
    const emptyFindingsResponse = {
      trade_id: 42,
      symbol: 'AAPL',
      strengths: [],
      improvement_areas: [],
      evidence: [],
      lessons_learned: [],
      disclaimer: 'Educational disclaimer without fabrication.',
    }

    vi.spyOn(apiModule, 'apiRequest').mockResolvedValue(emptyFindingsResponse)

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(await screen.findByText('No Review Findings Available')).toBeInTheDocument()
    expect(
      screen.getByText(/no conclusive strengths, improvement areas, or lessons were identified/i)
    ).toBeInTheDocument()
    expect(screen.getByText('Educational disclaimer without fabrication.')).toBeInTheDocument()
  })

  // 10. Copy action copies the full structured review to clipboard
  it('copies review text to clipboard when copy button is clicked', async () => {
    vi.spyOn(apiModule, 'apiRequest').mockResolvedValue(mockReviewResponse)

    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    })

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={() => {}}
      />
    )

    expect(await screen.findByText('Observed Strengths')).toBeInTheDocument()

    const copyBtn = screen.getByRole('button', { name: /Copy review text to clipboard/i })
    fireEvent.click(copyBtn)

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1)
      const copiedText = writeTextMock.mock.calls[0][0]
      expect(copiedText).toContain('AI Trade Review - AAPL (Trade #42)')
      expect(copiedText).toContain('Stop loss respected cleanly according to pre-trade risk budget.')
      expect(copiedText).toContain('Realized P&L was $48.00 after $2.00 in execution fees.')
      expect(copiedText).toContain('DISCLAIMER')
    })

    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  // 11. Escape key triggers dialog close
  it('closes dialog on Escape key press', async () => {
    vi.spyOn(apiModule, 'apiRequest').mockResolvedValue(mockReviewResponse)
    const handleClose = vi.fn()

    render(
      <AiTradeReviewModal
        tradeId={42}
        symbol="AAPL"
        isOpen={true}
        onClose={handleClose}
      />
    )

    expect(await screen.findByText('Observed Strengths')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
