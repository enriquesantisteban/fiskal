# Fiskal

Aplicación privada para consultar y gestionar finanzas personales almacenadas en Google Sheets. Incluye secciones de baloncesto, ventas, compras, informatica y nominas.

## Requisitos

- Node.js compatible con Next.js 16 (20.9 o posterior).
- pnpm 12.3.4.
- Un proyecto de Google Cloud con Google Sheets API y Google OAuth configurados.

## Instalacion

```bash
pnpm install
```

Crea un archivo `.env.local` en la raiz del proyecto con las variables indicadas abajo. Despues, inicia la aplicacion:

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

Para una compilacion de produccion:

```bash
pnpm build
pnpm start
```

## Variables de entorno

```dotenv
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTHORIZED_EMAIL=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_SHEET_ID=
```

- `AUTH_SECRET`: secreto de Auth.js.
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: credenciales del cliente OAuth de Google.
- `AUTHORIZED_EMAIL`: correo verificado autorizado para iniciar sesion.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY`: credenciales de una cuenta de servicio con acceso a la hoja. Si la clave se guarda en una sola linea, representa los saltos de linea como `\n`.
- `GOOGLE_SHEET_ID`: identificador de la hoja de calculo, incluido en su URL.

En la configuracion OAuth de Google, anade como URI de redireccion:

```text
http://localhost:3000/api/auth/callback/google
```

Anade tambien la URI correspondiente al dominio de produccion. Comparte la hoja con `GOOGLE_SERVICE_ACCOUNT_EMAIL` y dale permiso de editor para permitir cambios.

No subas `.env.local` ni compartas sus valores; contienen credenciales privadas.

## Hojas de calculo

La aplicacion busca estas pestañas por nombre. Los encabezados se pueden detectar aunque la tabla no empiece en la primera fila o columna.

| Pestaña | Columnas |
| --- | --- |
| `BALONCESTO` | `MES`, `AÑO`, `TEMPORADA`, `DINERO INGRESADO` |
| `VENTAS` | `VENTAS`, `COMERCIO`, `DINERO APORTADO`, `DINERO RECOGIDO`, `BENEFICIO` |
| `COMPRAS` | `COMPRAS`, `COMERCIO`, `DINERO PAGADO`, `A MEDIAS`, `REEMBOLSO`, `PRECIO FINAL` |
| `INFORMÁTICA` | `CLIENTE`, `TRABAJO`, `FECHA DE INICIO`, `FECHA DE FINALIZACIÓN`, `IMPORTE`, `PAGADO` |
| `NÓMINAS` | `EMPRESA`, `MES`, `AÑO`, `PAGADO` |

Para agregar, editar o eliminar registros, mantén los encabezados de cada tabla contiguos y en el orden indicado. `TEMPORADA` es opcional para leer registros antiguos de baloncesto; los nuevos registros la calculan usando temporadas de septiembre a junio. La fecha de finalizacion en Informatica es opcional.

Los encabezados `BENEFICIO GENERADO` y `GASTO FINAL` tambien se reconocen como equivalentes a `BENEFICIO` y `PRECIO FINAL`, respectivamente.

## Comprobacion de tipos

```bash
pnpm exec tsc --noEmit
```
