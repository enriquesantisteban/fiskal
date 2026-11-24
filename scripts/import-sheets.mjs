import { google } from 'googleapis'
import { neon } from '@neondatabase/serverless'
import { resolve } from 'node:path'

try { process.loadEnvFile('.env.local') } catch {}
const DATABASE_URL = process.env.DATABASE_URL?.trim() || process.env.storage_database_url?.trim() || process.env.STORAGE_DATABASE_URL?.trim()
const { GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID } = process.env
if (!DATABASE_URL) throw new Error('Falta DATABASE_URL en .env.local.')
if (!GOOGLE_SHEET_ID) throw new Error('Falta GOOGLE_SHEET_ID en .env.local.')
if (!GOOGLE_APPLICATION_CREDENTIALS && (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY)) throw new Error('Añade GOOGLE_APPLICATION_CREDENTIALS con la ruta a un JSON de cuenta de servicio, o configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY.')

const sheetNames = ['BALONCESTO', 'VENTAS', 'COMPRAS', 'INFORMÁTICA', 'NÓMINAS']
const expected = [
  ['MES', 'AÑO', 'TEMPORADA', 'DINERO INGRESADO'],
  ['VENTAS', 'COMERCIO', 'DINERO APORTADO', 'DINERO RECOGIDO', 'BENEFICIO'],
  ['COMPRAS', 'COMERCIO', 'DINERO PAGADO', 'A MEDIAS', 'REEMBOLSO', 'PRECIO FINAL'],
  ['CLIENTE', 'TRABAJO', 'FECHA DE INICIO', 'FECHA DE FINALIZACIÓN', 'IMPORTE', 'PAGADO'],
  ['EMPRESA', 'MES', 'AÑO', 'PAGADO'],
]
const categories = ['basketball', 'sales', 'purchases', 'it', 'payroll']
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es')
const aliases = { BENEFICIO: ['BENEFICIO GENERADO'], 'PRECIO FINAL': ['GASTO FINAL'] }
const matches = (value, name) => normalize(value) === normalize(name) || (aliases[name] ?? []).some((alias) => normalize(value) === normalize(alias))

const auth = GOOGLE_APPLICATION_CREDENTIALS
  ? new google.auth.GoogleAuth({ keyFile: resolve(GOOGLE_APPLICATION_CREDENTIALS), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
  : new google.auth.GoogleAuth({ credentials: { client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') }, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
const sheets = google.sheets({ version: 'v4', auth })
const response = await sheets.spreadsheets.values.batchGet({ spreadsheetId: GOOGLE_SHEET_ID, ranges: sheetNames.map((name) => `'${name}'!A1:Z1000`) })
const values = response.data.valueRanges ?? []
const sql = neon(DATABASE_URL)
let imported = 0
let skipped = 0

for (let tab = 0; tab < sheetNames.length; tab++) {
  const grid = values[tab]?.values ?? []
  const required = expected[tab]
  const headerRow = grid.findIndex((row) => required.filter((name) => name !== 'TEMPORADA').every((name) => row.some((value) => matches(value, name))))
  if (headerRow < 0) throw new Error(`No se encontró la cabecera de ${sheetNames[tab]}; no se importó ninguna fila de esa pestaña.`)
  const header = grid[headerRow]
  const indexes = required.map((name) => header.findIndex((value) => matches(value, name)))
  const dataRows = grid.slice(headerRow + 1).map((row, offset) => ({ row, rowNumber: headerRow + offset + 2 }))
  for (const { row, rowNumber } of dataRows) {
    const nonempty = indexes.some((index) => index >= 0 && String(row[index] ?? '').trim() !== '')
    if (!nonempty || normalize(row[indexes[0]]).startsWith('TOTAL')) continue
    const data = Object.fromEntries(required.map((name, index) => [name, indexes[index] >= 0 ? row[indexes[index]] ?? '' : '']))
    const key = `${sheetNames[tab]}:${rowNumber}`
    const result = await sql`INSERT INTO finance_records (category, data, sort_order, legacy_key) VALUES (${categories[tab]}, ${JSON.stringify(data)}::jsonb, ${rowNumber}, ${key}) ON CONFLICT (category, legacy_key) DO NOTHING RETURNING id`
    if (result.length) imported++
    else skipped++
  }
  console.log(`${sheetNames[tab]}: pestaña leída.`)
}

console.log(`Importación terminada: ${imported} registros nuevos; ${skipped} ya estaban importados.`)
