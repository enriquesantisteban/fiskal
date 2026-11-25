import 'server-only'
import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL?.trim() || process.env.storage_database_url?.trim() || process.env.STORAGE_DATABASE_URL?.trim()
if (!connectionString) throw new Error('Falta DATABASE_URL. Conecta Neon con el proyecto de Vercel y descarga las variables en local.')

export const db = neon(connectionString)

export const categories = ['basketball', 'sales', 'purchases', 'it', 'payroll'] as const
export type Category = (typeof categories)[number]
export type FinanceRecord = Record<string, unknown>
type DbRow = Record<string, unknown> & { id: string; created_at?: string | Date; sort_order?: number }

function mapRow(row: DbRow, category: Category) {
  const base = { _id: String(row.id), _rowNumber: Number(row.sort_order ?? 0) }
  if (category === 'basketball') return { ...base, MES: row.mes, 'AÑO': row.anio, TEMPORADA: row.temporada, 'DINERO INGRESADO': row.dinero_ingresado }
  if (category === 'sales') return { ...base, VENTAS: row.ventas, COMERCIO: row.comercio, 'DINERO APORTADO': row.dinero_aportado, 'DINERO RECOGIDO': row.dinero_recogido, BENEFICIO: row.beneficio, 'FECHA DE REGISTRO': row.created_at }
  if (category === 'purchases') return { ...base, COMPRAS: row.compras, COMERCIO: row.comercio, 'DINERO PAGADO': row.dinero_pagado, 'A MEDIAS': row.a_medias, REEMBOLSO: row.reembolso, 'PRECIO FINAL': row.precio_final, 'FECHA DE REGISTRO': row.created_at }
  if (category === 'it') return { ...base, CLIENTE: row.cliente, TRABAJO: row.trabajo, 'FECHA DE INICIO': row.fecha_inicio, 'FECHA DE FINALIZACIÓN': row.fecha_finalizacion, IMPORTE: row.importe, PAGADO: row.pagado, 'FECHA DE REGISTRO': row.created_at }
  return { ...base, EMPRESA: row.empresa, MES: row.mes, 'AÑO': row.anio, PAGADO: row.pagado }
}

export async function readRecords() {
  const [basketball, sales, purchases, it, payroll] = await Promise.all([
    db`SELECT * FROM baloncesto ORDER BY anio, mes, id`,
    db`SELECT * FROM ventas ORDER BY created_at DESC, id`,
    db`SELECT * FROM compras ORDER BY created_at DESC, id`,
    db`SELECT * FROM informatica ORDER BY created_at DESC, id`,
    db`SELECT * FROM nominas ORDER BY anio, mes, id`,
  ])
  return {
    basketball: basketball.map((row) => mapRow(row as DbRow, 'basketball')),
    sales: sales.map((row) => mapRow(row as DbRow, 'sales')),
    purchases: purchases.map((row) => mapRow(row as DbRow, 'purchases')),
    it: it.map((row) => mapRow(row as DbRow, 'it')),
    payroll: payroll.map((row) => mapRow(row as DbRow, 'payroll')),
  }
}

export async function createRecord(category: Category, data: FinanceRecord) {
  if (category === 'basketball') return db`INSERT INTO baloncesto (mes, anio, temporada, dinero_ingresado) VALUES (${data.MES}, ${data.AÑO}, ${data.TEMPORADA}, ${data['DINERO INGRESADO']})`
  if (category === 'sales') return db`INSERT INTO ventas (ventas, comercio, dinero_aportado, dinero_recogido, beneficio) VALUES (${data.VENTAS}, ${data.COMERCIO}, ${data['DINERO APORTADO']}, ${data['DINERO RECOGIDO']}, ${data.BENEFICIO})`
  if (category === 'purchases') return db`INSERT INTO compras (compras, comercio, dinero_pagado, a_medias, reembolso, precio_final) VALUES (${data.COMPRAS}, ${data.COMERCIO}, ${data['DINERO PAGADO']}, ${data['A MEDIAS']}, ${data.REEMBOLSO}, ${data['PRECIO FINAL']})`
  if (category === 'it') return db`INSERT INTO informatica (cliente, trabajo, fecha_inicio, fecha_finalizacion, importe, pagado) VALUES (${data.CLIENTE}, ${data.TRABAJO}, ${data['FECHA DE INICIO'] || null}, ${data['FECHA DE FINALIZACIÓN'] || null}, ${data.IMPORTE}, ${data.PAGADO})`
  return db`INSERT INTO nominas (empresa, mes, anio, pagado) VALUES (${data.EMPRESA}, ${data.MES}, ${data.AÑO}, ${data.PAGADO})`
}

export async function updateRecord(category: Category, id: string, data: FinanceRecord) {
  let rows
  if (category === 'basketball') rows = await db`UPDATE baloncesto SET mes=${data.MES}, anio=${data.AÑO}, temporada=${data.TEMPORADA}, dinero_ingresado=${data['DINERO INGRESADO']} WHERE id=${id} RETURNING id`
  else if (category === 'sales') rows = await db`UPDATE ventas SET ventas=${data.VENTAS}, comercio=${data.COMERCIO}, dinero_aportado=${data['DINERO APORTADO']}, dinero_recogido=${data['DINERO RECOGIDO']}, beneficio=${data.BENEFICIO}, updated_at=now() WHERE id=${id} RETURNING id`
  else if (category === 'purchases') rows = await db`UPDATE compras SET compras=${data.COMPRAS}, comercio=${data.COMERCIO}, dinero_pagado=${data['DINERO PAGADO']}, a_medias=${data['A MEDIAS']}, reembolso=${data.REEMBOLSO}, precio_final=${data['PRECIO FINAL']}, updated_at=now() WHERE id=${id} RETURNING id`
  else if (category === 'it') rows = await db`UPDATE informatica SET cliente=${data.CLIENTE}, trabajo=${data.TRABAJO}, fecha_inicio=${data['FECHA DE INICIO'] || null}, fecha_finalizacion=${data['FECHA DE FINALIZACIÓN'] || null}, importe=${data.IMPORTE}, pagado=${data.PAGADO}, updated_at=now() WHERE id=${id} RETURNING id`
  else rows = await db`UPDATE nominas SET empresa=${data.EMPRESA}, mes=${data.MES}, anio=${data.AÑO}, pagado=${data.PAGADO} WHERE id=${id} RETURNING id`
  if (!rows.length) throw new Error('El registro ya no existe. Actualiza la página e inténtalo de nuevo.')
}

export async function deleteRecords(category: Category, ids: string[]) {
  if (!ids.length) throw new Error('Selecciona al menos un registro.')
  const uniqueIds = [...new Set(ids)]
  let rows
  if (category === 'basketball') rows = await db`DELETE FROM baloncesto WHERE id = ANY(${uniqueIds}::uuid[]) RETURNING id`
  else if (category === 'sales') rows = await db`DELETE FROM ventas WHERE id = ANY(${uniqueIds}::uuid[]) RETURNING id`
  else if (category === 'purchases') rows = await db`DELETE FROM compras WHERE id = ANY(${uniqueIds}::uuid[]) RETURNING id`
  else if (category === 'it') rows = await db`DELETE FROM informatica WHERE id = ANY(${uniqueIds}::uuid[]) RETURNING id`
  else rows = await db`DELETE FROM nominas WHERE id = ANY(${uniqueIds}::uuid[]) RETURNING id`
  if (rows.length !== uniqueIds.length) throw new Error('Uno de los registros seleccionados ya no existe. Actualiza la página e inténtalo de nuevo.')
}
