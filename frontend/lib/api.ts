import { PeriodType } from './periods'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface BudgetScenario {
  id: number
  name: string
  period_type: PeriodType
  description: string
}

export interface BudgetLineItem {
  id: number
  scenario: number
  period: string
  department: string
  category: string
  budget_amount: string
  actual_amount: string
  variance: number
  notes: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  getScenarios: () =>
    request<BudgetScenario[]>('/api/scenarios/'),
  createScenario: (data: Partial<BudgetScenario>) =>
    request<BudgetScenario>('/api/scenarios/', { method: 'POST', body: JSON.stringify(data) }),
  deleteScenario: (id: number) =>
    fetch(`${BASE}/api/scenarios/${id}/`, { method: 'DELETE' }),

  getLineItems: (scenarioId: number) =>
    request<BudgetLineItem[]>(`/api/line-items/?scenario=${scenarioId}`),
  createLineItem: (data: Partial<BudgetLineItem>) =>
    request<BudgetLineItem>('/api/line-items/', { method: 'POST', body: JSON.stringify(data) }),
  updateLineItem: (id: number, data: Partial<BudgetLineItem>) =>
    request<BudgetLineItem>(`/api/line-items/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLineItem: (id: number) =>
    fetch(`${BASE}/api/line-items/${id}/`, { method: 'DELETE' }),
}
