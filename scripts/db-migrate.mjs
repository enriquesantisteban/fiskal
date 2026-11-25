import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

try { process.loadEnvFile('.env.local') } catch {}
const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.storage_database_url?.trim() || process.env.STORAGE_DATABASE_URL?.trim()
if (!databaseUrl) throw new Error('Falta DATABASE_URL. Descarga las variables de Vercel en .env.local primero.')

const sql = neon(databaseUrl)
const migration = await readFile(new URL('../db/migrations/0001_finance_tables.sql', import.meta.url), 'utf8')
for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) await sql.query(statement)
console.log('Esquema de Fiskal creado correctamente.')
