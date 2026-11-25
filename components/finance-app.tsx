'use client'

import { useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import useSWR, { mutate } from 'swr'
import { signOut } from 'next-auth/react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Banknote, BarChart3, CalendarDays, Check, ChevronDown, CircleDollarSign, Computer, Database, Filter, LayoutDashboard, LogOut, Menu, Pencil, Plus, Search, Share2, ShoppingBag, Trash2, Wallet, X } from 'lucide-react'

type Row = Record<string, unknown> & { _id?: string; _rowNumber?: number }
type Data = { basketball: Row[]; sales: Row[]; purchases: Row[]; it: Row[]; payroll: Row[]; warnings?: string[] }
type Section = 'Dashboard' | 'Baloncesto' | 'Ventas' | 'Compras' | 'Informática' | 'Nóminas'
type RecordIdentity = { id: string }
const sections: { name: Section; icon: ComponentType<{ size?: number; strokeWidth?: number }>; key?: keyof Data }[] = [
  { name: 'Dashboard', icon: LayoutDashboard }, { name: 'Baloncesto', icon: BasketballIcon }, { name: 'Ventas', icon: CircleDollarSign, key: 'sales' }, { name: 'Compras', icon: ShoppingBag, key: 'purchases' }, { name: 'Informática', icon: Computer, key: 'it' }, { name: 'Nóminas', icon: Wallet, key: 'payroll' },
]
function BasketballIcon({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2" /><path d="M4 7.5c4 1 7.2 5 8 12.8M20 7.5c-4 1-7.2 5-8 12.8M3 12h18" /></svg> }
const fetcher = async (url: string) => { const response = await fetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo cargar la hoja'); return data as Data }
const parseAmount = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let normalized = String(value ?? '').trim().replace(/\s|€|EUR/gi, '').replace(/[^\d,.-]/g, '')
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
function formatDate(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return '—'
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}
const numericTotal = (rows: Row[] | undefined, key: string) => (rows ?? []).reduce((sum, row) => sum + parseAmount(row[key]), 0)
const amountPaid = (row: Row) => {
  if (row.PAGADO !== undefined) return parseAmount(row.PAGADO)
  const status = String(row.PAGADO ?? '').trim().toLocaleLowerCase('es')
  if (['sí', 'si'].includes(status)) return parseAmount(row.IMPORTE)
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
  if (section === 'Informática') return Date.parse(String(row['FECHA DE INICIO'] ?? '')) || Number(row._rowNumber ?? 0)
  if (section === 'Baloncesto' || section === 'Nóminas') {
    const month = monthNumber(row.MES)
    const year = yearNumber(row['AÑO'])
    return month > 0 && year > 0 ? Date.UTC(year, month - 1, 1) : Number(row._rowNumber ?? 0)
  }
  // Las tablas de ventas y compras conservan la fecha de creación del registro.
  return Number(row._rowNumber ?? 0)
}
const sortRowsByDateDesc = (rows: Row[], section: Section) => [...rows].sort((left, right) => rowDateValue(right, section) - rowDateValue(left, section))
function periodForRow(row: Row, section: Section) {
  if ((section === 'Baloncesto' || section === 'Nóminas') && row.MES) return { month: monthNumber(row.MES), year: yearNumber(row['AÑO']) }
  const timestamp = rowDateValue(row, section)
  if (!timestamp) return { month: 0, year: 0 }
  const date = new Date(timestamp)
  return { month: date.getMonth() + 1, year: date.getFullYear() }
}
const seasonFor = (month: number, year: number) => {
  if (!Number.isInteger(year) || year < 1) return null
  if (month >= 9 && month <= 12) return `${year}/${year + 1}`
  if (month >= 1 && month <= 6) return `${year - 1}/${year}`
  return null
}
const seasonForRow = (row: Row) => String(row.TEMPORADA ?? '').trim() || seasonFor(monthNumber(row.MES), yearNumber(row.AÑO)) || ''
const fields: Record<Exclude<Section, 'Dashboard'>, { key: string; label: string; type?: string; options?: string[] }[]> = {
  Baloncesto: [{ key: 'MES', label: 'Mes', type: 'select', options: monthOptions }, { key: 'AÑO', label: 'Año' }, { key: 'DINERO INGRESADO', label: 'Dinero ingresado', type: 'number' }],
  Ventas: [{ key: 'VENTAS', label: 'Venta' }, { key: 'COMERCIO', label: 'Comercio' }, { key: 'DINERO APORTADO', label: 'Dinero aportado', type: 'number' }, { key: 'DINERO RECOGIDO', label: 'Dinero recogido', type: 'number' }],
  Compras: [{ key: 'COMPRAS', label: 'Compra' }, { key: 'COMERCIO', label: 'Comercio' }, { key: 'DINERO PAGADO', label: 'Dinero pagado', type: 'number' }, { key: 'A MEDIAS', label: '¿A medias?', type: 'select', options: ['No', 'Sí'] }, { key: 'REEMBOLSO', label: 'Reembolso', type: 'number' }],
  'Informática': [{ key: 'CLIENTE', label: 'Cliente' }, { key: 'TRABAJO', label: 'Trabajo' }, { key: 'FECHA DE INICIO', label: 'Fecha de inicio', type: 'date' }, { key: 'FECHA DE FINALIZACIÓN', label: 'Fecha de finalización (opcional)', type: 'date' }, { key: 'IMPORTE', label: 'Importe', type: 'number' }, { key: 'PAGADO', label: 'Pagado', type: 'number' }],
  Nóminas: [{ key: 'EMPRESA', label: 'Empresa' }, { key: 'MES', label: 'Mes', type: 'select', options: monthOptions }, { key: 'AÑO', label: 'Año' }, { key: 'PAGADO', label: 'Importe pagado', type: 'number' }],
}

export function FinanceApp({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } }) {
  const [active, setActive] = useState<Section>('Dashboard')
  const [modal, setModal] = useState(false)
  const [showCategoryChooser, setShowCategoryChooser] = useState(false)
  const [recordToEdit, setRecordToEdit] = useState<Row | null>(null)
  const [query, setQuery] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const { data, error, isLoading } = useSWR('/api/records', fetcher, { revalidateOnFocus: true })
  const rows = useMemo(() => {
    if (!data) return [] as Row[]
    if (active === 'Baloncesto') return data.basketball
    if (active === 'Nóminas') return data.payroll
    const key = sections.find((section) => section.name === active)?.key
    return key ? (data[key] as Row[]) : []
  }, [active, data])
  const matchesQuery = (row: Row) => Object.entries(row).filter(([key]) => !key.startsWith('_')).some(([, value]) => String(value).toLowerCase().includes(query.toLowerCase()))
  const filteredRows = sortRowsByDateDesc(rows.filter(matchesQuery), active)
  const basketballRows = sortRowsByDateDesc((data?.basketball ?? []).filter(matchesQuery), 'Baloncesto')
  const payrollRows = data?.payroll ?? []
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
  const chart = [{ month: 'Baloncesto', amount: totals.basketball }, { month: 'Ventas', amount: totals.sales }, { month: 'Compras', amount: totals.purchases }, { month: 'Informática', amount: totals.itPaid }, { month: 'Nóminas', amount: totals.payroll }]
  const categories: Record<Exclude<Section, 'Dashboard'>, string> = { Baloncesto: 'basketball', Ventas: 'sales', Compras: 'purchases', 'Informática': 'it', Nóminas: 'payroll' }
  const payrollCount = payrollRows.length
  function openAddRecord() { setRecordToEdit(null); setModal(true) }
  function chooseRecordSection(section: Exclude<Section, 'Dashboard'>) {
    setActive(section)
    setQuery('')
    setShowCategoryChooser(false)
    setRecordToEdit(null)
    setModal(true)
  }

  async function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const record: Record<string, FormDataEntryValue | string> = Object.fromEntries(formData.entries())
    if (active === 'Baloncesto') {
      record.TEMPORADA = seasonFor(monthNumber(record.MES), yearNumber(record.AÑO)) ?? ''
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
  }

  function editRecord(row: Row) {
    setRecordToEdit(row)
    setModal(true)
  }

  async function deleteRecord(row: Row) {
    if (!row._id || !window.confirm(`¿Quieres eliminar «${String(row.COMPRAS ?? row.VENTAS ?? row.CLIENTE ?? row.EMPRESA ?? row.MES ?? 'este registro')}»?`)) return
    const response = await fetch('/api/records', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: categories[active as Exclude<Section, 'Dashboard'>], ids: [row._id] }) })
    const result = await response.json()
    if (!response.ok) { window.alert(result.error || 'No se pudo eliminar el registro.'); return }
    await mutate('/api/records')
  }

  return <main className="app-shell" onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }} onTouchEnd={(event) => { const start = touchStartX.current; const end = event.changedTouches[0]?.clientX; if (start !== null && end !== undefined) { const delta = end - start; if (start < 36 && delta > 70) setMobileNav(true); else if (delta < -70 && mobileNav) setMobileNav(false) } touchStartX.current = null }}>
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand sidebar-brand" href="#"><span className="brand-mark">f</span><span>Fiskal<span className="brand-period">.</span></span></a>
      <div className="nav-caption">TU ESPACIO</div>
      <nav aria-label="Navegación principal">{sections.map(({ name, icon: Icon }) => <button key={name} className={`nav-link ${active === name ? 'nav-active' : ''}`} onClick={() => { setActive(name); setQuery(''); setMobileNav(false); setModal(false); setRecordToEdit(null) }}><Icon size={18} strokeWidth={1.8} /><span>{name}</span>{name === 'Dashboard' && active === name && <span className="nav-indicator" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sheet-status"><span className="status-pulse" /><div><strong>Base de datos</strong><small>{error ? 'Revisar conexión' : isLoading ? 'Conectando…' : 'Sincronización activa'}</small></div><Database size={17} /></div><div className="profile"><div className="avatar">{user.image ? <img src={user.image} alt="" /> : <span>{user.name?.[0] ?? 'U'}</span>}</div><div className="profile-copy"><strong>{user.name ?? 'Mi cuenta'}</strong><small>{user.email}</small></div><button className="icon-button logout" aria-label="Cerrar sesión" onClick={() => signOut()}><LogOut size={16} /></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-backdrop" aria-label="Cerrar navegación" onClick={() => setMobileNav(false)} />}
    <section className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Abrir navegación" onClick={() => setMobileNav(true)}><Menu size={19} /></button><span>Mis finanzas</span><span className="crumb-slash">/</span><strong>{active}</strong></div><div className="topbar-right"><span className="today"><CalendarDays size={15} /> {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span><div className="top-avatar">{user.image ? <img src={user.image} alt="" /> : user.name?.[0] ?? 'U'}</div></div></header>
      <div className="content">
        {error && <div className="error-banner"><span>No se pudo conectar con la base de datos. Comprueba la configuración de Neon en Vercel.</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => mutate('/api/records')}><X size={16} /></button></div>}
        {data?.warnings?.map((warning) => <div className="error-banner" role="alert" key={warning}><span>{warning}</span></div>)}
        {active === 'Dashboard' ? <>
          <div className="page-heading"><div><div className="eyebrow small-eyebrow"><span className="eyebrow-dot" /> RESUMEN PERSONAL</div><h1>Todo en <em>perspectiva.</em></h1><p>Un lugar para ver cómo se mueve tu dinero.</p></div><button className="button-primary" onClick={() => setShowCategoryChooser(true)}><Plus size={17} /> Añadir registro</button></div>
          <div className="kpi-grid"><Kpi title="INGRESOS TOTALES" value={euros(totalIncomes)} icon={CircleDollarSign} tone="green" foot="Baloncesto, ventas, nóminas e informática" /><Kpi title="BENEFICIO EN VENTAS" value={euros(totals.sales)} icon={ArrowUpRight} tone="green" foot={`${data?.sales.length ?? 0} ventas registradas`} /><Kpi title="GASTO EN COMPRAS" value={euros(totals.purchases)} icon={ArrowDownLeft} tone="orange" foot={`${data?.purchases.length ?? 0} compras registradas`} /><Kpi title="COBRADO · INFORMÁTICA" value={euros(totals.itPaid)} icon={Computer} tone="violet" foot={`${data?.it.length ?? 0} trabajos registrados`} /><Kpi title="NÓMINAS RECIBIDAS" value={euros(totals.payroll)} icon={Banknote} tone="yellow" foot={`${payrollCount} pagos registrados`} /></div>
          <div className="dashboard-grid">
            <section className="panel chart-panel"><div className="panel-heading"><div><span className="panel-kicker">PANORAMA</span><h2>Balance por actividad</h2></div><span className="chart-period">Todas las secciones <ChevronDown size={14} /></span></div><div className="chart-summary"><strong>{euros(totalIncomes - totals.purchases)}</strong><span>balance neto registrado</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 12, right: 6, left: 0, bottom: 0 }}><defs><linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#66947c" stopOpacity={0.28} /><stop offset="95%" stopColor="#66947c" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9e8df" strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#92948a', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#92948a', fontSize: 10 }} tickFormatter={(value) => `${value}€`} width={50} /><Tooltip formatter={(value) => euros(value)} contentStyle={{ borderRadius: 12, borderColor: '#e6e5db', fontSize: 12 }} /><Area type="monotone" dataKey="amount" name="Importe" stroke="#547c67" strokeWidth={2.5} fill="url(#fillBalance)" /></AreaChart></ResponsiveContainer></div><div className="chart-legend"><span><i /> Importes acumulados</span><span>Fuente: tus datos</span></div></section>
            <section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">TUS ÁREAS</span><h2>Actividad financiera</h2></div><button className="text-button" onClick={() => setActive('Baloncesto')}>Ver todo <ArrowUpRight size={14} /></button></div><div className="activity-list">{[{ name: 'Baloncesto', sub: 'Ingresos y temporadas', icon: BasketballIcon, total: totals.basketball, tone: 'activity-green' }, { name: 'Ventas', sub: `${data?.sales.length ?? 0} registros`, icon: CircleDollarSign, total: totals.sales, tone: 'activity-violet' }, { name: 'Compras', sub: `${data?.purchases.length ?? 0} registros`, icon: ShoppingBag, total: totals.purchases, tone: 'activity-orange' }, { name: 'Informática', sub: `${data?.it.length ?? 0} trabajos`, icon: Computer, total: totals.it, tone: 'activity-blue' }, { name: 'Nóminas', sub: `${data?.payroll.length ?? 0} empresas`, icon: Wallet, total: totals.payroll, tone: 'activity-yellow' }].map(({ name, sub, icon: Icon, total, tone }) => <button className={`activity-row ${tone}`} key={name} onClick={() => setActive(name as Section)}><span className={`activity-icon ${tone}`}><Icon size={17} /></span><span className="activity-copy"><strong>{name}</strong><small>{sub}</small></span><strong className="activity-total">{euros(total)}</strong><ArrowUpRight className="activity-arrow" size={15} /></button>)}</div><div className="activity-note"><span className="note-symbol">↗</span><span>Tus datos se guardan de forma segura en Neon.</span></div></section>
          </div>
          <div className="dashboard-bottom"><div><span className="bottom-dot" /> DATOS PRIVADOS · SOLO PARA TI</div><span>Actualizado al consultar tus datos</span></div>
        </> : <>
          <div className="page-heading section-heading"><div><div className="eyebrow small-eyebrow"><span className="eyebrow-dot" /> GESTIÓN PERSONAL</div><h1>{active === 'Baloncesto' ? 'Baloncesto' : active}<span className="heading-period">.</span></h1><p>{sectionDescription(active)}</p></div><button className="button-primary" onClick={openAddRecord}><Plus size={17} /> Añadir registro</button></div>
          {active === 'Baloncesto' ? <BasketballIncomeCards rows={basketballRows} query={query} onQueryChange={setQuery} isLoading={isLoading} onAdd={openAddRecord} onEdit={editRecord} onDelete={deleteRecord} /> : null}
          {active !== 'Baloncesto' && <RecordCards section={active} rows={filteredRows} isLoading={isLoading} query={query} onQueryChange={setQuery} onEdit={editRecord} onDelete={deleteRecord} onAdd={openAddRecord} />}
        </>}
      </div>
    </section>
    {modal && active !== 'Dashboard' && <RecordModal key={`${active}-${recordToEdit?._rowNumber ?? 'new'}`} active={active} initialRecord={recordToEdit} onClose={() => { setModal(false); setRecordToEdit(null) }} onSave={saveRecord} />}
    {showCategoryChooser && <CategoryChooser onClose={() => setShowCategoryChooser(false)} onChoose={chooseRecordSection} />}
  </main>
}

function RecordCards({ section, rows, isLoading, query, onQueryChange, onEdit, onDelete, onAdd }: { section: Exclude<Section, 'Dashboard' | 'Baloncesto'>; rows: Row[]; isLoading: boolean; query: string; onQueryChange: (value: string) => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void; onAdd: () => void }) {
  const [showFilters, setShowFilters] = useState(false)
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const config = {
    Ventas: { title: 'VENTAS', subtitle: 'COMERCIO', amount: 'BENEFICIO', icon: CircleDollarSign, tone: 'sales' },
    Compras: { title: 'COMPRAS', subtitle: 'COMERCIO', amount: 'PRECIO FINAL', icon: ShoppingBag, tone: 'purchases' },
    Informática: { title: 'CLIENTE', subtitle: 'TRABAJO', amount: 'IMPORTE', icon: Computer, tone: 'it' },
    Nóminas: { title: 'EMPRESA', subtitle: 'MES', amount: 'PAGADO', icon: Wallet, tone: 'payroll' },
  }[section]
  const columns = tableColumns(section)
  const years = [...new Set(rows.map((row) => periodForRow(row, section).year).filter((year) => year > 0))].sort((a, b) => b - a)
  const filtered = rows.filter((row) => { const period = periodForRow(row, section); return (!monthFilter || period.month === Number(monthFilter)) && (!yearFilter || period.year === Number(yearFilter)) })
  async function shareRecords() {
    const summary = filtered.map((row) => `${String(row[config.title] ?? 'Registro')} · ${euros(row[config.amount])}`).join('\n')
    const shareData = { title: `Fiskal · ${section}`, text: summary || `Sin registros en ${section}` }
    if (navigator.share) await navigator.share(shareData)
    else await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`)
  }
  return <section className="record-collection">
    <div className="record-collection-head"><div><span className="panel-kicker">REGISTROS</span><h2>{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</h2></div><div className="record-search-tools"><label className="searchbox"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={`Buscar ${section.toLocaleLowerCase('es')}...`} aria-label={`Buscar ${section}`} />{query && <button aria-label="Limpiar búsqueda" onClick={() => onQueryChange('')}><X size={14} /></button>}</label><button className={`record-tool-button ${showFilters ? 'record-tool-active' : ''}`} aria-label="Mostrar filtros" aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)}><Filter size={17} /></button></div></div>
    {showFilters && <div className="record-filter-row"><select aria-label="Filtrar por mes" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="">Todos los meses</option>{monthOptions.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select><select aria-label="Filtrar por año" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="">Todos los años</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select><button className="record-tool-button" aria-label="Compartir registros visibles" onClick={() => { void shareRecords().catch(() => {}) }}><Share2 size={17} /></button></div>}
    {isLoading ? <p className="record-loading">Cargando registros…</p> : filtered.length ? <><div className={`record-card-list record-grid-${config.tone}`}>{filtered.map((row) => <FinanceCardRow key={recordId(row)} row={row} section={section} config={config} columns={columns} onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />)}</div><div className="record-list-footer"><span>Mostrando {filtered.length} de {rows.length} registros</span><strong>Total visible <b>{euros(numericTotal(filtered, config.amount))}</b></strong></div></> : <div className="record-empty"><span className="empty-icon"><BarChart3 size={20} /></span><strong>{query || monthFilter || yearFilter ? 'No encontramos resultados' : 'Aún no hay registros'}</strong><p>{query || monthFilter || yearFilter ? 'Prueba con otra búsqueda o filtro.' : 'Añade un registro para empezar.'}</p>{!query && !monthFilter && !yearFilter && <button className="button-outline" onClick={onAdd}><Plus size={15} /> Añadir registro</button>}</div>}
  </section>
}

function FinanceCardRow({ row, section, config, columns, onEdit, onDelete }: { row: Row; section: Exclude<Section, 'Dashboard' | 'Baloncesto'>; config: { title: string; subtitle: string; amount: string; icon: ComponentType<{ size?: number }>; tone: string }; columns: string[]; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = config.icon
  const title = String(row[config.title] ?? 'Registro')
  const subtitle = section === 'Nóminas' ? `${String(row.MES ?? '')} ${String(row['AÑO'] ?? '')}` : String(row[config.subtitle] ?? 'Sin detalle')
  const extraColumns = columns.filter((key) => ![config.title, config.subtitle, config.amount].includes(key))
  return <article className={`finance-record-card ${expanded ? 'finance-record-expanded' : ''}`}>
    <button className="finance-card-summary" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><span className={`finance-card-icon card-tone-${config.tone}`}><Icon size={17} /></span><span className="finance-card-title"><strong>{title}</strong><small>{subtitle}</small></span><strong className="finance-card-amount">{euros(row[config.amount])}</strong><ChevronDown className="finance-card-chevron" size={17} /></button>
    {expanded && <div className="finance-card-expanded"><div className="finance-card-details">{extraColumns.map((key) => <div className="finance-card-detail" key={key}><span>{key}</span><strong>{renderCell(key, row[key])}</strong></div>)}</div><div className="finance-card-footer"><span><CalendarDays size={13} /> {row['FECHA DE REGISTRO'] ? renderCell('FECHA DE REGISTRO', row['FECHA DE REGISTRO']) : section === 'Nóminas' ? `Nómina · ${subtitle}` : 'Registro guardado'}</span><div className="finance-card-actions"><button onClick={onEdit}><Pencil size={14} /> Editar</button><button onClick={onDelete}><Trash2 size={14} /> Eliminar</button></div></div></div>}
  </article>
}

function BasketballIncomeCards({ rows, query, onQueryChange, isLoading, onAdd, onEdit, onDelete }: { rows: Row[]; query: string; onQueryChange: (value: string) => void; isLoading: boolean; onAdd: () => void; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  const [expandedSeason, setExpandedSeason] = useState('')
  const [expandedMonth, setExpandedMonth] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [seasonFilter, setSeasonFilter] = useState('')
  const seasonsAvailable = [...new Set(rows.map(seasonForRow).filter(Boolean))].sort((a, b) => Number(b.slice(0, 4)) - Number(a.slice(0, 4)))
  const visibleRows = rows.filter((row) => !seasonFilter || seasonForRow(row) === seasonFilter)
  const seasons = new Map<string, Row[]>()
  for (const row of visibleRows) {
    const season = seasonForRow(row)
    if (season) seasons.set(season, [...(seasons.get(season) ?? []), row])
  }
  const seasonRows = [...seasons].map(([season, entries]) => ({ season, entries, amount: numericTotal(entries, 'DINERO INGRESADO') })).sort((a, b) => Number(b.season.slice(0, 4)) - Number(a.season.slice(0, 4)))
  const monthlyEntries = (entries: Row[]) => {
    const months = new Map<string, Row[]>()
    for (const row of entries) {
      const month = monthNumber(row.MES)
      const year = yearNumber(row['AÑO'])
      if (month < 1 || month > 12) continue
      const key = `${year}-${String(month).padStart(2, '0')}`
      months.set(key, [...(months.get(key) ?? []), row])
    }
    return [...months].map(([key, monthRows]) => ({ key, month: Number(key.slice(5)), year: Number(key.slice(0, 4)), rows: monthRows, amount: numericTotal(monthRows, 'DINERO INGRESADO') })).sort((a, b) => a.year - b.year || a.month - b.month)
  }
  return <section className="basketball-income-section"><div className="basketball-section-heading"><div><span className="panel-kicker">BALONCESTO</span><h2>Ingresos por temporada</h2><p>Selecciona una temporada para consultar sus meses.</p></div><button className="button-outline basketball-add-button" onClick={onAdd}><Plus size={15} /> Añadir ingreso</button></div>
    <div className="record-collection-head basketball-record-tools"><span className="basketball-result-count">{visibleRows.length} {visibleRows.length === 1 ? 'ingreso' : 'ingresos'}</span><div className="record-search-tools"><label className="searchbox"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar un ingreso..." aria-label="Buscar ingresos" />{query && <button aria-label="Limpiar búsqueda" onClick={() => onQueryChange('')}><X size={14} /></button>}</label><button className={`record-tool-button ${showFilters ? 'record-tool-active' : ''}`} aria-label="Mostrar filtros" aria-expanded={showFilters} onClick={() => setShowFilters((value) => !value)}><Filter size={17} /></button></div></div>
    {showFilters && <div className="record-filter-row basketball-filter-row"><select aria-label="Filtrar por temporada" value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value)}><option value="">Todas las temporadas</option>{seasonsAvailable.map((season) => <option key={season} value={season}>{season}</option>)}</select><button className="record-tool-button" aria-label="Compartir ingresos" onClick={() => { const text = visibleRows.map((row) => `${row.MES} ${row['AÑO']} · ${euros(row['DINERO INGRESADO'])}`).join('\n'); if (navigator.share) void navigator.share({ title: 'Fiskal · Baloncesto', text }).catch(() => {}); else void navigator.clipboard.writeText(text).catch(() => {}) }}><Share2 size={17} /></button></div>}
    {isLoading ? <p className="record-loading">Cargando ingresos…</p> : seasonRows.length ? <><div className="season-card-grid">{seasonRows.map(({ season, entries, amount }) => <div className={`season-income-card ${expandedSeason === season ? 'season-income-active' : ''}`} key={season}>
      <button className="season-income-button" aria-expanded={expandedSeason === season} onClick={() => { setExpandedSeason(expandedSeason === season ? '' : season); setExpandedMonth('') }}><span className="season-income-icon"><BasketballIcon size={19} /></span><span className="season-income-copy"><small>TEMPORADA</small><strong>{season}</strong><em>{entries.length} {entries.length === 1 ? 'ingreso mensual' : 'ingresos mensuales'}</em></span><span className="season-income-total">{euros(amount)}</span><ChevronDown className="season-chevron" size={17} /></button>
      {expandedSeason === season && <div className="season-months">{monthlyEntries(entries).map(({ key, month, year, rows: monthRows, amount: monthAmount }) => <article className={`month-income-card ${expandedMonth === key ? 'month-income-open' : ''}`} key={key}><button className="month-income-button" aria-expanded={expandedMonth === key} onClick={() => setExpandedMonth(expandedMonth === key ? '' : key)}><span className="month-income-date"><CalendarDays size={15} /><span>{monthOptions[month - 1]} <small>{year}</small></span></span><strong>{euros(monthAmount)}</strong><ChevronDown size={15} /></button>{expandedMonth === key && <div className="month-income-entries">{monthRows.map((row) => <div className="month-income-entry" key={recordId(row)}><span>{String(row.MES ?? '')} {String(row['AÑO'] ?? '')}</span><strong>{euros(row['DINERO INGRESADO'])}</strong><div><button aria-label="Modificar ingreso" onClick={() => onEdit(row)}><Pencil size={13} /></button><button aria-label="Eliminar ingreso" onClick={() => onDelete(row)}><Trash2 size={13} /></button></div></div>)}</div>}</article>)}</div>}
    </div>)}</div><div className="record-list-footer"><span>Mostrando {visibleRows.length} de {rows.length} ingresos</span><strong>Total visible <b>{euros(numericTotal(visibleRows, 'DINERO INGRESADO'))}</b></strong></div></> : <div className="record-empty"><span className="empty-icon"><BasketballIcon size={20} /></span><strong>{query || seasonFilter ? 'No encontramos resultados' : 'Aún no hay ingresos'}</strong><p>{query || seasonFilter ? 'Prueba con otra búsqueda o temporada.' : 'Añade un ingreso para empezar a ver tus temporadas.'}</p>{!query && !seasonFilter && <button className="button-outline" onClick={onAdd}><Plus size={15} /> Añadir ingreso</button>}</div>}
  </section>
}

function Kpi({ title, value, icon: Icon, tone, foot }: { title: string; value: string; icon: typeof ArrowUpRight; tone: string; foot: string }) { return <article className="kpi-card"><div className="kpi-top"><span>{title}</span><span className={`kpi-icon ${tone}`}><Icon size={17} /></span></div><strong className="kpi-value">{value}</strong><div className="kpi-foot"><span className="kpi-dash" />{foot}</div></article> }
function SplitCard({ title, value, foot, tone }: { title: string; value: string; foot: string; tone?: string }) { return <div className={`split-card ${tone ?? ''}`}><span>{title}</span><strong>{value}</strong><small>{foot}</small></div> }
function sectionDescription(section: Section) { return ({ Baloncesto: 'Consulta tus ingresos por mes y el total acumulado de cada temporada.', Ventas: 'Sigue las ventas, aportaciones y el beneficio generado.', Compras: 'Registra tus compras, pagos y reembolsos.', 'Informática': 'Organiza trabajos, fechas de entrega e importes.', Nóminas: 'Consulta los pagos mensuales de cada empresa.' } as Record<string, string>)[section] ?? '' }
function tableColumns(section: Section) { if (section === 'Baloncesto') return ['MES', 'AÑO', 'TEMPORADA', 'DINERO INGRESADO']; if (section === 'Ventas') return ['VENTAS', 'COMERCIO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO', 'FECHA DE REGISTRO']; if (section === 'Compras') return ['COMPRAS', 'COMERCIO', 'DINERO PAGADO', 'A MEDIAS', 'REEMBOLSO', 'PRECIO FINAL', 'FECHA DE REGISTRO']; if (section === 'Informática') return ['CLIENTE', 'TRABAJO', 'FECHA DE INICIO', 'FECHA DE FINALIZACIÓN', 'IMPORTE', 'PAGADO', 'FECHA DE REGISTRO']; if (section === 'Nóminas') return ['EMPRESA', 'MES', 'AÑO', 'PAGADO']; return [] }
function renderCell(key: string, value: unknown) { if (key === 'PAGADO') { const normalized = String(value ?? '').trim().toLowerCase(); if (['sí', 'si', 'no'].includes(normalized)) return <span className={`paid-badge ${normalized === 'sí' || normalized === 'si' ? 'paid-yes' : 'paid-no'}`}><span />{normalized === 'no' ? 'Pendiente' : 'Pagado'}</span>; return value == null || value === '' ? '—' : euros(value) } if (['FECHA DE INICIO', 'FECHA DE FINALIZACIÓN', 'FECHA DE REGISTRO'].includes(key)) return formatDate(value); if (['DINERO INGRESADO', 'DINERO GANADO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO', 'DINERO PAGADO', 'REEMBOLSO', 'PRECIO FINAL', 'IMPORTE', 'IMPORTE PAGADO'].includes(key)) return euros(value); if (key === 'A MEDIAS') return <span className="yes-no">{value ? 'Sí' : 'No'}</span>; return String(value ?? '—') }

function RecordModal({ active, initialRecord, onClose, onSave }: { active: Exclude<Section, 'Dashboard'>; initialRecord: Row | null; onClose: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const inputs = fields[active]
  const editing = Boolean(initialRecord)
  const initialValue = (key: string, type?: string) => {
    if (key === 'A MEDIAS') return initialRecord?.[key] ? 'Sí' : 'No'
    const text = String(initialRecord?.[key] ?? '')
    if (type !== 'date' || !text) return text
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
    const spanishDate = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
    if (spanishDate) return `${spanishDate[3]}-${spanishDate[2].padStart(2, '0')}-${spanishDate[1].padStart(2, '0')}`
    return ''
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-head"><div><span className="panel-kicker">{active.toUpperCase()}</span><h2 id="modal-title">{editing ? 'Modificar registro' : 'Nuevo registro'}</h2><p>{editing ? 'Actualiza los datos de este registro.' : 'Se guardará directamente en la base de datos.'}</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></header><form onSubmit={onSave}><div className="modal-fields">{inputs.map((field) => {
    if (field.type === 'select') return <label key={field.key}>{field.label}<select name={field.key} required defaultValue={initialValue(field.key, field.type)}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    return <label key={field.key}>{field.label}<input name={field.key} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} defaultValue={initialValue(field.key, field.type)} required={field.key !== 'FECHA DE FINALIZACIÓN'} /></label>
  })}</div><div className="modal-actions"><button type="button" className="button-outline" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> {editing ? 'Guardar cambios' : 'Guardar registro'}</button></div></form></section></div>
}

function CategoryChooser({ onClose, onChoose }: { onClose: () => void; onChoose: (section: Exclude<Section, 'Dashboard'>) => void }) {
  const categories = sections.filter(({ name }) => name !== 'Dashboard')
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="record-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="category-title"><header className="modal-head"><div><span className="panel-kicker">NUEVO REGISTRO</span><h2 id="category-title">¿Qué quieres registrar?</h2><p>Elige una sección para mostrar el formulario adecuado.</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></header><div className="category-grid">{categories.map(({ name, icon: Icon }) => <button key={name} className="category-option" onClick={() => onChoose(name as Exclude<Section, 'Dashboard'>)}><Icon size={18} /><span>{name}</span><ArrowUpRight size={14} /></button>)}</div></section></div>
}
