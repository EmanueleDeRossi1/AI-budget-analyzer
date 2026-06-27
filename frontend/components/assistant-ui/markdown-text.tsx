'use client'

import {
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from '@assistant-ui/react-markdown'
import remarkGfm from 'remark-gfm'
import { type FC, memo } from 'react'
import { cn } from '@/lib/utils'

const MarkdownImpl: FC = () => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm]}
    components={components}
    defer
  />
)

export const MarkdownText = memo(MarkdownImpl)

const components = memoizeMarkdownComponents({
  p: ({ className, ...props }) => (
    <p className={cn('my-2 leading-relaxed first:mt-0 last:mb-0', className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn('my-2 ms-5 list-disc [&>li]:mt-1', className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn('my-2 ms-5 list-decimal [&>li]:mt-1', className)} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={cn('leading-relaxed', className)} {...props} />
  ),
  h1: ({ className, ...props }) => (
    <h1 className={cn('mt-4 mb-2 text-lg font-semibold first:mt-0', className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn('mt-3 mb-1.5 text-base font-semibold first:mt-0', className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn('mt-3 mb-1 text-sm font-semibold first:mt-0', className)} {...props} />
  ),
  strong: ({ className, ...props }) => (
    <strong className={cn('font-semibold', className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote className={cn('my-2 border-s-2 border-gray-300 ps-3 text-gray-600', className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="my-3 overflow-x-auto">
      <table className={cn('w-full border-separate border-spacing-0 text-sm', className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        'bg-gray-100 px-3 py-1.5 text-left font-medium text-gray-700 first:rounded-tl-lg last:rounded-tr-lg [[align=center]]:text-center [[align=right]]:text-right',
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        'border-b border-s border-gray-200 px-3 py-1.5 text-left last:border-e [[align=center]]:text-center [[align=right]]:text-right',
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        'first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg',
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        'my-2 overflow-x-auto rounded-lg bg-gray-100 p-3 text-[13px] leading-relaxed',
        className,
      )}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock()
    return (
      <code
        className={cn(
          !isCodeBlock && 'rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em]',
          className,
        )}
        {...props}
      />
    )
  },
  hr: ({ className, ...props }) => (
    <hr className={cn('my-3 border-gray-200', className)} {...props} />
  ),
})
