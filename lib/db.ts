import 'server-only'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL?.trim() || process.env.storage_database_url?.trim() || process.env.STORAGE_DATABASE_URL?.trim()
if (!connectionString) throw new Error('Falta DATABASE_URL. Conecta Neon con el proyecto de Vercel y descarga las variables en local.')

export const db = neon(connectionString)

export const categories = ['basketball', 'sales', 'purchases', 'it', 'payroll'] as const
export type Category = (typeof categories)[number]
export type FinanceRecord = Record<string, unknown>

export async function readRecords() {
  const rows = await db`SELECT id, category, data, sort_order FROM finance_records ORDER BY category, sort_order, created_at`
  const result: Record<Category, (FinanceRecord & { _id: string; _rowNumber: number })[]> = {
    basketball: [], sales: [], purchases: [], it: [], payroll: [],
  }
  for (const row of rows) {
    const category = row.category as Category
    result[category].push({ ...(row.data as FinanceRecord), _id: String(row.id), _rowNumber: Number(row.sort_order) })
  }
  return {
    basketball: result.basketball,
    sales: result.sales,
    purchases: result.purchases,
    it: result.it,
    payroll: result.payroll,
  }
}

export async function createRecord(category: Category, data: FinanceRecord) {
  const order = await db`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM finance_records WHERE category = ${category}`
  const sortOrder = Number(order[0]?.next_order ?? 1)
  await db`INSERT INTO finance_records (category, data, sort_order) VALUES (${category}, ${JSON.stringify(data)}::jsonb, ${sortOrder})`
}

export async function updateRecord(category: Category, id: string, data: FinanceRecord) {
  const rows = await db`UPDATE finance_records SET data = ${JSON.stringify(data)}::jsonb, updated_at = now() WHERE id = ${id} AND category = ${category} RETURNING id`
  if (!rows.length) throw new Error('El registro ya no existe. Actualiza la página e inténtalo de nuevo.')
}

export async function deleteRecords(category: Category, ids: string[]) {
  if (!ids.length) throw new Error('Selecciona al menos un registro.')
  const uniqueIds = [...new Set(ids)]
  const rows = await db`DELETE FROM finance_records WHERE category = ${category} AND id = ANY(${uniqueIds}::uuid[]) RETURNING id`
  if (rows.length !== uniqueIds.length) throw new Error('Uno de los registros seleccionados ya no existe. Actualiza la página e inténtalo de nuevo.')
}
