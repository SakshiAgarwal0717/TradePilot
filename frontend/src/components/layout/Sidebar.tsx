import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShieldAlert,
  BookOpen,
  BarChart3,
  Settings as SettingsIcon,
  Compass,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Risk Gatekeeper', path: '/risk-gatekeeper', icon: ShieldAlert },
  { name: 'Trading Journal', path: '/journal', icon: BookOpen },
  { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: SettingsIcon },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#0b1329] border-r border-[#1e294b] transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Branding */}
        <div className="flex h-14 items-center justify-between px-5 border-b border-[#1e294b]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white font-semibold">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white block">
                TradePilot
              </span>
              <span className="text-[10px] text-slate-400 block -mt-0.5 tracking-wider font-medium uppercase">
                Risk & Analytics
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Platform Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-[#1d2c54] text-white font-semibold border-l-2 border-blue-500 pl-[10px]'
                      : 'text-slate-300 hover:bg-[#141f3d] hover:text-white'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-white" />
                <span>{item.name}</span>
              </NavLink>
            )
          })}
        </div>

        {/* System status placeholder */}
        <div className="p-3 border-t border-[#1e294b] bg-[#070d1e]">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Engine Online
            </span>
            <span className="text-slate-400">v0.1.0-alpha</span>
          </div>
        </div>
      </aside>
    </>
  )
}
