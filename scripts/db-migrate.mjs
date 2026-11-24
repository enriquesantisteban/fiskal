import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

try { process.loadEnvFile('.env.local') } catch {}
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Descarga las variables de Vercel en .env.local primero.')

const sql = neon(process.env.DATABASE_URL)
const migration = await readFile(new URL('../db/migrations/0001_finance_records.sql', import.meta.url), 'utf8')
for (const statement of migration.split(';').map((part) => part.trim()).filter(Boolean)) await sql.query(statement)
console.log('Esquema de Fiskal creado correctamente.')
