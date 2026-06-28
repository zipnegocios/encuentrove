import { TipoSer } from "@/data/types";

// Mismo rango de marcas diacriticas (NFD) que normalizeStr en src/api/index.ts
// y src/lib/liveFeed.ts. Construido por codigo (no como regex literal en el
// fuente) porque escribir el escape unicode directamente aqui termina
// guardando el caracter combinante real en vez del texto escapado.
const DIACRITICS_RE = new RegExp(
  `[${String.fromCharCode(92, 117, 48, 51, 48, 48)}-${String.fromCharCode(92, 117, 48, 51, 54, 102)}]`,
  "g",
);

// Mismo slugify que artifacts/api-server/src/routes/og.ts — segmento
// decorativo en la URL (/ser/:id/:slug), nunca se usa para resolver el id.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSerPath(ser: { id: string; tipo_ser: TipoSer; nombre: string | null; apellido: string | null }): string {
  const nombreCompleto = ser.tipo_ser === "ANIMAL"
    ? ser.nombre ?? ""
    : `${ser.nombre ?? ""} ${ser.apellido ?? ""}`.trim();
  const slug = slugify(nombreCompleto);
  return slug ? `/ser/${ser.id}/${slug}` : `/ser/${ser.id}`;
}
