# SIPEC — Guía de instalación

Esta guía permite instalar y ejecutar la plataforma en un equipo local. Puedes iniciar con la portada pública sin configurar servicios o preparar una instalación con Supabase para utilizar el acceso interno.

## Requisitos

- Node.js 22 o superior y npm.
- Un proyecto [Supabase](https://supabase.com/dashboard) con PostgreSQL, Auth y Storage para utilizar las funciones internas.
- Una copia del repositorio. Ejecuta los comandos desde la carpeta que contiene `package.json`.

## 1. Instalar dependencias

Abre una terminal en la carpeta del repositorio y comprueba las herramientas:

```powershell
node --version
npm --version
```

Instala las versiones fijadas en `package-lock.json` y crea el archivo de configuración sin sobrescribir uno existente:

```powershell
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

### Inicio rápido sin Supabase

Para comprobar la instalación y ver la portada pública, deja las variables de conexión vacías y ejecuta:

```powershell
npm run dev
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000). Este modo no permite acceder a datos internos. Detén el servidor con `Ctrl+C` y continúa con el paso 2 para configurar la instalación completa.

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

| Variable | Valor que debes configurar |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública del mismo proyecto. |
| `SUPABASE_SECRET_KEY` | Clave secreta del proyecto; se utiliza exclusivamente en el servidor. |
| `DATABASE_MIGRATION_URL` | Conexión PostgreSQL administrativa para migraciones y carga inicial. |
| `DATABASE_URL` | Conexión con un usuario restringido miembro de `electoral_app`, preparado en el paso 3; no usar el propietario. |
| `APP_SITE_URL` | Origen de la aplicación; en local, `http://127.0.0.1:3000`. |

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

## 4. Preparar los datos iniciales

Elige según el destino de la instalación:

- **Demostración:** conserva los tres identificadores `APP_*_ID` de `.env.example` y carga los datos sintéticos con los pasos siguientes.
- **Uso real:** prepara los registros de organización, cantón y evento y configura sus identificadores en `.env.local`. Esta guía no incluye un asistente para crear esos registros; deben existir antes de habilitar al administrador.

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

## Solución de problemas

| Problema | Qué revisar |
| --- | --- |
| PowerShell bloquea `npm.ps1` | Usa `npm.cmd` y `npx.cmd` en lugar de `npm` y `npx`. |
| La portada abre pero no puedes usar el acceso interno | Comprueba las variables de Supabase y `DATABASE_URL`; reinicia el servidor después de editar `.env.local`. |
| Fallan las migraciones | Revisa `DATABASE_MIGRATION_URL`, sus permisos y que la base pertenezca a un proyecto con Supabase Auth. |
| No se puede habilitar al administrador | Verifica que el UUID corresponda a un usuario existente en Supabase Auth y que `APP_ORGANIZATION_ID` corresponda a una organización ya creada. |
| Fallan los archivos adjuntos | Ejecuta los tres comandos del paso 6 y comprueba `SUPABASE_SECRET_KEY`. |
| El puerto 3000 está ocupado | Detén el proceso que lo utiliza o ejecuta `npm run dev -- --port 3001`. Si cambias el puerto, actualiza `APP_SITE_URL` y las URL de Auth en Supabase para que coincidan. |
