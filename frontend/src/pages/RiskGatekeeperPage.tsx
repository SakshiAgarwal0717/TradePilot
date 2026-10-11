import * as React from 'react'
import {
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  BookOpen,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { apiRequest, ApiException } from '@/lib/api'

interface RuleEvaluation {
  rule_name: string
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED'
  message: string
  details?: Record<string, unknown>
}

interface EvaluationResult {
  evaluation_id?: number
  outcome: 'APPROVED' | 'REJECTED' | 'WARNING'
  account_equity: string
  risk_budget: string
  risk_percentage: string
  per_unit_risk: string
  raw_quantity: string
  recommended_quantity: string
  projected_loss: string
  reward_to_risk_ratio?: string
  target_distance?: string
  stop_distance: string
  rules: RuleEvaluation[]
  summary: string
}

export function RiskGatekeeperPage() {
  const navigate = useNavigate()
  // Trade Parameters Form State
  const [symbol, setSymbol] = React.useState('NQ')
  const [side, setSide] = React.useState<'LONG' | 'SHORT'>('LONG')
  const [accountEquity, setAccountEquity] = React.useState('50000')
  const [riskPercentage, setRiskPercentage] = React.useState('1.00')
  const [entryPrice, setEntryPrice] = React.useState('21000.00')
  const [stopLoss, setStopLoss] = React.useState('20950.00')
  const [targetPrice, setTargetPrice] = React.useState('21150.00')
  const [quantityIncrement, setQuantityIncrement] = React.useState('1')
  const [minRewardRiskRatio, setMinRewardRiskRatio] = React.useState('1.5')
  const [currentDailyLosses, setCurrentDailyLosses] = React.useState('0')

  // UI state
  const [loading, setLoading] = React.useState(false)
  const [savingJournal, setSavingJournal] = React.useState(false)
  const [journalSaved, setJournalSaved] = React.useState(false)
  const [evaluation, setEvaluation] = React.useState<EvaluationResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [actionNotice, setActionNotice] = React.useState<string | null>(null)

  // Load user risk settings from backend on mount to prefill defaults
  React.useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await apiRequest<{
          max_risk_per_trade_pct: string
          max_daily_loss_pct: string
        }>('/settings')
        if (settings) {
          if (settings.max_risk_per_trade_pct) {
            setRiskPercentage(parseFloat(settings.max_risk_per_trade_pct).toFixed(2))
          }
        }
      } catch {
        // Fallback to default state if backend not reached
      }
    }
    loadSettings()
  }, [])

  const handleEvaluate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setActionNotice(null)
    setJournalSaved(false)
    setLoading(true)

    try {
      const payload = {
        account_equity: accountEquity,
        risk_percentage: riskPercentage,
        symbol,
        side,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        target_price: targetPrice ? targetPrice : null,
        quantity_increment: quantityIncrement ? quantityIncrement : null,
        min_reward_risk_ratio: minRewardRiskRatio ? minRewardRiskRatio : '1.5',
        current_daily_losses: currentDailyLosses ? currentDailyLosses : '0',
        save_evaluation: true,
      }

      const res = await apiRequest<EvaluationResult>('/gatekeeper/evaluate', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setEvaluation(res)
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError('Failed to reach Risk Gatekeeper evaluation service.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToJournal = async () => {
    if (!evaluation) return
    if (evaluation.outcome === 'REJECTED') {
      setError('A rejected trade cannot be saved to the journal.')
      return
    }

    setSavingJournal(true)
    setError(null)

    try {
      const tradePayload = {
        symbol,
        side,
        quantity: evaluation.recommended_quantity,
        entry_price: entryPrice,
        stop_loss: stopLoss,
        take_profit: targetPrice ? targetPrice : null,
        strategy_tag: 'Gatekeeper Verified',
        notes: `Simulated via Gatekeeper (R:R ${evaluation.reward_to_risk_ratio || 'N/A'}:1, Projected Risk $${parseFloat(evaluation.projected_loss).toFixed(2)})`,
      }

      await apiRequest(`/trades/?evaluation_id=${evaluation.evaluation_id}`, {
        method: 'POST',
        body: JSON.stringify(tradePayload),
      })

      setJournalSaved(true)
      setActionNotice('Trade successfully logged in Trading Journal!')
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError('Failed to record trade to journal.')
      }
    } finally {
      setSavingJournal(false)
    }
  }

  const getOutcomeBadge = (outcome: 'APPROVED' | 'REJECTED' | 'WARNING') => {
    switch (outcome) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            CLEARANCE APPROVED
          </span>
        )
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            CONDITIONAL WARNING
          </span>
        )
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-4 h-4 text-red-600" />
            EXECUTION REJECTED
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rule-based Risk Gatekeeper"
        description="Deterministic pre-flight risk evaluation and position sizing engine."
      />

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div>
            <span className="font-semibold block">Gatekeeper Validation Error</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {actionNotice && (
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/journal')}
            className="h-7 text-xs bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100"
          >
            View in Journal
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: Multi-section Trade Parameters */}
        <div className="lg:col-span-7">
          <form onSubmit={handleEvaluate}>
            <Card>
              <CardHeader>
                <CardTitle>Trade Pre-Flight Parameters</CardTitle>
                <CardDescription>
                  Configure account context and prospective order parameters for rule verification.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Section 1: Portfolio & Risk Parameters */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                    1. Account &amp; Risk Envelope
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Account Equity ($)"
                      type="number"
                      step="any"
                      required
                      value={accountEquity}
                      onChange={(e) => setAccountEquity(e.target.value)}
                      disabled={loading}
                    />

                    <Input
                      label="Risk % Per Trade"
                      type="number"
                      step="0.01"
                      required
                      value={riskPercentage}
                      onChange={(e) => setRiskPercentage(e.target.value)}
                      disabled={loading}
                    />

                    <Input
                      label="Daily Losses So Far ($)"
                      type="number"
                      step="any"
                      value={currentDailyLosses}
                      onChange={(e) => setCurrentDailyLosses(e.target.value)}
                      disabled={loading}
                      helperText="Recorded realized loss"
                    />
                  </div>
                </div>

                {/* Section 2: Order Specifications */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                    2. Order Specifications
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <Select
                      label="Symbol / Instrument"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      disabled={loading}
                    >
                      <option value="NQ">NQ (E-mini Nasdaq-100)</option>
                      <option value="ES">ES (E-mini S&P 500)</option>
                      <option value="BTCUSDT">BTC/USDT (Crypto)</option>
                      <option value="EURUSD">EUR/USD (FX)</option>
                      <option value="AAPL">AAPL (Equity)</option>
                    </Select>

                    <Select
                      label="Direction"
                      value={side}
                      onChange={(e) => setSide(e.target.value as 'LONG' | 'SHORT')}
                      disabled={loading}
                    >
                      <option value="LONG">LONG (Buy Setup)</option>
                      <option value="SHORT">SHORT (Sell Setup)</option>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Entry Price"
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      disabled={loading}
                    />

                    <Input
                      label="Stop Loss Price"
                      type="number"
                      step="any"
                      required
                      placeholder="0.00"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      disabled={loading}
                      helperText="Strict stop requirement"
                    />

                    <Input
                      label="Target Price"
                      type="number"
                      step="any"
                      placeholder="Optional"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      disabled={loading}
                      helperText="Required for R:R check"
                    />
                  </div>
                </div>

                {/* Section 3: Sizing & Ratio Constraints */}
                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                    3. Sizing &amp; Ratio Constraints
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Quantity Increment / Lot Size"
                      type="number"
                      step="any"
                      placeholder="1"
                      value={quantityIncrement}
                      onChange={(e) => setQuantityIncrement(e.target.value)}
                      disabled={loading}
                      helperText="e.g. 1 for full contracts, 0.1 for micro"
                    />

                    <Input
                      label="Min Reward-to-Risk (R:R)"
                      type="number"
                      step="0.1"
                      value={minRewardRiskRatio}
                      onChange={(e) => setMinRewardRiskRatio(e.target.value)}
                      disabled={loading}
                      helperText="Default rule threshold: 1.5:1"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Simulates position sizing: calculates risk budget from account equity, evaluates stop distance,
                    checks minimum R:R ratio, rounds quantity down to the permitted increment, and blocks daily loss breaches.
                  </span>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between border-t border-slate-100 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setEntryPrice('')
                    setStopLoss('')
                    setTargetPrice('')
                    setEvaluation(null)
                    setError(null)
                  }}
                  disabled={loading}
                >
                  Reset Form
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={loading}>
                  {loading ? 'Evaluating Rules...' : 'Run Gatekeeper Evaluation'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        {/* Right Panel: Calculated Results & Rule Explanations */}
        <div className="lg:col-span-5 space-y-4">
          {evaluation ? (
            <>
              {/* Outcome Banner */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle>Evaluation Diagnostic</CardTitle>
                    {getOutcomeBadge(evaluation.outcome)}
                  </div>
                  <CardDescription>{evaluation.summary}</CardDescription>
                </CardHeader>
                <CardContent className="pt-2 space-y-3">
                  {/* Quantitative Sizing Matrix */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Risk Budget</span>
                      <span className="text-sm font-bold text-slate-900">
                        ${parseFloat(evaluation.risk_budget).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Stop Distance</span>
                      <span className="text-sm font-bold text-slate-900">
                        {parseFloat(evaluation.stop_distance).toFixed(2)} pts
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Recommended Size</span>
                      <span className="text-sm font-bold text-blue-700">
                        {parseFloat(evaluation.recommended_quantity).toFixed(2)} units
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Projected Max Loss</span>
                      <span className="text-sm font-bold text-slate-900">
                        ${parseFloat(evaluation.projected_loss).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {evaluation.reward_to_risk_ratio && (
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Reward-to-Risk Ratio</span>
                      <span className="text-sm font-bold text-slate-900">
                        {parseFloat(evaluation.reward_to_risk_ratio).toFixed(2)} : 1
                      </span>
                    </div>
                  )}

                  {/* Individual Rule Verification Explanations */}
                  <div className="pt-2">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Rule Verification Matrix
                    </h5>
                    <div className="space-y-2">
                      {evaluation.rules.map((rule, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded border text-xs flex items-start gap-2.5 ${
                            rule.status === 'PASS'
                              ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                              : rule.status === 'WARNING'
                              ? 'bg-amber-50/60 border-amber-200 text-slate-800'
                              : 'bg-red-50/60 border-red-200 text-slate-800'
                          }`}
                        >
                          {rule.status === 'PASS' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          )}
                          {rule.status === 'WARNING' && (
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          )}
                          {rule.status === 'FAIL' && (
                            <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          )}

                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">{rule.rule_name}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  rule.status === 'PASS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : rule.status === 'WARNING'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {rule.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">{rule.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  {evaluation.outcome !== 'REJECTED' ? (
                    <div className="w-full flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 justify-center"
                        onClick={handleSaveToJournal}
                        disabled={savingJournal || journalSaved}
                      >
                        <BookOpen className="w-4 h-4 mr-1.5" />
                        {journalSaved
                          ? 'Logged in Journal'
                          : savingJournal
                          ? 'Saving...'
                          : 'Record Approved Trade in Journal'}
                      </Button>
                      {journalSaved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/journal')}
                          className="text-xs"
                        >
                          Go to Journal
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="w-full p-2.5 rounded bg-red-50 border border-red-200 text-center text-xs text-red-700 font-medium">
                      Cannot save rejected trade to journal. Adjust parameters to pass safety rules.
                    </div>
                  )}
                </CardFooter>
              </Card>
            </>
          ) : (
            <>
              {/* Initial Rules Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Active Rule Matrix</CardTitle>
                    <Badge variant="info">Enforcement Active</Badge>
                  </div>
                  <CardDescription>
                    Rules checked before a trade is granted clearance.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 rounded border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        1. Stop Loss Mandatory
                      </span>
                      <Badge variant="neutral">Rule #1</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Orders missing a predefined numeric stop loss trigger an instant rejection.
                    </p>
                  </div>

                  <div className="p-3 rounded border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        2. Directional Stop Alignment
                      </span>
                      <Badge variant="neutral">Rule #2</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Long stop must be below entry. Short stop must be above entry.
                    </p>
                  </div>

                  <div className="p-3 rounded border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        3. Reward-to-Risk Requirement
                      </span>
                      <Badge variant="neutral">Rule #3</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Enforces target placement with minimum 1.5:1 reward-to-risk ratio.
                    </p>
                  </div>

                  <div className="p-3 rounded border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        4. Daily Drawdown Guard
                      </span>
                      <Badge variant="neutral">Rule #4</Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Prevents entries if projected loss causes daily loss limit breach.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Decision Support Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 bg-slate-100/70 rounded border border-slate-200">
                    <ShieldCheck className="w-5 h-5 text-slate-500" />
                    <div>
                      <div className="text-xs font-medium text-slate-800">Awaiting Submission</div>
                      <div className="text-[11px] text-slate-500">
                        Input parameters and trigger evaluation to view rule approval diagnostics.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
