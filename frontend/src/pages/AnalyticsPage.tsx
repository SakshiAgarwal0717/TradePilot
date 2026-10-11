import * as React from 'react'
import {
  TrendingUp,
  Percent,
  Activity,
  ShieldAlert,
  Info,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  LineChart as LineChartIcon,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { apiRequest, ApiException } from '@/lib/api'
import type { AnalyticsSummary } from '@/types/analytics'

export function AnalyticsPage() {
  const navigate = useNavigate()

  const [preset, setPreset] = React.useState<'all' | '30d' | '90d' | 'ytd'>('all')
  const [startDate, setStartDate] = React.useState<string>('')
  const [endDate, setEndDate] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<AnalyticsSummary | null>(null)

  const fetchAnalytics = React.useCallback(async (start?: string, end?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (start) {
        params.append('start_date', new Date(`${start}T00:00:00`).toISOString())
      }
      if (end) {
        params.append('end_date', new Date(`${end}T23:59:59`).toISOString())
      }
      const queryStr = params.toString() ? `?${params.toString()}` : ''
      const result = await apiRequest<AnalyticsSummary>(`/analytics/summary${queryStr}`)
      setData(result)
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError('Failed to load authoritative analytics from service.')
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handlePresetChange = (selected: 'all' | '30d' | '90d' | 'ytd') => {
    setPreset(selected)
    const today = new Date()
    const formatDate = (d: Date) => d.toISOString().split('T')[0]

    if (selected === 'all') {
      setStartDate('')
      setEndDate('')
      fetchAnalytics('', '')
    } else if (selected === '30d') {
      const past = new Date()
      past.setDate(today.getDate() - 30)
      const s = formatDate(past)
      const e = formatDate(today)
      setStartDate(s)
      setEndDate(e)
      fetchAnalytics(s, e)
    } else if (selected === '90d') {
      const past = new Date()
      past.setDate(today.getDate() - 90)
      const s = formatDate(past)
      const e = formatDate(today)
      setStartDate(s)
      setEndDate(e)
      fetchAnalytics(s, e)
    } else if (selected === 'ytd') {
      const startOfYear = new Date(today.getFullYear(), 0, 1)
      const s = formatDate(startOfYear)
      const e = formatDate(today)
      setStartDate(s)
      setEndDate(e)
      fetchAnalytics(s, e)
    }
  }

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault()
    fetchAnalytics(startDate, endDate)
  }

  const handleResetFilter = () => {
    setPreset('all')
    setStartDate('')
    setEndDate('')
    fetchAnalytics('', '')
  }

  React.useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Formatting helpers
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

  const formatRatio = (val: string | number | null | undefined, suffix = ''): string => {
    if (val === null || val === undefined) return '—'
    const num = typeof val === 'string' ? parseFloat(val) : val
    if (isNaN(num)) return '—'
    return `${num.toFixed(2)}${suffix}`
  }

  const netPnlNum = data ? parseFloat(String(data.net_realized_pnl)) : 0
  const isPositiveNet = netPnlNum >= 0

  // Chart data formatting
  const chartEquityData = React.useMemo(() => {
    if (!data?.equity_curve || data.equity_curve.length === 0) return []
    return data.equity_curve.map((pt, idx) => ({
      index: idx + 1,
      tradeId: pt.trade_id,
      symbol: pt.symbol,
      date: new Date(pt.exit_time).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      timeStr: new Date(pt.exit_time).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      pnl: parseFloat(String(pt.pnl)),
      cumulativePnl: parseFloat(String(pt.cumulative_pnl)),
      runningPeak: parseFloat(String(pt.running_peak)),
      drawdown: -parseFloat(String(pt.drawdown)),
      drawdownPct: parseFloat(String(pt.drawdown_pct)),
    }))
  }, [data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trading Analytics"
        description="Deterministic quantitative performance, equity growth, and drawdown series."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAnalytics(startDate, endDate)}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/journal')}>
              Trade Journal
            </Button>
          </div>
        }
      />

      {/* Zero Fabricated Data Banner */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900">Zero Fabricated Data: </span>
          In adherence to fintech risk reporting best practices, TradePilot does not generate synthetic or fictitious performance curves. Charts will plot strictly from verified journal entries.
        </div>
      </div>

      {/* Date Filter & Preset Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 mr-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Timeframe:
              </span>
              <button
                type="button"
                onClick={() => handlePresetChange('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  preset === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('30d')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  preset === '30d'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('90d')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  preset === '90d'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Last 90 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetChange('ytd')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  preset === 'ytd'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                YTD
              </button>
            </div>

            {/* Custom Range Form */}
            <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <label htmlFor="startDateInput" className="sr-only">Start Date</label>
                <input
                  id="startDateInput"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setPreset('all')
                  }}
                  className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <span className="text-slate-400">to</span>
                <label htmlFor="endDateInput" className="sr-only">End Date</label>
                <input
                  id="endDateInput"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setPreset('all')
                  }}
                  className="px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                Filter
              </Button>
              {(startDate || endDate) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetFilter}
                  className="h-7 text-xs text-slate-500"
                >
                  Clear
                </Button>
              )}
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <ErrorState
          title="Could not load analytics"
          description={error}
          actionLabel="Try Again"
          onAction={() => fetchAnalytics(startDate, endDate)}
        />
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Net Realized P&L */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Cumulative Net P&amp;L</span>
              {data && netPnlNum >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              ) : data && netPnlNum < 0 ? (
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
              ) : null}
            </div>
            <div
              className={`text-2xl font-bold mt-1 tracking-tight ${
                data && netPnlNum > 0
                  ? 'text-emerald-700'
                  : data && netPnlNum < 0
                  ? 'text-rose-700'
                  : 'text-slate-900'
              }`}
            >
              {data ? formatCurrency(data.net_realized_pnl) : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {data && data.closed_trades > 0 ? (
                `Gross: ${formatCurrency(data.gross_profit)} • Fees: ${formatCurrency(data.total_fees)}`
              ) : (
                'Awaiting closed trades'
              )}
            </div>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Win Rate %</span>
              <Percent className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              {data ? formatPct(data.win_rate_pct) : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {data && data.closed_trades > 0
                ? `${data.winning_trades}W • ${data.losing_trades}L • ${data.breakeven_trades}BE`
                : '0 Total Trades'}
            </div>
          </CardContent>
        </Card>

        {/* Profit Factor */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Profit Factor</span>
              <Scale className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              {data ? formatRatio(data.profit_factor) : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {data ? `Losses: ${formatCurrency(data.gross_loss)}` : 'Gross Wins / Gross Losses'}
            </div>
          </CardContent>
        </Card>

        {/* Max Peak Drawdown */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Max Peak Drawdown</span>
              <Activity className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              {data ? formatCurrency(data.max_drawdown_amount) : '—'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {data ? `Peak drop: ${formatPct(data.max_drawdown_pct)}` : 'Historical peak-to-trough'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-3.5">
              <span className="text-[11px] text-slate-500 block">Avg Win / Avg Loss</span>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                <span className="text-emerald-700">{formatCurrency(data.avg_win)}</span>
                <span className="text-slate-400 mx-1">/</span>
                <span className="text-rose-700">{formatCurrency(data.avg_loss)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3.5">
              <span className="text-[11px] text-slate-500 block">Avg Realized R:R</span>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {formatRatio(data.avg_reward_to_risk, ' R')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3.5">
              <span className="text-[11px] text-slate-500 block">Gatekeeper Violation Rate</span>
              <div className="text-sm font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>{formatPct(data.violation_rate_pct)}</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ({data.rejected_evaluations} rej / {data.total_evaluations} evals)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3.5">
              <span className="text-[11px] text-slate-500 block">Recorded Positions</span>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {data.total_trades} total
                <span className="text-xs text-slate-500 font-normal ml-1">
                  ({data.closed_trades} closed, {data.open_trades} open)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Section */}
      {data && chartEquityData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equity Growth Curve */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Realized Equity Curve
              </CardTitle>
              <CardDescription>
                Cumulative net profit/loss progression over completed trades.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartEquityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isPositiveNet ? '#059669' : '#e11d48'} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={isPositiveNet ? '#059669' : '#e11d48'} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload
                          return (
                            <div className="p-2.5 bg-white border border-slate-200 rounded shadow-sm text-xs space-y-1">
                              <div className="font-semibold text-slate-800">
                                Trade #{d.tradeId} • {d.symbol}
                              </div>
                              <div className="text-[10px] text-slate-400">{d.timeStr}</div>
                              <div className="flex justify-between gap-4 pt-1 border-t border-slate-100">
                                <span className="text-slate-500">Trade P&amp;L:</span>
                                <span className={`font-mono font-medium ${d.pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {d.pnl >= 0 ? `+$${d.pnl.toFixed(2)}` : `-$${Math.abs(d.pnl).toFixed(2)}`}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Cumulative:</span>
                                <span className="font-mono font-medium text-slate-800">
                                  ${d.cumulativePnl.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
                    <Area
                      type="monotone"
                      dataKey="cumulativePnl"
                      stroke={isPositiveNet ? '#059669' : '#e11d48'}
                      strokeWidth={2}
                      fill="url(#equityGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Underwater Drawdown Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-600" />
                Underwater Drawdown Profile
              </CardTitle>
              <CardDescription>
                Portfolio decline from the running cumulative equity high-water mark.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartEquityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.0} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload
                          return (
                            <div className="p-2.5 bg-white border border-slate-200 rounded shadow-sm text-xs space-y-1">
                              <div className="font-semibold text-slate-800">
                                Trade #{d.tradeId} • {d.symbol}
                              </div>
                              <div className="text-[10px] text-slate-400">{d.timeStr}</div>
                              <div className="flex justify-between gap-4 pt-1 border-t border-slate-100">
                                <span className="text-slate-500">Drawdown:</span>
                                <span className="font-mono font-medium text-rose-700">
                                  -${Math.abs(d.drawdown).toFixed(2)} ({d.drawdownPct.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-slate-500">Peak Mark:</span>
                                <span className="font-mono text-slate-600">
                                  ${d.runningPeak.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
                    <Area
                      type="monotone"
                      dataKey="drawdown"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      fill="url(#drawdownGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Per-Trade P&L Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChartIcon className="w-4 h-4 text-slate-600" />
                Individual Realized Trade Outliers
              </CardTitle>
              <CardDescription>
                Sequential net returns per closed position.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartEquityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload
                          return (
                            <div className="p-2.5 bg-white border border-slate-200 rounded shadow-sm text-xs">
                              <div className="font-semibold text-slate-800">
                                {d.symbol} (Trade #{d.tradeId})
                              </div>
                              <div className="text-[10px] text-slate-400 mb-1">{d.timeStr}</div>
                              <div className="font-mono font-medium">
                                P&amp;L:{' '}
                                <span className={d.pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                                  {d.pnl >= 0 ? `+$${d.pnl.toFixed(2)}` : `-$${Math.abs(d.pnl).toFixed(2)}`}
                                </span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
                    <Bar dataKey="pnl">
                      {chartEquityData.map((entry) => (
                        <Cell
                          key={`cell-${entry.tradeId}`}
                          fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Trade Outcome Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-slate-600" />
                Trade Outcome Breakdown
              </CardTitle>
              <CardDescription>
                Distribution of wins, losses, and scratch/breakeven trades.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="space-y-3">
                {/* Win Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-emerald-800 flex items-center gap-1">
                      Winning Trades
                    </span>
                    <span className="text-slate-600 font-mono">
                      {data.winning_trades} ({formatPct(data.win_rate_pct)})
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${data.closed_trades > 0 ? (data.winning_trades / data.closed_trades) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Loss Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-rose-800">Losing Trades</span>
                    <span className="text-slate-600 font-mono">
                      {data.losing_trades} (
                      {formatPct(
                        data.closed_trades > 0
                          ? (data.losing_trades / data.closed_trades) * 100
                          : 0
                      )}
                      )
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{
                        width: `${data.closed_trades > 0 ? (data.losing_trades / data.closed_trades) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Breakeven Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">Breakeven Trades ($0 P&amp;L)</span>
                    <span className="text-slate-600 font-mono">
                      {data.breakeven_trades} (
                      {formatPct(
                        data.closed_trades > 0
                          ? (data.breakeven_trades / data.closed_trades) * 100
                          : 0
                      )}
                      )
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-400 rounded-full"
                      style={{
                        width: `${data.closed_trades > 0 ? (data.breakeven_trades / data.closed_trades) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-[10px] text-slate-500 block">Total Realized Volume</span>
                  <span className="font-semibold text-slate-800">{data.closed_trades} Executions</span>
                </div>
                <div className="p-2 bg-slate-50 rounded">
                  <span className="text-[10px] text-slate-500 block">Total Execution Fees</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(data.total_fees)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Equity Growth Curve</CardTitle>
              <CardDescription>Cumulative portfolio balance over time (Recharts)</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<TrendingUp className="w-5 h-5 text-slate-400" />}
                title="No equity data to plot"
                description="Record and close trades in your Trading Journal to render your cumulative portfolio performance curve."
                actionLabel="Go to Journal"
                onAction={() => navigate('/journal')}
                className="min-h-[260px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Underwater Drawdown Profile</CardTitle>
              <CardDescription>Drawdown percentage from all-time portfolio highs</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyState
                icon={<Activity className="w-5 h-5 text-slate-400" />}
                title="No drawdown history"
                description="Drawdown tracking activates automatically once executions commence and reach an equity peak."
                className="min-h-[260px]"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Academic & Non-predictive Disclaimer */}
      <div className="text-center py-2 text-[11px] text-slate-400">
        * Note: Quantitative calculations and drawdown profiles reflect historical journal records only. Past performance is not indicative of future market returns.
      </div>
    </div>
  )
}
