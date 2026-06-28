'use client'

import { useRef, useMemo } from 'react'
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ToolCallMessagePart,
  type TextMessagePart,
} from '@assistant-ui/react'
import { API_BASE } from '@/lib/api'

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
        // Build OpenAI-format message history including tool calls, but replace
        // query_budget results with a placeholder to avoid sending the full budget
        // JSON payload on every turn. The model will re-query fresh data as needed
        // while still retaining display_budget / reset_display context.
        const apiMessages: object[] = []
        for (const m of messages) {
          const textParts = m.content.filter((p): p is TextMessagePart => p.type === 'text')
          const toolCalls = m.content.filter((p): p is ToolCallMessagePart => p.type === 'tool-call')

          if (m.role === 'assistant' && toolCalls.length > 0) {
            // In the Responses API, function calls are top-level items in the flat
            // input array — not nested inside a message's content.
            if (textParts.length > 0) {
              apiMessages.push({ role: 'assistant', content: textParts.map(p => p.text).join('') })
            }
            for (const tc of toolCalls) {
              apiMessages.push({
                type: 'function_call',
                id: tc.toolCallId.replace(/^call_/, 'fc_'),
                call_id: tc.toolCallId,
                name: tc.toolName,
                arguments: tc.argsText,
              })
            }
            for (const tc of toolCalls) {
              apiMessages.push({
                type: 'function_call_output',
                call_id: tc.toolCallId,
                output: tc.toolName === 'query_budget'
                  ? '[data fetched — will re-query]'
                  : String(tc.result ?? ''),
              })
            }
          } else {
            apiMessages.push({
              role: m.role,
              content: textParts.map(p => p.text).join(''),
            })
          }
        }

        const res = await fetch(
          `${API_BASE}/api/chat/`,
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
