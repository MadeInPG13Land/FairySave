import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { basePath } from '@/lib/asset-path'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'FairySaveTool - Forsaken Frontiers Save Editor',
  description: 'A browser-based save editor for Forsaken Frontiers. Decrypt, edit, and re-encrypt your game save files with a friendly UI.',
  generator: 'v0.app',
  manifest: `${basePath}/site.webmanifest`,
  icons: {
    icon: [
      {
        url: `${basePath}/favicon.ico`,
      },
      {
        url: `${basePath}/favicon-16x16.png`,
        sizes: '16x16',
        type: 'image/png',
      },
      {
        url: `${basePath}/icon-light-32x32.png`,
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: `${basePath}/icon-dark-32x32.png`,
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: `${basePath}/apple-icon.png`,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
