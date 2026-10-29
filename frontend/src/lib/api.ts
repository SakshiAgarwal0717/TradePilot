let inMemoryToken: string | null = null

export function setAuthToken(token: string | null): void {
  inMemoryToken = token
  if (token) {
    try {
      localStorage.setItem('tradepilot_token', token)
    } catch {
      // Storage unavailable or blocked
    }
  } else {
    try {
      localStorage.removeItem('tradepilot_token')
    } catch {
      // Storage unavailable or blocked
    }
  }
}

export function getAuthToken(): string | null {
  if (inMemoryToken) {
    return inMemoryToken
  }
  try {
    const stored = localStorage.getItem('tradepilot_token')
    if (stored) {
      inMemoryToken = stored
      return stored
    }
  } catch {
    // Storage unavailable
  }
  return null
}

function getBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  // If running in browser, align hostname with frontend
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname || '127.0.0.1'
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:8000/api/v1`
    }
    // In production (Vercel / deployed domain), use same-origin relative path
    return '/api/v1'
  }
  return 'http://127.0.0.1:8000/api/v1'
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
}

export class ApiException extends Error {
  code: string
  details?: unknown
  status: number

  constructor(error: ApiError, status: number) {
    super(error.message)
    this.name = 'ApiException'
    this.code = error.code
    this.details = error.details
    this.status = status
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }

  // Attach Bearer token if available
  const token = getAuthToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Include credentials for HttpOnly session cookies across matching origins
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: options.credentials || 'include',
  })

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorData: ApiError = data.error || {
      code: `HTTP_${response.status}`,
      message: data.detail || 'An error occurred during request processing.',
    }
    throw new ApiException(errorData, response.status)
  }

  return data as T
}

