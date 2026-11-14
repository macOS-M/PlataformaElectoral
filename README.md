# SIPEC — Instalación

## Requisitos

- Node.js 22 o superior y npm.
- Un proyecto [Supabase](https://supabase.com/dashboard) con PostgreSQL, Auth y Storage.
- Una copia del repositorio. Ejecuta los comandos desde la carpeta que contiene `package.json`.

## 1. Instalar dependencias

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

## 2. Configurar Supabase

Completa estas variables en `.env.local` con los datos del mismo proyecto:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
DATABASE_MIGRATION_URL=
DATABASE_URL=
AUTH_IDENTIFIER_SECRET=
APP_SITE_URL=http://127.0.0.1:3000
```

- `DATABASE_MIGRATION_URL`: conexión PostgreSQL administrativa.
- `DATABASE_URL`: conexión con un usuario restringido miembro de `electoral_app`, preparado después de las migraciones; no usar el propietario.
- `AUTH_IDENTIFIER_SECRET`: secreto estable de al menos 32 caracteres. Genéralo con el comando siguiente y copia su salida en la variable:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Conserva los valores de `APP_ORGANIZATION_ID`, `APP_CANTON_ID` y `APP_EVENT_ID` de la plantilla si vas a cargar la demo. Mantén `SOPORTEREAL_ENABLED=false`. No compartas ni publiques `.env.local`.

## 3. Preparar la base de datos

Para un proyecto nuevo de prueba:

```powershell
npm run db:migrate
```

En el editor SQL de Supabase, sustituye la contraseña y ejecuta:

```sql
CREATE ROLE electoral_runtime LOGIN PASSWORD '<CONTRASEÑA_SEGURA>' INHERIT;
GRANT electoral_app TO electoral_runtime;
```

Completa `DATABASE_URL` con ese usuario y su contraseña, respetando el formato de conexión del proyecto y TLS. Mantén el esquema `electoral` fuera de los esquemas expuestos por Data API.

En una base existente, revisa y respalda antes de aplicar migraciones. No cargues la demo sobre datos reales.

## 4. Cargar datos de ejemplo (opcional)

En `.env.local`, cambia temporalmente `ALLOW_DEMO_SEED=true` y ejecuta:

```powershell
npm run db:seed
```

Después vuelve a `ALLOW_DEMO_SEED=false`. La demo crea datos sintéticos, no cuentas de acceso. Para una instalación real, los tres identificadores `APP_*_ID` deben corresponder a registros preparados para esa organización.

## 5. Crear el administrador

Crea y confirma una cuenta con correo y contraseña en **Supabase > Authentication > Users**. Copia su ID y reemplaza `UUID_DEL_USUARIO` en:

```powershell
npm run db:grant-admin -- UUID_DEL_USUARIO
```

La organización debe existir antes de ejecutar el comando. Deshabilita el registro público directo de Supabase; las cuentas posteriores se autorizan desde SIPEC.

En **Authentication > URL Configuration**, configura:

```text
Site URL: http://127.0.0.1:3000
Redirect URL: http://127.0.0.1:3000/auth/callback
```

## 6. Preparar archivos privados

```powershell
npx tsx scripts/setup-center-storage.ts
npx tsx scripts/setup-inventory-storage.ts
npx tsx scripts/setup-vehicle-storage.ts
```

Estos comandos crean o actualizan los espacios privados de Storage del proyecto configurado.

## 7. Ejecutar

```powershell
npm run dev
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000) e ingresa por el acceso interno. Detén el servidor con `Ctrl+C`. Reinícialo después de cambiar `.env.local`.

Para ejecutar una compilación de producción local:

```powershell
npm run build
npm start
```

Estos comandos escuchan en `127.0.0.1`; publicar la aplicación requiere configurar alojamiento, HTTPS y las direcciones de Supabase. La recuperación de contraseñas por correo requiere además preparar el envío de correo en Supabase.

## Comprobaciones opcionales

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright necesita el puerto 3100 libre. Las pruebas aisladas no verifican Supabase Auth ni el correo real.

Si PowerShell bloquea `npm.ps1`, usa `npm.cmd` y `npx.cmd` en lugar de `npm` y `npx`.
