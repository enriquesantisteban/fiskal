# Fiskal

Aplicación privada de finanzas personales. Guarda los datos en cinco tablas PostgreSQL de Neon: `baloncesto`, `ventas`, `compras`, `informatica` y `nominas`.

## Desarrollo local

Requisitos: Node.js 20.9 o posterior y pnpm 12.3.4.

```bash
pnpm install
```

Crea `.env.local` en la raíz con las variables de autenticación y la conexión a Neon:

```dotenv
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTHORIZED_EMAIL=
DATABASE_URL=
```

`DATABASE_URL` también puede llamarse `storage_database_url` o `STORAGE_DATABASE_URL`. Inicia la aplicación con:

```bash
pnpm dev
```

## Base de datos

Las tablas se pueden crear con `pnpm db:migrate` o ejecutando `db/migrations/0001_finance_tables.sql` en el SQL Editor de Neon. La migración usa `CREATE TABLE IF NOT EXISTS`, por lo que no borra tablas existentes.

Ventas, compras e informática guardan automáticamente `created_at` y `updated_at`. La aplicación muestra `created_at` como fecha de registro; informática conserva además sus fechas de inicio y finalización.

La aplicación requiere que el proyecto de Vercel tenga configuradas `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `AUTHORIZED_EMAIL`. Google se usa para iniciar sesión; ya no se requieren credenciales de Google Sheets.

No compartas ni subas `.env.local`; contiene secretos y está excluido de Git.
