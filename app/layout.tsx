import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler';
import SwRegister from '@/components/sw-register';
import InstallPrompt from '@/components/install-prompt';
import { ResourcePrefetcher } from '@/components/resource-prefetcher';
import Script from 'next/script';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL) : undefined,
  title: 'FaturaAO - Sistema de Faturação Certificado AGT Angola',
  description: 'Software de faturação profissional para Angola. Emita faturas com compliance total à Administração Geral Tributária (AGT).',
  manifest: '/manifest.json',
  applicationName: 'FaturaAO',
  appleWebApp: {
    capable: true,
    title: 'FaturaAO',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/icon-192.png',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'FaturaAO - Faturação Angola',
    description: 'Sistema de faturação certificado AGT para empresas angolanas',
    images: ['/og-image.png'],
    type: 'website',
  },
  twitter: { card: 'summary_large_image', images: ['/og-image.png'] },
};

export const viewport: Viewport = {
  themeColor: '#0b4a6f',          // Xero navy — matches app header
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,                // Prevent zoom on input focus (iOS)
  userScalable: false,
  viewportFit: 'cover',           // Enable safe-area-inset-* on notch/Dynamic Island
};

import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta name="application-name" content="FaturaAO" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FaturaAO" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground" suppressHydrationWarning>
        <Script src="https://apps.abacus.ai/chatllm/appllm-lib.js" strategy="lazyOnload" />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-right" />
          <SwRegister />
          <InstallPrompt />
          <ChunkLoadErrorHandler />
        </ThemeProvider>
      </body>
    </html>
  );
}
