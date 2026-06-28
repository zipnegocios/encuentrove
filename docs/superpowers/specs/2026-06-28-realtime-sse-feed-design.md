# Feed en tiempo real vía SSE centralizado en api-server

## Context

EncuentroVE refleja datos de campo (rescatistas actualizando el estado/ubicación de personas y animales) que cambian rápido durante una emergencia. Hoy el portal web no tiene ningún mecanismo de actualización automática: cada página hace **un solo fetch** (al montar, o al cambiar un filtro de búsqueda) y lo cachea en memoria por 60 segundos. Si una familia deja abierta la página de una persona, o la lista de resultados, nunca se actualiza sola — solo recargando manualmente.

El usuario pidió específicamente: que el api-server centralice el polling al backend Java y reparta los cambios a los clientes conectados vía Server-Sent Events (SSE), en vez de que cada cliente haga polling por su cuenta (lo cual multiplicaría la carga sobre el backend Java por cada pestaña abierta).

## Decisiones confirmadas con el usuario

- **Push de snapshot completo** (no deltas, no solo una señal de "algo cambió"): el api-server reenvía el array completo del feed cuando detecta un cambio. Es la opción más simple, encaja con la arquitectura actual del frontend ("traer todo y filtrar/paginar en el cliente"), y evita el efecto "manada" de que cada cliente dispare su propio fetch al mismo tiempo.
- **Intervalo de poll**: cada 10 segundos.

## Hallazgo durante el diseño (se corrige como parte de este trabajo)

`artifacts/api-server/src/lib/feed.ts` (creado para el trabajo de OG/sitemap) concatena los items de `PERSONA` y `ANIMAL` tal cual vienen del backend Java, sin ordenar ni deduplicar. El frontend (`src/api/index.ts:fetchFeed`), en cambio, ordena por `fechaRegistro` descendente y deduplica quedándose con el movimiento **más reciente** por persona/animal (la API del backend Java parece devolver una fila por movimiento, no una por ser_viviente). Esto significa que `watches.ts` (`buildStateMap`) puede hoy quedarse con un estado viejo si el backend Java no devuelve los movimientos ya ordenados — un bug latente, no introducido por este trabajo pero que pasa a ser crítico ahora que `lib/feed.ts` se vuelve la fuente central de verdad para todo (watches, OG, sitemap, y ahora el feed en vivo). Se corrige aquí: se mueve la misma lógica de orden+dedup del frontend a `lib/feed.ts`.

## Arquitectura

```
Backend Java ←(poll cada 10s, GET feed PERSONA+ANIMAL)— api-server
                                                              │
                                            ordena por fechaRegistro desc,
                                            deduplica (1 por persona/animal),
                                            compara contra el ultimo snapshot
                                                              │
                                            ¿cambio?  ──no──→ no hace nada
                                                  │
                                                 si
                                                  ↓
                                    notifica a los suscriptores SSE
                                                  │
                                          GET /api/events (SSE)
                                                  │
                        ┌─────────────────────────┼─────────────────────────┐
                   HomePage                   BuscarPage                DetallePage
                (deriva estadisticas)   (filtra/pagina localmente)   (busca por id)
                        └────── los 3 leen del mismo store reactivo (liveFeed.ts) ──────┘
```

## Componentes — Backend

### `lib/feed.ts` (reescrito)

Deja de ser una caché perezosa con TTL y pasa a ser un **poller activo**:
- `ApiFeedItem` se amplía para incluir todos los campos crudos que el frontend necesita para su propio mapeo (`rangoEdad`, `sexo`, `conFamiliar`, `fechaRegistro`, `usuarioHito`, `usuarioCreador` — hoy `lib/feed.ts` solo tenia el subconjunto que usaban watches/og/sitemap).
- `setInterval` cada 10s (constante `POLL_INTERVAL_MS`, no env var — no hace falta configurarlo desde afuera) llama a `fetchAllFeedItems()` (ya existe), ordena por `fechaRegistro` desc y deduplica (misma lógica que hoy vive en el frontend, movida aquí).
- Si el resultado es distinto al último snapshot guardado (comparación por `JSON.stringify` — el dataset es pequeño, no hace falta nada más sofisticado), actualiza el snapshot y notifica a los suscriptores.
- Pub-sub mínimo con un `Set<(items: ApiFeedItem[]) => void>` de listeners — sin librerías nuevas.
- `getFeedCached()` se simplifica: ya no hace fetch on-demand, simplemente devuelve el snapshot mantenido por el poller (siempre fresco, máximo 10s de antigüedad). Mantiene su firma `async`/`Promise<ApiFeedItem[]>` actual (solo que ahora resuelve de inmediato, sin esperar red) para no tener que tocar `watches.ts`, `og.ts` ni el sitemap.
- Si el poll falla (backend Java no responde): se queda con el último snapshot bueno, loggea `warn`, no notifica a nadie (no hay "cambio" que anunciar).

### `routes/sse.ts` (nuevo)

`GET /api/events`:
- Headers SSE (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`).
- Al conectar: escribe inmediatamente el snapshot actual como primer evento (el cliente no espera al próximo poll para tener datos).
- Se suscribe al pub-sub de `feed.ts`; cada notificación se escribe como `data: <json>\n\n`.
- `req.on("close", ...)` para des-suscribirse y no perder memoria con conexiones cerradas.
- Sin rate limiting propio — es una conexión persistente por cliente, no una ráfaga de requests; el riesgo que mitigan los rate limiters de `watches.ts`/`reports.ts` no aplica igual aquí. Si en el futuro se nota abuso (alguien abriendo miles de conexiones), se revisita.

### nginx (`deploy/nginx.conf`)

SSE necesita su propio `location`, separado del `location /api/` genérico:
```nginx
location = /api/events {
  proxy_pass http://127.0.0.1:8080/api/events;
  proxy_set_header Host $host;
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 1h;
  chunked_transfer_encoding off;
}
```
Sin esto, nginx puede bufferear la respuesta (rompiendo el push en tiempo real) o cortar la conexión por el `proxy_read_timeout` de 30s ya configurado para `/api/`.

## Componentes — Frontend

### `src/lib/liveFeed.ts` (nuevo)

- Abre un único `EventSource("/api/events")` (singleton a nivel de módulo — una sola conexión para toda la app, sin importar cuántos componentes la usen).
- Mantiene el array recibido más reciente y una lista de listeners — shape compatible con `useSyncExternalStore` (`subscribe(cb)`, `getSnapshot()`).
- Si no llega ningún mensaje en 60s desde que se abrió la conexión (el navegador o un proxy intermedio bloqueó SSE — raro, pero pasa en algunas redes corporativas): hace un único `fetch` directo a `/api/v1/seres-vivientes/feed` como respaldo para no dejar la pantalla vacía, mientras el `EventSource` sigue reintentando solo en segundo plano (comportamiento nativo del navegador, no hay que programarlo).
- Si nunca hay datos reales (ni SSE ni el fetch de respaldo funcionaron): `getSnapshot()` devuelve `null`, y el consumidor decide el fallback a mock — mismo comportamiento de hoy, solo que la decisión de "usar mock" se mueve al único lugar donde ya vive (`src/api/index.ts`).

### `src/api/index.ts` (modificado)

- Se elimina `fetchFeed()` y la caché de 60s (`feedCache`/`feedCacheAt`/`CACHE_TTL`) — ya no hace falta, el store vivo siempre tiene datos frescos (máx. 10s de antigüedad).
- `getAll()` pasa a leer `liveFeed.getSnapshot()`; si es `null` (sin datos reales todavía), devuelve `seresConEstadoMock` — mismo fallback de siempre.
- `mapFeedItem`, `buildFotoUrl`, etc. no cambian — siguen siendo funciones puras que transforman el shape crudo a `SerVivienteConEstado`, ahora aplicadas sobre datos que llegan por push en vez de por fetch.
- `searchSeres`, `getSerById`, `getEstadisticas`, `getZonas` no cambian sus firmas — siguen siendo `async` (para no romper a quien las llama) pero ya no esperan ninguna red, solo leen el store en memoria.

### Páginas (`HomePage.tsx`, `BuscarPage.tsx`, `DetallePage.tsx`)

Hoy cada una hace `useEffect(() => { fn().then(setState) }, [deps])` — un fetch único. Pasan a usar `useSyncExternalStore(liveFeed.subscribe, liveFeed.getSnapshot)` para re-renderizar solas cuando llega un push, y derivan sus datos (`stats`, `results`, `ser`) de ese snapshot con `useMemo` en vez de guardar el resultado en su propio `useState` poblado por una promesa. `BuscarPage` sigue recalculando filtro/paginación en cada cambio del snapshot — mismo trabajo que hoy hace una sola vez, ahora se repite automáticamente.

## Manejo de errores

- Backend Java no responde durante un poll → se mantiene el último snapshot bueno (igual que hoy en `getFeedCached`), no se notifica un cambio falso.
- Cliente SSE se desconecta → reconexión automática del navegador; el servidor limpia el listener al cerrar la conexión.
- SSE bloqueado por completo (proxy/red) → fallback a un fetch único después de 60s sin mensajes, mientras el `EventSource` sigue reintentando en background.
- Ningún dato real disponible nunca → fallback a mock data, igual que el comportamiento actual.

## Verificación

- `curl -N http://localhost:8080/api/events` — confirmar que llega el snapshot inicial inmediatamente, y un segundo evento si algo cambia dentro de los primeros ~10-20s.
- Abrir dos pestañas del navegador contra el dev server, confirmar que ambas reciben el mismo push al mismo tiempo (revisar la pestaña de Network → EventSource en devtools).
- Confirmar que `BuscarPage` y `DetallePage` se actualizan solas sin recargar la página, cuando cambia el feed.
- `pnpm --filter @workspace/api-server run typecheck/build` y `pnpm --filter @workspace/encuentrove-web run typecheck/build`.
- nginx: no se puede probar en este entorno (sin Docker/nginx instalados localmente) — validar `proxy_buffering off` funcionando una vez deployado, confirmando que los eventos llegan sin demora a través de nginx y no solo hablando directo con el api-server.
