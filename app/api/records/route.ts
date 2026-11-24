import { auth } from '@/auth'
import { categories, createRecord, deleteRecords, readRecords, updateRecord, type Category, type FinanceRecord } from '@/lib/db'
import { NextResponse } from 'next/server'

const categorySet = new Set<string>(categories)
const validId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

async function authorized() {
  const session = await auth()
  const allowed = process.env.AUTHORIZED_EMAIL?.trim().toLowerCase()
  return Boolean(session?.user?.email && allowed && session.user.email.trim().toLowerCase() === allowed)
}

function normalizeRecord(category: Category, body: FinanceRecord): FinanceRecord {
  const text = (key: string) => String(body[key] ?? '').trim()
  const amount = (key: string) => {
    const value = Number(body[key] ?? 0)
    if (!Number.isFinite(value) || value < 0) throw new Error(`Importe no válido: ${key}`)
    return value
  }
  if (category === 'basketball') return { MES: text('MES'), AÑO: amount('AÑO'), TEMPORADA: text('TEMPORADA'), 'DINERO INGRESADO': amount('DINERO INGRESADO') }
  if (category === 'payroll') return { EMPRESA: text('EMPRESA'), MES: text('MES'), AÑO: amount('AÑO'), PAGADO: amount('PAGADO') }
  if (category === 'sales') {
    const contributed = amount('DINERO APORTADO')
    const collected = amount('DINERO RECOGIDO')
    return { VENTAS: text('VENTAS'), COMERCIO: text('COMERCIO'), 'DINERO APORTADO': contributed, 'DINERO RECOGIDO': collected, BENEFICIO: collected - contributed }
  }
  if (category === 'purchases') {
    const paid = amount('DINERO PAGADO')
    const refund = amount('REEMBOLSO')
    return { COMPRAS: text('COMPRAS'), COMERCIO: text('COMERCIO'), 'DINERO PAGADO': paid, 'A MEDIAS': text('A MEDIAS'), REEMBOLSO: refund, 'PRECIO FINAL': paid - refund }
  }
  const projectAmount = amount('IMPORTE')
  const paymentChoice = text('PAGADO')
  const paid = paymentChoice === 'Cantidad específica' ? amount('IMPORTE PAGADO') : paymentChoice === 'Sí' ? projectAmount : paymentChoice === 'No' ? 0 : Number(paymentChoice)
  if (!Number.isFinite(paid) || paid < 0 || paid > projectAmount) throw new Error('El importe pagado debe estar entre 0 y el importe total del trabajo.')
  return {
    CLIENTE: text('CLIENTE'), TRABAJO: text('TRABAJO'), 'FECHA DE INICIO': text('FECHA DE INICIO'),
    'FECHA DE FINALIZACIÓN': text('FECHA DE FINALIZACIÓN'), IMPORTE: projectAmount,
    PAGADO: paymentChoice === 'Sí' ? 'Sí' : paymentChoice === 'No' ? 'No' : paid,
  }
}

export async function GET() {
  if (!await authorized()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try { return NextResponse.json(await readRecords()) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron leer los datos.' }, { status: 503 }) }
}

export async function POST(request: Request) {
  if (!await authorized()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const payload = await request.json() as { category?: Category; record?: FinanceRecord }
    if (!payload.category || !categorySet.has(payload.category) || !payload.record || typeof payload.record !== 'object') return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    await createRecord(payload.category, normalizeRecord(payload.category, payload.record))
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el registro.' }, { status: 400 }) }
}

export async function PATCH(request: Request) {
  if (!await authorized()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const payload = await request.json() as { category?: Category; id?: string; record?: FinanceRecord }
    if (!payload.category || !categorySet.has(payload.category) || !validId(payload.id) || !payload.record || typeof payload.record !== 'object') return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    await updateRecord(payload.category, payload.id, normalizeRecord(payload.category, payload.record))
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo modificar el registro.' }, { status: 400 }) }
}

export async function DELETE(request: Request) {
  if (!await authorized()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const payload = await request.json() as { category?: Category; ids?: unknown[] }
    if (!payload.category || !categorySet.has(payload.category) || !Array.isArray(payload.ids) || payload.ids.some((id) => !validId(id))) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    await deleteRecords(payload.category, payload.ids as string[])
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron eliminar los registros.' }, { status: 400 }) }
}
