export interface EquityPoint {
  trade_id: number
  symbol: string
  exit_time: string
  pnl: string | number
  cumulative_pnl: string | number
  running_peak: string | number
  drawdown: string | number
  drawdown_pct: string | number
}

export interface AnalyticsSummary {
  // Counts
  total_trades: number
  closed_trades: number
  open_trades: number
  draft_trades: number
  winning_trades: number
  losing_trades: number
  breakeven_trades: number

  // Performance
  win_rate_pct: string | number | null
  gross_profit: string | number
  gross_loss: string | number
  total_fees: string | number
  net_realized_pnl: string | number

  // Averages
  avg_win: string | number | null
  avg_loss: string | number | null
  profit_factor: string | number | null
  avg_reward_to_risk: string | number | null

  // Drawdown
  max_drawdown_amount: string | number
  max_drawdown_pct: string | number

  // Gatekeeper Governance
  total_evaluations: number
  approved_evaluations: number
  rejected_evaluations: number
  warning_evaluations: number
  violation_rate_pct: string | number | null

  // Equity series
  equity_curve: EquityPoint[]
}
