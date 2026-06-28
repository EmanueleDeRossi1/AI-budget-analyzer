'use client'

import { useRef, useMemo } from 'react'
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from '@assistant-ui/react'

export function RuntimeProvider({
  children,
  scenarioId,
  dispatch,
}: {
  children: React.ReactNode
  scenarioId: number | null
  dispatch: (operationId: string, params?: any) => any
}) {
  const scenarioIdRef = useRef(scenarioId)
  scenarioIdRef.current = scenarioId

  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        const apiMessages = messages.map(m => ({
          role: m.role,
          content: m.content
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text)
            .join(''),
        }))

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/chat/`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: apiMessages, scenario_id: scenarioIdRef.current }),
            signal: abortSignal,
          }
        )

        if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let text = ''
        let status = ''
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') return
            try {
              const data = JSON.parse(raw)

              // All view operations come through as {operation: {id, params}}
              if (data.operation) {
                dispatchRef.current(data.operation.id, data.operation.params ?? {})
                continue
              }

              // Backward compat: handle legacy event shapes during migration
              if (data.filter_spec) {
                dispatchRef.current('updateView', data.filter_spec)
                continue
              }
              if (data.highlight_spec) {
                dispatchRef.current('highlight', data.highlight_spec)
                continue
              }
              if (data.reset_view !== undefined) {
                dispatchRef.current('resetView')
                continue
              }

              if (data.status) {
                status = data.status
                if (!text) {
                  yield { content: [{ type: 'text' as const, text: `_${status}_` }] }
                }
                continue
              }

              if (data.text) {
                text += data.text
                yield { content: [{ type: 'text' as const, text }] }
              }
            } catch {}
          }
        }
      },
    }),
    []
  )

  const runtime = useLocalRuntime(adapter)

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}
