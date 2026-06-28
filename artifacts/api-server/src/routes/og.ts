import { Router, type Request, type Response } from "express";
import { getFeedCached, deriveRouteId, buildFotoUrl, type ApiFeedItem } from "../lib/feed";

const router = Router();

const SITE_URL = "https://encuentrove.online";
const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph.jpg`;

const ESTADO_LABELS: Record<string, string> = {
  BUSCADO: "Buscado/a",
  LOCALIZADO_BIEN: "Localizado/a — Bien",
  EN_REFUGIO: "En refugio",
  NECESITA_ASISTENCIA_MEDICA: "Necesita asistencia médica",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value: string): string {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function renderOgPage(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
}): string {
  const title = escapeHtml(opts.title);
  const description = escapeHtml(opts.description);
  const image = escapeHtml(opts.image);
  const url = escapeHtml(opts.url);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<meta name="description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:image" content="${image}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${image}" />
</head>
<body>
<a href="${url}">${title}</a>
</body>
</html>`;
}

function findItem(items: ApiFeedItem[], id: string): ApiFeedItem | undefined {
  return items.find((item) => deriveRouteId(item) === id || item.cedula === id);
}

// Mismo slugify que artifacts/encuentrove-web/src/lib/slug.ts — segmento
// decorativo en la URL (/ser/:id/:slug), nunca se usa para resolver el id.
function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug;
}

function buildPageUrl(id: string, nombre?: string, apellido?: string): string {
  const slug = slugify(`${nombre ?? ""} ${apellido ?? ""}`.trim());
  return slug ? `${SITE_URL}/ser/${encodeURIComponent(id)}/${slug}` : `${SITE_URL}/ser/${encodeURIComponent(id)}`;
}

router.get("/og/ser/:id", async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const items = await getFeedCached();
  const item = findItem(items, id);
  const pageUrl = `${SITE_URL}/ser/${encodeURIComponent(id)}`;

  if (!item) {
    res.set("Content-Type", "text/html; charset=utf-8").send(
      renderOgPage({
        title: "EncuentroVE — Portal de Emergencia",
        description: "Busca a tus seres queridos en zonas de emergencia.",
        image: DEFAULT_OG_IMAGE,
        url: pageUrl,
      }),
    );
    return;
  }

  const estadoLabel = ESTADO_LABELS[item.estadoActual] ?? item.estadoActual;
  const nombreCompleto = [item.nombre, item.apellido].filter(Boolean).join(" ");
  const lugar = item.nombreLugar ? ` Visto por última vez en ${item.nombreLugar}.` : "";

  res.set("Content-Type", "text/html; charset=utf-8").send(
    renderOgPage({
      title: `${estadoLabel}: ${nombreCompleto} — EncuentroVE`,
      description: `${lugar} Ayúdanos a difundir y encontrarlo/a.`.trim(),
      image: buildFotoUrl(item.urlFoto) ?? DEFAULT_OG_IMAGE,
      url: buildPageUrl(id, item.nombre, item.apellido),
    }),
  );
});

router.get("/sitemap.xml", async (_req: Request, res: Response) => {
  const items = await getFeedCached();
  const staticUrls = [`${SITE_URL}/`, `${SITE_URL}/buscar`];
  // Some records share a placeholder cedula (e.g. "SIN_CEDULA") when the
  // person's identity is unknown — dedupe so the sitemap doesn't repeat the
  // same /ser/:id url for each of them.
  const dynamicUrls = [...new Set(items.map((item) => buildPageUrl(deriveRouteId(item), item.nombre, item.apellido)))];

  const urls = [...staticUrls, ...dynamicUrls]
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n");

  res
    .set("Content-Type", "application/xml; charset=utf-8")
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

export default router;
