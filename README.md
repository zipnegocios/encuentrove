# EncuentroVE — Portal Web de Emergencia

Portal público de búsqueda de personas y animales en zonas de desastre natural (caso de uso: Estado Vargas, Venezuela). Permite a familias fuera de la zona de emergencia consultar si sus seres queridos han sido avistados por rescatistas en campo.

## Run & Operate

- `pnpm --filter @workspace/encuentrove-web run dev` — portal web (puerto dinámico)
- `pnpm --filter @workspace/api-server run dev` — API server Express (puerto 5000)
- `pnpm run typecheck` — typecheck completo
- `pnpm run build` — typecheck + build de todos los paquetes
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks y Zod schemas desde OpenAPI

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS v4, shadcn/ui, wouter, framer-motion
- API: Express 5 (Fase 2)
- DB: PostgreSQL + Drizzle ORM (Fase 2)
- Build: esbuild (CJS bundle para api-server)
- Deploy: Docker multi-stage (node:20-alpine → nginx:alpine) → AWS

## Where things live

- `artifacts/encuentrove-web/` — portal web React + Vite (Fase 1)
  - `src/components/brand/` — Logo.tsx e Isotype.tsx (SVG trazados)
  - `src/data/types.ts` — tipos TypeScript del schema PostgreSQL
  - `src/data/mockData.ts` — 35 registros mock (personas y animales)
  - `src/api/index.ts` — capa API stub (Fase 1 mock → Fase 2 HTTP real)
  - `src/pages/` — HomePage, BuscarPage, DetallePage, NotFoundPage
  - `Dockerfile` — multi-stage para AWS
  - `nginx.conf` — SPA routing + gzip + caché
  - `.env.example` — VITE_API_BASE_URL, VITE_S3_BASE_URL
  - `public/downloads/` — APK de Android para descarga temporal desde el Home (ver README.md ahi para reemplazarlo por una nueva version)
- `artifacts/api-server/` — backend Express (preparado para Fase 2)
- `lib/api-spec/openapi.yaml` — contrato API (fuente de verdad)
- `lib/db/src/schema/` — schema Drizzle ORM

## Architecture decisions

- **Fase 1 es 100% frontend**: datos mock en src/data/mockData.ts replican el schema PostgreSQL exacto del plan técnico. La capa src/api/index.ts tiene firmas fijas — en Fase 2 solo se reemplaza el body de cada función con un fetch real.
- **SVGs trazados a mano**: Logo e Isotype son componentes React con paths SVG, no imágenes PNG. Escalables y sin dependencia de archivos externos.
- **Búsqueda con normalización de acentos**: usa NFD normalize + regex para que "maria" encuentre "María" — crucial para nombres venezolanos.
- **Imágenes via S3**: las URL de fotos se construyen con VITE_S3_BASE_URL + url_foto del movimiento. En Fase 1 usan DiceBear como placeholder.
- **Docker AWS-ready**: nginx sirve el build estático con SPA fallback (/index.html para rutas del cliente).

## Product

Portal de consulta pública para la Plataforma de Emergencia EncuentroVE:
- Búsqueda por nombre/apellido (fuzzy, tolerante a acentos) o cédula exacta
- Filtros por tipo (PERSONA/ANIMAL), estado y zona geográfica
- Cards paginadas (12/página) con fotos thumbnail (lazy load)
- Página de detalle con historial completo de movimientos cronológico
- 4 estados visuales: BUSCADO (rojo), LOCALIZADO_BIEN (verde), EN_REFUGIO (azul), NECESITA_ASISTENCIA_MEDICA (naranja)

## User preferences

- Idioma del UI: español venezolano
- Sin emojis en la interfaz
- Sin backend en Fase 1 — solo frontend con datos mock
- Compatible con Docker, despliegue en AWS, imágenes en S3

## Gotchas

- El array `seresConEstado` en mockData.ts usa `Math.random()` — los IDs/estados varían entre execuciones del módulo (pero son estables durante la sesión)
- Al correr `pnpm --filter @workspace/encuentrove-web run build` para Docker, pasar `BASE_PATH=/` como variable de entorno
- En Fase 2: las firmas de searchSeres, getSerById, getZonas, getEstadisticas NO deben cambiar — solo el body
