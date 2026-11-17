import { auth } from '@/auth'
import { FinanceApp } from '@/components/finance-app'
import { LoginScreen } from '@/components/login-screen'

export default async function Page() {
  const authConfigured = Boolean(process.env.AUTH_SECRET && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTHORIZED_EMAIL)
  if (!authConfigured) return <LoginScreen setupNeeded />
  const session = await auth()
  const user = session?.user
  const email = user?.email?.trim().toLowerCase()
  const allowed = process.env.AUTHORIZED_EMAIL?.trim().toLowerCase()
  if (!user || !email || !allowed || email !== allowed) return <LoginScreen />
  return <FinanceApp user={user} />
}
