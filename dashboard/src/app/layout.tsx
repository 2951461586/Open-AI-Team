import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '团队看板',
  description: '团队协作看板 — 任务、对话与交付追踪',
  applicationName: '团队看板',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '团队看板', statusBarStyle: 'default' },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    title: '团队看板', description: '团队协作看板 — 任务、对话与交付追踪',
    siteName: '团队看板', type: 'website',
  },
  twitter: {
    card: 'summary', title: '团队看板',
    description: '团队协作看板 — 任务、对话与交付追踪',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try{
              var t=localStorage.getItem('dashboard-theme');
              if(t==='midnight') document.documentElement.setAttribute('data-theme','midnight');
            }catch(e){}
          })();
        `}} />
      </head>
      <body className="h-screen overflow-hidden antialiased">
        {children}
      </body>
    </html>
  )
}
