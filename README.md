# MamutAdmin

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.2.4.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Ambiente local (Docker)

Para probar sin tocar el Supabase real, el proyecto levanta un Supabase local (Postgres + Auth + Storage + Studio) en Docker con el Supabase CLI.

1. Abre Docker Desktop.
2. `npm run db:start` — la primera vez descarga las imágenes, aplica `supabase/migrations/` y carga `supabase/seed.sql` (datos inventados).
3. En `backend/.env` deja activo el bloque **LOCAL** y comentado el de **PRODUCCIÓN** (para volver a producción, al revés). Reinicia el backend al cambiar.
4. `npm run dev` y entra a http://localhost:4200 con `admin@mammut.local` / `Admin-123456!` o `vendedor1@mammut.local` / `Vendedor-123456!`.

| Comando | Qué hace |
| --- | --- |
| `npm run db:start` / `db:stop` | Levanta / detiene los contenedores |
| `npm run db:reset` | Borra la base local y la recrea con migraciones + seed |
| `npm run db:status` | Muestra URLs y llaves locales |

Studio (ver y editar datos): http://127.0.0.1:54323 · Correos de Auth: http://127.0.0.1:54324

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
