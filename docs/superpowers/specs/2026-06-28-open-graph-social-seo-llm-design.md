# Open Graph dinámico, Social Sharing, SEO y LLM Discover

## Context

EncuentroVE es un portal público de búsqueda de personas y animales en zonas de emergencia (Estado Vargas, Venezuela). Hoy el sitio (`artifacts/encuentrove-web`, SPA React+Vite servido por nginx, sin SSR) tiene un Open Graph **estático y genérico**: el mismo título, descripción e imagen (`opengraph.jpg`, banner de marca) aparecen sin importar qué página se comparta — incluyendo las páginas de detalle de una persona específica (`/ser/:id`).

Esto importa porque el caso de uso central de la app es compartir el link de una persona/animal desaparecido para pedir ayuda a encontrarlo. Una vista previa genérica ("EncuentroVE — Portal de Emergencia") no comunica nada útil en ese momento; una vista previa con la foto y el nombre de esa persona sí. El objetivo de este trabajo es que compartir `/ser/:id` en WhatsApp, Facebook, Telegram, etc. muestre la foto y el nombre reales de esa persona, además de cubrir lo básico de SEO (`sitemap.xml`) y discoverability para LLMs (`llms.txt`).

No existe hoy: `sitemap.xml`, `llms.txt`, `og:url`/`canonical`, ni ningún mecanismo de meta tags por página (el SPA no tiene SSR, así que cualquier dato dinámico inyectado vía JS es invisible para los bots de redes sociales, que no ejecutan JavaScript).

## Decisiones confirmadas con el usuario

- **OG dinámico por persona** para `/ser/:id` (no solo el banner genérico) — es la prioridad del trabajo.
- **Dominio de producción**: `https://encuentrove.online`.
- **LLM Discover**: solo `llms.txt` (se preguntó explícitamente por JSON-LD y reglas de robots.txt por bot de IA — el usuario no las pidió).
- **SEO**: solo `sitemap.xml` (se preguntó explícitamente por JSON-LD, meta title/description por página, y robots.txt explícito por bot — el usuario no los pidió).

## Arquitectura

El frontend es un SPA sin SSR. Los bots de previsualización social (Facebook, WhatsApp, Telegram, Twitter, etc.) no ejecutan JavaScript — solo leen el HTML que el servidor devuelve en la primera respuesta. Para servir OG distinto por persona sin migrar a SSR completo, se detecta el bot en nginx por `User-Agent` y se le redirige a una ruta del `api-server` que renderiza un HTML mínimo con los datos reales de esa persona. Los usuarios reales siguen recibiendo el SPA normal.

```
Bot social  → nginx (map por User-Agent) → api-server GET /api/og/ser/:id → HTML con OG real
Usuario/SPA → nginx                       → index.html + JS (sin cambios)
```

El `api-server` ya proxea `/api/v1/*` al backend Java y no tiene endpoint propio para "una sola persona" — el backend Java tampoco lo tiene (el frontend ya resuelve esto pidiendo el feed completo y filtrando por id/cédula en `src/api/index.ts:getSerById`). La nueva ruta reutiliza ese mismo patrón, ya implementado en `artifacts/api-server/src/routes/watches.ts` (`fetchFeedItems`/`buildStateMap`).

## Componentes

### 1. `lib` compartido en api-server: caché del feed

Hoy `watches.ts` pide el feed completo al backend Java (`PERSONA` + `ANIMAL`, sin caché) cada vez que llega un `/watches/check`, además de en su scheduler de 60s. La nueva ruta de OG y el sitemap necesitan exactamente el mismo dato. En vez de triplicar el fetch:

- Nuevo archivo `artifacts/api-server/src/lib/feed.ts`:
  - `fetchFeedItems(tipo: "PERSONA" | "ANIMAL"): Promise<ApiFeedItem[]>` — movido tal cual desde `watches.ts`.
  - `getFeedCached(): Promise<ApiFeedItem[]>` — pide ambos tipos en paralelo (`Promise.allSettled`, igual que `buildStateMap`), cachea el resultado combinado en memoria por **30 segundos** (TTL fijo, sin invalidación manual — simple a propósito).
- `watches.ts` se actualiza para usar `getFeedCached()` en lugar de su `buildStateMap` actual (que queda como una función fina sobre el resultado cacheado, conservando su contrato actual de `Map<stableKey, estado>`).
- `deriveStableKey` se mueve también a `feed.ts` (ya está duplicada conceptualmente entre `watches.ts` y el frontend; aquí solo se consolida el lado del servidor).

### 2. Nueva ruta: `GET /api/og/ser/:id`

Archivo nuevo `artifacts/api-server/src/routes/og.ts`:

- Busca en `getFeedCached()` el item cuyo `id`/`cedula` coincida con `:id` (mismo criterio que `getSerById` del frontend).
- Si lo encuentra: devuelve `text/html` con:
  - `<title>{ESTADO_LABEL}: {nombre}{apellido} — EncuentroVE</title>`
  - `og:title`, `og:description` (ej. "Visto por última vez en {zona}. Ayúdanos a difundir."), `og:image` (URL absoluta: `S3_BASE_URL` + `urlFoto` si existe, si no `https://encuentrove.online/opengraph.jpg`), `og:url` (`https://encuentrove.online/ser/{id}`), `og:type=website` (no `profile` — esa semántica de OG implica sub-propiedades de perfil social que no aplican a un reporte de persona desaparecida), más los equivalentes `twitter:*` (`summary_large_image`).
  - Body minimal (un `<a href="/ser/{id}">` visible, sin redirect — los bots no lo necesitan y así no hay riesgo de bucles).
- Si no lo encuentra o falla el fetch al backend Java: devuelve el **mismo HTML pero con el OG genérico actual** (banner de marca), nunca un error — un bot que recibe un 404/500 simplemente no genera preview, peor que mostrar el genérico.
- `S3_BASE_URL` se lee de una env var del mismo nombre en `api-server`, default `https://encuentrove-bucket.s3.us-east-1.amazonaws.com` (mismo valor que usa hoy `VITE_S3_BASE_URL` en el `.env.example` del frontend — esa lógica hoy solo existe ahí, del lado del cliente).

Se registra en `artifacts/api-server/src/routes/index.ts` junto a los demás routers.

### 3. nginx: detección de bots en `/ser/:id`

En `deploy/nginx.conf` (la imagen combinada para EasyPanel):

```nginx
map $http_user_agent $is_social_bot {
    default 0;
    "~*facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|SkypeUriPreview|Pinterest|redditbot|vkShare|Viber|Line" 1;
}

server {
    ...
    location ~ ^/ser/([^/]+)/?$ {
        if ($is_social_bot) {
            proxy_pass http://127.0.0.1:8080/api/og/ser/$1;
            break;
        }
        try_files /index.html =404;
    }
    ...
}
```

El `map` va al nivel `http {}` (fuera del bloque `server`), y como Alpine's nginx no separa `http.d` de un `nginx.conf` editable directamente para eso, se agrega como un archivo adicional `deploy/nginx-maps.conf` copiado a `/etc/nginx/http.d/` (Alpine incluye todo `*.conf` ahí dentro del bloque `http` ya existente — no requiere tocar el `nginx.conf` principal del paquete).

El `nginx.conf` viejo (`artifacts/encuentrove-web/nginx.conf`, usado por el Dockerfile de AWS) **no se toca** — ese path no tiene `api-server` corriendo al lado, así que el bot-detection no aplicaría ahí sin trabajo adicional fuera de alcance.

### 4. `GET /sitemap.xml`

Nueva ruta `GET /api/sitemap.xml` en `og.ts` (mismo archivo, comparte el fetch cacheado):

- XML con `https://encuentrove.online/`, `https://encuentrove.online/buscar`, y una entrada `https://encuentrove.online/ser/{id}` por cada item de `getFeedCached()`. Respuesta con `Content-Type: application/xml` explícito (nginx/Express no lo infieren solos para esta ruta).
- Si falla el fetch al backend Java: devuelve el XML solo con las dos rutas estáticas (nunca un error 500 — un sitemap parcial es preferible a uno caído).

nginx: `location = /sitemap.xml { proxy_pass http://127.0.0.1:8080/api/sitemap.xml; }` en `deploy/nginx.conf`.

### 5. `llms.txt`

Archivo estático nuevo `artifacts/encuentrove-web/public/llms.txt` (markdown plano, sin lógica): qué es EncuentroVE, qué tipo de datos expone (personas/animales reportados, estado, ubicación, foto), cómo están estructuradas las páginas (`/ser/:id`), y el mismo disclaimer que ya usa el resto del sitio ("datos referenciales, sujetos a confirmación en campo").

### 6. OG estático + canonical (`/`, `/buscar`, `/404`)

En `index.html`: agregar `<meta property="og:url" content="https://encuentrove.online/" />` y `<link rel="canonical" href="https://encuentrove.online/" />` (faltan hoy). Sin cambios al resto de las tags estáticas existentes.

### 7. `document.title` dinámico en `DetallePage.tsx`

Pequeño complemento natural al punto 2 (sin el cual la pestaña del navegador no combina con lo que se comparte): `useEffect` que setea `document.title` a `${ESTADO_LABEL}: ${nombre} — EncuentroVE` cuando carga el `ser`, y lo revierte al título genérico en cleanup. No se toca `/buscar` ni ningún otro meta tag por página — eso quedó fuera de alcance.

## Manejo de errores

- Backend Java no responde (timeout/502) en `/api/og/ser/:id` → fallback al OG genérico, igual.
- Backend Java no responde en `/sitemap.xml` → sitemap solo con rutas estáticas.
- `:id` no existe en el feed → mismo fallback genérico que un error de red (no se distingue "no encontrado" de "error", para mantener la ruta simple).
- Caché del feed (`getFeedCached`) nunca lanza — si el fetch falla, devuelve `[]` y loggea con `logger.warn`, igual que el patrón ya usado en `watches.ts`.

## Verificación

- `pnpm --filter @workspace/api-server run typecheck` y `build` tras mover `fetchFeedItems`/`deriveStableKey` a `feed.ts` — confirmar que `watches.ts` sigue compilando con el contrato igual.
- Levantar `api-server` localmente y probar directo (sin nginx):
  - `curl http://localhost:8080/api/og/ser/<id-real>` — confirmar `og:title`/`og:image` con datos reales.
  - `curl http://localhost:8080/api/og/ser/no-existe` — confirmar fallback genérico, no error.
  - `curl http://localhost:8080/api/sitemap.xml` — confirmar XML válido con entradas dinámicas.
- Con la imagen Docker completa (o nginx + api-server corriendo juntos localmente):
  - `curl -A "facebookexternalhit/1.1" https://.../ser/<id>` → debe traer el HTML del bot, no el `index.html` del SPA.
  - `curl -A "Mozilla/5.0 ..." https://.../ser/<id>` → debe seguir trayendo el `index.html` normal.
- Verificación visual: abrir `/ser/<id>` en navegador real, confirmar que el título de la pestaña cambia y vuelve al genérico al salir.
- Antes de publicar: validar con el debugger de Facebook (Sharing Debugger) y la vista previa de Twitter/X contra una URL real de `/ser/:id` en `encuentrove.online`.
