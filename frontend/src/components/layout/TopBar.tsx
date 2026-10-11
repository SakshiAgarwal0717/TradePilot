import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Bell, User, ShieldCheck, LogOut, CheckCircle2, Sliders } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

interface TopBarProps {
  onMenuClick: () => void
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Platform Overview', subtitle: 'Executive risk and journaling performance dashboard' },
  '/risk-gatekeeper': { title: 'Risk Gatekeeper', subtitle: 'Pre-trade rule enforcement and parameter checks' },
  '/journal': { title: 'Trading Journal', subtitle: 'Systematic trade logs and execution records' },
  '/analytics': { title: 'Trading Analytics', subtitle: 'Statistical equity curve and risk-adjusted metrics' },
  '/settings': { title: 'Settings & Preferences', subtitle: 'Account preferences, risk bounds, and journal configuration' },
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [showAlerts, setShowAlerts] = React.useState(false)

  const current = pageTitles[location.pathname] || {
    title: 'TradePilot',
    subtitle: 'Risk-aware trading platform',
  }

  // Close alerts popover on click outside
  const alertsRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setShowAlerts(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Mobile Toggle + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 lg:hidden"
          aria-label="Open sidebar menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900">{current.title}</span>
        </div>
      </div>

      {/* Contextual actions & Profile */}
      <div className="flex items-center gap-3">
        {/* Risk Status Indicator */}
        <button
          type="button"
          onClick={() => navigate('/risk-gatekeeper')}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100/70 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          title="Click to open Risk Gatekeeper"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Rules Active</span>
        </button>

        {/* Alerts popover */}
        <div className="relative" ref={alertsRef}>
          <button
            type="button"
            onClick={() => setShowAlerts(!showAlerts)}
            className="relative p-1.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
            title="System Alerts & Notifications"
            aria-label="Notifications"
            aria-expanded={showAlerts}
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>

          {showAlerts && (
            <div className="absolute right-0 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 font-semibold text-slate-900">
                <span>System Monitoring</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-normal">
                  Live Guard
                </span>
              </div>
              <div className="py-2.5 space-y-2 text-slate-600">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-slate-800 block">Risk Gatekeeper Enforced</span>
                    <span className="text-[11px] text-slate-500">
                      Pre-flight limits and mandatory stop orders active.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium text-slate-800 block">Journal Isolation Online</span>
                    <span className="text-[11px] text-slate-500">
                      Realized calculations verified against database records.
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAlerts(false)
                    navigate('/settings')
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800"
                >
                  <Sliders className="w-3 h-3" />
                  Manage Risk Rules
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User profile & logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 border border-slate-300">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-medium text-slate-800 leading-none">
              {user ? user.username : 'Desk Trader'}
            </span>
            <span className="text-[10px] text-slate-400 leading-none mt-1">
              {user ? user.email : 'Paper Account'}
            </span>
          </div>

          <button
            onClick={() => logout()}
            className="ml-2 p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            title="Log Out"
            aria-label="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
