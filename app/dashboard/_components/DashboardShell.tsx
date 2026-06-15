'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase'

const NAV_LINKS = [
  { href: '/dashboard/businesses', label: 'Businesses' },
  { href: '/dashboard/locations',  label: 'Locations' },
  { href: '/dashboard/contacts',   label: 'Contacts' },
  { href: '/dashboard/rules',      label: 'Rules' },
  { href: '/dashboard/logs',       label: 'Alert Logs' },
]

export default function DashboardShell({
  email,
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createBrowserSupabaseClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r flex flex-col shrink-0">
        <div className="px-4 py-4 border-b">
          <span className="font-bold text-gray-900 text-base">Utilyze</span>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_LINKS.map(link => {
            const active = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
          <span className="font-semibold text-gray-800">Utilyze Admin</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{email}</span>
            <button
              onClick={signOut}
              className="text-sm text-gray-600 hover:text-gray-900 border rounded px-3 py-1 transition-colors"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
