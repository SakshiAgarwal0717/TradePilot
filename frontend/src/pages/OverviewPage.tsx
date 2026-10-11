import * as React from 'react'
import { Shield, TrendingUp, AlertTriangle, Plus, Eye, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '@/lib/api'
import type { AnalyticsSummary } from '@/types/analytics'
import type { Trade } from '@/pages/TradingJournalPage'

interface PaginatedTrades {
  items: Trade[]
  total: number
  skip: number
  limit: number
}

export function OverviewPage() {
  const navigate = useNavigate()
  const [analytics, setAnalytics] = React.useState<AnalyticsSummary | null>(null)
  const [recentTrades, setRecentTrades] = React.useState<Trade[]>([])

  React.useEffect(() => {
    let isMounted = true

    async function loadOverviewData() {
      try {
        const [analyticsRes, tradesRes] = await Promise.allSettled([
          apiRequest<AnalyticsSummary>('/analytics/summary'),
          apiRequest<PaginatedTrades>('/trades/?limit=5'),
        ])

        if (!isMounted) return

        if (analyticsRes.status === 'fulfilled') {
          setAnalytics(analyticsRes.value)
        }
        if (tradesRes.status === 'fulfilled') {
          setRecentTrades(tradesRes.value.items || [])
        }
      } catch {
        // Fallback gracefully
      }
    }

    loadOverviewData()
    return () => {
      isMounted = false
    }
  }, [])

  const formatCurrency = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '—'
    const num = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(num)) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const formatPct = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '—'
    const num = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(num)) return '—'
    return `${num.toFixed(1)}%`
  }

  const netPnl = analytics ? parseFloat(String(analytics.net_realized_pnl)) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Core risk metrics, trade discipline alerts, and activity snapshots."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/risk-gatekeeper')}>
              Validate Trade
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/journal')}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Trade
            </Button>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Risk Gate Status */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Risk Gate Status</span>
              <span className="p-1.5 rounded bg-emerald-50 text-emerald-700">
                <Shield className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-bold tracking-tight text-slate-900">Enforced</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {analytics && analytics.total_evaluations > 0
                  ? `${analytics.approved_evaluations} approved of ${analytics.total_evaluations} evaluations`
                  : 'Active pre-flight validation'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Net Realized P&L */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Net Realized P&amp;L</span>
              <span
                className={`p-1.5 rounded ${
                  netPnl >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {netPnl >= 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
              </span>
            </div>
            <div className="mt-3">
              <span
                className={`text-xl font-bold tracking-tight ${
                  netPnl > 0
                    ? 'text-emerald-700'
                    : netPnl < 0
                    ? 'text-rose-700'
                    : 'text-slate-900'
                }`}
              >
                {analytics ? formatCurrency(analytics.net_realized_pnl) : '—'}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Win Rate: {analytics ? formatPct(analytics.win_rate_pct) : '—'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Max Peak Drawdown */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Max Peak Drawdown</span>
              <span className="p-1.5 rounded bg-amber-50 text-amber-700">
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                {analytics ? formatCurrency(analytics.max_drawdown_amount) : '—'}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {analytics ? `Decline: ${formatPct(analytics.max_drawdown_pct)}` : 'Peak-to-trough drop'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Journal Entries */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Journal Entries</span>
              <span className="p-1.5 rounded bg-blue-50 text-blue-700">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-xl font-bold tracking-tight text-slate-900">
                {analytics ? analytics.total_trades : 0}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {analytics
                  ? `${analytics.closed_trades} closed, ${analytics.open_trades} open`
                  : 'Total logged executions'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Trades</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative feed of logged executions evaluated against risk rules.
            </p>
          </div>
          {recentTrades.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/journal')} className="text-xs">
              View All Journal Entries
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {recentTrades.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-medium">
                    <th className="py-2.5 px-4">Date &amp; Time</th>
                    <th className="py-2.5 px-4">Instrument</th>
                    <th className="py-2.5 px-4">Side</th>
                    <th className="py-2.5 px-4">Entry / Stop</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Realized P&amp;L</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTrades.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-4 text-slate-600">
                        {new Date(t.entry_time).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{t.symbol}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant={t.side === 'LONG' ? 'profit' : 'loss'}>
                          {t.side}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        ${parseFloat(t.entry_price).toFixed(2)} /{' '}
                        {t.stop_loss ? `$${parseFloat(t.stop_loss).toFixed(2)}` : 'None'}
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
                      <td className="py-2.5 px-4 font-mono font-medium">
                        {t.status === 'CLOSED' && t.realized_pnl !== null && t.realized_pnl !== undefined ? (
                          <span
                            className={
                              parseFloat(t.realized_pnl) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }
                          >
                            {parseFloat(t.realized_pnl) >= 0 ? '+' : ''}
                            ${parseFloat(t.realized_pnl).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/journal')}
                          className="h-6 px-2 text-slate-500 hover:text-slate-900"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No recent trades recorded"
                description="Your journal is empty. Use the Trade Form or Risk Gatekeeper to validate and record your first trade."
                actionLabel="Add Trade"
                onAction={() => navigate('/journal')}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
