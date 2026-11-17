import { auth } from '@/auth'
import { appendSheetRecord, type SheetName, readAllSheets } from '@/lib/sheets'
import { NextResponse } from 'next/server'

const allowed = new Set<SheetName>(['BALONCESTO', 'VENTAS', 'COMPRAS', 'INFORMÁTICA', 'NÓMINAS'])
export async function GET() {
  const session = await auth()
  if (!session?.user?.email || session.user.email.toLowerCase() !== process.env.AUTHORIZED_EMAIL?.trim().toLowerCase()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try { return NextResponse.json(await readAllSheets()) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo leer Google Sheets.' }, { status: 503 }) }
}
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email || session.user.email.toLowerCase() !== process.env.AUTHORIZED_EMAIL?.trim().toLowerCase()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const payload = await request.json() as { sheet?: SheetName; record?: Record<string, unknown> }
    if (!payload.sheet || !allowed.has(payload.sheet) || !payload.record || typeof payload.record !== 'object') return NextResponse.json({ error: 'Solicitud no válida.' }, { status: 400 })
    await appendSheetRecord(payload.sheet, payload.record)
    return NextResponse.json({ ok: true })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el registro.' }, { status: 400 }) }
}
