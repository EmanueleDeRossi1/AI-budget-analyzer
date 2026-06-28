'use client'

import { useRef, useMemo } from 'react'
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ToolCallMessagePart,
  type TextMessagePart,
} from '@assistant-ui/react'

// Content parts that accumulate over the stream lifetime of one assistant turn.
type ContentState = {
  text: string
  toolCalls: Map<string, ToolCallMessagePart>
}

function buildContent({ text, toolCalls }: ContentState): (TextMessagePart | ToolCallMessagePart)[] {
  const parts: (TextMessagePart | ToolCallMessagePart)[] = [
    ...Array.from(toolCalls.values()),
  ]
  if (text) parts.push({ type: 'text', text })
  return parts
}

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
        let buffer = ''
        const state: ContentState = { text: '', toolCalls: new Map() }

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
              const ev = JSON.parse(raw)

              switch (ev.type) {
                case 'text':
                  state.text += ev.delta
                  yield { content: buildContent(state) }
                  break

                case 'tool_call':
                  state.toolCalls.set(ev.id, {
                    type: 'tool-call',
                    toolCallId: ev.id,
                    toolName: ev.name,
                    args: JSON.parse(ev.args ?? '{}'),
                    argsText: ev.args ?? '',
                  })
                  yield { content: buildContent(state) }
                  break

                case 'tool_result':
                  const existing = state.toolCalls.get(ev.id)
                  if (existing) {
                    state.toolCalls.set(ev.id, { ...existing, result: ev.result })
                    yield { content: buildContent(state) }
                  }
                  break

                case 'operation':
                  // Side effect: update the budget table. Not a UI content part.
                  dispatchRef.current(ev.id, ev.params ?? {})
                  break

                case 'error':
                  state.text += `\n\n_Error: ${ev.message}_`
                  yield { content: buildContent(state) }
                  break
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
