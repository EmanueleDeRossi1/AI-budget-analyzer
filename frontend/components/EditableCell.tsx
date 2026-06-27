'use client'

import { useState } from 'react'

// Wraps a table cell value. On hover shows a dashed underline hint.
// On click, hides the display value (keeping its width) and overlays an input.
export default function EditableCell({
  children,
  isEditing,
  onActivate,
  input,
  align = 'left',
}: {
  children: React.ReactNode
  isEditing: boolean
  onActivate: () => void
  input: React.ReactNode
  align?: 'left' | 'right'
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Keeps column width intact — hidden but still takes space */}
      <div
        onClick={isEditing ? undefined : onActivate}
        style={{
          visibility: isEditing ? 'hidden' : 'visible',
          cursor: 'text',
          textAlign: align,
          borderBottom: hovered && !isEditing
            ? '1px dashed var(--mantine-color-gray-4)'
            : '1px solid transparent',
          userSelect: 'none',
          minWidth: 40,
        }}
      >
        {children}
      </div>

      {/* Input overlays the cell without changing its size */}
      {isEditing && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'stretch' }}>
          {input}
        </div>
      )}
    </div>
  )
}

// Plain inline input — used inside EditableCell
export function CellInput({
  value,
  onChange,
  onSave,
  onCancel,
  align = 'left',
}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  align?: 'left' | 'right'
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onSave() }
        if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      }}
      onBlur={onSave}
      style={{
        width: '100%',
        height: '100%',
        padding: '0 6px',
        border: 'none',
        outline: '2px solid var(--mantine-color-blue-5)',
        outlineOffset: '-2px',
        borderRadius: 'var(--mantine-radius-xs)',
        fontSize: 'var(--mantine-font-size-sm)',
        background: 'var(--mantine-color-white)',
        textAlign: align,
        boxSizing: 'border-box',
        fontFamily: 'inherit',
      }}
    />
  )
}
