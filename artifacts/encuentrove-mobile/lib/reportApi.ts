function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

export interface ReportPayload {
  tipo: string;
  nombre: string;
  apellido?: string;
  cedula?: string;
  sexo?: string;
  rangoEdad?: string;
  raza?: string;
  ultimaUbicacion: string;
  condicionMedica?: string;
  contacto?: string;
}

export interface ReportResult {
  success: boolean;
  message: string;
}

export async function submitReport(payload: ReportPayload): Promise<ReportResult> {
  const base = getBaseUrl();
  const res = await fetch(`${base}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Error ${res.status}`);
  }

  return res.json() as Promise<ReportResult>;
}
