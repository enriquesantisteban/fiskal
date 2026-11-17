import 'server-only'
import { google } from 'googleapis'

const sheetNames = ['BALONCESTO_HISTÓRICO', 'VENTAS', 'COMPRAS', 'INFORMÁTICA', 'NÓMINAS'] as const
export type SheetName = (typeof sheetNames)[number]
type SheetRow = Record<string, unknown> & { _rowNumber: number; _group?: string }
export type RecordIdentity = { rowNumber: number; group?: string }

type TableLocation = { headerRow: number; startColumn: number; width: number; totalRow: number | null }

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!email || !privateKey || !spreadsheetId) throw new Error('Google Sheets no está configurado. Añade las variables de servicio del proyecto.')
  const auth = new google.auth.GoogleAuth({ credentials: { client_email: email, private_key: privateKey }, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
  return { api: google.sheets({ version: 'v4', auth }), spreadsheetId }
}

const headers: Record<Exclude<SheetName, 'BALONCESTO_HISTÓRICO' | 'NÓMINAS'>, string[]> = {
  VENTAS: ['VENTAS', 'COMERCIO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO'],
  COMPRAS: ['COMPRAS', 'COMERCIO', 'DINERO PAGADO', 'A MEDIAS', 'REEMBOLSO', 'PRECIO FINAL'],
  'INFORMÁTICA': ['CLIENTE', 'TRABAJO', 'FECHA DE INICIO', 'FECHA DE FINALIZACIÓN', 'IMPORTE', 'PAGADO'],
}
const column = (index: number) => { let n = index + 1; let out = ''; while (n) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26) } return out }
const cell = (value: unknown) => String(value ?? '').trim().toLocaleUpperCase('es')
const isTotalRow = (row: unknown[], startColumn: number) => cell(row[startColumn]).startsWith('TOTAL')
const hasValues = (row: unknown[], startColumn: number, width: number) => row.slice(startColumn, startColumn + width).some((value) => String(value ?? '').trim() !== '')

function table(allRows: unknown[][], expected: string[], startColumn = 0, group?: string): SheetRow[] {
  const headerRow = allRows.findIndex((row) => expected.every((header, i) => cell(row[startColumn + i]) === header))
  if (headerRow < 0) return []
  return allRows.slice(headerRow + 1).map((row, index) => ({ row, rowNumber: headerRow + index + 2 })).filter(({ row }) => hasValues(row, startColumn, expected.length) && !isTotalRow(row, startColumn)).map(({ row, rowNumber }) => ({
    ...Object.fromEntries(expected.map((header, i) => [header, row[startColumn + i] ?? ''])),
    _rowNumber: rowNumber,
    ...(group ? { _group: group } : {}),
  }))
}

async function getGrid(sheet: SheetName) {
  const { api, spreadsheetId } = sheetsClient()
  const { data } = await api.spreadsheets.values.get({ spreadsheetId, range: `'${sheet}'!A1:Z1000` })
  return data.values ?? []
}

function locateTable(grid: unknown[][], expected: string[], startColumn = 0): TableLocation {
  const headerRow = grid.findIndex((row) => expected.every((header, i) => cell(row[startColumn + i]) === header))
  if (headerRow < 0) throw new Error(`No se encontró la cabecera ${expected.join(' · ')}.`)
  const totalRow = grid.findIndex((row, index) => index > headerRow && isTotalRow(row, startColumn))
  return { headerRow, startColumn, width: expected.length, totalRow: totalRow < 0 ? null : totalRow }
}

function tableDefinition(sheet: SheetName, body: Record<string, unknown>) {
  const text = (key: string) => String(body[key] ?? '').trim()
  const amount = (key: string) => { const value = Number(body[key] ?? 0); if (!Number.isFinite(value) || value < 0) throw new Error(`Importe no válido: ${key}`); return value }
  if (sheet === 'BALONCESTO_HISTÓRICO') return { expected: ['MES', 'AÑO', 'DINERO INGRESADO'], startColumn: 0, values: [text('MES'), amount('AÑO'), amount('DINERO INGRESADO')] }
  if (sheet === 'NÓMINAS') return { expected: ['EMPRESA', 'MES', 'AÑO', 'PAGADO'], startColumn: 0, values: [text('EMPRESA'), text('MES'), amount('AÑO'), amount('PAGADO')] }
  if (sheet === 'VENTAS') {
    const contributed = amount('DINERO APORTADO')
    const collected = amount('DINERO RECOGIDO')
    return { expected: headers.VENTAS, startColumn: 0, values: [text('VENTAS'), text('COMERCIO'), contributed, collected, collected - contributed] }
  }
  if (sheet === 'COMPRAS') {
    const paid = amount('DINERO PAGADO')
    const refund = amount('REEMBOLSO')
    return { expected: headers.COMPRAS, startColumn: 0, values: [text('COMPRAS'), text('COMERCIO'), paid, text('A MEDIAS'), refund, paid - refund] }
  }
  const projectAmount = amount('IMPORTE')
  const paymentChoice = text('PAGADO')
  const paidAmount = paymentChoice === 'Cantidad específica' ? amount('IMPORTE PAGADO') : paymentChoice === 'Sí' ? projectAmount : paymentChoice === 'No' ? 0 : Number(paymentChoice)
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > projectAmount) throw new Error('El importe pagado debe estar entre 0 y el importe total del trabajo.')
  return { expected: headers['INFORMÁTICA'], startColumn: 0, values: [text('CLIENTE'), text('TRABAJO'), text('FECHA DE INICIO'), text('FECHA DE FINALIZACIÓN'), projectAmount, paymentChoice === 'Sí' ? 'Sí' : paymentChoice === 'No' ? 'No' : paidAmount] }
}

function recordsForSheet(sheet: SheetName, data: Awaited<ReturnType<typeof readAllSheets>>): SheetRow[] {
  if (sheet === 'BALONCESTO_HISTÓRICO') return data.basketballMonthly
  if (sheet === 'NÓMINAS') return data.payroll
  if (sheet === 'VENTAS') return data.sales
  if (sheet === 'COMPRAS') return data.purchases
  return data.it
}

export async function readAllSheets() {
  const { api, spreadsheetId } = sheetsClient()
  const response = await api.spreadsheets.values.batchGet({ spreadsheetId, ranges: sheetNames.map((name) => `'${name}'!A1:Z1000`) })
  const values = response.data.valueRanges ?? []
  const rows = (index: number) => values[index]?.values ?? []
  return {
    basketballMonthly: table(rows(0), ['MES', 'AÑO', 'DINERO INGRESADO']),
    sales: table(rows(1), headers.VENTAS),
    purchases: table(rows(2), headers.COMPRAS),
    it: table(rows(3), headers['INFORMÁTICA']),
    payroll: table(rows(4), ['EMPRESA', 'MES', 'AÑO', 'PAGADO']),
  }
}

async function writeAtLocation(sheet: SheetName, location: TableLocation, values: unknown[]) {
  const { api, spreadsheetId } = sheetsClient()
  if (location.totalRow !== null) {
    const spreadsheet = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' })
    const sheetId = spreadsheet.data.sheets?.find((entry) => entry.properties?.title === sheet)?.properties?.sheetId
    if (sheetId === undefined) throw new Error(`No se encontró la pestaña ${sheet}.`)
    await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ insertDimension: { range: { sheetId, dimension: 'ROWS', startIndex: location.totalRow, endIndex: location.totalRow + 1 }, inheritFromBefore: true } }] } })
    const targetRow = location.totalRow + 1
    const start = column(location.startColumn)
    const end = column(location.startColumn + location.width - 1)
    await api.spreadsheets.values.update({ spreadsheetId, range: `'${sheet}'!${start}${targetRow}:${end}${targetRow}`, valueInputOption: 'RAW', requestBody: { values: [values] } })
    return
  }
  const start = column(location.startColumn)
  const end = column(location.startColumn + location.width - 1)
  await api.spreadsheets.values.append({ spreadsheetId, range: `'${sheet}'!${start}:${end}`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [values] } })
}

async function locationFor(sheet: SheetName, definition: ReturnType<typeof tableDefinition>) {
  const grid = await getGrid(sheet)
  return locateTable(grid, definition.expected, definition.startColumn)
}

export async function appendSheetRecord(sheet: SheetName, body: Record<string, unknown>) {
  const definition = tableDefinition(sheet, body)
  await writeAtLocation(sheet, await locationFor(sheet, definition), definition.values)
}

export async function updateSheetRecord(sheet: SheetName, identity: RecordIdentity, body: Record<string, unknown>) {
  const data = await readAllSheets()
  const record = recordsForSheet(sheet, data).find((row) => row._rowNumber === identity.rowNumber && (!identity.group || row._group === identity.group))
  if (!record) throw new Error('El registro ya no existe o no pertenece a esta tabla. Actualiza la página e inténtalo de nuevo.')
  const definition = tableDefinition(sheet, body)
  const location = await locationFor(sheet, definition)
  if (identity.rowNumber <= location.headerRow + 1 || (location.totalRow !== null && identity.rowNumber >= location.totalRow + 1)) throw new Error('No se puede modificar una fila de cabecera o de total.')
  const { api, spreadsheetId } = sheetsClient()
  const start = column(location.startColumn)
  const end = column(location.startColumn + location.width - 1)
  await api.spreadsheets.values.update({ spreadsheetId, range: `'${sheet}'!${start}${identity.rowNumber}:${end}${identity.rowNumber}`, valueInputOption: 'RAW', requestBody: { values: [definition.values] } })
}

export async function deleteSheetRecords(sheet: SheetName, identities: RecordIdentity[]) {
  if (!identities.length) throw new Error('Selecciona al menos un registro.')
  const data = await readAllSheets()
  const records = recordsForSheet(sheet, data)
  const unique = new Map(identities.map((identity) => [`${identity.group ?? ''}:${identity.rowNumber}`, identity]))
  for (const identity of unique.values()) {
    const record = records.find((row) => row._rowNumber === identity.rowNumber && (!identity.group || row._group === identity.group))
    if (!record) throw new Error('Uno de los registros seleccionados ya no existe. Actualiza la página e inténtalo de nuevo.')
  }
  const groups = new Map<string, RecordIdentity[]>()
  for (const identity of unique.values()) {
    const key = identity.group ?? ''
    groups.set(key, [...(groups.get(key) ?? []), identity])
  }
  const { api, spreadsheetId } = sheetsClient()
  for (const [group, groupIdentities] of groups) {
    const sample = records.find((row) => row._rowNumber === groupIdentities[0].rowNumber && (!group || row._group === group))
    if (!sample) throw new Error('No se encontró la tabla del registro seleccionado.')
    const definition = tableDefinition(sheet, {})
    const location = await locationFor(sheet, definition)
    const width = location.width
    const start = column(location.startColumn)
    const end = column(location.startColumn + width - 1)
    await api.spreadsheets.values.batchClear({ spreadsheetId, requestBody: { ranges: groupIdentities.map(({ rowNumber }) => `'${sheet}'!${start}${rowNumber}:${end}${rowNumber}`) } })
  }
}
