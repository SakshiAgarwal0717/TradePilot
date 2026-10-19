import * as React from 'react'
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Lightbulb,
  Info,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { apiRequest, ApiException } from '@/lib/api'

export interface TradeReviewResponse {
  trade_id: number
  symbol: string
  strengths: string[]
  improvement_areas: string[]
  evidence: string[]
  lessons_learned: string[]
  disclaimer: string
}

export interface AiTradeReviewModalProps {
  tradeId: number
  symbol: string
  isOpen: boolean
  onClose: () => void
}

export function AiTradeReviewModal({
  tradeId,
  symbol,
  isOpen,
  onClose,
}: AiTradeReviewModalProps) {
  const [review, setReview] = React.useState<TradeReviewResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isUnconfigured, setIsUnconfigured] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Track the active tradeId and request sequence to prevent stale display
  const activeTradeIdRef = React.useRef<number>(tradeId)
  const activeRequestIdRef = React.useRef<number>(0)
  const isFetchingRef = React.useRef<boolean>(false)
  const modalContainerRef = React.useRef<HTMLDivElement>(null)
  const closeButtonRef = React.useRef<HTMLButtonElement>(null)

  const fetchReview = React.useCallback(async (targetTradeId: number) => {
    // Generate new request sequence ID
    const currentRequestId = ++activeRequestIdRef.current
    activeTradeIdRef.current = targetTradeId

    isFetchingRef.current = true
    setLoading(true)
    setError(null)
    setIsUnconfigured(false)
    setReview(null)
    setCopied(false)

    try {
      const data = await apiRequest<TradeReviewResponse>(`/ai-review/trade/${targetTradeId}`, {
        method: 'POST',
        body: JSON.stringify({ focus_area: 'general' }),
      })

      // Ensure response matches currently active trade and request
      if (
        activeRequestIdRef.current === currentRequestId &&
        activeTradeIdRef.current === targetTradeId
      ) {
        setReview(data)
      }
    } catch (err) {
      if (
        activeRequestIdRef.current === currentRequestId &&
        activeTradeIdRef.current === targetTradeId
      ) {
        if (err instanceof ApiException) {
          if (err.status === 503) {
            setIsUnconfigured(true)
            setError(err.message || 'AI Review Assistant is not configured on the backend.')
          } else {
            setError(err.message || 'Failed to generate AI trade review.')
          }
        } else {
          setError('An unexpected network error occurred while requesting the trade review.')
        }
      }
    } finally {
      if (activeRequestIdRef.current === currentRequestId) {
        isFetchingRef.current = false
        if (activeTradeIdRef.current === targetTradeId) {
          setLoading(false)
        }
      }
    }
  }, [])

  // When modal opens or tradeId changes, trigger fetch if not already loaded for this trade
  React.useEffect(() => {
    activeTradeIdRef.current = tradeId
    if (isOpen) {
      fetchReview(tradeId)
    } else {
      // Clear state on close
      activeRequestIdRef.current++
      setReview(null)
      setError(null)
      setIsUnconfigured(false)
      setLoading(false)
      setCopied(false)
      isFetchingRef.current = false
    }
  }, [isOpen, tradeId, fetchReview])

  // Accessibility: Focus trap & Escape key handler
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab' && modalContainerRef.current) {
        const focusableElements = modalContainerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    // Set initial focus to close button
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 50)

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Copy review summary action
  const handleCopyReview = async () => {
    if (!review) return

    const reviewText = [
      `AI Trade Review - ${review.symbol} (Trade #${review.trade_id})`,
      '',
      '--- OBSERVED STRENGTHS ---',
      review.strengths.length > 0
        ? review.strengths.map((s) => `• ${s}`).join('\n')
        : '• No explicit strengths identified in recorded data.',
      '',
      '--- AREAS FOR IMPROVEMENT ---',
      review.improvement_areas.length > 0
        ? review.improvement_areas.map((a) => `• ${a}`).join('\n')
        : '• No specific execution defects identified in recorded data.',
      '',
      '--- CITED TRADE EVIDENCE ---',
      review.evidence.length > 0
        ? review.evidence.map((e) => `• ${e}`).join('\n')
        : '• No additional factual evidence recorded.',
      '',
      '--- LESSONS LEARNED ---',
      review.lessons_learned.length > 0
        ? review.lessons_learned.map((l) => `• ${l}`).join('\n')
        : '• No actionable takeaway derived.',
      '',
      '--- DISCLAIMER ---',
      review.disclaimer,
    ].join('\n')

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(reviewText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = reviewText
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard write failed safely
    }
  }

  if (!isOpen) {
    return null
  }

  // Safe checks for empty findings
  const hasNoFindings =
    review &&
    review.strengths.length === 0 &&
    review.improvement_areas.length === 0 &&
    review.evidence.length === 0 &&
    review.lessons_learned.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-review-modal-title"
      aria-describedby="ai-review-modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={modalContainerRef}
        className="w-full max-w-2xl bg-white rounded-lg border border-slate-200 shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200" aria-hidden="true">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 id="ai-review-modal-title" className="text-sm font-semibold text-slate-900">
                AI Trade Review Assistant
              </h3>
              <p id="ai-review-modal-description" className="text-[11px] text-slate-500">
                Objective post-trade decision support for{' '}
                <strong className="text-slate-700">{symbol}</strong> (Trade #{tradeId})
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
            aria-label="Close review modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* Loading State */}
          {loading && (
            <div
              className="flex flex-col items-center justify-center py-16 text-center space-y-3"
              role="status"
              aria-live="polite"
            >
              <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Generating Trade Review...</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Analyzing execution metrics, stop discipline, and trade facts.
                </p>
              </div>
            </div>
          )}

          {/* Missing Configuration State */}
          {!loading && isUnconfigured && (
            <div
              className="p-6 rounded-lg border border-amber-200 bg-amber-50/60 text-center space-y-3"
              role="alert"
            >
              <div
                className="inline-flex p-2.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 mb-1"
                aria-hidden="true"
              >
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">AI Assistant Not Configured</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {error || 'The AI review provider is not configured in the backend environment.'}
              </p>
              <div className="text-[11px] text-slate-500 max-w-md mx-auto pt-1 border-t border-amber-200/60">
                <span>Set <code className="bg-amber-100/70 px-1.5 py-0.5 rounded font-mono text-slate-800">OPENROUTER_API_KEY</code> or <code className="bg-amber-100/70 px-1.5 py-0.5 rounded font-mono text-slate-800">GEMINI_API_KEY</code> in <code className="font-mono text-slate-800">backend/.env</code> to enable AI trade evaluations.</span>
              </div>
            </div>
          )}

          {/* Error / Failure State */}
          {!loading && !isUnconfigured && error && (
            <div
              className="p-6 rounded-lg border border-red-200 bg-red-50/50 text-center space-y-3"
              role="alert"
            >
              <div
                className="inline-flex p-2.5 rounded-full bg-red-100 text-red-700 border border-red-200 mb-1"
                aria-hidden="true"
              >
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">Review Generation Failed</h4>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchReview(tradeId)}
                disabled={loading}
                className="mt-2 border-red-200 text-red-700 hover:bg-red-50"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                Retry Review
              </Button>
            </div>
          )}

          {/* Empty Findings State (Zero points in all sections, not fabricated) */}
          {!loading && !error && !isUnconfigured && hasNoFindings && (
            <div className="p-8 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-center space-y-3">
              <div
                className="inline-flex p-2.5 rounded-full bg-white border border-slate-200 text-slate-400 mb-1"
                aria-hidden="true"
              >
                <FileText className="w-5 h-5 text-slate-400" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">No Review Findings Available</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                The AI Review Assistant completed the analysis, but no conclusive strengths, improvement areas, or lessons were identified from the available trade parameters.
              </p>
              {review?.disclaimer && (
                <div className="p-3 mt-4 rounded border border-slate-200 bg-white text-left text-[11px] text-slate-500">
                  <p className="leading-relaxed">{review.disclaimer}</p>
                </div>
              )}
            </div>
          )}

          {/* Review Results Display */}
          {!loading && !error && review && !hasNoFindings && (
            <div className="space-y-4">
              {/* Strengths Card */}
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Observed Strengths</span>
                  <Badge variant="profit" className="ml-auto text-[10px] py-0 px-1.5 font-mono">
                    {review.strengths.length} {review.strengths.length === 1 ? 'point' : 'points'}
                  </Badge>
                </div>
                {review.strengths.length > 0 ? (
                  <ul className="space-y-1.5 pl-6 list-disc text-slate-700 marker:text-emerald-500">
                    {review.strengths.map((point, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic pl-1">
                    No explicit disciplined actions identified from available parameters.
                  </p>
                )}
              </div>

              {/* Areas for Improvement Card */}
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/40 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>Areas for Improvement</span>
                  <Badge variant="warning" className="ml-auto text-[10px] py-0 px-1.5 font-mono">
                    {review.improvement_areas.length} {review.improvement_areas.length === 1 ? 'point' : 'points'}
                  </Badge>
                </div>
                {review.improvement_areas.length > 0 ? (
                  <ul className="space-y-1.5 pl-6 list-disc text-slate-700 marker:text-amber-500">
                    {review.improvement_areas.map((point, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic pl-1">
                    No execution rule violations or defects noted.
                  </p>
                )}
              </div>

              {/* Cited Evidence Card */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                  <span>Cited Trade Evidence</span>
                  <Badge variant="neutral" className="ml-auto text-[10px] py-0 px-1.5 font-mono">
                    {review.evidence.length} {review.evidence.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                {review.evidence.length > 0 ? (
                  <ul className="space-y-1.5 pl-6 list-disc text-slate-600 marker:text-slate-400">
                    {review.evidence.map((point, idx) => (
                      <li key={idx} className="leading-relaxed font-mono text-[11px]">
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic pl-1">
                    No specific recorded metrics cited.
                  </p>
                )}
              </div>

              {/* Practical Lessons Learned */}
              <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/40 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs">
                  <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>Lessons Learned &amp; Takeaways</span>
                  <Badge variant="info" className="ml-auto text-[10px] py-0 px-1.5 font-mono">
                    {review.lessons_learned.length} {review.lessons_learned.length === 1 ? 'lesson' : 'lessons'}
                  </Badge>
                </div>
                {review.lessons_learned.length > 0 ? (
                  <ul className="space-y-1.5 pl-6 list-disc text-slate-700 marker:text-blue-500">
                    {review.lessons_learned.map((point, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic pl-1">
                    No actionable takeaways derived.
                  </p>
                )}
              </div>

              {/* Regulatory & Decision-Support Disclaimer */}
              <div
                className="p-3 rounded border border-slate-200 bg-slate-50 flex items-start gap-2.5 text-[11px] text-slate-500"
                role="note"
                aria-label="Educational disclaimer"
              >
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">{review.disclaimer}</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {review ? 'Deterministic decision support' : 'Automated analysis'}
          </span>
          <div className="flex items-center gap-2">
            {!loading && review && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyReview}
                  aria-label={copied ? 'Review copied to clipboard' : 'Copy review text to clipboard'}
                  className={copied ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : ''}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" aria-hidden="true" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1 text-slate-500" aria-hidden="true" />
                      Copy Review
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => fetchReview(tradeId)}
                  aria-label="Regenerate trade review"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  Regenerate
                </Button>
              </>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={onClose}
              aria-label="Close review dialog"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
