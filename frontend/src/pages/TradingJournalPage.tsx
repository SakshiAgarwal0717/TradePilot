import * as React from 'react'
import {
  Plus,
  Filter,
  ArrowUpDown,
  X,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/FormFields'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, LoadingState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { apiRequest, ApiException } from '@/lib/api'
import { AiTradeReviewModal } from '@/components/journal/AiTradeReviewModal'

export interface Trade {
  id: number
  user_id: number
  symbol: string
  side: 'LONG' | 'SHORT'
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
  quantity: string
  entry_price: string
  exit_price?: string | null
  stop_loss?: string | null
  take_profit?: string | null
  fees: string
  realized_pnl?: string | null
  r_multiple?: string | null
  notes?: string | null
  strategy_tag?: string | null
  entry_time: string
  exit_time?: string | null
  created_at: string
}

interface PaginatedTrades {
  items: Trade[]
  total: number
  skip: number
  limit: number
}

export function TradingJournalPage() {
  const [trades, setTrades] = React.useState<Trade[]>([])
  const [totalCount, setTotalCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [successNotice, setSuccessNotice] = React.useState<string | null>(null)

  // Filters & sorting state
  const [filterSymbol, setFilterSymbol] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState('')
  const [filterSide, setFilterSide] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [sortBy] = React.useState('entry_time')
  const [sortDesc, setSortDesc] = React.useState(true)
  const [page, setPage] = React.useState(0)
  const pageSize = 15

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = React.useState(false)
  const [editingTrade, setEditingTrade] = React.useState<Trade | null>(null)
  const [viewingTrade, setViewingTrade] = React.useState<Trade | null>(null)
  const [deletingTrade, setDeletingTrade] = React.useState<Trade | null>(null)
  const [reviewingTrade, setReviewingTrade] = React.useState<Trade | null>(null)

  // Form inputs
  const [formSymbol, setFormSymbol] = React.useState('NQ')
  const [formSide, setFormSide] = React.useState<'LONG' | 'SHORT'>('LONG')
  const [formStatus, setFormStatus] = React.useState<'DRAFT' | 'OPEN' | 'CLOSED'>('OPEN')
  const [formQuantity, setFormQuantity] = React.useState('1.0')
  const [formEntryPrice, setFormEntryPrice] = React.useState('')
  const [formExitPrice, setFormExitPrice] = React.useState('')
  const [formStopLoss, setFormStopLoss] = React.useState('')
  const [formTakeProfit, setFormTakeProfit] = React.useState('')
  const [formFees, setFormFees] = React.useState('0.00')
  const [formNotes, setFormNotes] = React.useState('')
  const [formStrategyTag, setFormStrategyTag] = React.useState('')
  const [formError, setFormError] = React.useState<string | null>(null)
  const [formSubmitting, setFormSubmitting] = React.useState(false)

  const fetchTrades = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterSymbol.trim()) params.set('symbol', filterSymbol.trim())
      if (filterStatus) params.set('status', filterStatus)
      if (filterSide) params.set('side', filterSide)
      if (startDate) params.set('start_date', new Date(startDate).toISOString())
      if (endDate) params.set('end_date', new Date(endDate).toISOString())
      params.set('sort_by', sortBy)
      params.set('sort_desc', String(sortDesc))
      params.set('skip', String(page * pageSize))
      params.set('limit', String(pageSize))

      const res = await apiRequest<PaginatedTrades>(`/trades/?${params.toString()}`)
      setTrades(res.items || [])
      setTotalCount(res.total || 0)
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError('Failed to load journal records.')
      }
    } finally {
      setLoading(false)
    }
  }, [filterSymbol, filterStatus, filterSide, startDate, endDate, sortBy, sortDesc, page])

  React.useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  const openCreateModal = () => {
    setEditingTrade(null)
    setFormSymbol('NQ')
    setFormSide('LONG')
    setFormStatus('OPEN')
    setFormQuantity('1.0')
    setFormEntryPrice('')
    setFormExitPrice('')
    setFormStopLoss('')
    setFormTakeProfit('')
    setFormFees('0.00')
    setFormNotes('')
    setFormStrategyTag('')
    setFormError(null)
    setIsFormModalOpen(true)
  }

  const openEditModal = (trade: Trade) => {
    setEditingTrade(trade)
    setFormSymbol(trade.symbol)
    setFormSide(trade.side)
    setFormStatus(trade.status as 'DRAFT' | 'OPEN' | 'CLOSED')
    setFormQuantity(trade.quantity)
    setFormEntryPrice(trade.entry_price)
    setFormExitPrice(trade.exit_price || '')
    setFormStopLoss(trade.stop_loss || '')
    setFormTakeProfit(trade.take_profit || '')
    setFormFees(trade.fees || '0.00')
    setFormNotes(trade.notes || '')
    setFormStrategyTag(trade.strategy_tag || '')
    setFormError(null)
    setIsFormModalOpen(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (formStatus === 'CLOSED' && (!formExitPrice || parseFloat(formExitPrice) <= 0)) {
      setFormError('A closed trade requires a positive exit price.')
      return
    }

    setFormSubmitting(true)
    try {
      const payload = {
        symbol: formSymbol.trim(),
        side: formSide,
        status: formStatus,
        quantity: formQuantity,
        entry_price: formEntryPrice,
        exit_price: formStatus === 'CLOSED' && formExitPrice ? formExitPrice : null,
        stop_loss: formStopLoss ? formStopLoss : null,
        take_profit: formTakeProfit ? formTakeProfit : null,
        fees: formFees || '0.00',
        notes: formNotes ? formNotes : null,
        strategy_tag: formStrategyTag ? formStrategyTag : null,
      }

      if (editingTrade) {
        await apiRequest(`/trades/${editingTrade.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setSuccessNotice('Trade updated successfully.')
      } else {
        await apiRequest('/trades/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setSuccessNotice('Trade logged into journal.')
      }

      setIsFormModalOpen(false)
      fetchTrades()
      setTimeout(() => setSuccessNotice(null), 3500)
    } catch (err) {
      if (err instanceof ApiException) {
        setFormError(err.message)
      } else {
        setFormError('An unexpected error occurred saving trade.')
      }
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDeleteTrade = async () => {
    if (!deletingTrade) return
    try {
      await apiRequest(`/trades/${deletingTrade.id}`, { method: 'DELETE' })
      setSuccessNotice('Trade deleted successfully.')
      setDeletingTrade(null)
      fetchTrades()
      setTimeout(() => setSuccessNotice(null), 3500)
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError('Failed to delete trade.')
      }
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trading Journal"
        description="Audit log of planned, open, and closed execution records with quantitative risk tracking."
        actions={
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={openCreateModal}>
              <Plus className="w-3.5 h-3.5" />
              Add Trade
            </Button>
          </div>
        }
      />

      {successNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Search Symbol</label>
              <Input
                placeholder="e.g. NQ, AAPL..."
                value={filterSymbol}
                onChange={(e) => setFilterSymbol(e.target.value)}
                className="h-8"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Status</label>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-8 text-xs"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="OPEN">Open</option>
                <option value="CLOSED">Closed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Direction</label>
              <Select
                value={filterSide}
                onChange={(e) => setFilterSide(e.target.value)}
                className="h-8 text-xs"
              >
                <option value="">All Directions</option>
                <option value="LONG">Long</option>
                <option value="SHORT">Short</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-8 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 flex-1"
                onClick={() => {
                  setFilterSymbol('')
                  setFilterStatus('')
                  setFilterSide('')
                  setStartDate('')
                  setEndDate('')
                }}
              >
                Reset
              </Button>
              <Button variant="secondary" size="sm" className="h-8 flex-1" onClick={fetchTrades}>
                <Filter className="w-3 h-3 mr-1" />
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trades Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Trade Log</CardTitle>
              <CardDescription>
                Verified trade executions and historical P&amp;L records
              </CardDescription>
            </div>
            <div className="text-xs text-slate-500">
              Showing {trades.length} of {totalCount} records
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <LoadingState label="Loading trading journal records..." />
          ) : trades.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No trade entries found"
                description={
                  filterSymbol || filterStatus || filterSide
                    ? 'No records match your active search filters.'
                    : 'Your journal is empty. Add your first trade entry or evaluate a setup in the Risk Gatekeeper.'
                }
                actionLabel="Add Trade"
                onAction={openCreateModal}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                    <th className="py-2.5 px-4">
                      <button
                        type="button"
                        className="flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:underline select-none"
                        onClick={() => setSortDesc(!sortDesc)}
                        aria-label={`Sort by entry date (${sortDesc ? 'descending' : 'ascending'})`}
                      >
                        Entry Date <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </button>
                    </th>
                    <th className="py-2.5 px-4">Symbol</th>
                    <th className="py-2.5 px-4">Side</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Entry</th>
                    <th className="py-2.5 px-4">Exit</th>
                    <th className="py-2.5 px-4">Size</th>
                    <th className="py-2.5 px-4">Stop / Target</th>
                    <th className="py-2.5 px-4">Realized P&amp;L</th>
                    <th className="py-2.5 px-4">R-Multiple</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trades.map((t) => {
                    const pnlNum = t.realized_pnl ? parseFloat(t.realized_pnl) : null
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                          {new Date(t.entry_time).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{t.symbol}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              t.side === 'LONG'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {t.side}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge
                            variant={
                              t.status === 'CLOSED'
                                ? 'neutral'
                                : t.status === 'OPEN'
                                ? 'info'
                                : 'warning'
                            }
                          >
                            {t.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-800">
                          ${parseFloat(t.entry_price).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-800">
                          {t.exit_price ? `$${parseFloat(t.exit_price).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">
                          {parseFloat(t.quantity).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                          {t.stop_loss ? `$${parseFloat(t.stop_loss).toFixed(2)}` : '—'} /{' '}
                          {t.take_profit ? `$${parseFloat(t.take_profit).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold">
                          {pnlNum !== null ? (
                            <span
                              className={
                                pnlNum > 0
                                  ? 'text-emerald-700'
                                  : pnlNum < 0
                                  ? 'text-red-700'
                                  : 'text-slate-600'
                              }
                            >
                              {pnlNum > 0 ? '+' : ''}${pnlNum.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal italic">Unrealized</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {t.r_multiple ? (
                            <span
                              className={
                                parseFloat(t.r_multiple) >= 0 ? 'text-emerald-700' : 'text-red-700'
                              }
                            >
                              {parseFloat(t.r_multiple) > 0 ? '+' : ''}
                              {parseFloat(t.r_multiple).toFixed(2)}R
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingTrade(t)}
                              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                              title="View Details"
                              aria-label={`View details for trade ${t.id} ${t.symbol}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(t)}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-600"
                              title="Edit Trade"
                              aria-label={`Edit trade ${t.id} ${t.symbol}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingTrade(t)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-red-600"
                              title="Delete Trade"
                              aria-label={`Delete trade ${t.id} ${t.symbol}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50/50">
              <span className="text-xs text-slate-500">
                Page {page + 1} of {Math.ceil(totalCount / pageSize)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(page + 1) * pageSize >= totalCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Trade Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingTrade ? `Edit Trade #${editingTrade.id}` : 'Record New Trade Entry'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {formError && (
                  <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label="Symbol"
                    required
                    placeholder="e.g. NQ, AAPL"
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                  />

                  <Select
                    label="Direction"
                    value={formSide}
                    onChange={(e) => setFormSide(e.target.value as 'LONG' | 'SHORT')}
                  >
                    <option value="LONG">Long</option>
                    <option value="SHORT">Short</option>
                  </Select>

                  <Select
                    label="Status"
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as 'DRAFT' | 'OPEN' | 'CLOSED')
                    }
                  >
                    <option value="OPEN">Open</option>
                    <option value="CLOSED">Closed</option>
                    <option value="DRAFT">Draft</option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Entry Price"
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={formEntryPrice}
                    onChange={(e) => setFormEntryPrice(e.target.value)}
                  />

                  <Input
                    label="Quantity / Units"
                    type="number"
                    step="any"
                    required
                    placeholder="1.0"
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Stop Loss"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formStopLoss}
                    onChange={(e) => setFormStopLoss(e.target.value)}
                  />

                  <Input
                    label="Take Profit Target"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formTakeProfit}
                    onChange={(e) => setFormTakeProfit(e.target.value)}
                  />
                </div>

                {/* Conditional Exit Details for Closed Status */}
                {formStatus === 'CLOSED' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-3">
                    <span className="text-xs font-semibold text-slate-800 block">
                      Closed Trade Exit Information
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Exit Price"
                        type="number"
                        step="any"
                        required
                        placeholder="0.00"
                        value={formExitPrice}
                        onChange={(e) => setFormExitPrice(e.target.value)}
                        helperText="Required to calculate net P&L"
                      />

                      <Input
                        label="Commission / Fees ($)"
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={formFees}
                        onChange={(e) => setFormFees(e.target.value)}
                        helperText="Subtracted from gross gain"
                      />
                    </div>
                  </div>
                )}

                <Input
                  label="Setup / Strategy Tag"
                  placeholder="e.g. Trend Continuation, Breakout"
                  value={formStrategyTag}
                  onChange={(e) => setFormStrategyTag(e.target.value)}
                />

                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-medium text-slate-700">Trade Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Execution details, discipline notes, or trade psychology..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="rounded border border-slate-300 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : editingTrade ? 'Update Trade' : 'Save to Journal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Trade #{viewingTrade.id}: {viewingTrade.symbol}
                </h3>
                <Badge variant={viewingTrade.status === 'CLOSED' ? 'neutral' : 'info'}>
                  {viewingTrade.status}
                </Badge>
              </div>
              <button
                onClick={() => setViewingTrade(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-500 block">Direction</span>
                  <span className="font-semibold text-slate-800">{viewingTrade.side}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Position Size</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {parseFloat(viewingTrade.quantity).toFixed(2)} units
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-500 block">Entry Price</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    ${parseFloat(viewingTrade.entry_price).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Exit Price</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {viewingTrade.exit_price
                      ? `$${parseFloat(viewingTrade.exit_price).toFixed(2)}`
                      : 'Still Open'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-500 block">Stop Loss</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {viewingTrade.stop_loss
                      ? `$${parseFloat(viewingTrade.stop_loss).toFixed(2)}`
                      : 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Take Profit</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {viewingTrade.take_profit
                      ? `$${parseFloat(viewingTrade.take_profit).toFixed(2)}`
                      : 'None'}
                  </span>
                </div>
              </div>

              {viewingTrade.status === 'CLOSED' && (
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-600 font-medium">Net Realized P&amp;L</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        parseFloat(viewingTrade.realized_pnl || '0') >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                    >
                      ${parseFloat(viewingTrade.realized_pnl || '0').toFixed(2)}
                    </span>
                  </div>
                  {viewingTrade.r_multiple && (
                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>R-Multiple</span>
                      <span className="font-mono font-semibold">
                        {parseFloat(viewingTrade.r_multiple).toFixed(2)}R
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-0.5">
                    <span>Transaction Fees</span>
                    <span className="font-mono">${parseFloat(viewingTrade.fees).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {viewingTrade.notes && (
                <div>
                  <span className="text-slate-500 block mb-1">Notes</span>
                  <p className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {viewingTrade.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewingTrade(viewingTrade)}
                className="text-blue-700 border-blue-200 bg-blue-50/50 hover:bg-blue-100 hover:text-blue-800"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Review Trade with AI
              </Button>
              <Button variant="outline" size="sm" onClick={() => setViewingTrade(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Trade Review Assistant Modal */}
      {reviewingTrade && (
        <AiTradeReviewModal
          tradeId={reviewingTrade.id}
          symbol={reviewingTrade.symbol}
          isOpen={Boolean(reviewingTrade)}
          onClose={() => setReviewingTrade(null)}
        />
      )}

      {/* Destructive Deletion Confirmation Modal */}
      {deletingTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm bg-white rounded-lg border border-slate-200 shadow-xl p-5">
            <div className="flex items-center gap-3 mb-3 text-red-600">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-sm font-semibold text-slate-900">Confirm Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to permanently delete trade{' '}
              <strong className="text-slate-900">#{deletingTrade.id} ({deletingTrade.symbol})</strong>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingTrade(null)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeleteTrade}>
                Delete Trade
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
