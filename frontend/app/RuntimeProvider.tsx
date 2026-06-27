'use client'

import { useRef, useMemo } from 'react'
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from '@assistant-ui/react'
import { FilterSpec } from '@/lib/filterSpec'

export function RuntimeProvider({
  children,
  scenarioId,
  onFilterSpec,
}: {
  children: React.ReactNode
  scenarioId: number | null
  onFilterSpec?: (spec: FilterSpec) => void
}) {
  const scenarioIdRef = useRef(scenarioId)
  scenarioIdRef.current = scenarioId

  const onFilterSpecRef = useRef(onFilterSpec)
  onFilterSpecRef.current = onFilterSpec

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

              if (data.filter_spec) {
                onFilterSpecRef.current?.(data.filter_spec as FilterSpec)
                continue
              }

              if (data.status) {
                status = data.status
                // Show status only while no real text has started yet
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
