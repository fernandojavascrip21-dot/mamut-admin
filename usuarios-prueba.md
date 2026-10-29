# Usuarios de prueba

Cuentas reales (persistentes en Supabase, no se borran solas) creadas para probar el login y el enrutamiento por rol de `mamut-admin` en local.

## Administrador

- **Correo (campo "Usuario" del login):** `m0-test-admin@mammut.local`
- **Contraseña:** `MamutAdmin2026!`
- **Rol:** `admin` → entra a `/admin`

## Vendedor

- **Correo (campo "Usuario" del login):** `m0-test-vendedor@mammut.local`
- **Contraseña:** `MamutVendedor2026!`
- **Rol:** `vendedor` → entra a `/vendedor`

## Cuentas de Claude (solo Docker local)

Creadas el 2026-10-28 por Claude Code en el Supabase **local** (`npm run db:start`, base `127.0.0.1:54322`) con el mismo flujo del backend (`createAccount` en `backend/src/accounts/accounts.ts`: Auth + `profiles`). No existen en producción. `npm run db:reset` las borra, porque no están en `supabase/seed.sql`.

### Administrador

- **Correo (campo "Usuario" del login):** `claude-admin@mammut.local`
- **Contraseña:** `ClaudeAdmin-UvsY7G6o9!`
- **Nombre:** Claude Prueba Admin
- **Rol:** `admin` → entra a `/admin`

### Vendedor

- **Correo (campo "Usuario" del login):** `claude-vendedor@mammut.local`
- **Contraseña:** `ClaudeVendedor-X0tvYExm9!`
- **Nombre:** Claude Prueba Vendedor
- **Rol:** `vendedor` → entra a `/vendedor`

## Notas

- El campo "Usuario" del formulario de login en realidad envía el correo (`email`), no hay un campo de username separado.
- Para que el login funcione: backend corriendo (`cd backend && npm run dev`, puerto 3000) y frontend corriendo (`npm start`, puerto 4200).
- Son cuentas reales en la base de Supabase del proyecto, no efímeras como las de los tests automáticos (esas se crean y se borran solas en cada corrida). Bórralas a mano cuando ya no las necesites.
- No hay todavía una pantalla ni endpoint para crear vendedores desde la app (eso es RF-31, milestone M2); esta cuenta de vendedor se creó directo contra Supabase con un script puntual.
