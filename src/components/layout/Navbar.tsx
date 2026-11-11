// DESTINATION: src/components/layout/Navbar.tsx  (replaces the existing file)
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { CartLink } from '@/components/layout/CartLink'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type NavbarProps = { isLoggedIn: boolean; role: string | null; hasShop: boolean }

export function Navbar({ isLoggedIn, role, hasShop }: NavbarProps) {
  const isCustomerSide = isLoggedIn && role !== 'admin'

  return (
    // z-[2000] keeps the bar above every map layer on every page
    <header className="sticky top-0 z-[2000] border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <Link href="/" aria-label="GharKePaas home" className="flex shrink-0 items-center no-underline">
          {/* Two files, CSS shows the right one (see globals.css). They live in /public/logo/ */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/GKP_logo_lightmode.svg" alt="GharKePaas" className="logo-light h-9 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/GKP_logo_darkmode.svg" alt="" aria-hidden="true" className="logo-dark h-9 w-auto" />
        </Link>

        <nav className="flex max-w-full items-center gap-1 overflow-x-auto text-sm">
          <Link href="/search" className="nav-link">Search</Link>

          {!isLoggedIn && (
            <>
              <Link href="/login" className="nav-link">Login</Link>
              <Link
                href="/register"
                className="ml-1 rounded-full bg-brand px-4 py-1.5 font-semibold text-white transition-colors hover:bg-brand-2"
              >
                Sign up
              </Link>
            </>
          )}

          {isLoggedIn && role === 'admin' && <Link href="/admin" className="nav-link">Admin</Link>}
          {isCustomerSide && <Link href="/orders" className="nav-link">My Orders</Link>}
          {isCustomerSide && <Link href="/addresses" className="nav-link">Addresses</Link>}
          {isCustomerSide &&
            (hasShop ? (
              <Link href="/dashboard/shop-owner" className="nav-link">My Shop</Link>
            ) : (
              <Link href="/dashboard/shop-owner/onboarding" className="nav-link">Become a Shop Owner</Link>
            ))}
          {isCustomerSide && <CartLink />}

          <span className="ml-1"><ThemeToggle /></span>
          {isLoggedIn && <span className="ml-1"><LogoutButton /></span>}
        </nav>
      </div>
    </header>
  )
}
