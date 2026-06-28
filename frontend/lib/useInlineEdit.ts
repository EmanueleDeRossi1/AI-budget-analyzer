'use client'

import { useState, useCallback } from 'react'
import { api, BudgetLineItem } from '@/lib/api'
import { normalizeAmount, filterNumericInput } from '@/lib/utils'

export type EditableField = 'period' | 'department' | 'category' | 'budget_amount' | 'actual_amount' | 'notes'
export type EditCell = { itemId: number; field: EditableField; value: string } | null

export function useInlineEdit(refresh: () => void) {
  const [editCell, setEditCell] = useState<EditCell>(null)

  const activateCell = useCallback((item: BudgetLineItem, field: EditableField) => {
    setEditCell({ itemId: item.id, field, value: String(item[field] ?? '') })
  }, [])

  const saveCellEdit = useCallback(async () => {
    if (!editCell) return
    const { itemId, field, value } = editCell
    const isNumeric = field === 'budget_amount' || field === 'actual_amount'
    const saveValue = isNumeric ? normalizeAmount(value) : value
    setEditCell(null)
    await api.updateLineItem(itemId, { [field]: saveValue })
    refresh()
  }, [editCell, refresh])

  const cancelCellEdit = useCallback(() => {
    setEditCell(null)
  }, [])

  const updateValue = useCallback((value: string) => {
    setEditCell(c => {
      if (!c) return c
      const isNumeric = c.field === 'budget_amount' || c.field === 'actual_amount'
      return { ...c, value: isNumeric ? filterNumericInput(value) : value }
    })
  }, [])

  return { editCell, activateCell, saveCellEdit, cancelCellEdit, updateValue, setEditCell }
}
