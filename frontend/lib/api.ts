import { PeriodType } from './periods'

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

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
  notes: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  // 204 No Content — return undefined cast to T
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  getScenarios: () =>
    request<BudgetScenario[]>('/api/scenarios/'),
  createScenario: (data: Partial<BudgetScenario>) =>
    request<BudgetScenario>('/api/scenarios/', { method: 'POST', body: JSON.stringify(data) }),
  deleteScenario: (id: number) =>
    request<void>(`/api/scenarios/${id}/`, { method: 'DELETE' }),

  getLineItems: (scenarioId: number) =>
    request<BudgetLineItem[]>(`/api/line-items/?scenario=${scenarioId}`),
  createLineItem: (data: Partial<BudgetLineItem>) =>
    request<BudgetLineItem>('/api/line-items/', { method: 'POST', body: JSON.stringify(data) }),
  updateLineItem: (id: number, data: Partial<BudgetLineItem>) =>
    request<BudgetLineItem>(`/api/line-items/${id}/`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLineItem: (id: number) =>
    request<void>(`/api/line-items/${id}/`, { method: 'DELETE' }),
}
