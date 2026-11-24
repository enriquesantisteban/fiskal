# Fiskal

Aplicación privada de finanzas personales. Guarda baloncesto, ventas, compras, informática y nóminas en PostgreSQL de Neon, conectado al proyecto de Vercel.

## Requisitos

- Node.js 20.9 o posterior.
- pnpm 12.3.4.
- Un proyecto de Neon conectado al proyecto de Vercel.
- Las credenciales de Google Sheets solo son necesarias para importar los datos actuales una vez.

## Desarrollo local

```bash
pnpm install
```

Crea `.env.local` en la raíz del proyecto con las variables de Auth.js, Google OAuth, el correo autorizado y `DATABASE_URL`. Para importar los datos actuales, añade temporalmente también `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` y `GOOGLE_SHEET_ID`.

```bash
pnpm dev
```

## Configuración de Vercel y Neon

1. En Vercel, abre el proyecto `fiskal-enrique` y conecta la base `neon-fiskal-enrique` desde **Storage / Marketplace**.
2. Comprueba que Vercel haya añadido `DATABASE_URL` a los entornos Development, Preview y Production.
3. Conserva temporalmente las variables de Sheets en Vercel hasta completar la importación.
4. Descarga las variables del proyecto para el entorno local con Vercel CLI. Si aún no has enlazado el repositorio local, ejecuta primero `vercel link` y elige `fiskal-enrique`.

```bash
vercel env pull .env.local
```

No compartas ni subas `.env.local`; contiene secretos y está excluido de Git.

## Crear las tablas e importar los datos actuales

Desde la raíz del proyecto, con `DATABASE_URL` y las tres variables de Sheets en `.env.local`:

```bash
pnpm db:migrate
pnpm db:import-sheets
```

La importación conserva los registros de las cinco pestañas y se puede repetir sin duplicar filas ya importadas. La cuenta de servicio de Google solo necesita permiso de lectura durante la migración.

Comprueba el resultado en el SQL Editor de Neon:

```sql
SELECT category, count(*)
FROM finance_records
GROUP BY category
ORDER BY category;
```

Cuando hayas comprobado los datos en la aplicación y las cantidades coincidan, elimina de Vercel las variables `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` y `GOOGLE_SHEET_ID`. La app ya no las necesita para funcionar. Mantén las variables de Google OAuth y `AUTHORIZED_EMAIL` para conservar el inicio de sesión privado.

## Variables de entorno

```dotenv
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTHORIZED_EMAIL=
DATABASE_URL=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
```

Las últimas tres variables se usan únicamente en la importación inicial. En producción la aplicación necesita `DATABASE_URL` y las variables de autenticación.

En la configuración OAuth de Google, la URI de redirección de producción es:

```text
https://fiskal-enrique.vercel.app/api/auth/callback/google
```

Para una compilación de producción:

```bash
pnpm build
pnpm start
```
