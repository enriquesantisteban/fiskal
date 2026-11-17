'use client'

import { signIn } from 'next-auth/react'
import { ArrowUpRight, BarChart3, LockKeyhole, Sparkles } from 'lucide-react'

export function LoginScreen({ setupNeeded = false }: { setupNeeded?: boolean }) {
  return (
    <main className="login-shell">
      <div className="login-grain" aria-hidden="true" />
      <header className="login-top"><a className="brand" href="#"><span className="brand-mark">f</span><span>Fiskal<span className="brand-period">.</span></span></a><span className="private-label"><LockKeyhole size={14} /> ESPACIO PRIVADO</span></header>
      <section className="login-content">
        <div className="login-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> TU DINERO, EN ORDEN</div>
          <h1>Una mirada<br />a todo lo que<br /><em>construyes.</em></h1>
          <p>Tu espacio personal para seguir cada ingreso, gasto y proyecto. Todo organizado, nada se pierde de vista.</p>
          <button className="google-button" onClick={() => signIn('google')} disabled={setupNeeded} aria-disabled={setupNeeded}><span className="google-g">G</span> Iniciar sesión con Google <ArrowUpRight size={17} /></button>
          {setupNeeded && <p className="setup-note">Para activar el acceso, añade las credenciales privadas de Auth.js y Google OAuth en las variables del proyecto.</p>}
          <div className="secure-note"><LockKeyhole size={13} /> Acceso exclusivo y cifrado</div>
        </div>
        <aside className="login-art" aria-label="Vista previa del panel financiero">
          <div className="art-head"><span>VISTA GENERAL</span><span className="art-live"><span /> PRIVADO</span></div>
          <div className="art-title">Tu panorama<br />financiero<span>.</span></div>
          <div className="art-chart" aria-hidden="true"><div className="art-axis"><span>INGRESOS</span><span>GASTOS</span></div><div className="art-bars">{[24, 32, 29, 42, 37, 51, 44, 58, 51, 67, 57, 76, 65, 86, 74, 94, 80, 100].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</div><div className="art-months"><span>ENE</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span></div></div>
          <div className="art-bottom"><div><span className="art-icon"><BarChart3 size={15} /></span><span>5 áreas organizadas</span></div><Sparkles size={16} /></div>
        </aside>
      </section>
      <footer className="login-footer"><span>CUENTA PERSONAL</span><span>Hecho para tenerlo claro <span className="brand-period">.</span></span></footer>
    </main>
  )
}
