import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
<<<<<<< HEAD
  title: 'Fiskal — Enrique',
  description: 'Tu espacio privado para organizar ingresos, compras, ventas, proyectos y nóminas.',
  applicationName: 'Fiskal',
=======
  title: 'Cuenta — Finanzas personales',
  description: 'Tu espacio privado para organizar ingresos, compras, ventas, proyectos y nóminas.',
  applicationName: 'Cuenta',
>>>>>>> 62281e44b66a518ab73288ca4e44e8af418b8c53
  icons: { icon: '/icon.svg', apple: '/apple-icon.png' },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f6f5ef',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
