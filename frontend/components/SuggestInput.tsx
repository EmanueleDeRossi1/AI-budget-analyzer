'use client'

import { useEffect, useRef, useState, forwardRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Badge, Divider } from '@mantine/core'

const SuggestInput = forwardRef<HTMLInputElement, {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  autoFocus?: boolean
  onEnter?: () => void
}>(({ value, onChange, suggestions, placeholder, autoFocus, onEnter }, forwardedRef) => {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
  const showAddNew = value.trim() !== '' && !suggestions.some(s => s.toLowerCase() === value.trim().toLowerCase())
  const totalOptions = filtered.length + (showAddNew ? 1 : 0)
  const hasOptions = totalOptions > 0

  function updateCoords() {
    const el = containerRef.current?.querySelector('input')
    if (el) {
      const rect = el.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }

  function selectOption(idx: number) {
    if (showAddNew && idx === 0) onChange(value.trim())
    else onChange(filtered[showAddNew ? idx - 1 : idx])
    setOpen(false)
    setHighlighted(-1)
  }

  function scrollIntoView(idx: number) {
    if (!listRef.current) return
    const item = listRef.current.children[idx] as HTMLElement
    item?.scrollIntoView({ block: 'nearest' })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !hasOptions) {
      if (e.key === 'Enter') { e.preventDefault(); onEnter?.() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => { const next = (h + 1) % totalOptions; scrollIntoView(next); return next })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => { const next = (h - 1 + totalOptions) % totalOptions; scrollIntoView(next); return next })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlighted >= 0) selectOption(highlighted)
      else if (filtered.length > 0) selectOption(0)
      else { onChange(value.trim()); setOpen(false) }
      onEnter?.()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  useEffect(() => { setHighlighted(-1) }, [value])

  useLayoutEffect(() => {
    if (autoFocus) { updateCoords(); setOpen(true) }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef}>
      <input
        ref={forwardedRef}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); updateCoords() }}
        onFocus={() => { updateCoords(); setOpen(true) }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          display: 'flex',
          height: 36,
          width: '100%',
          borderRadius: 'var(--mantine-radius-sm)',
          border: '1px solid var(--mantine-color-gray-4)',
          background: 'var(--mantine-color-white)',
          padding: '0 12px',
          fontSize: 'var(--mantine-font-size-sm)',
          color: 'var(--mantine-color-text)',
          outline: 'none',
          transition: 'border-color 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--mantine-color-gray-5)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--mantine-color-gray-4)')}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--mantine-color-blue-5)')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--mantine-color-gray-4)')}
      />
      {open && hasOptions && createPortal(
        <div style={{
          position: 'fixed', top: coords.top, left: coords.left,
          width: Math.max(coords.width, 160), zIndex: 9999,
          background: 'var(--mantine-color-white)',
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-sm)',
          boxShadow: 'var(--mantine-shadow-md)',
          overflow: 'hidden',
        }}>
          <div ref={listRef} style={{ maxHeight: 176, overflowY: 'auto' }}>
            {showAddNew && (
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); selectOption(0) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 12px',
                  fontSize: 'var(--mantine-font-size-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: highlighted === 0 ? 'var(--mantine-color-blue-0)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                }}
              >
                <span>{value.trim()}</span>
                <Badge size="xs" variant="light" color="blue" ml="xs">new</Badge>
              </button>
            )}
            {showAddNew && filtered.length > 0 && <Divider />}
            {filtered.map((s, i) => {
              const idx = showAddNew ? i + 1 : i
              return (
                <button
                  key={s}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectOption(idx) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 12px',
                    fontSize: 'var(--mantine-font-size-sm)',
                    background: idx === highlighted ? 'var(--mantine-color-blue-0)' : 'transparent',
                    color: idx === highlighted ? 'var(--mantine-color-blue-7)' : 'inherit',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
})
SuggestInput.displayName = 'SuggestInput'

export default SuggestInput
