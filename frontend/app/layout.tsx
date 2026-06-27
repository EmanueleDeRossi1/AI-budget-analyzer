import '@mantine/core/styles.css'
import '@mantine/charts/styles.css'
import './globals.css'
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core'

export const metadata = { title: 'AI Budget Analyst' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>{children}</MantineProvider>
      </body>
    </html>
  )
}
