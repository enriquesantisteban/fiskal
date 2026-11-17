'use client'

import { useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { signOut } from 'next-auth/react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Banknote, BarChart3, CalendarDays, Check, ChevronDown, CircleDollarSign, Computer, FileSpreadsheet, LayoutDashboard, LogOut, Menu, Plus, Search, ShoppingBag, Trophy, Wallet, X } from 'lucide-react'

type Row = Record<string, string | number>
type Data = { basketballMonthly: Row[]; basketballSeasons: Row[]; sales: Row[]; purchases: Row[]; it: Row[]; payroll: { company: string; rows: Row[] }[] }
type Section = 'Dashboard' | 'Baloncesto' | 'Ventas' | 'Compras' | 'Informática' | 'Nóminas'
const sections: { name: Section; icon: typeof LayoutDashboard; key?: keyof Data }[] = [
  { name: 'Dashboard', icon: LayoutDashboard }, { name: 'Baloncesto', icon: Trophy }, { name: 'Ventas', icon: CircleDollarSign, key: 'sales' }, { name: 'Compras', icon: ShoppingBag, key: 'purchases' }, { name: 'Informática', icon: Computer, key: 'it' }, { name: 'Nóminas', icon: Wallet, key: 'payroll' },
]
const fetcher = async (url: string) => { const r = await fetch(url); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'No se pudo cargar la hoja'); return data as Data }
const parseAmount = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let normalized = String(value ?? '').trim().replace(/\s|€|EUR/gi, '').replace(/[^\d,.-]/g, '')
  if (!normalized) return 0
  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '')
  } else if (comma >= 0) {
    normalized = normalized.replace(/,/g, '.')
  } else if (dot >= 0) {
    const groups = normalized.split('.')
    if (groups.length > 2 || groups.at(-1)?.length === 3) normalized = groups.join('')
  }
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}
const euros = (value: unknown) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(parseAmount(value))
const numericTotal = (rows: Row[] | undefined, key: string) => (rows ?? []).reduce((sum, row) => sum + parseAmount(row[key]), 0)
const fields: Record<Exclude<Section, 'Dashboard'>, { key: string; label: string; type?: string; options?: string[] }[]> = {
  Baloncesto: [{ key: 'kind', label: 'Tipo de registro', type: 'select', options: ['monthly', 'season'] }, { key: 'MESES', label: 'Mes' }, { key: 'DINERO INGRESADO', label: 'Dinero ingresado', type: 'number' }, { key: 'TEMPORADA', label: 'Temporada' }, { key: 'DINERO GANADO', label: 'Dinero ganado', type: 'number' }],
  Ventas: [{ key: 'VENTAS', label: 'Venta' }, { key: 'COMERCIO', label: 'Comercio' }, { key: 'DINERO APORTADO', label: 'Dinero aportado', type: 'number' }, { key: 'DINERO RECOGIDO', label: 'Dinero recogido', type: 'number' }],
  Compras: [{ key: 'COMPRAS', label: 'Compra' }, { key: 'COMERCIO', label: 'Comercio' }, { key: 'DINERO PAGADO', label: 'Dinero pagado', type: 'number' }, { key: 'A MEDIAS', label: '¿A medias?', type: 'select', options: ['No', 'Sí'] }, { key: 'REEMBOLSO', label: 'Reembolso', type: 'number' }],
  'Informática': [{ key: 'CLIENTE', label: 'Cliente' }, { key: 'TRABAJO', label: 'Trabajo' }, { key: 'FECHA DE INICIO', label: 'Fecha de inicio', type: 'date' }, { key: 'FECHA DE FINALIZACIÓN', label: 'Fecha de finalización', type: 'date' }, { key: 'IMPORTE', label: 'Importe', type: 'number' }, { key: 'PAGADO', label: '¿Pagado?', type: 'select', options: ['No', 'Sí'] }],
  Nóminas: [{ key: 'company', label: 'Empresa', type: 'select' }, { key: 'MES', label: 'Mes', type: 'select', options: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] }, { key: 'PAGADO', label: 'Importe pagado', type: 'number' }],
}

export function FinanceApp({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
  const [active, setActive] = useState<Section>('Dashboard')
  const [modal, setModal] = useState(false)
  const [query, setQuery] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const { data, error, isLoading } = useSWR('/api/sheets', fetcher, { revalidateOnFocus: true })
  const rows = useMemo(() => {
    if (!data) return [] as Row[]
    if (active === 'Baloncesto') return [...data.basketballMonthly, ...data.basketballSeasons]
    if (active === 'Nóminas') return data.payroll.flatMap((item) => item.rows.map((row): Row => ({ Empresa: item.company, ...row })))
    const key = sections.find((s) => s.name === active)?.key
    return key ? (data[key] as Row[]) : []
  }, [active, data])
  const filteredRows = rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())))
  const basketballMonthlyRows = (data?.basketballMonthly ?? []).filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())))
  const basketballSeasonRows = (data?.basketballSeasons ?? []).filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())))
  const totals = { sales: numericTotal(data?.sales, 'BENEFICIO'), purchases: numericTotal(data?.purchases, 'PRECIO FINAL'), payroll: (data?.payroll ?? []).reduce((sum, company) => sum + numericTotal(company.rows, 'PAGADO'), 0), basketball: numericTotal(data?.basketballMonthly, 'DINERO INGRESADO') + numericTotal(data?.basketballSeasons, 'DINERO GANADO'), it: numericTotal(data?.it, 'IMPORTE') }
  const chart = [{ month: 'Baloncesto', amount: totals.basketball }, { month: 'Ventas', amount: totals.sales }, { month: 'Compras', amount: totals.purchases }, { month: 'Informática', amount: totals.it }, { month: 'Nóminas', amount: totals.payroll }]

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const record = Object.fromEntries(formData.entries())
    const sheet = active === 'Baloncesto' ? 'BALONCESTO' : active === 'Ventas' ? 'VENTAS' : active === 'Compras' ? 'COMPRAS' : active === 'Informática' ? 'INFORMÁTICA' : 'NÓMINAS'
    const response = await fetch('/api/sheets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheet, record }) })
    const result = await response.json()
    if (!response.ok) { window.alert(result.error || 'No se pudo guardar el registro.'); return }
    await mutate('/api/sheets'); setModal(false)
  }

  return <main className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand sidebar-brand" href="#"><span className="brand-mark">c</span><span>cuenta<span className="brand-period">.</span></span></a>
      <div className="nav-caption">TU ESPACIO</div>
      <nav aria-label="Navegación principal">{sections.map(({ name, icon: Icon }) => <button key={name} className={`nav-link ${active === name ? 'nav-active' : ''}`} onClick={() => { setActive(name); setQuery(''); setMobileNav(false) }}><Icon size={18} strokeWidth={1.8} /><span>{name}</span>{name === 'Dashboard' && active === name && <span className="nav-indicator" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sheet-status"><span className="status-pulse" /><div><strong>Google Sheets</strong><small>{error ? 'Revisar conexión' : isLoading ? 'Conectando…' : 'Sincronización activa'}</small></div><FileSpreadsheet size={17} /></div><div className="profile"><div className="avatar">{user.image ? <img src={user.image} alt="" /> : <span>{user.name?.[0] ?? 'U'}</span>}</div><div className="profile-copy"><strong>{user.name ?? 'Mi cuenta'}</strong><small>{user.email}</small></div><button className="icon-button logout" aria-label="Cerrar sesión" onClick={() => signOut()}><LogOut size={16} /></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-backdrop" aria-label="Cerrar navegación" onClick={() => setMobileNav(false)} />}
    <section className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Abrir navegación" onClick={() => setMobileNav(true)}><Menu size={19} /></button><span>Mis finanzas</span><span className="crumb-slash">/</span><strong>{active}</strong></div><div className="topbar-right"><span className="today"><CalendarDays size={15} /> {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span><div className="top-avatar">{user.image ? <img src={user.image} alt="" /> : user.name?.[0] ?? 'U'}</div></div></header>
      <div className="content">
        {error && <div className="error-banner"><span>Google Sheets todavía no está conectado. Comprueba las variables de entorno y comparte la hoja con la cuenta de servicio.</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => mutate('/api/sheets')}><X size={16} /></button></div>}
        {active === 'Dashboard' ? <>
          <div className="page-heading"><div><div className="eyebrow small-eyebrow"><span className="eyebrow-dot" /> RESUMEN PERSONAL</div><h1>Todo en <em>perspectiva.</em></h1><p>Un lugar para ver cómo se mueve tu dinero.</p></div><button className="button-primary" onClick={() => setActive('Ventas')}><Plus size={17} /> Añadir registro</button></div>
          <div className="kpi-grid">
            <Kpi title="BENEFICIO EN VENTAS" value={euros(totals.sales)} icon={ArrowUpRight} tone="green" foot={`${data?.sales.length ?? 0} ventas registradas`} />
            <Kpi title="GASTO EN COMPRAS" value={euros(totals.purchases)} icon={ArrowDownLeft} tone="orange" foot={`${data?.purchases.length ?? 0} compras registradas`} />
            <Kpi title="INGRESOS INFORMÁTICA" value={euros(totals.it)} icon={Computer} tone="violet" foot={`${data?.it.length ?? 0} trabajos registrados`} />
            <Kpi title="NÓMINAS RECIBIDAS" value={euros(totals.payroll)} icon={Banknote} tone="yellow" foot={`${data?.payroll.reduce((n, c) => n + c.rows.length, 0) ?? 0} pagos registrados`} />
          </div>
          <div className="dashboard-grid">
            <section className="panel chart-panel"><div className="panel-heading"><div><span className="panel-kicker">PANORAMA</span><h2>Balance por actividad</h2></div><span className="chart-period">Todas las secciones <ChevronDown size={14} /></span></div><div className="chart-summary"><strong>{euros(totals.sales + totals.payroll + totals.it + totals.basketball - totals.purchases)}</strong><span>balance neto registrado</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 12, right: 6, left: 0, bottom: 0 }}><defs><linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#66947c" stopOpacity={0.28} /><stop offset="95%" stopColor="#66947c" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9e8df" strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#92948a', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#92948a', fontSize: 10 }} tickFormatter={(v) => `${v}€`} width={50} /><Tooltip formatter={(value) => euros(value)} contentStyle={{ borderRadius: 12, borderColor: '#e6e5db', fontSize: 12 }} /><Area type="monotone" dataKey="amount" name="Importe" stroke="#547c67" strokeWidth={2.5} fill="url(#fillBalance)" /></AreaChart></ResponsiveContainer></div><div className="chart-legend"><span><i /> Importes acumulados</span><span>Fuente: tus hojas</span></div></section>
            <section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">TUS ÁREAS</span><h2>Actividad financiera</h2></div><button className="text-button" onClick={() => setActive('Baloncesto')}>Ver todo <ArrowUpRight size={14} /></button></div><div className="activity-list">{[{ name: 'Baloncesto', sub: 'Ingresos y temporadas', icon: Trophy, total: totals.basketball, tone: 'activity-green' }, { name: 'Ventas', sub: `${data?.sales.length ?? 0} registros`, icon: CircleDollarSign, total: totals.sales, tone: 'activity-violet' }, { name: 'Compras', sub: `${data?.purchases.length ?? 0} registros`, icon: ShoppingBag, total: totals.purchases, tone: 'activity-orange' }, { name: 'Informática', sub: `${data?.it.length ?? 0} trabajos`, icon: Computer, total: totals.it, tone: 'activity-blue' }, { name: 'Nóminas', sub: `${data?.payroll.length ?? 0} empresas`, icon: Wallet, total: totals.payroll, tone: 'activity-yellow' }].map(({ name, sub, icon: Icon, total, tone }) => <button className="activity-row" key={name} onClick={() => setActive(name as Section)}><span className={`activity-icon ${tone}`}><Icon size={17} /></span><span className="activity-copy"><strong>{name}</strong><small>{sub}</small></span><strong className="activity-total">{euros(total)}</strong><ArrowUpRight className="activity-arrow" size={15} /></button>)}</div><div className="activity-note"><span className="note-symbol">↗</span><span>Tus datos se guardan en tu propia hoja de cálculo.</span></div></section>
          </div>
          <div className="dashboard-bottom"><div><span className="bottom-dot" /> DATOS PRIVADOS · SOLO PARA TI</div><span>Actualizado al consultar tus hojas</span></div>
        </> : <>
          <div className="page-heading section-heading"><div><div className="eyebrow small-eyebrow"><span className="eyebrow-dot" /> GESTIÓN PERSONAL</div><h1>{active === 'Baloncesto' ? 'Baloncesto' : active}<span className="heading-period">.</span></h1><p>{sectionDescription(active)}</p></div><button className="button-primary" onClick={() => setModal(true)}><Plus size={17} /> Añadir registro</button></div>
          {active === 'Baloncesto' && <div className="split-stats"><div className="split-card"><span>INGRESOS MENSUALES</span><strong>{euros(numericTotal(data?.basketballMonthly, 'DINERO INGRESADO'))}</strong><small>{data?.basketballMonthly.length ?? 0} meses registrados</small></div><div className="split-card split-lime"><span>ACUMULADO POR TEMPORADA</span><strong>{euros(numericTotal(data?.basketballSeasons, 'DINERO GANADO'))}</strong><small>{data?.basketballSeasons.length ?? 0} temporadas</small></div></div>}
          {active === 'Nóminas' && <div className="company-chips">{data?.payroll.map((item) => <span key={item.company}>{item.company}<b>{item.rows.length}</b></span>)}</div>}
          <section className="panel table-panel"><div className="table-toolbar"><div><span className="panel-kicker">REGISTROS</span><h2>{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</h2></div><label className="searchbox"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en registros..." aria-label="Buscar en registros" />{query && <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={14} /></button>}</label></div>{active === 'Baloncesto' ? <div className="basketball-tables"><BasketballTable title="INGRESOS POR MES" columns={['MESES', 'DINERO INGRESADO']} rows={basketballMonthlyRows} isLoading={isLoading} query={query} onAdd={() => setModal(true)} /><BasketballTable title="INGRESOS POR TEMPORADA" columns={['TEMPORADA', 'DINERO GANADO']} rows={basketballSeasonRows} isLoading={isLoading} query={query} onAdd={() => setModal(true)} /></div> : <div className="table-scroll"><table><thead><tr>{tableColumns(active).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={8} className="table-empty">Cargando desde Google Sheets…</td></tr> : filteredRows.length ? filteredRows.map((row, index) => <tr key={index}>{tableColumns(active).map((key) => <td key={key}>{renderCell(key, row[key])}</td>)}</tr>) : <tr><td colSpan={8} className="table-empty"><div className="empty-icon"><BarChart3 size={20} /></div><strong>{query ? 'No encontramos resultados' : 'Aún no hay registros'}</strong><span>{query ? 'Prueba con otra búsqueda.' : 'Añade tu primer registro para empezar.'}</span>{!query && <button className="button-outline" onClick={() => setModal(true)}><Plus size={15} /> Añadir registro</button>}</td></tr>}</tbody></table></div>}<div className="table-footer"><span>Mostrando {active === 'Baloncesto' ? basketballMonthlyRows.length + basketballSeasonRows.length : filteredRows.length} de {rows.length} registros</span><span><span className="status-pulse" /> Sincronizado con Google Sheets</span></div></section>
        </>}
      </div>
    </section>
    {modal && <RecordModal active={active as Exclude<Section, 'Dashboard'>} companies={data?.payroll.map((p) => p.company) ?? []} onClose={() => setModal(false)} onSave={saveRecord} />}
  </main>
}

function BasketballTable({ title, columns, rows, isLoading, query, onAdd }: { title: string; columns: string[]; rows: Row[]; isLoading: boolean; query: string; onAdd: () => void }) {
  return <section className="basketball-table"><h3>{title}</h3><div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={columns.length} className="table-empty">Cargando desde Google Sheets…</td></tr> : rows.length ? rows.map((row, index) => <tr key={index}>{columns.map((key) => <td key={key}>{renderCell(key, row[key])}</td>)}</tr>) : <tr><td colSpan={columns.length} className="table-empty"><strong>{query ? 'No encontramos resultados' : 'Aún no hay registros'}</strong><span>{query ? 'Prueba con otra búsqueda.' : 'Añade tu primer registro para empezar.'}</span>{!query && <button className="button-outline" onClick={onAdd}><Plus size={15} /> Añadir registro</button>}</td></tr>}</tbody></table></div></section>
}

function Kpi({ title, value, icon: Icon, tone, foot }: { title: string; value: string; icon: typeof ArrowUpRight; tone: string; foot: string }) { return <article className="kpi-card"><div className="kpi-top"><span>{title}</span><span className={`kpi-icon ${tone}`}><Icon size={17} /></span></div><strong className="kpi-value">{value}</strong><div className="kpi-foot"><span className="kpi-dash" />{foot}</div></article> }
function sectionDescription(section: Section) { return ({ Baloncesto: 'Controla los ingresos por mes y por temporada.', Ventas: 'Sigue las ventas, aportaciones y el beneficio generado.', Compras: 'Registra tus compras, pagos y reembolsos.', 'Informática': 'Organiza trabajos, fechas de entrega e importes.', Nóminas: 'Consulta los pagos mensuales de cada empresa.' } as Record<string, string>)[section] ?? '' }
function tableColumns(section: Section) { if (section === 'Baloncesto') return ['MESES', 'DINERO INGRESADO', 'TEMPORADA', 'DINERO GANADO']; if (section === 'Ventas') return ['VENTAS', 'COMERCIO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO']; if (section === 'Compras') return ['COMPRAS', 'COMERCIO', 'DINERO PAGADO', 'A MEDIAS', 'REEMBOLSO', 'PRECIO FINAL']; if (section === 'Informática') return ['CLIENTE', 'TRABAJO', 'FECHA DE INICIO', 'FECHA DE FINALIZACIÓN', 'IMPORTE', 'PAGADO']; return ['Empresa', 'MES', 'PAGADO'] }
function renderCell(key: string, value: unknown) { if (key === 'PAGADO') { const normalized = String(value ?? '').trim().toLowerCase(); if (['sí', 'si', 'no'].includes(normalized)) return <span className={`paid-badge ${normalized === 'sí' || normalized === 'si' ? 'paid-yes' : 'paid-no'}`}><span />{normalized === 'no' ? 'Pendiente' : 'Pagado'}</span>; return value == null || value === '' ? '—' : euros(value) } if (['DINERO INGRESADO', 'DINERO GANADO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO', 'DINERO PAGADO', 'REEMBOLSO', 'PRECIO FINAL', 'IMPORTE'].includes(key)) return euros(value); if (key === 'A MEDIAS') return <span className="yes-no">{String(value || 'No')}</span>; return String(value ?? '—') }
function RecordModal({ active, companies, onClose, onSave }: { active: Exclude<Section, 'Dashboard'>; companies: string[]; onClose: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const inputs = fields[active]
  const [basketballKind, setBasketballKind] = useState('monthly')
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-head"><div><span className="panel-kicker">{active.toUpperCase()}</span><h2 id="modal-title">Nuevo registro</h2><p>Se guardará directamente en tu hoja de cálculo.</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></header><form onSubmit={onSave}><div className="modal-fields">{inputs.map((field) => { if (field.key === 'kind') return <label key={field.key}>{field.label}<select name={field.key} value={basketballKind} onChange={(event) => setBasketballKind(event.target.value)}><option value="monthly">Ingreso mensual</option><option value="season">Resumen por temporada</option></select></label>; if (field.key === 'company') return <label key={field.key}>{field.label}<select name={field.key} required defaultValue=""><option value="" disabled>Selecciona una empresa</option>{companies.map((name) => <option key={name}>{name}</option>)}</select></label>; if (active === 'Baloncesto' && (field.key === 'TEMPORADA' || field.key === 'DINERO GANADO')) return basketballKind === 'season' ? <label className="conditional-field" key={field.key}>{field.label}<input name={field.key} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} required /></label> : null; if (active === 'Baloncesto' && (field.key === 'MESES' || field.key === 'DINERO INGRESADO')) return basketballKind === 'monthly' ? <label className="conditional-field" key={field.key}>{field.label}<input name={field.key} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} required /></label> : null; if (field.type === 'select') return <label key={field.key}>{field.label}<select name={field.key} required defaultValue="">{field.options?.map((o) => <option key={o} value={o} disabled={o === ''}>{o}</option>)}</select></label>; return <label key={field.key}>{field.label}<input name={field.key} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} required /></label> })}</div><div className="modal-actions"><button type="button" className="button-outline" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> Guardar registro</button></div></form></section></div>
}
