import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, children, ...props }, ref) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-colors rounded border focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed select-none'

    const variantClasses = {
      primary: 'bg-slate-900 text-white border-transparent hover:bg-slate-800 active:bg-slate-950',
      secondary: 'bg-slate-100 text-slate-900 border-slate-200 hover:bg-slate-200 active:bg-slate-300',
      outline: 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 active:bg-slate-100',
      danger: 'bg-red-700 text-white border-transparent hover:bg-red-800 active:bg-red-900',
      ghost: 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100 active:bg-slate-200',
    }

    const sizeClasses = {
      sm: 'text-xs px-2.5 py-1.5 h-8 gap-1.5',
      md: 'text-sm px-3.5 py-2 h-9 gap-2',
      lg: 'text-base px-4 py-2.5 h-11 gap-2.5',
    }

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
