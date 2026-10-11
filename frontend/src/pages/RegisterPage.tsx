import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Compass, AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import { Input } from '@/components/ui/FormFields'
import { Button } from '@/components/ui/Button'
import { ApiException } from '@/lib/api'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must include uppercase, lowercase, and numeric characters.')
      return
    }

    setLoading(true)

    try {
      await register(email, username, password)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError('Registration could not be completed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-600 text-white shadow-sm">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">
              TradePilot
            </span>
            <span className="text-[11px] text-slate-500 block -mt-0.5 tracking-wider font-medium uppercase">
              Risk Gatekeeper &amp; Analytics
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create TradePilot Account</CardTitle>
            <CardDescription>
              Start tracking trade setups with disciplined risk parameters and analytics.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Input
                label="Email Address"
                type="email"
                required
                autoComplete="email"
                placeholder="trader@tradepilot.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />

              <Input
                label="Trader Username"
                type="text"
                required
                autoComplete="username"
                placeholder="e.g. risk_manager"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />

              <Input
                label="Password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                helperText="Must include uppercase, lowercase, and a number"
              />

              <Input
                label="Confirm Password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full justify-center"
                disabled={loading}
              >
                {loading ? 'Creating Profile...' : 'Complete Registration'}
                {!loading && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
              </Button>

              <div className="text-center text-xs text-slate-500">
                Already registered?{' '}
                <Link to="/login" className="font-semibold text-blue-600 hover:underline">
                  Sign In
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
