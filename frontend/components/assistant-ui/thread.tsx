'use client'

import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from '@assistant-ui/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
} from 'lucide-react'
import { type FC } from 'react'
import { cn } from '@/lib/utils'
import { MarkdownText } from './markdown-text'
import { toolRegistry, GenericToolCard } from '@/lib/toolRegistry'

// ── Root ──────────────────────────────────────────────────────────────────────

export const Thread: FC = () => (
  <ThreadPrimitive.Root className="flex h-full flex-col bg-white text-sm">
    <ThreadPrimitive.Viewport className="relative flex min-h-0 flex-1 flex-col overflow-y-scroll scroll-smooth px-4 py-4">

      {/* Welcome */}
      <AuiIf condition={(s) => s.thread.isEmpty}>
        <div className="flex flex-1 flex-col items-center justify-center gap-1 py-12 text-center text-gray-400">
          <p className="text-base font-medium text-gray-600">Ask the AI</p>
          <p className="text-xs">Questions about your budget, variances, trends…</p>
        </div>
      </AuiIf>

      {/* Messages */}
      <div className="flex flex-col gap-6">
        <ThreadPrimitive.Messages>
          {() => <ThreadMessage />}
        </ThreadPrimitive.Messages>
      </div>

      {/* Scroll-to-bottom only */}
      <ThreadPrimitive.ViewportFooter className="sticky bottom-0 flex flex-col items-center bg-white pt-2">
        <ThreadPrimitive.ScrollToBottom asChild>
          <button className="rounded-full border bg-white p-2 text-gray-400 shadow-sm hover:text-gray-700 disabled:invisible">
            <ArrowDownIcon className="size-4" />
          </button>
        </ThreadPrimitive.ScrollToBottom>
      </ThreadPrimitive.ViewportFooter>

    </ThreadPrimitive.Viewport>

    {/* Composer pinned at the bottom, outside the scroll area */}
    <div className="flex-shrink-0 px-4 pb-3 pt-2">
      <Composer />
    </div>
  </ThreadPrimitive.Root>
)

// ── Thread message dispatcher ─────────────────────────────────────────────────

function ThreadMessage() {
  const isEditing = useAuiState((s) => s.message.composer.isEditing)
  const role = useAuiState((s) => s.message.role)
  if (isEditing) return <EditComposer />
  if (role === 'user') return <UserMessage />
  return <AssistantMessage />
}

// ── Composer (bottom) ─────────────────────────────────────────────────────────

const Composer: FC = () => (
  <ComposerPrimitive.Root className="flex w-full flex-col rounded-2xl border bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/40">
    <ComposerPrimitive.Input
      className="max-h-32 min-h-[2rem] w-full resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-gray-400"
      placeholder="Ask about your budget…"
      rows={1}
      autoFocus
    />
    <div className="flex justify-end">
      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <button className="rounded-full bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-40">
            <ArrowUpIcon className="size-4" />
          </button>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <button className="rounded-full bg-gray-800 p-1.5 text-white hover:bg-gray-700">
            <SquareIcon className="size-3 fill-current" />
          </button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  </ComposerPrimitive.Root>
)

// ── User message ──────────────────────────────────────────────────────────────

const UserMessage: FC = () => (
  <MessagePrimitive.Root className="group flex justify-end gap-2 px-2">
    <div className="relative max-w-[80%]">
      {/* Edit button — appears on hover to the left */}
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        className="absolute right-full top-1/2 -translate-y-1/2 pe-2 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <ActionBarPrimitive.Edit asChild>
          <IconButton title="Edit message">
            <PencilIcon className="size-3.5" />
          </IconButton>
        </ActionBarPrimitive.Edit>
      </ActionBarPrimitive.Root>

      <div className="rounded-2xl bg-gray-100 px-4 py-2.5 text-gray-900">
        <MessagePrimitive.Parts />
      </div>
    </div>
    <BranchPicker className="-mt-1 self-end" />
  </MessagePrimitive.Root>
)

// ── Edit composer ─────────────────────────────────────────────────────────────

const EditComposer: FC = () => {
  const originalText = useAuiState((s) =>
    (s.message.content ?? [])
      .filter((p: any): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p: any) => p.text)
      .join('')
  )
  const currentText = useAuiState((s) => (s.message.composer as any).text ?? '')
  const isUnchanged = currentText.trim() === '' || currentText === originalText

  return (
    <MessagePrimitive.Root className="flex flex-col px-2">
      <ComposerPrimitive.Root className="ms-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-gray-100">
        <ComposerPrimitive.Input
          className="min-h-14 w-full resize-none bg-transparent p-4 text-sm outline-none"
          autoFocus
        />
        <div className="mx-3 mb-3 flex items-center justify-end gap-2">
          <ComposerPrimitive.Cancel asChild>
            <button className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-200">
              Cancel
            </button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <button
              disabled={isUnchanged}
              className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Update
            </button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

// ── Assistant message ─────────────────────────────────────────────────────────

// MarkdownText must be rendered inside a part context provided by MessagePrimitive.Parts
const TextPart: FC = () => <MarkdownText />
const IndicatorPart: FC = () => (
  <span className="animate-pulse font-sans text-gray-400">●</span>
)

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="group px-2">
    <div className="leading-relaxed text-gray-800">
      <MessagePrimitive.Parts components={{
        Text: TextPart,
        Indicator: IndicatorPart,
        tools: { by_name: toolRegistry, Fallback: GenericToolCard },
      }} />
    </div>

    <div className="mt-1 flex min-h-[1.5rem] items-center gap-1">
      <BranchPicker />
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <ActionBarPrimitive.Copy asChild>
          <IconButton title="Copy">
            <AuiIf condition={(s) => s.message.isCopied}>
              <CheckIcon className="size-3.5 text-green-600" />
            </AuiIf>
            <AuiIf condition={(s) => !s.message.isCopied}>
              <CopyIcon className="size-3.5" />
            </AuiIf>
          </IconButton>
        </ActionBarPrimitive.Copy>
        <ActionBarPrimitive.Reload asChild>
          <IconButton title="Regenerate">
            <RefreshCwIcon className="size-3.5" />
          </IconButton>
        </ActionBarPrimitive.Reload>
      </ActionBarPrimitive.Root>
    </div>
  </MessagePrimitive.Root>
)

// ── Branch picker ─────────────────────────────────────────────────────────────

const BranchPicker: FC<{ className?: string }> = ({ className }) => (
  <BranchPickerPrimitive.Root
    hideWhenSingleBranch
    className={cn('inline-flex items-center gap-0.5 text-xs text-gray-400', className)}
  >
    <BranchPickerPrimitive.Previous asChild>
      <IconButton title="Previous">
        <ChevronLeftIcon className="size-3.5" />
      </IconButton>
    </BranchPickerPrimitive.Previous>
    <span className="font-medium tabular-nums">
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <IconButton title="Next">
        <ChevronRightIcon className="size-3.5" />
      </IconButton>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
)

// ── Icon button ───────────────────────────────────────────────────────────────

const IconButton: FC<{
  title: string
  onClick?: () => void
  className?: string
  children: React.ReactNode
}> = ({ title, className, children, ...rest }) => (
  <button
    title={title}
    className={cn('rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700', className)}
    {...rest}
  >
    {children}
  </button>
)
