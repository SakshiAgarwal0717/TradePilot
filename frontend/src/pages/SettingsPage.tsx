import * as React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Shield, Bell, Check, AlertCircle, RefreshCw } from 'lucide-react'
import { apiRequest, ApiException } from '@/lib/api'

interface RiskSettingsResponse {
  max_risk_per_trade_pct: string
  max_daily_loss_pct: string
  max_open_positions: number
  enforce_mandatory_stop_loss: boolean
  base_currency: string
}

export function SettingsPage() {
  const [maxRiskPercent, setMaxRiskPercent] = React.useState('1.00')
  const [maxDailyLossPercent, setMaxDailyLossPercent] = React.useState('2.00')
  const [hardStopRequired, setHardStopRequired] = React.useState(true)
  const [maxOpenPositions, setMaxOpenPositions] = React.useState('3')
  const [currency, setCurrency] = React.useState('USD')

  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch persisted settings from backend
  const fetchSettings = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiRequest<RiskSettingsResponse>('/settings')
      if (data) {
        setMaxRiskPercent(parseFloat(data.max_risk_per_trade_pct).toFixed(2))
        setMaxDailyLossPercent(parseFloat(data.max_daily_loss_pct).toFixed(2))
        setMaxOpenPositions(String(data.max_open_positions || 3))
        setHardStopRequired(data.enforce_mandatory_stop_loss !== false)
        setCurrency(data.base_currency || 'USD')
      }
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError('Could not load preferences from backend.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setSaving(true)
    setSaved(false)

    try {
      const payload = {
        max_risk_per_trade_pct: maxRiskPercent,
        max_daily_loss_pct: maxDailyLossPercent,
        max_open_positions: parseInt(maxOpenPositions, 10) || 3,
        enforce_mandatory_stop_loss: hardStopRequired,
        base_currency: currency,
      }

      await apiRequest<RiskSettingsResponse>('/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError('Failed to update settings.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefaults = () => {
    setMaxRiskPercent('1.00')
    setMaxDailyLossPercent('2.00')
    setMaxOpenPositions('3')
    setHardStopRequired(true)
    setCurrency('USD')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Preferences"
        description="Configure your risk management bounds, account currency, and platform rules."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSettings}
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Reload Settings
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Risk preferences successfully saved and synchronized with the Gatekeeper.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Risk Governance Profile */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <CardTitle>Risk Gatekeeper Policies</CardTitle>
              </div>
              <CardDescription>
                Systematic rules applied to reject high-risk or reckless entries.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSave}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Max Risk Per Trade (%)"
                    type="number"
                    step="0.05"
                    min="0.01"
                    max="100.00"
                    required
                    value={maxRiskPercent}
                    onChange={(e) => setMaxRiskPercent(e.target.value)}
                    helperText="Default hard ceiling: 1.0%"
                  />

                  <Input
                    label="Max Daily Loss Limit (%)"
                    type="number"
                    step="0.1"
                    min="0.01"
                    max="100.00"
                    required
                    value={maxDailyLossPercent}
                    onChange={(e) => setMaxDailyLossPercent(e.target.value)}
                    helperText="Trading halted if daily equity drops past this"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Max Concurrent Open Positions"
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={maxOpenPositions}
                    onChange={(e) => setMaxOpenPositions(e.target.value)}
                    helperText="Limits simultaneous portfolio exposure"
                  />

                  <Select
                    label="Base Reporting Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="USD">USD - US Dollar ($)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="GBP">GBP - British Pound (£)</option>
                    <option value="INR">INR - Indian Rupee (₹)</option>
                  </Select>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 p-3 rounded border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={hardStopRequired}
                      onChange={(e) => setHardStopRequired(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Enforce Mandatory Stop Loss
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Instantly disqualify prospective trades submitted to the Gatekeeper without a numeric stop price.
                      </span>
                    </div>
                  </label>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-slate-100 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={handleResetDefaults}
                  disabled={saving}
                >
                  Reset Defaults
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={saving}>
                  {saving ? (
                    'Saving...'
                  ) : saved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                      Preferences Saved
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* Notifications Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-600" />
                <CardTitle>Discipline &amp; Risk Alerts</CardTitle>
              </div>
              <CardDescription>Notification triggers for risk boundary breaches</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center justify-between text-xs text-slate-700 p-2 rounded hover:bg-slate-50 transition-colors cursor-pointer">
                <span>Alert on approaching 80% of daily loss limit</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-slate-700 p-2 rounded hover:bg-slate-50 transition-colors cursor-pointer">
                <span>Notify upon consecutive loss streak (3+ trades)</span>
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </CardContent>
          </Card>
        </div>

        {/* Info / Metadata Box */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Architecture Status</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3 text-slate-600">
              <div className="flex justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Platform Tier</span>
                <span className="font-semibold text-slate-800">Academic / Prototyping</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Engine Backend</span>
                <span className="font-semibold text-slate-800">FastAPI (Python)</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Persistence</span>
                <span className="font-semibold text-slate-800">SQLite + SQLAlchemy</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Frontend Client</span>
                <span className="font-semibold text-slate-800">React + TS + Vite</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
