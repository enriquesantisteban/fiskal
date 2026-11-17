import 'server-only'
import { google } from 'googleapis'

const sheetNames = ['BALONCESTO', 'VENTAS', 'COMPRAS', 'INFORMÁTICA', 'NÓMINAS'] as const
export type SheetName = (typeof sheetNames)[number]

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const spreadsheetId = process.env.GOOGLE_SHEET_ID
  if (!email || !privateKey || !spreadsheetId) throw new Error('Google Sheets no está configurado. Añade las variables de servicio del proyecto.')
  const auth = new google.auth.GoogleAuth({ credentials: { client_email: email, private_key: privateKey }, scopes: ['https://www.googleapis.com/auth/spreadsheets'] })
  return { api: google.sheets({ version: 'v4', auth }), spreadsheetId }
}

const headers: Record<Exclude<SheetName, 'BALONCESTO' | 'NÓMINAS'>, string[]> = {
  VENTAS: ['VENTAS', 'COMERCIO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO'],
  COMPRAS: ['COMPRAS', 'COMERCIO', 'DINERO PAGADO', 'A MEDIAS', 'REEMBOLSO', 'PRECIO FINAL'],
  'INFORMÁTICA': ['CLIENTE', 'TRABAJO', 'FECHA DE INICIO', 'FECHA DE FINALIZACIÓN', 'IMPORTE', 'PAGADO'],
}
const column = (index: number) => { let n = index + 1; let out = ''; while (n) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26) } return out }
const cell = (value: unknown) => String(value ?? '').trim().toLocaleUpperCase('es')

export async function readAllSheets() {
  const { api, spreadsheetId } = sheetsClient()
  const response = await api.spreadsheets.values.batchGet({ spreadsheetId, ranges: sheetNames.map((name) => `'${name}'!A1:Z1000`) })
  const values = response.data.valueRanges ?? []
  const rows = (index: number) => values[index]?.values ?? []
  const table = (allRows: unknown[][], expected: string[], startColumn = 0) => {
    const headRow = allRows.findIndex((row) => expected.every((header, i) => cell(row[startColumn + i]) === header))
    if (headRow < 0) return []
    return allRows.slice(headRow + 1).filter((row) => row.slice(startColumn, startColumn + expected.length).some((v) => String(v ?? '').trim() !== '')).map((row) => Object.fromEntries(expected.map((header, i) => [header, row[startColumn + i] ?? ''])))
  }
  const basketball = rows(0)
  const payroll = rows(4)
  const payrollCompanies: { company: string; rows: Record<string, unknown>[] }[] = []
  const maxColumns = Math.max(0, ...payroll.map((r) => r.length))
  for (let c = 0; c < maxColumns; c++) {
    const nameRow = payroll.findIndex((row, i) => cell(row[c]) && cell(payroll[i + 1]?.[c]) === 'MES' && cell(payroll[i + 1]?.[c + 1]) === 'PAGADO')
    if (nameRow >= 0) payrollCompanies.push({ company: cell(payroll[nameRow][c]), rows: table(payroll, ['MES', 'PAGADO'], c) })
  }
  return {
    basketballMonthly: table(basketball, ['MESES', 'DINERO INGRESADO']),
    basketballSeasons: table(basketball, ['TEMPORADA', 'DINERO GANADO'], 3),
    sales: table(rows(1), headers.VENTAS), purchases: table(rows(2), headers.COMPRAS),
    it: table(rows(3), headers['INFORMÁTICA']), payroll: payrollCompanies,
  }
}

export async function appendSheetRecord(sheet: SheetName, body: Record<string, unknown>) {
  const { api, spreadsheetId } = sheetsClient()
  const text = (key: string) => String(body[key] ?? '').trim()
  const amount = (key: string) => { const v = Number(body[key] ?? 0); if (!Number.isFinite(v) || v < 0) throw new Error(`Importe no válido: ${key}`); return v }
  let range: string
  let values: unknown[]
  if (sheet === 'BALONCESTO') {
    const kind = text('kind')
    if (kind === 'monthly') { range = `'BALONCESTO'!A:B`; values = [text('MESES'), amount('DINERO INGRESADO')] }
    else if (kind === 'season') { range = `'BALONCESTO'!D:E`; values = [text('TEMPORADA'), amount('DINERO GANADO')] }
    else throw new Error('Selecciona un bloque válido de Baloncesto.')
  } else if (sheet === 'NÓMINAS') {
    const company = text('company')
    const { data } = await api.spreadsheets.values.get({ spreadsheetId, range: "'NÓMINAS'!A1:Z1000" })
    const grid = data.values ?? []
    let start = -1
    for (let c = 0; c < Math.max(0, ...grid.map((r) => r.length)); c++) if (grid.some((r, i) => cell(r[c]) === cell(company) && cell(grid[i + 1]?.[c]) === 'MES' && cell(grid[i + 1]?.[c + 1]) === 'PAGADO')) { start = c; break }
    if (start < 0) throw new Error('No se encontró la empresa seleccionada en la pestaña NÓMINAS.')
    range = `'NÓMINAS'!${column(start)}:${column(start + 1)}`; values = [text('MES'), amount('PAGADO')]
  } else if (sheet === 'VENTAS') {
    const contributed = amount('DINERO APORTADO'); const collected = amount('DINERO RECOGIDO')
    range = "'VENTAS'!A:E"; values = [text('VENTAS'), text('COMERCIO'), contributed, collected, collected - contributed]
  } else if (sheet === 'COMPRAS') {
    const paid = amount('DINERO PAGADO'); const refund = amount('REEMBOLSO'); const half = text('A MEDIAS') === 'Sí'
    range = "'COMPRAS'!A:F"; values = [text('COMPRAS'), text('COMERCIO'), paid, half ? 'Sí' : 'No', refund, paid - refund]
  } else {
    range = "'INFORMÁTICA'!A:F"; values = ['CLIENTE', 'TRABAJO', 'FECHA DE INICIO', 'FECHA DE FINALIZACIÓN', 'IMPORTE', 'PAGADO'].map((key) => key === 'IMPORTE' ? amount(key) : text(key))
  }
  await api.spreadsheets.values.append({ spreadsheetId, range, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [values] } })
}
