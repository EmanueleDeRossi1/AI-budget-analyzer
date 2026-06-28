'use client'

import type { CSSProperties, ReactNode } from 'react'

function segStyle(active: boolean): CSSProperties {
  return {
    border: '1px solid',
    borderColor: active ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-gray-4)',
    background: active ? 'var(--mantine-color-blue-0)' : 'transparent',
    color: active ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-gray-6)',
    borderRadius: 'var(--mantine-radius-sm)',
    padding: '3px 10px',
    fontSize: 'var(--mantine-font-size-xs)',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    lineHeight: 1.5,
  }
}

export default function SegmentButton({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button style={segStyle(active)} onClick={onClick}>
      {children}
    </button>
  )
}
