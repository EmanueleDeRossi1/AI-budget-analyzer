'use client'

import { useCallback } from 'react'
import { BudgetLineItem } from '../api'
import { FilterSpec } from '../filterSpec'
import { getOperation, ViewResult, OperationContext } from './registry'

type OperationsState = {
  lineItems: BudgetLineItem[]
  filterSpec: FilterSpec
  scenarioId: number | null
  refresh: () => void
  setFilterSpec: (spec: FilterSpec) => void
}

export function useOperations(state: OperationsState) {
  const dispatch = useCallback(
    <T = any>(operationId: string, params: any = {}): T | undefined => {
      const op = getOperation(operationId)
      if (!op) {
        console.warn(`Unknown operation: ${operationId}`)
        return undefined
      }

      const ctx: OperationContext = {
        lineItems: state.lineItems,
        filterSpec: state.filterSpec,
        scenarioId: state.scenarioId,
        refresh: state.refresh,
      }

      const result = op.execute(ctx, params)

      if (op.kind === 'view') {
        const viewResult = result as ViewResult
        if (viewResult.filterSpec !== undefined) {
          state.setFilterSpec(viewResult.filterSpec)
        }
        return result as T
      }

      if (op.kind === 'compute') {
        return result as T
      }

      // data ops are async — handled by the caller
      return result as T
    },
    [state],
  )

  return { dispatch }
}
