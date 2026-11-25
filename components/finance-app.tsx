'use client'

import { useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import useSWR, { mutate } from 'swr'
import { signOut } from 'next-auth/react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Banknote, BarChart3, CalendarDays, Check, ChevronDown, CircleDollarSign, Computer, Database, LayoutDashboard, LogOut, Menu, Pencil, Plus, Search, ShoppingBag, Trash2, Wallet, X } from 'lucide-react'
import { TopCommerceChart } from '@/components/finance-charts'

type Row = Record<string, unknown> & { _id?: string; _rowNumber?: number }
type Data = { basketball: Row[]; sales: Row[]; purchases: Row[]; it: Row[]; payroll: Row[]; warnings?: string[] }
type Section = 'Dashboard' | 'Baloncesto' | 'Ventas' | 'Compras' | 'InformÃ¡tica' | 'NÃ³minas'
type RecordIdentity = { id: string }
const sections: { name: Section; icon: ComponentType<{ size?: number; strokeWidth?: number }>; key?: keyof Data }[] = [
  { name: 'Dashboard', icon: LayoutDashboard }, { name: 'Baloncesto', icon: BasketballIcon }, { name: 'Ventas', icon: CircleDollarSign, key: 'sales' }, { name: 'Compras', icon: ShoppingBag, key: 'purchases' }, { name: 'InformÃ¡tica', icon: Computer, key: 'it' }, { name: 'NÃ³minas', icon: Wallet, key: 'payroll' },
]
function BasketballIcon({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2" /><path d="M4 7.5c4 1 7.2 5 8 12.8M20 7.5c-4 1-7.2 5-8 12.8M3 12h18" /></svg> }
const fetcher = async (url: string) => { const response = await fetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo cargar la hoja'); return data as Data }
const parseAmount = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let normalized = String(value ?? '').trim().replace(/\s|â‚¬|EUR/gi, '').replace(/[^\d,.-]/g, '')
  if (!normalized) return 0
  const comma = normalized.lastIndexOf(',')
  const dot = normalized.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) normalized = comma > dot ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '')
  else if (comma >= 0) normalized = normalized.replace(/,/g, '.')
  else if (dot >= 0) { const groups = normalized.split('.'); if (groups.length > 2 || groups.at(-1)?.length === 3) normalized = groups.join('') }
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}
const euros = (value: unknown) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(parseAmount(value))
const numericTotal = (rows: Row[] | undefined, key: string) => (rows ?? []).reduce((sum, row) => sum + parseAmount(row[key]), 0)
const amountPaid = (row: Row) => {
  if (row.PAGADO !== undefined) return parseAmount(row.PAGADO)
  const status = String(row.PAGADO ?? '').trim().toLocaleLowerCase('es')
  if (['sÃ­', 'si'].includes(status)) return parseAmount(row.IMPORTE)
  if (status === 'no') return 0
  return parseAmount(row.PAGADO)
}
const recordId = (row: Row) => String(row._id ?? '')
const monthOptions = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const monthNumber = (value: unknown) => {
  const numeric = Number(value)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es')
  return monthOptions.findIndex((month) => month.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es') === normalized) + 1
}
const yearNumber = (value: unknown) => Number(String(value ?? '').match(/\d{4}/)?.[0] ?? parseAmount(value))
const rowDateValue = (row: Row, section: Section) => {
  if (row['FECHA DE REGISTRO']) return Date.parse(String(row['FECHA DE REGISTRO'])) || 0
  if (section === 'InformÃ¡tica') return Date.parse(String(row['FECHA DE INICIO'] ?? '')) || Number(row._rowNumber ?? 0)
  if (section === 'Baloncesto' || section === 'NÃ³minas') {
    const month = monthNumber(row.MES)
    const year = yearNumber(row['AÃ‘O'])
    return month > 0 && year > 0 ? Date.UTC(year, month - 1, 1) : Number(row._rowNumber ?? 0)
  }
  // Las tablas de ventas y compras conservan la fecha de creaciÃ³n del registro.
  return Number(row._rowNumber ?? 0)
}
const sortRowsByDateDesc = (rows: Row[], section: Section) => [...rows].sort((left, right) => rowDateValue(right, section) - rowDateValue(left, section))
const seasonFor = (month: number, year: number) => {
  if (!Number.isInteger(year) || year < 1) return null
  if (month >= 9 && month <= 12) return `${year}/${year + 1}`
  if (month >= 1 && month <= 6) return `${year - 1}/${year}`
  return null
}
const seasonForRow = (row: Row) => String(row.TEMPORADA ?? '').trim() || seasonFor(monthNumber(row.MES), yearNumber(row.AÃ‘O)) || ''
const currentSeason = (date = new Date()) => {
  const year = date.getFullYear()
  return date.getMonth() + 1 >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`
}
const fields: Record<Exclude<Section, 'Dashboard'>, { key: string; label: string; type?: string; options?: string[] }[]> = {
  Baloncesto: [{ key: 'MES', label: 'Mes', type: 'select', options: monthOptions }, { key: 'AÃ‘O', label: 'AÃ±o' }, { key: 'DINERO INGRESADO', label: 'Dinero ingresado', type: 'number' }],
  Ventas: [{ key: 'VENTAS', label: 'Venta' }, { key: 'COMERCIO', label: 'Comercio' }, { key: 'DINERO APORTADO', label: 'Dinero aportado', type: 'number' }, { key: 'DINERO RECOGIDO', label: 'Dinero recogido', type: 'number' }],
  Compras: [{ key: 'COMPRAS', label: 'Compra' }, { key: 'COMERCIO', label: 'Comercio' }, { key: 'DINERO PAGADO', label: 'Dinero pagado', type: 'number' }, { key: 'A MEDIAS', label: 'Â¿A medias?', type: 'select', options: ['No', 'SÃ­'] }, { key: 'REEMBOLSO', label: 'Reembolso', type: 'number' }],
  'InformÃ¡tica': [{ key: 'CLIENTE', label: 'Cliente' }, { key: 'TRABAJO', label: 'Trabajo' }, { key: 'FECHA DE INICIO', label: 'Fecha de inicio', type: 'date' }, { key: 'FECHA DE FINALIZACIÃ“N', label: 'Fecha de finalizaciÃ³n (opcional)', type: 'date' }, { key: 'IMPORTE', label: 'Importe', type: 'number' }, { key: 'PAGADO', label: 'Pagado', type: 'number' }],
  NÃ³minas: [{ key: 'EMPRESA', label: 'Empresa' }, { key: 'MES', label: 'Mes', type: 'select', options: monthOptions }, { key: 'AÃ‘O', label: 'AÃ±o' }, { key: 'PAGADO', label: 'Importe pagado', type: 'number' }],
}

export function FinanceApp({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
  const [active, setActive] = useState<Section>('Dashboard')
  const [modal, setModal] = useState(false)
  const [showCategoryChooser, setShowCategoryChooser] = useState(false)
  const [recordToEdit, setRecordToEdit] = useState<Row | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [selectedBasketballSeason, setSelectedBasketballSeason] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const { data, error, isLoading } = useSWR('/api/records', fetcher, { revalidateOnFocus: true })
  const rows = useMemo(() => {
    if (!data) return [] as Row[]
    if (active === 'Baloncesto') return data.basketball
    if (active === 'NÃ³minas') return data.payroll
    const key = sections.find((section) => section.name === active)?.key
    return key ? (data[key] as Row[]) : []
  }, [active, data])
  const matchesQuery = (row: Row) => Object.entries(row).filter(([key]) => !key.startsWith('_')).some(([, value]) => String(value).toLowerCase().includes(query.toLowerCase()))
  const filteredRows = sortRowsByDateDesc(rows.filter(matchesQuery), active)
  const basketballSeasonRows = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of data?.basketball ?? []) {
      const season = seasonForRow(row)
      if (!season) continue
      totals.set(season, (totals.get(season) ?? 0) + parseAmount(row['DINERO INGRESADO']))
    }
    return [...totals].map(([season, amount]) => ({ TEMPORADA: season, 'DINERO GANADO': amount })).sort((left, right) => Number(right.TEMPORADA.slice(0, 4)) - Number(left.TEMPORADA.slice(0, 4)))
  }, [data])
  const basketballRows = sortRowsByDateDesc((data?.basketball ?? []).filter(matchesQuery), 'Baloncesto')
  const payrollRows = data?.payroll ?? []
  const payrollCompanies = [...new Set(payrollRows.map((row) => String(row.EMPRESA ?? '').trim()).filter(Boolean))]
  const totals = {
    sales: numericTotal(data?.sales, 'BENEFICIO'),
    salesCollected: numericTotal(data?.sales, 'DINERO RECOGIDO'),
    salesContributed: numericTotal(data?.sales, 'DINERO APORTADO'),
    purchases: numericTotal(data?.purchases, 'PRECIO FINAL'),
    refunds: numericTotal(data?.purchases, 'REEMBOLSO'),
    payroll: numericTotal(payrollRows, 'PAGADO'),
    basketball: numericTotal(data?.basketball, 'DINERO INGRESADO'),
    it: numericTotal(data?.it, 'IMPORTE'),
    itPaid: (data?.it ?? []).reduce((sum, row) => sum + amountPaid(row), 0),
  }
  const totalIncomes = totals.basketball + totals.salesCollected + totals.payroll + totals.itPaid
  const chart = [{ month: 'Baloncesto', amount: totals.basketball }, { month: 'Ventas', amount: totals.sales }, { month: 'Compras', amount: totals.purchases }, { month: 'InformÃ¡tica', amount: totals.itPaid }, { month: 'NÃ³minas', amount: totals.payroll }]
  const selectedRows = rows.filter((row) => selectedIds.has(recordId(row)))
  const categories: Record<Exclude<Section, 'Dashboard'>, string> = { Baloncesto: 'basketball', Ventas: 'sales', Compras: 'purchases', 'InformÃ¡tica': 'it', NÃ³minas: 'payroll' }
  const payrollCount = payrollRows.length
  const companyCount = payrollCompanies.length
  const paidIt = (data?.it ?? []).filter((row) => amountPaid(row) >= parseAmount(row.IMPORTE))
  const unpaidIt = (data?.it ?? []).filter((row) => amountPaid(row) < parseAmount(row.IMPORTE))
  const pendingItAmount = unpaidIt.reduce((sum, row) => sum + Math.max(0, parseAmount(row.IMPORTE) - amountPaid(row)), 0)
  const cards: Partial<Record<Section, { title: string; value: string; foot: string }[]>> = {
    Ventas: [{ title: 'DINERO APORTADO', value: euros(totals.salesContributed), foot: `${data?.sales.length ?? 0} ventas registradas` }, { title: 'DINERO RECOGIDO', value: euros(totals.salesCollected), foot: 'Importe total cobrado' }, { title: 'BENEFICIO GENERADO', value: euros(totals.sales), foot: 'Recogido menos aportado' }],
    Compras: [{ title: 'GASTO FINAL', value: euros(totals.purchases), foot: `${data?.purchases.length ?? 0} compras registradas` }, { title: 'TOTAL REEMBOLSADO', value: euros(totals.refunds), foot: 'Importe devuelto de tus compras' }],
    'InformÃ¡tica': [{ title: 'IMPORTE TOTAL', value: euros(totals.it), foot: `${data?.it.length ?? 0} trabajos registrados` }, { title: 'COBRADO', value: euros(totals.itPaid), foot: `${paidIt.length} trabajos completados` }, { title: 'PENDIENTE DE COBRO', value: euros(pendingItAmount), foot: `${unpaidIt.length} trabajos pendientes` }],
    NÃ³minas: [{ title: 'NÃ“MINAS RECIBIDAS', value: euros(totals.payroll), foot: `${payrollCount} pagos registrados` }, { title: 'EMPRESAS', value: String(companyCount), foot: 'Empresas con registros de nÃ³mina' }],
  }

  function openAddRecord() { setRecordToEdit(null); setSelectedIds(new Set()); setModal(true) }
  function toggleSelection(row: Row) {
    const id = recordId(row)
    setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function chooseRecordSection(section: Exclude<Section, 'Dashboard'>) {
    setActive(section)
    setQuery('')
    setSelectedBasketballSeason('')
    setShowCategoryChooser(false)
    setRecordToEdit(null)
    setModal(true)
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const record: Record<string, FormDataEntryValue | string> = Object.fromEntries(formData.entries())
    if (active === 'Baloncesto') {
      record.TEMPORADA = seasonFor(monthNumber(record.MES), yearNumber(record.AÃ‘O)) ?? ''
    }
    const isEditing = Boolean(recordToEdit)
    const identity: RecordIdentity | undefined = recordToEdit?._id ? { id: recordToEdit._id } : undefined
    const response = await fetch('/api/records', {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: categories[active as Exclude<Section, 'Dashboard'>], ...(identity ?? {}), record }),
    })
    const result = await response.json()
    if (!response.ok) { window.alert(result.error || (isEditing ? 'No se pudo modificar el registro.' : 'No se pudo guardar el registro.')); return }
    await mutate('/api/records')
    setModal(false)
    setRecordToEdit(null)
    setSelectedIds(new Set())
  }

  async function deleteSelectedRecords() {
    if (!selectedRows.length || !window.confirm(`Â¿Quieres eliminar ${selectedRows.length === 1 ? 'este registro' : `estos ${selectedRows.length} registros`}?`)) return
    const ids = selectedRows.flatMap((row) => row._id ? [row._id] : [])
    const response = await fetch('/api/records', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: categories[active as Exclude<Section, 'Dashboard'>], ids }) })
    const result = await response.json()
    if (!response.ok) { window.alert(result.error || 'No se pudieron eliminar los registros.'); return }
    await mutate('/api/records')
    setSelectedIds(new Set())
  }

  function editRecord(row: Row) {
    setRecordToEdit(row)
    setSelectedIds(new Set())
    setModal(true)
  }

  async function deleteRecord(row: Row) {
    if (!row._id || !window.confirm(`Â¿Quieres eliminar Â«${String(row.COMPRAS ?? row.VENTAS ?? row.CLIENTE ?? row.EMPRESA ?? row.MES ?? 'este registro')}Â»?`)) return
    const response = await fetch('/api/records', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: categories[active as Exclude<Section, 'Dashboard'>], ids: [row._id] }) })
    const result = await response.json()
    if (!response.ok) { window.alert(result.error || 'No se pudo eliminar el registro.'); return }
    await mutate('/api/records')
    setSelectedIds(new Set())
  }

  return <main className="app-shell" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => { const start = touchStartX.current; const end = event.changedTouches[0]?.clientX; if (start !== null && end !== undefined) { const delta = end - start; if (start < 36 && delta > 70) setMobileNav(true); else if (delta < -70 && mobileNav) setMobileNav(false) } touchStartX.current = null }}>
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand sidebar-brand" href="#"><span className="brand-mark">f</span><span>Fiskal<span className="brand-period">.</span></span></a>
      <div className="nav-caption">TU ESPACIO</div>
      <nav aria-label="NavegaciÃ³n principal">{sections.map(({ name, icon: Icon }) => <button key={name} className={`nav-link ${active === name ? 'nav-active' : ''}`} onClick={() => { setActive(name); setQuery(''); setSelectedBasketballSeason(''); setSelectedIds(new Set()); setMobileNav(false); setModal(false); setRecordToEdit(null) }}><Icon size={18} strokeWidth={1.8} /><span>{name}</span>{name === 'Dashboard' && active === name && <span className="nav-indicator" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sheet-status"><span className="status-pulse" /><div><strong>Base de datos</strong><small>{error ? 'Revisar conexiÃ³n' : isLoading ? 'Conectandoâ€¦' : 'SincronizaciÃ³n activa'}</small></div><Database size={17} /></div><div className="profile"><div className="avatar">{user.image ? <img src={user.image} alt="" /> : <span>{user.name?.[0] ?? 'U'}</span>}</div><div className="profile-copy"><strong>{user.name ?? 'Mi cuenta'}</strong><small>{user.email}</small></div><button className="icon-button logout" aria-label="Cerrar sesiÃ³n" onClick={() => signOut()}><LogOut size={16} /></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-backdrop" aria-label="Cerrar navegaciÃ³n" onClick={() => setMobileNav(false)} />}
    <section className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Abrir navegaciÃ³n" onClick={() => setMobileNav(true)}><Menu size={19} /></button><span>Mis finanzas</span><span className="crumb-slash">/</span><strong>{active}</strong></div><div className="topbar-right"><span className="today"><CalendarDays size={15} /> {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span><div className="top-avatar">{user.image ? <img src={user.image} alt="" /> : user.name?.[0] ?? 'U'}</div></div></header>
      <div className="content">
        {error && <div className="error-banner"><span>No se pudo conectar con la base de datos. Comprueba la configuraciÃ³n de Neon en Vercel.</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => mutate('/api/records')}><X size={16} /></button></div>}
        {data?.warnings?.map((warning) => <div className="error-banner" role="alert" key={warning}><span>{warning}</span></div>)}
        {active === 'Dashboard' ? <>
          <div className="page-heading"><div><div className="eyebrow small-eyebrow"><span className="eyebrow-dot" /> RESUMEN PERSONAL</div><h1>Todo en <em>perspectiva.</em></h1><p>Un lugar para ver cÃ³mo se mueve tu dinero.</p></div><button className="button-primary" onClick={() => setShowCategoryChooser(true)}><Plus size={17} /> AÃ±adir registro</button></div>
          <div className="kpi-grid"><Kpi title="INGRESOS TOTALES" value={euros(totalIncomes)} icon={CircleDollarSign} tone="green" foot="Baloncesto, ventas, nÃ³minas e informÃ¡tica" /><Kpi title="BENEFICIO EN VENTAS" value={euros(totals.sales)} icon={ArrowUpRight} tone="green" foot={`${data?.sales.length ?? 0} ventas registradas`} /><Kpi title="GASTO EN COMPRAS" value={euros(totals.purchases)} icon={ArrowDownLeft} tone="orange" foot={`${data?.purchases.length ?? 0} compras registradas`} /><Kpi title="COBRADO Â· INFORMÃTICA" value={euros(totals.itPaid)} icon={Computer} tone="violet" foot={`${data?.it.length ?? 0} trabajos registrados`} /><Kpi title="NÃ“MINAS RECIBIDAS" value={euros(totals.payroll)} icon={Banknote} tone="yellow" foot={`${payrollCount} pagos registrados`} /></div>
          <div className="dashboard-grid">
            <section className="panel chart-panel"><div className="panel-heading"><div><span className="panel-kicker">PANORAMA</span><h2>Balance por actividad</h2></div><span className="chart-period">Todas las secciones <ChevronDown size={14} /></span></div><div className="chart-summary"><strong>{euros(totalIncomes - totals.purchases)}</strong><span>balance neto registrado</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 12, right: 6, left: 0, bottom: 0 }}><defs><linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#66947c" stopOpacity={0.28} /><stop offset="95%" stopColor="#66947c" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9e8df" strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#92948a', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#92948a', fontSize: 10 }} tickFormatter={(value) => `${value}â‚¬`} width={50} /><Tooltip formatter={(value) => euros(value)} contentStyle={{ borderRadius: 12, borderColor: '#e6e5db', fontSize: 12 }} /><Area type="monotone" dataKey="amount" name="Importe" stroke="#547c67" strokeWidth={2.5} fill="url(#fillBalance)" /></AreaChart></ResponsiveContainer></div><div className="chart-legend"><span><i /> Importes acumulados</span><span>Fuente: tus datos</span></div></section>
            <section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">TUS ÃREAS</span><h2>Actividad financiera</h2></div><button className="text-button" onClick={() => setActive('Baloncesto')}>Ver todo <ArrowUpRight size={14} /></button></div><div className="activity-list">{[{ name: 'Baloncesto', sub: 'Ingresos y temporadas', icon: BasketballIcon, total: totals.basketball, tone: 'activity-green' }, { name: 'Ventas', sub: `${data?.sales.length ?? 0} registros`, icon: CircleDollarSign, total: totals.sales, tone: 'activity-violet' }, { name: 'Compras', sub: `${data?.purchases.length ?? 0} registros`, icon: ShoppingBag, total: totals.purchases, tone: 'activity-orange' }, { name: 'InformÃ¡tica', sub: `${data?.it.length ?? 0} trabajos`, icon: Computer, total: totals.it, tone: 'activity-blue' }, { name: 'NÃ³minas', sub: `${data?.payroll.length ?? 0} empresas`, icon: Wallet, total: totals.payroll, tone: 'activity-yellow' }].map(({ name, sub, icon: Icon, total, tone }) => <button className={`activity-row ${tone}`} key={name} onClick={() => setActive(name as Section)}><span className={`activity-icon ${tone}`}><Icon size={17} /></span><span className="activity-copy"><strong>{name}</strong><small>{sub}</small></span><strong className="activity-total">{euros(total)}</strong><ArrowUpRight className="activity-arrow" size={15} /></button>)}</div><div className="activity-note"><span className="note-symbol">â†—</span><span>Tus datos se guardan de forma segura en Neon.</span></div></section>
          </div>
          <div className="dashboard-bottom"><div><span className="bottom-dot" /> DATOS PRIVADOS Â· SOLO PARA TI</div><span>Actualizado al consultar tus datos</span></div>
        </> : <>
          <div className="page-heading section-heading"><div><div className="eyebrow small-eyebrow"><span className="eyebrow-dot" /> GESTIÃ“N PERSONAL</div><h1>{active === 'Baloncesto' ? 'Baloncesto' : active}<span className="heading-period">.</span></h1><p>{sectionDescription(active)}</p></div><button className="button-primary" onClick={openAddRecord}><Plus size={17} /> AÃ±adir registro</button></div>
          {active === 'Baloncesto' ? <BasketballIncomeCards rows={basketballRows} query={query} onQueryChange={setQuery} isLoading={isLoading} onAdd={openAddRecord} onEdit={editRecord} onDelete={deleteRecord} /> : cards[active] && <div className="split-stats">{cards[active]?.map((card, index) => <SplitCard key={card.title} {...card} tone={index % 2 ? 'split-lime' : undefined} />)}</div>}
          {active === 'NÃ³minas' && <div className="company-chips">{payrollCompanies.map((company) => <span key={company}>{company}<b>{payrollRows.filter((row) => String(row.EMPRESA ?? '').trim() === company).length}</b></span>)}</div>}
          {active === 'Ventas' && <TopCommerceChart title="Top comercios por beneficio" rows={data?.sales ?? []} valueKey="BENEFICIO" valueLabel="Beneficio" />}
          {active === 'Compras' && <TopCommerceChart title="Top tiendas por dinero gastado" rows={data?.purchases ?? []} valueKey="PRECIO FINAL" valueLabel="Gasto final" />}
          {active !== 'Baloncesto' && <RecordCards section={active} rows={filteredRows} isLoading={isLoading} query={query} onQueryChange={setQuery} onEdit={editRecord} onDelete={deleteRecord} onAdd={openAddRecord} />}
        </>}
      </div>
    </section>
    {modal && active !== 'Dashboard' && <RecordModal key={`${active}-${recordToEdit?._rowNumber ?? 'new'}`} active={active} initialRecord={recordToEdit} onClose={() => { setModal(false); setRecordToEdit(null) }} onSave={saveRecord} />}
    {showCategoryChooser && <CategoryChooser onClose={() => setShowCategoryChooser(false)} onChoose={chooseRecordSection} />}
  </main>
}

function RecordCards({ section, rows, isLoading, query, onQueryChange, onEdit, onDelete, onAdd }: { section: Exclude<Section, 'Dashboard' | 'Baloncesto'>; rows: Row[]; isLoading: boolean; query: string; onQueryChange: (value: string) => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; onAdd: () => void }) {
  const config = {
    Ventas: { title: 'VENTAS', subtitle: 'COMERCIO', amount: 'BENEFICIO', icon: CircleDollarSign, tone: 'sales' },
    Compras: { title: 'COMPRAS', subtitle: 'COMERCIO', amount: 'PRECIO FINAL', icon: ShoppingBag, tone: 'purchases' },
    InformÃ¡tica: { title: 'CLIENTE', subtitle: 'TRABAJO', amount: 'IMPORTE', icon: Computer, tone: 'it' },
    NÃ³minas: { title: 'EMPRESA', subtitle: 'MES', amount: 'PAGADO', icon: Wallet, tone: 'payroll' },
  }[section]
  const columns = tableColumns(section)
  return <section className="record-collection">
    <div className="record-collection-head"><div><span className="panel-kicker">REGISTROS</span><h2>{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</h2></div><label className="searchbox"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={`Buscar ${section.toLocaleLowerCase('es')}...`} aria-label={`Buscar ${section}`} />{query && <button aria-label="Limpiar bÃºsqueda" onClick={() => onQueryChange('')}><X size={14} /></button>}</label></div>
    {isLoading ? <p className="record-loading">Cargando registrosâ€¦</p> : rows.length ? <div className={`record-card-grid record-grid-${config.tone}`}>{rows.map((row) => {
      const Icon = config.icon
      const title = String(row[config.title] ?? 'Registro')
      const subtitle = section === 'NÃ³minas' ? `${String(row.MES ?? '')} ${String(row['AÃ‘O'] ?? '')}` : String(row[config.subtitle] ?? 'Sin detalle')
      const extraColumns = columns.filter((key) => ![config.title, config.subtitle, config.amount].includes(key))
      return <article className="finance-record-card" key={recordId(row)}>
        <div className="finance-card-heading"><span className={`finance-card-icon card-tone-${config.tone}`}><Icon size={17} /></span><div className="finance-card-title"><strong>{title}</strong><small>{subtitle}</small></div><button className="finance-card-menu" aria-label={`Modificar ${title}`} onClick={() => onEdit(row)}><Pencil size={15} /></button></div>
        <div className="finance-card-amount"><span>{config.amount === 'BENEFICIO' ? 'BENEFICIO' : config.amount === 'PRECIO FINAL' ? 'GASTO FINAL' : config.amount === 'IMPORTE' ? 'IMPORTE TOTAL' : 'IMPORTE PAGADO'}</span><strong>{euros(row[config.amount])}</strong></div>
        <div className="finance-card-details">{extraColumns.map((key) => <div className="finance-card-detail" key={key}><span>{key}</span><strong>{renderCell(key, row[key])}</strong></div>)}</div>
        <div className="finance-card-footer"><span><CalendarDays size={13} /> {row['FECHA DE REGISTRO'] ? renderCell('FECHA DE REGISTRO', row['FECHA DE REGISTRO']) : section === 'NÃ³minas' ? `NÃ³mina Â· ${subtitle}` : 'Registro guardado'}</span><button onClick={() => onDelete(row)} aria-label={`Eliminar ${title}`}><Trash2 size={14} /> Eliminar</button></div>
      </article>
    })}</div> : <div className="record-empty"><span className="empty-icon"><BarChart3 size={20} /></span><strong>{query ? 'No encontramos resultados' : 'AÃºn no hay registros'}</strong><p>{query ? 'Prueba con otra bÃºsqueda.' : 'AÃ±ade un registro para empezar.'}</p>{!query && <button className="button-outline" onClick={onAdd}><Plus size={15} /> AÃ±adir registro</button>}</div>}
  </section>
}

function BasketballIncomeCards({ rows, query, onQueryChange, isLoading, onAdd, onEdit, onDelete }: { rows: Row[]; query: string; onQueryChange: (value: string) => void; isLoading: boolean; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  const [expandedSeason, setExpandedSeason] = useState('')
  const [expandedMonth, setExpandedMonth] = useState('')
  const seasons = new Map<string, Row[]>()
  for (const row of rows) {
    const season = seasonForRow(row)
    if (season) seasons.set(season, [...(seasons.get(season) ?? []), row])
  }
  const seasonRows = [...seasons].map(([season, entries]) => ({ season, entries, amount: numericTotal(entries, 'DINERO INGRESADO') })).sort((a, b) => Number(b.season.slice(0, 4)) - Number(a.season.slice(0, 4)))
  const monthlyEntries = (entries: Row[]) => {
    const months = new Map<string, Row[]>()
    for (const row of entries) {
      const month = monthNumber(row.MES)
      const year = yearNumber(row['AÃ‘O'])
      if (month < 1 || month > 12) continue
      const key = `${year}-${String(month).padStart(2, '0')}`
      months.set(key, [...(months.get(key) ?? []), row])
    }
    return [...months].map(([key, monthRows]) => ({ key, month: Number(key.slice(5)), year: Number(key.slice(0, 4)), rows: monthRows, amount: numericTotal(monthRows, 'DINERO INGRESADO') })).sort((a, b) => a.year - b.year || a.month - b.month)
  }
  return <section className="basketball-income-section"><div className="basketball-section-heading"><div><span className="panel-kicker">BALONCESTO</span><h2>Ingresos por temporada</h2><p>Selecciona una temporada para consultar sus meses.</p></div><div className="basketball-heading-actions"><label className="searchbox"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar ingresos..." aria-label="Buscar ingresos" />{query && <button aria-label="Limpiar bÃºsqueda" onClick={() => onQueryChange('')}><X size={14} /></button>}</label><button className="button-outline" onClick={onAdd}><Plus size={15} /> AÃ±adir ingreso</button></div></div>
    {isLoading ? <p className="record-loading">Cargando ingresosâ€¦</p> : seasonRows.length ? <div className="season-card-grid">{seasonRows.map(({ season, entries, amount }) => <div className={`season-income-card ${expandedSeason === season ? 'season-income-active' : ''}`} key={season}>
      <button className="season-income-button" aria-expanded={expandedSeason === season} onClick={() => { setExpandedSeason(expandedSeason === season ? '' : season); setExpandedMonth('') }}><span className="season-income-icon"><BasketballIcon size={19} /></span><span className="season-income-copy"><small>TEMPORADA</small><strong>{season}</strong><em>{entries.length} {entries.length === 1 ? 'ingreso mensual' : 'ingresos mensuales'}</em></span><span className="season-income-total">{euros(amount)}</span><ChevronDown className="season-chevron" size={17} /></button>
      {expandedSeason === season && <div className="season-months">{monthlyEntries(entries).map(({ key, month, year, rows: monthRows, amount: monthAmount }) => <article className={`month-income-card ${expandedMonth === key ? 'month-income-open' : ''}`} key={key}><button className="month-income-button" aria-expanded={expandedMonth === key} onClick={() => setExpandedMonth(expandedMonth === key ? '' : key)}><span className="month-income-date"><CalendarDays size={15} /><span>{monthOptions[month - 1]} <small>{year}</small></span></span><strong>{euros(monthAmount)}</strong><ChevronDown size={15} /></button>{expandedMonth === key && <div className="month-income-entries">{monthRows.map((row) => <div className="month-income-entry" key={recordId(row)}><span>{String(row.MES ?? '')} {String(row['AÃ‘O'] ?? '')}</span><strong>{euros(row['DINERO INGRESADO'])}</strong><div><button aria-label="Modificar ingreso" onClick={() => onEdit(row)}><Pencil size={13} /></button><button aria-label="Eliminar ingreso" onClick={() => onDelete(row)}><Trash2 size={13} /></button></div></div>)}</div>}</article>)}</div>}
    </div>)}</div> : <div className="record-empty"><span className="empty-icon"><BasketballIcon size={20} /></span><strong>{rows.length ? 'No encontramos resultados' : 'AÃºn no hay ingresos'}</strong><p>AÃ±ade un ingreso para empezar a ver tus temporadas.</p><button className="button-outline" onClick={onAdd}><Plus size={15} /> AÃ±adir ingreso</button></div>}
  </section>
}

function BasketballTable({ title, columns, rows, isLoading, query, selectedIds, onToggle, onAdd, onEdit, onDelete, selectable = true }: { title: string; columns: string[]; rows: Row[]; isLoading: boolean; query: string; selectedIds: Set<string>; onToggle: (row: Row) => void; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; selectable?: boolean }) {
  const selectionColumn = selectable ? 1 : 0
  return <section className="basketball-table"><h3>{title}</h3><div className="table-scroll"><table><thead><tr>{selectable && <th className="table-select-cell"><span className="sr-only">Seleccionar</span></th>}{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={columns.length + selectionColumn} className="table-empty">Cargando datosâ€¦</td></tr> : rows.length ? rows.map((row) => <tr key={selectable ? recordId(row) : String(row.TEMPORADA ?? '')}>{selectable && <td className="table-select-cell"><input type="checkbox" className="table-select" aria-label={`Seleccionar registro ${String(row._rowNumber ?? '')}`} checked={selectedIds.has(recordId(row))} onChange={() => onToggle(row)} /></td>}{columns.map((key) => <td key={key}>{renderCell(key, row[key])}</td>)}</tr>) : <tr><td colSpan={columns.length + selectionColumn} className="table-empty"><strong>{query ? 'No encontramos resultados' : 'AÃºn no hay registros'}</strong><span>{query ? 'Prueba con otra bÃºsqueda.' : 'AÃ±ade tu primer registro para empezar.'}</span>{!query && selectable && <button className="button-outline" onClick={onAdd}><Plus size={15} /> AÃ±adir registro</button>}</td></tr>}</tbody></table><MobileRecordCards section="Baloncesto" columns={columns} rows={rows} isLoading={isLoading} query={query} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} selectable={selectable} /></div></section>
}

function MobileRecordCards({ section, columns, rows, isLoading, query, onAdd, onEdit, onDelete, selectable = true }: { section: Section; columns: string[]; rows: Row[]; isLoading: boolean; query: string; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; selectable?: boolean }) {
  const seasonOverview = section === 'Baloncesto' && columns[0] === 'TEMPORADA'
  return <div className={`mobile-record-cards ${seasonOverview ? 'season-overview-cards' : ''}`}>{isLoading ? <p className="purchase-loading">Cargando datosâ€¦</p> : rows.length ? rows.map((row) => seasonOverview ? <div className="mobile-season-row" key={`season-${String(row.TEMPORADA ?? '')}`}><span>{String(row.TEMPORADA ?? 'Temporada')}</span><strong>{euros(row['DINERO GANADO'])}</strong></div> : <MobileRecordCard key={`mobile-${recordId(row)}`} section={section} columns={columns} row={row} onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} canManage={selectable} />) : <div className="purchase-mobile-empty"><div className="empty-icon"><BarChart3 size={20} /></div><strong>{query ? 'No encontramos resultados' : 'AÃºn no hay registros'}</strong><span>{query ? 'Prueba con otra bÃºsqueda.' : 'AÃ±ade tu primer registro para empezar.'}</span>{!query && selectable && <button className="button-outline" onClick={onAdd}><Plus size={15} /> AÃ±adir registro</button>}</div>}</div>
}

function MobileRecordCard({ section, columns, row, onEdit, onDelete, canManage }: { section: Section; columns: string[]; row: Row; onEdit: () => void; onDelete: () => void; canManage: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const titleKey: Record<string, string> = { Ventas: 'VENTAS', Compras: 'COMPRAS', InformÃ¡tica: 'CLIENTE', NÃ³minas: 'EMPRESA', Baloncesto: 'MES' }
  const amountKey: Record<string, string> = { Ventas: 'BENEFICIO', Compras: 'PRECIO FINAL', InformÃ¡tica: 'IMPORTE', NÃ³minas: 'PAGADO', Baloncesto: 'DINERO INGRESADO' }
  const title = titleKey[section] ?? columns[0]
  const amount = amountKey[section] ?? columns[columns.length - 1]
  const subtitle = section === 'NÃ³minas' ? `${String(row.MES ?? 'â€”')} ${String(row['AÃ‘O'] ?? '')}` : section === 'Baloncesto' ? String(row.TEMPORADA ?? 'â€”') : String(row[section === 'InformÃ¡tica' ? 'TRABAJO' : 'COMERCIO'] ?? 'â€”')
  const detailColumns = columns.filter((key) => key !== title && key !== amount && key !== (section === 'Baloncesto' ? 'TEMPORADA' : section === 'NÃ³minas' ? 'MES' : section === 'InformÃ¡tica' ? 'TRABAJO' : 'COMERCIO') && !(section === 'NÃ³minas' && key === 'AÃ‘O'))
  const Icon = section === 'Ventas' ? CircleDollarSign : section === 'Compras' ? ShoppingBag : section === 'InformÃ¡tica' ? Computer : section === 'NÃ³minas' ? Wallet : BasketballIcon
  const iconTone = `record-icon-${section === 'InformÃ¡tica' ? 'informatica' : section === 'NÃ³minas' ? 'nominas' : section.toLowerCase()}`
  const expandable = detailColumns.length > 0
  return <article className={`mobile-record-card ${expanded ? 'record-expanded' : ''} ${expandable ? '' : 'no-expand'}`}><button type="button" className="mobile-record-summary" aria-expanded={expanded} disabled={!expandable} onClick={() => setExpanded((value) => !value)}><span className={`mobile-record-icon ${iconTone}`}><Icon size={16} /></span><span className="mobile-record-copy"><strong>{String(row[title] ?? 'Registro')}</strong><small>{subtitle}</small></span><strong className="mobile-record-amount">{renderCell(amount, row[amount])}</strong>{expandable && <ChevronDown className="mobile-record-chevron" size={15} />}</button>{expanded && <div className="mobile-record-details">{detailColumns.map((key) => <div key={key}><span>{key}</span><strong>{renderCell(key, row[key])}</strong></div>)}{canManage && <div className="mobile-record-actions"><button type="button" className="record-action-edit" aria-label={`Modificar ${String(row[title] ?? 'registro')}`} onClick={onEdit}><Pencil size={15} /> Modificar</button><button type="button" className="record-action-delete" aria-label={`Eliminar ${String(row[title] ?? 'registro')}`} onClick={onDelete}><Trash2 size={15} /> Eliminar</button></div>}</div>}</article>
}
function Kpi({ title, value, icon: Icon, tone, foot }: { title: string; value: string; icon: typeof ArrowUpRight; tone: string; foot: string }) { return <article className="kpi-card"><div className="kpi-top"><span>{title}</span><span className={`kpi-icon ${tone}`}><Icon size={17} /></span></div><strong className="kpi-value">{value}</strong><div className="kpi-foot"><span className="kpi-dash" />{foot}</div></article> }
function SplitCard({ title, value, foot, tone }: { title: string; value: string; foot: string; tone?: string }) { return <div className={`split-card ${tone ?? ''}`}><span>{title}</span><strong>{value}</strong><small>{foot}</small></div> }
function sectionDescription(section: Section) { return ({ Baloncesto: 'Consulta tus ingresos por mes y el total acumulado de cada temporada.', Ventas: 'Sigue las ventas, aportaciones y el beneficio generado.', Compras: 'Registra tus compras, pagos y reembolsos.', 'InformÃ¡tica': 'Organiza trabajos, fechas de entrega e importes.', NÃ³minas: 'Consulta los pagos mensuales de cada empresa.' } as Record<string, string>)[section] ?? '' }
function tableColumns(section: Section) { if (section === 'Baloncesto') return ['MES', 'AÃ‘O', 'TEMPORADA', 'DINERO INGRESADO']; if (section === 'Ventas') return ['VENTAS', 'COMERCIO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO', 'FECHA DE REGISTRO']; if (section === 'Compras') return ['COMPRAS', 'COMERCIO', 'DINERO PAGADO', 'A MEDIAS', 'REEMBOLSO', 'PRECIO FINAL', 'FECHA DE REGISTRO']; if (section === 'InformÃ¡tica') return ['CLIENTE', 'TRABAJO', 'FECHA DE INICIO', 'FECHA DE FINALIZACIÃ“N', 'IMPORTE', 'PAGADO', 'FECHA DE REGISTRO']; if (section === 'NÃ³minas') return ['EMPRESA', 'MES', 'AÃ‘O', 'PAGADO']; return [] }
function renderCell(key: string, value: unknown) { if (key === 'PAGADO') { const normalized = String(value ?? '').trim().toLowerCase(); if (['sÃ­', 'si', 'no'].includes(normalized)) return <span className={`paid-badge ${normalized === 'sÃ­' || normalized === 'si' ? 'paid-yes' : 'paid-no'}`}><span />{normalized === 'no' ? 'Pendiente' : 'Pagado'}</span>; return value == null || value === '' ? 'â€”' : euros(value) } if (key === 'FECHA DE FINALIZACIÃ“N' && String(value ?? '').trim() === '') return 'â€”'; if (key === 'FECHA DE REGISTRO' && value) return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value))); if (['DINERO INGRESADO', 'DINERO GANADO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO', 'DINERO PAGADO', 'REEMBOLSO', 'PRECIO FINAL', 'IMPORTE', 'IMPORTE PAGADO'].includes(key)) return euros(value); if (key === 'A MEDIAS') return <span className="yes-no">{value ? 'SÃ­' : 'No'}</span>; return String(value ?? 'â€”') }

function RecordModal({ active, initialRecord, onClose, onSave }: { active: Exclude<Section, 'Dashboard'>; initialRecord: Row | null; onClose: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const inputs = fields[active]
  const editing = Boolean(initialRecord)
  const initialValue = (key: string, type?: string) => {
    if (key === 'A MEDIAS') return initialRecord?.[key] ? 'SÃ­' : 'No'
    const text = String(initialRecord?.[key] ?? '')
    if (type !== 'date' || !text) return text
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
    const spanishDate = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
    if (spanishDate) return `${spanishDate[3]}-${spanishDate[2].padStart(2, '0')}-${spanishDate[1].padStart(2, '0')}`
    return ''
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-head"><div><span className="panel-kicker">{active.toUpperCase()}</span><h2 id="modal-title">{editing ? 'Modificar registro' : 'Nuevo registro'}</h2><p>{editing ? 'Actualiza los datos de este registro.' : 'Se guardarÃ¡ directamente en la base de datos.'}</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></header><form onSubmit={onSave}><div className="modal-fields">{inputs.map((field) => {
    if (field.type === 'select') return <label key={field.key}>{field.label}<select name={field.key} required defaultValue={initialValue(field.key, field.type)}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    return <label key={field.key}>{field.label}<input name={field.key} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} defaultValue={initialValue(field.key, field.type)} required={field.key !== 'FECHA DE FINALIZACIÃ“N'} /></label>
  })}</div><div className="modal-actions"><button type="button" className="button-outline" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> {editing ? 'Guardar cambios' : 'Guardar registro'}</button></div></form></section></div>
}

function CategoryChooser({ onClose, onChoose }: { onClose: () => void; onChoose: (section: Exclude<Section, 'Dashboard'>) => void }) {
  const categories = sections.filter(({ name }) => name !== 'Dashboard')
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="record-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="category-title"><header className="modal-head"><div><span className="panel-kicker">NUEVO REGISTRO</span><h2 id="category-title">Â¿QuÃ© quieres registrar?</h2><p>Elige una secciÃ³n para mostrar el formulario adecuado.</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></header><div className="category-grid">{categories.map(({ name, icon: Icon }) => <button key={name} className="category-option" onClick={() => onChoose(name as Exclude<Section, 'Dashboard'>)}><Icon size={18} /><span>{name}</span><ArrowUpRight size={14} /></button>)}</div></section></div>
}
