/**
 * Tool call UI registry
 *
 * To add a new tool: one entry in toolRegistry. Nothing else changes.
 */

import { type FC } from 'react'
import { type ToolCallMessagePartProps } from '@assistant-ui/react'
import { DatabaseIcon, LayoutIcon, RotateCcwIcon } from 'lucide-react'

// ── Shared primitive ──────────────────────────────────────────────────────────

function ToolCard({ icon, label, running }: { icon: React.ReactNode; label: string; running: boolean }) {
  return (
    <div className="my-1 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
      <span className={running ? 'animate-pulse text-blue-400' : 'text-green-500'}>{icon}</span>
      <span className={running ? 'text-gray-400' : 'text-gray-600'}>{label}</span>
      {running && <span className="ml-auto h-1.5 w-1.5 animate-ping rounded-full bg-blue-400" />}
    </div>
  )
}

function makeToolCard(icon: React.ReactNode, runningLabel: string, doneLabel: string): FC<ToolCallMessagePartProps> {
  return ({ status }) => (
    <ToolCard icon={icon} label={status.type === 'running' ? runningLabel : doneLabel} running={status.type === 'running'} />
  )
}

// ── Fallback ──────────────────────────────────────────────────────────────────

export const GenericToolCard: FC<ToolCallMessagePartProps> = ({ toolName, status }) => (
  <ToolCard
    icon={<span className="font-mono">fn</span>}
    label={status.type === 'running' ? `${toolName}…` : toolName}
    running={status.type === 'running'}
  />
)

// ── Registry ──────────────────────────────────────────────────────────────────

export const toolRegistry: Record<string, FC<ToolCallMessagePartProps>> = {
  query_budget:   makeToolCard(<DatabaseIcon className="size-3.5" />, 'Fetching budget data…', 'Budget data loaded'),
  display_budget: makeToolCard(<LayoutIcon className="size-3.5" />,   'Updating table…',        'Table updated'),
  reset_display:  makeToolCard(<RotateCcwIcon className="size-3.5" />, 'Resetting view…',       'View reset'),
}
