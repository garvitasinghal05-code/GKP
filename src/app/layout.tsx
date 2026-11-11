// DESTINATION: src/app/layout.tsx  (replaces the existing file)
import type { Metadata } from 'next'
import { Baloo_2, DM_Sans } from 'next/font/google'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import { Navbar } from '@/components/layout/Navbar'
import { Providers } from '@/components/layout/Providers'

const display = Baloo_2({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display' })
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'GKP — GharKePaas',
  description: 'Hyperlocal shop discovery',
}

// Runs before the page paints, so there is no white flash for dark-mode users.
// Order: the visitor's saved choice, else their phone/computer setting, else light.
const themeInit = `(function(){try{var t=localStorage.getItem('gkp-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: string | null = null
  let hasShop = false

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    role = profile?.role ?? null

    if (role !== 'admin') {
      const { data: shop } = await supabase.from('shops').select('id').eq('owner_id', user.id).maybeSingle()
      hasShop = !!shop
    }
  }

  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <Providers>
          <Navbar isLoggedIn={!!user} role={role} hasShop={hasShop} />
          {children}
        </Providers>
      </body>
    </html>
  )
}
