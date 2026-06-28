export type TipoSer = "PERSONA" | "ANIMAL";
export type RangoEdad = "NINO" | "ADOLESCENTE" | "ADULTO" | "ANCIANO";
export type EstadoPersona =
  | "BUSCADO"
  | "LOCALIZADO_BIEN"
  | "EN_REFUGIO"
  | "NECESITA_ASISTENCIA_MEDICA";
export type Sexo = "Femenino" | "Masculino" | "Desconocido";

export interface Ubicacion {
  id: number;
  nombre_lugar: string;
  geolocalizacion_red: string | null;
  zona: string;
}

export interface MovimientoConUbicacion {
  id: number;
  id_ser_viviente: string;
  id_ubicacion: number;
  id_persona_dueno_telefono: string;
  estado_persona: EstadoPersona;
  condicion_medica: string | null;
  con_familiar: boolean;
  url_foto: string | null;
  fecha_registro: string;
  id_trx: string;
  ubicacion: Ubicacion;
  fotoUrl: string | null;
}

export interface SerVivienteConEstado {
  id: string;
  tipo_ser: TipoSer;
  nombre: string | null;
  apellido: string | null;
  cedula: string | null;
  sexo: Sexo | null;
  rango_edad: RangoEdad;
  raza: string | null;
  color: string | null;
  estadoActual: EstadoPersona;
  ubicacionActual: Ubicacion;
  ultimoMovimiento: MovimientoConUbicacion;
  movimientos: MovimientoConUbicacion[];
}

export interface Estadisticas {
  total: number;
  porEstado: Record<EstadoPersona, number>;
}

export interface SearchParams {
  query?: string;
  tipo?: TipoSer | "";
  estado?: EstadoPersona | "";
}
