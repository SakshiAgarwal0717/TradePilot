import * as React from 'react'
import { FolderX, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

export interface StateViewProps {
  title: string
  description?: string
  className?: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export function EmptyState({
  title,
  description,
  className,
  actionLabel,
  onAction,
  icon,
}: StateViewProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 min-h-[220px]',
        className
      )}
    >
      <div className="p-3 bg-white rounded-full border border-slate-200 text-slate-400 mb-3">
        {icon ?? <FolderX className="w-5 h-5 text-slate-400" />}
      </div>
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {description && <p className="text-xs text-slate-500 max-w-sm mt-1">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-4">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function LoadingState({
  label = 'Loading data...',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center min-h-[180px]',
        className
      )}
    >
      <RefreshCw className="w-5 h-5 text-slate-400 animate-spin mb-2" />
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

export function ErrorState({
  title = 'Failed to load data',
  description = 'An error occurred while communicating with the service. Please try again.',
  actionLabel = 'Retry',
  onAction,
  className,
}: StateViewProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-lg border border-red-200 bg-red-50/40 min-h-[200px]',
        className
      )}
    >
      <div className="p-3 bg-red-100/70 rounded-full border border-red-200 text-red-700 mb-3">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {description && <p className="text-xs text-slate-600 max-w-sm mt-1">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction} className="mt-4 border-red-200 text-red-700 hover:bg-red-50">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
