'use client'

import { useMemo, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { signOut } from 'next-auth/react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Banknote, BarChart3, CalendarDays, Check, ChevronDown, CircleDollarSign, Computer, FileSpreadsheet, LayoutDashboard, LogOut, Menu, Pencil, Plus, Search, ShoppingBag, Trash2, Trophy, Wallet, X } from 'lucide-react'
import { TopCommerceChart } from '@/components/finance-charts'

type Row = Record<string, unknown> & { _rowNumber?: number; _group?: string }
type Data = { basketball: Row[]; sales: Row[]; purchases: Row[]; it: Row[]; payroll: Row[]; warnings?: string[] }
type Section = 'Dashboard' | 'Baloncesto' | 'Ventas' | 'Compras' | 'Informática' | 'Nóminas'
type RecordIdentity = { rowNumber: number; group?: string }
const sections: { name: Section; icon: typeof LayoutDashboard; key?: keyof Data }[] = [
  { name: 'Dashboard', icon: LayoutDashboard }, { name: 'Baloncesto', icon: Trophy }, { name: 'Ventas', icon: CircleDollarSign, key: 'sales' }, { name: 'Compras', icon: ShoppingBag, key: 'purchases' }, { name: 'Informática', icon: Computer, key: 'it' }, { name: 'Nóminas', icon: Wallet, key: 'payroll' },
]
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
const numericTotal = (rows: Row[] | undefined, key: string) => (rows ?? []).reduce((sum, row) => sum + parseAmount(row[key]), 0)
const amountPaid = (row: Row) => {
  const status = String(row.PAGADO ?? '').trim().toLocaleLowerCase('es')
  if (['sí', 'si'].includes(status)) return parseAmount(row.IMPORTE)
  if (status === 'no') return 0
  return parseAmount(row.PAGADO)
}
const recordId = (row: Row) => `${String(row._group ?? '')}:${String(row._rowNumber ?? '')}`
const monthOptions = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const monthNumber = (value: unknown) => {
  const numeric = Number(value)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric
  const normalized = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es')
  return monthOptions.findIndex((month) => month.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es') === normalized) + 1
}
const yearNumber = (value: unknown) => Number(String(value ?? '').match(/\d{4}/)?.[0] ?? parseAmount(value))
const seasonFor = (month: number, year: number) => {
  if (!Number.isInteger(year) || year < 1) return null
  if (month >= 9 && month <= 12) return `${year}/${year + 1}`
  if (month >= 1 && month <= 6) return `${year - 1}/${year}`
  return null
}
const seasonForRow = (row: Row) => String(row.TEMPORADA ?? '').trim() || seasonFor(monthNumber(row.MES), yearNumber(row.AÑO)) || ''
const currentSeason = (date = new Date()) => {
  const year = date.getFullYear()
  return date.getMonth() + 1 >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`
}
const fields: Record<Exclude<Section, 'Dashboard'>, { key: string; label: string; type?: string; options?: string[] }[]> = {
  Baloncesto: [{ key: 'MES', label: 'Mes', type: 'select', options: monthOptions }, { key: 'AÑO', label: 'Año', type: 'number' }, { key: 'DINERO INGRESADO', label: 'Dinero ingresado', type: 'number' }],
  Ventas: [{ key: 'VENTAS', label: 'Venta' }, { key: 'COMERCIO', label: 'Comercio' }, { key: 'DINERO APORTADO', label: 'Dinero aportado', type: 'number' }, { key: 'DINERO RECOGIDO', label: 'Dinero recogido', type: 'number' }],
  Compras: [{ key: 'COMPRAS', label: 'Compra' }, { key: 'COMERCIO', label: 'Comercio' }, { key: 'DINERO PAGADO', label: 'Dinero pagado', type: 'number' }, { key: 'A MEDIAS', label: '¿A medias?', type: 'select', options: ['No', 'Sí'] }, { key: 'REEMBOLSO', label: 'Reembolso', type: 'number' }],
  'Informática': [{ key: 'CLIENTE', label: 'Cliente' }, { key: 'TRABAJO', label: 'Trabajo' }, { key: 'FECHA DE INICIO', label: 'Fecha de inicio', type: 'date' }, { key: 'FECHA DE FINALIZACIÓN', label: 'Fecha de finalización', type: 'date' }, { key: 'IMPORTE', label: 'Importe', type: 'number' }, { key: 'PAGADO', label: '¿Cuánto te han pagado?', type: 'select', options: ['Sí', 'No', 'Cantidad específica'] }],
  Nóminas: [{ key: 'EMPRESA', label: 'Empresa' }, { key: 'MES', label: 'Mes', type: 'select', options: monthOptions }, { key: 'AÑO', label: 'Año', type: 'number' }, { key: 'PAGADO', label: 'Importe pagado', type: 'number' }],
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
  const { data, error, isLoading } = useSWR('/api/sheets', fetcher, { revalidateOnFocus: true })
  const rows = useMemo(() => {
    if (!data) return [] as Row[]
    if (active === 'Baloncesto') return data.basketball
    if (active === 'Nóminas') return data.payroll
    const key = sections.find((section) => section.name === active)?.key
    return key ? (data[key] as Row[]) : []
  }, [active, data])
  const matchesQuery = (row: Row) => Object.entries(row).filter(([key]) => !key.startsWith('_')).some(([, value]) => String(value).toLowerCase().includes(query.toLowerCase()))
  const filteredRows = rows.filter(matchesQuery)
  const basketballSeasonRows = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of data?.basketball ?? []) {
      const season = seasonForRow(row)
      if (!season) continue
      totals.set(season, (totals.get(season) ?? 0) + parseAmount(row['DINERO INGRESADO']))
    }
    return [...totals].map(([season, amount]) => ({ TEMPORADA: season, 'DINERO GANADO': amount })).sort((left, right) => Number(left.TEMPORADA.slice(0, 4)) - Number(right.TEMPORADA.slice(0, 4)))
  }, [data])
  const currentSeasonLabel = currentSeason()
  const currentSeasonIncome = basketballSeasonRows.find((row) => row.TEMPORADA === currentSeasonLabel)?.['DINERO GANADO'] ?? 0
  const basketballRows = (data?.basketball ?? []).filter(matchesQuery).filter((row) => !selectedBasketballSeason || seasonForRow(row) === selectedBasketballSeason)
  const filteredBasketballSeasonRows = basketballSeasonRows.filter(matchesQuery).filter((row) => !selectedBasketballSeason || row.TEMPORADA === selectedBasketballSeason)
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
  const chart = [{ month: 'Baloncesto', amount: totals.basketball }, { month: 'Ventas', amount: totals.sales }, { month: 'Compras', amount: totals.purchases }, { month: 'Informática', amount: totals.itPaid }, { month: 'Nóminas', amount: totals.payroll }]
  const selectedRows = rows.filter((row) => selectedIds.has(recordId(row)))
  const sheetNames: Record<Exclude<Section, 'Dashboard'>, string> = { Baloncesto: 'BALONCESTO', Ventas: 'VENTAS', Compras: 'COMPRAS', 'Informática': 'INFORMÁTICA', Nóminas: 'NÓMINAS' }
  const payrollCount = payrollRows.length
  const companyCount = payrollCompanies.length
  const paidIt = (data?.it ?? []).filter((row) => amountPaid(row) >= parseAmount(row.IMPORTE))
  const unpaidIt = (data?.it ?? []).filter((row) => amountPaid(row) < parseAmount(row.IMPORTE))
  const pendingItAmount = unpaidIt.reduce((sum, row) => sum + Math.max(0, parseAmount(row.IMPORTE) - amountPaid(row)), 0)
  const cards: Partial<Record<Section, { title: string; value: string; foot: string }[]>> = {
    Ventas: [{ title: 'DINERO APORTADO', value: euros(totals.salesContributed), foot: `${data?.sales.length ?? 0} ventas registradas` }, { title: 'DINERO RECOGIDO', value: euros(totals.salesCollected), foot: 'Importe total cobrado' }, { title: 'BENEFICIO GENERADO', value: euros(totals.sales), foot: 'Recogido menos aportado' }],
    Compras: [{ title: 'GASTO FINAL', value: euros(totals.purchases), foot: `${data?.purchases.length ?? 0} compras registradas` }, { title: 'TOTAL REEMBOLSADO', value: euros(totals.refunds), foot: 'Importe devuelto de tus compras' }],
    'Informática': [{ title: 'IMPORTE TOTAL', value: euros(totals.it), foot: `${data?.it.length ?? 0} trabajos registrados` }, { title: 'COBRADO', value: euros(totals.itPaid), foot: `${paidIt.length} trabajos completados` }, { title: 'PENDIENTE DE COBRO', value: euros(pendingItAmount), foot: `${unpaidIt.length} trabajos pendientes` }],
    Nóminas: [{ title: 'NÓMINAS RECIBIDAS', value: euros(totals.payroll), foot: `${payrollCount} pagos registrados` }, { title: 'EMPRESAS', value: String(companyCount), foot: 'Empresas con registros de nómina' }],
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
      record.TEMPORADA = seasonFor(monthNumber(record.MES), yearNumber(record.AÑO)) ?? ''
    }
    const isEditing = Boolean(recordToEdit)
    const identity: RecordIdentity | undefined = recordToEdit?._rowNumber ? { rowNumber: recordToEdit._rowNumber, group: recordToEdit._group } : undefined
    const response = await fetch('/api/sheets', {
      method: isEditing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheetNames[active as Exclude<Section, 'Dashboard'>], ...(identity ? { ...identity, rowNumber: identity.rowNumber } : {}), record }),
    })
    const result = await response.json()
    if (!response.ok) { window.alert(result.error || (isEditing ? 'No se pudo modificar el registro.' : 'No se pudo guardar el registro.')); return }
    await mutate('/api/sheets')
    setModal(false)
    setRecordToEdit(null)
    setSelectedIds(new Set())
  }

  async function deleteSelectedRecords() {
    if (!selectedRows.length || !window.confirm(`¿Quieres eliminar ${selectedRows.length === 1 ? 'este registro' : `estos ${selectedRows.length} registros`}?`)) return
    const records: RecordIdentity[] = selectedRows.flatMap((row) => row._rowNumber ? [{ rowNumber: row._rowNumber, ...(row._group ? { group: row._group } : {}) }] : [])
    const response = await fetch('/api/sheets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheet: sheetNames[active as Exclude<Section, 'Dashboard'>], records }) })
    const result = await response.json()
    if (!response.ok) { window.alert(result.error || 'No se pudieron eliminar los registros.'); return }
    await mutate('/api/sheets')
    setSelectedIds(new Set())
  }

  return <main className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <a className="brand sidebar-brand" href="#"><span className="brand-mark">f</span><span>Fiskal<span className="brand-period">.</span></span></a>
      <div className="nav-caption">TU ESPACIO</div>
      <nav aria-label="Navegación principal">{sections.map(({ name, icon: Icon }) => <button key={name} className={`nav-link ${active === name ? 'nav-active' : ''}`} onClick={() => { setActive(name); setQuery(''); setSelectedBasketballSeason(''); setSelectedIds(new Set()); setMobileNav(false); setModal(false); setRecordToEdit(null) }}><Icon size={18} strokeWidth={1.8} /><span>{name}</span>{name === 'Dashboard' && active === name && <span className="nav-indicator" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sheet-status"><span className="status-pulse" /><div><strong>Google Sheets</strong><small>{error ? 'Revisar conexión' : isLoading ? 'Conectando…' : 'Sincronización activa'}</small></div><FileSpreadsheet size={17} /></div><div className="profile"><div className="avatar">{user.image ? <img src={user.image} alt="" /> : <span>{user.name?.[0] ?? 'U'}</span>}</div><div className="profile-copy"><strong>{user.name ?? 'Mi cuenta'}</strong><small>{user.email}</small></div><button className="icon-button logout" aria-label="Cerrar sesión" onClick={() => signOut()}><LogOut size={16} /></button></div></div>
    </aside>
    {mobileNav && <button className="mobile-backdrop" aria-label="Cerrar navegación" onClick={() => setMobileNav(false)} />}
    <section className="main-panel">
      <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Abrir navegación" onClick={() => setMobileNav(true)}><Menu size={19} /></button><span>Mis finanzas</span><span className="crumb-slash">/</span><strong>{active}</strong></div><div className="topbar-right"><span className="today"><CalendarDays size={15} /> {new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span><div className="top-avatar">{user.image ? <img src={user.image} alt="" /> : user.name?.[0] ?? 'U'}</div></div></header>
      <div className="content">
        {error && <div className="error-banner"><span>Google Sheets todavía no está conectado. Comprueba las variables de entorno y comparte la hoja con la cuenta de servicio.</span><button className="icon-button" aria-label="Cerrar aviso" onClick={() => mutate('/api/sheets')}><X size={16} /></button></div>}
        {data?.warnings?.map((warning) => <div className="error-banner" role="alert" key={warning}><span>{warning}</span></div>)}
        {active === 'Dashboard' ? <>
          <div className="page-heading"><div><div className="eyebrow small-eyebrow"><span className="eyebrow-dot" /> RESUMEN PERSONAL</div><h1>Todo en <em>perspectiva.</em></h1><p>Un lugar para ver cómo se mueve tu dinero.</p></div><button className="button-primary" onClick={() => setShowCategoryChooser(true)}><Plus size={17} /> Añadir registro</button></div>
          <div className="kpi-grid"><Kpi title="INGRESOS TOTALES" value={euros(totalIncomes)} icon={CircleDollarSign} tone="green" foot="Baloncesto, ventas, nóminas e informática" /><Kpi title="BENEFICIO EN VENTAS" value={euros(totals.sales)} icon={ArrowUpRight} tone="green" foot={`${data?.sales.length ?? 0} ventas registradas`} /><Kpi title="GASTO EN COMPRAS" value={euros(totals.purchases)} icon={ArrowDownLeft} tone="orange" foot={`${data?.purchases.length ?? 0} compras registradas`} /><Kpi title="COBRADO · INFORMÁTICA" value={euros(totals.itPaid)} icon={Computer} tone="violet" foot={`${data?.it.length ?? 0} trabajos registrados`} /><Kpi title="NÓMINAS RECIBIDAS" value={euros(totals.payroll)} icon={Banknote} tone="yellow" foot={`${payrollCount} pagos registrados`} /></div>
          <div className="dashboard-grid">
            <section className="panel chart-panel"><div className="panel-heading"><div><span className="panel-kicker">PANORAMA</span><h2>Balance por actividad</h2></div><span className="chart-period">Todas las secciones <ChevronDown size={14} /></span></div><div className="chart-summary"><strong>{euros(totalIncomes - totals.purchases)}</strong><span>balance neto registrado</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 12, right: 6, left: 0, bottom: 0 }}><defs><linearGradient id="fillBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#66947c" stopOpacity={0.28} /><stop offset="95%" stopColor="#66947c" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9e8df" strokeDasharray="3 4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#92948a', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#92948a', fontSize: 10 }} tickFormatter={(value) => `${value}€`} width={50} /><Tooltip formatter={(value) => euros(value)} contentStyle={{ borderRadius: 12, borderColor: '#e6e5db', fontSize: 12 }} /><Area type="monotone" dataKey="amount" name="Importe" stroke="#547c67" strokeWidth={2.5} fill="url(#fillBalance)" /></AreaChart></ResponsiveContainer></div><div className="chart-legend"><span><i /> Importes acumulados</span><span>Fuente: tus hojas</span></div></section>
            <section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">TUS ÁREAS</span><h2>Actividad financiera</h2></div><button className="text-button" onClick={() => setActive('Baloncesto')}>Ver todo <ArrowUpRight size={14} /></button></div><div className="activity-list">{[{ name: 'Baloncesto', sub: 'Ingresos y temporadas', icon: Trophy, total: totals.basketball, tone: 'activity-green' }, { name: 'Ventas', sub: `${data?.sales.length ?? 0} registros`, icon: CircleDollarSign, total: totals.sales, tone: 'activity-violet' }, { name: 'Compras', sub: `${data?.purchases.length ?? 0} registros`, icon: ShoppingBag, total: totals.purchases, tone: 'activity-orange' }, { name: 'Informática', sub: `${data?.it.length ?? 0} trabajos`, icon: Computer, total: totals.it, tone: 'activity-blue' }, { name: 'Nóminas', sub: `${data?.payroll.length ?? 0} empresas`, icon: Wallet, total: totals.payroll, tone: 'activity-yellow' }].map(({ name, sub, icon: Icon, total, tone }) => <button className="activity-row" key={name} onClick={() => setActive(name as Section)}><span className={`activity-icon ${tone}`}><Icon size={17} /></span><span className="activity-copy"><strong>{name}</strong><small>{sub}</small></span><strong className="activity-total">{euros(total)}</strong><ArrowUpRight className="activity-arrow" size={15} /></button>)}</div><div className="activity-note"><span className="note-symbol">↗</span><span>Tus datos se guardan en tu propia hoja de cálculo.</span></div></section>
          </div>
          <div className="dashboard-bottom"><div><span className="bottom-dot" /> DATOS PRIVADOS · SOLO PARA TI</div><span>Actualizado al consultar tus hojas</span></div>
        </> : <>
          <div className="page-heading section-heading"><div><div className="eyebrow small-eyebrow"><span className="eyebrow-dot" /> GESTIÓN PERSONAL</div><h1>{active === 'Baloncesto' ? 'Baloncesto' : active}<span className="heading-period">.</span></h1><p>{sectionDescription(active)}</p></div><button className="button-primary" onClick={openAddRecord}><Plus size={17} /> Añadir registro</button></div>
          {active === 'Baloncesto' ? <div className="split-stats"><SplitCard title="INGRESOS TEMPORADA ACTUAL" value={euros(currentSeasonIncome)} foot={`Temporada ${currentSeasonLabel}`} /><SplitCard title="INGRESOS HISTÓRICOS" value={euros(totals.basketball)} foot={`${data?.basketball.length ?? 0} registros`} tone="split-lime" /></div> : cards[active] && <div className="split-stats">{cards[active]?.map((card, index) => <SplitCard key={card.title} {...card} tone={index % 2 ? 'split-lime' : undefined} />)}</div>}
          {active === 'Nóminas' && <div className="company-chips">{payrollCompanies.map((company) => <span key={company}>{company}<b>{payrollRows.filter((row) => String(row.EMPRESA ?? '').trim() === company).length}</b></span>)}</div>}
          {active === 'Ventas' && <TopCommerceChart title="Top comercios por beneficio" rows={data?.sales ?? []} valueKey="BENEFICIO" valueLabel="Beneficio" />}
          {active === 'Compras' && <TopCommerceChart title="Top tiendas por dinero gastado" rows={data?.purchases ?? []} valueKey="PRECIO FINAL" valueLabel="Gasto final" />}
          <section className="panel table-panel"><div className="table-toolbar"><div><span className="panel-kicker">REGISTROS</span><h2>{active === 'Baloncesto' ? basketballRows.length : rows.length} {(active === 'Baloncesto' ? basketballRows.length : rows.length) === 1 ? 'registro' : 'registros'}</h2></div><div className="table-controls">{selectedRows.length > 0 && <div className="table-actions"><button className="button-outline" onClick={() => { if (selectedRows.length === 1) { setRecordToEdit(selectedRows[0]); setModal(true) } }} disabled={selectedRows.length !== 1}><Pencil size={14} /> Modificar</button><button className="button-outline button-danger" onClick={deleteSelectedRecords}><Trash2 size={14} /> Eliminar ({selectedRows.length})</button></div>}{active === 'Baloncesto' && <label className="season-filter">Temporada<select value={selectedBasketballSeason} onChange={(event) => { setSelectedBasketballSeason(event.target.value); setSelectedIds(new Set()) }} aria-label="Filtrar por temporada"><option value="">Todas las temporadas</option>{basketballSeasonRows.map((row) => <option key={row.TEMPORADA} value={row.TEMPORADA}>{row.TEMPORADA}</option>)}</select></label>}<label className="searchbox"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar en registros..." aria-label="Buscar en registros" />{query && <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')}><X size={14} /></button>}</label></div></div>
            {active === 'Baloncesto' ? <div className="basketball-tables"><BasketballTable title="INGRESOS POR TEMPORADA" columns={['TEMPORADA', 'DINERO GANADO']} rows={filteredBasketballSeasonRows} isLoading={isLoading} query={query} selectedIds={selectedIds} onToggle={toggleSelection} onAdd={openAddRecord} selectable={false} /><BasketballTable title="BALONCESTO HISTÓRICO" columns={['MES', 'AÑO', 'TEMPORADA', 'DINERO INGRESADO']} rows={basketballRows} isLoading={isLoading} query={query} selectedIds={selectedIds} onToggle={toggleSelection} onAdd={openAddRecord} /></div> : <div className="table-scroll"><table><thead><tr><th className="table-select-cell"><span className="sr-only">Seleccionar</span></th>{tableColumns(active).map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={tableColumns(active).length + 1} className="table-empty">Cargando desde Google Sheets…</td></tr> : filteredRows.length ? filteredRows.map((row) => <tr key={recordId(row)}><td className="table-select-cell"><input type="checkbox" className="table-select" aria-label={`Seleccionar registro ${String(row._rowNumber ?? '')}`} checked={selectedIds.has(recordId(row))} onChange={() => toggleSelection(row)} /></td>{tableColumns(active).map((key) => <td key={key}>{renderCell(key, row[key])}</td>)}</tr>) : <tr><td colSpan={tableColumns(active).length + 1} className="table-empty"><div className="empty-icon"><BarChart3 size={20} /></div><strong>{query ? 'No encontramos resultados' : 'Aún no hay registros'}</strong><span>{query ? 'Prueba con otra búsqueda.' : 'Añade tu primer registro para empezar.'}</span>{!query && <button className="button-outline" onClick={openAddRecord}><Plus size={15} /> Añadir registro</button>}</td></tr>}</tbody></table></div>}
            <div className="table-footer"><span>Mostrando {active === 'Baloncesto' ? basketballRows.length : filteredRows.length} de {rows.length} registros</span><span><span className="status-pulse" /> Sincronizado con Google Sheets</span></div>
          </section>
        </>}
      </div>
    </section>
    {modal && active !== 'Dashboard' && <RecordModal key={`${active}-${recordToEdit?._rowNumber ?? 'new'}`} active={active} initialRecord={recordToEdit} onClose={() => { setModal(false); setRecordToEdit(null) }} onSave={saveRecord} />}
    {showCategoryChooser && <CategoryChooser onClose={() => setShowCategoryChooser(false)} onChoose={chooseRecordSection} />}
  </main>
}

function BasketballTable({ title, columns, rows, isLoading, query, selectedIds, onToggle, onAdd, selectable = true }: { title: string; columns: string[]; rows: Row[]; isLoading: boolean; query: string; selectedIds: Set<string>; onToggle: (row: Row) => void; onAdd: () => void; selectable?: boolean }) {
  const selectionColumn = selectable ? 1 : 0
  return <section className="basketball-table"><h3>{title}</h3><div className="table-scroll"><table><thead><tr>{selectable && <th className="table-select-cell"><span className="sr-only">Seleccionar</span></th>}{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={columns.length + selectionColumn} className="table-empty">Cargando desde Google Sheets…</td></tr> : rows.length ? rows.map((row) => <tr key={selectable ? recordId(row) : String(row.TEMPORADA ?? '')}>{selectable && <td className="table-select-cell"><input type="checkbox" className="table-select" aria-label={`Seleccionar registro ${String(row._rowNumber ?? '')}`} checked={selectedIds.has(recordId(row))} onChange={() => onToggle(row)} /></td>}{columns.map((key) => <td key={key}>{renderCell(key, row[key])}</td>)}</tr>) : <tr><td colSpan={columns.length + selectionColumn} className="table-empty"><strong>{query ? 'No encontramos resultados' : 'Aún no hay registros'}</strong><span>{query ? 'Prueba con otra búsqueda.' : 'Añade tu primer registro para empezar.'}</span>{!query && selectable && <button className="button-outline" onClick={onAdd}><Plus size={15} /> Añadir registro</button>}</td></tr>}</tbody></table></div></section>
}

function Kpi({ title, value, icon: Icon, tone, foot }: { title: string; value: string; icon: typeof ArrowUpRight; tone: string; foot: string }) { return <article className="kpi-card"><div className="kpi-top"><span>{title}</span><span className={`kpi-icon ${tone}`}><Icon size={17} /></span></div><strong className="kpi-value">{value}</strong><div className="kpi-foot"><span className="kpi-dash" />{foot}</div></article> }
function SplitCard({ title, value, foot, tone }: { title: string; value: string; foot: string; tone?: string }) { return <div className={`split-card ${tone ?? ''}`}><span>{title}</span><strong>{value}</strong><small>{foot}</small></div> }
function sectionDescription(section: Section) { return ({ Baloncesto: 'Consulta tus ingresos por mes y el total acumulado de cada temporada.', Ventas: 'Sigue las ventas, aportaciones y el beneficio generado.', Compras: 'Registra tus compras, pagos y reembolsos.', 'Informática': 'Organiza trabajos, fechas de entrega e importes.', Nóminas: 'Consulta los pagos mensuales de cada empresa.' } as Record<string, string>)[section] ?? '' }
function tableColumns(section: Section) { if (section === 'Baloncesto') return ['MES', 'AÑO', 'TEMPORADA', 'DINERO INGRESADO']; if (section === 'Ventas') return ['VENTAS', 'COMERCIO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO']; if (section === 'Compras') return ['COMPRAS', 'COMERCIO', 'DINERO PAGADO', 'A MEDIAS', 'REEMBOLSO', 'PRECIO FINAL']; if (section === 'Informática') return ['CLIENTE', 'TRABAJO', 'FECHA DE INICIO', 'FECHA DE FINALIZACIÓN', 'IMPORTE', 'PAGADO']; if (section === 'Nóminas') return ['EMPRESA', 'MES', 'AÑO', 'PAGADO']; return [] }
function renderCell(key: string, value: unknown) { if (key === 'PAGADO') { const normalized = String(value ?? '').trim().toLowerCase(); if (['sí', 'si', 'no'].includes(normalized)) return <span className={`paid-badge ${normalized === 'sí' || normalized === 'si' ? 'paid-yes' : 'paid-no'}`}><span />{normalized === 'no' ? 'Pendiente' : 'Pagado'}</span>; return value == null || value === '' ? '—' : euros(value) } if (['DINERO INGRESADO', 'DINERO GANADO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO', 'DINERO PAGADO', 'REEMBOLSO', 'PRECIO FINAL', 'IMPORTE'].includes(key)) return euros(value); if (key === 'A MEDIAS') return <span className="yes-no">{String(value || 'No')}</span>; return String(value ?? '—') }

function RecordModal({ active, initialRecord, onClose, onSave }: { active: Exclude<Section, 'Dashboard'>; initialRecord: Row | null; onClose: () => void; onSave: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const inputs = fields[active]
  const editing = Boolean(initialRecord)
  const initialPayment = String(initialRecord?.PAGADO ?? '').trim()
  const normalizedPayment = initialPayment.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  const [paymentOption, setPaymentOption] = useState(normalizedPayment === 'si' ? 'Sí' : normalizedPayment === 'no' || !initialPayment ? 'No' : 'Cantidad específica')
  const initialValue = (key: string, type?: string) => {
    const text = String(initialRecord?.[key] ?? '')
    if (type !== 'date' || !text) return text
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
    const spanishDate = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
    if (spanishDate) return `${spanishDate[3]}-${spanishDate[2].padStart(2, '0')}-${spanishDate[1].padStart(2, '0')}`
    return ''
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-head"><div><span className="panel-kicker">{active.toUpperCase()}</span><h2 id="modal-title">{editing ? 'Modificar registro' : 'Nuevo registro'}</h2><p>{editing ? 'Actualiza los datos de este registro.' : 'Se guardará directamente en tu hoja de cálculo.'}</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></header><form onSubmit={onSave}><div className="modal-fields">{inputs.map((field) => {
    if (active === 'Informática' && field.key === 'PAGADO') return <div className="conditional-field-pair" key={field.key}><label>{field.label}<select name="PAGADO" required value={paymentOption} onChange={(event) => setPaymentOption(event.target.value)}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>{paymentOption === 'Cantidad específica' && <label>Cantidad recibida (€)<input name="IMPORTE PAGADO" type="number" min={0} step="0.01" defaultValue={initialRecord ? String(initialRecord.PAGADO ?? '') : ''} required /></label>}</div>
    if (field.type === 'select') return <label key={field.key}>{field.label}<select name={field.key} required defaultValue={initialValue(field.key, field.type)}>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    return <label key={field.key}>{field.label}<input name={field.key} type={field.type ?? 'text'} min={field.type === 'number' ? 0 : undefined} step={field.type === 'number' ? '0.01' : undefined} defaultValue={initialValue(field.key, field.type)} required /></label>
  })}</div><div className="modal-actions"><button type="button" className="button-outline" onClick={onClose}>Cancelar</button><button type="submit" className="button-primary"><Check size={16} /> {editing ? 'Guardar cambios' : 'Guardar registro'}</button></div></form></section></div>
}

function CategoryChooser({ onClose, onChoose }: { onClose: () => void; onChoose: (section: Exclude<Section, 'Dashboard'>) => void }) {
  const categories = sections.filter(({ name }) => name !== 'Dashboard')
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="record-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="category-title"><header className="modal-head"><div><span className="panel-kicker">NUEVO REGISTRO</span><h2 id="category-title">¿Qué quieres registrar?</h2><p>Elige una sección para mostrar el formulario adecuado.</p></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={19} /></button></header><div className="category-grid">{categories.map(({ name, icon: Icon }) => <button key={name} className="category-option" onClick={() => onChoose(name as Exclude<Section, 'Dashboard'>)}><Icon size={18} /><span>{name}</span><ArrowUpRight size={14} /></button>)}</div></section></div>
}
