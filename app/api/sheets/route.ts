import { auth } from '@/auth'
import { appendSheetRecord, deleteSheetRecords, type RecordIdentity, type SheetName, readAllSheets, updateSheetRecord } from '@/lib/sheets'
import { NextResponse } from 'next/server'

<<<<<<< HEAD
const allowed = new Set<SheetName>(['BALONCESTO_HISTÓRICO', 'VENTAS', 'COMPRAS', 'INFORMÁTICA', 'NÓMINAS'])
=======
const allowed = new Set<SheetName>(['BALONCESTO', 'VENTAS', 'COMPRAS', 'INFORMÁTICA', 'NÓMINAS'])
>>>>>>> 62281e44b66a518ab73288ca4e44e8af418b8c53
export async function GET() {
  const session = await auth()
  if (!session?.user?.email || session.user.email.toLowerCase() !== process.env.AUTHORIZED_EMAIL?.trim().toLowerCase()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try { return NextResponse.json(await readAllSheets()) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo leer Google Sheets.' }, { status: 503 }) }
}
async function isAuthorized() {
  const session = await auth()
  return Boolean(session?.user?.email && session.user.email.toLowerCase() === process.env.AUTHORIZED_EMAIL?.trim().toLowerCase())
}

export async function POST(request: Request) {
  if (!await isAuthorized()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const payload = await request.json() as { sheet?: SheetName; record?: Record<string, unknown> }
    if (!payload.sheet || !allowed.has(payload.sheet) || !payload.record || typeof payload.record !== 'object') return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    await appendSheetRecord(payload.sheet, payload.record)
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el registro.' }, { status: 400 }) }
}

export async function PATCH(request: Request) {
  if (!await isAuthorized()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const payload = await request.json() as { sheet?: SheetName; rowNumber?: number; group?: string; record?: Record<string, unknown> }
    if (!payload.sheet || !allowed.has(payload.sheet) || !Number.isInteger(payload.rowNumber) || !payload.record || typeof payload.record !== 'object') return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    await updateSheetRecord(payload.sheet, { rowNumber: payload.rowNumber!, group: payload.group }, payload.record)
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo modificar el registro.' }, { status: 400 }) }
}

export async function DELETE(request: Request) {
  if (!await isAuthorized()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const payload = await request.json() as { sheet?: SheetName; records?: RecordIdentity[] }
    if (!payload.sheet || !allowed.has(payload.sheet) || !Array.isArray(payload.records) || payload.records.some((record) => !record || !Number.isInteger(record.rowNumber) || (record.group !== undefined && typeof record.group !== 'string'))) return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    await deleteSheetRecords(payload.sheet, payload.records)
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudieron eliminar los registros.' }, { status: 400 }) }
}
