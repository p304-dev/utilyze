import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import DashboardShell from './_components/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  return (
    <DashboardShell email={user.email ?? ''}>
      {children}
    </DashboardShell>
  )
}
