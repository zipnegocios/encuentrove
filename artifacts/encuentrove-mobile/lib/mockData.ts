import { SerVivienteConEstado, MovimientoConUbicacion, Ubicacion, EstadoPersona } from "@/types";

const zonas = ["Macuto", "Caraballeda", "Catia La Mar", "La Guaira", "Naiguata", "Tanaguarena"];

const ubicaciones: Ubicacion[] = zonas.map((zona, index) => ({
  id: index + 1,
  nombre_lugar: `Refugio ${zona}`,
  geolocalizacion_red: null,
  zona,
}));

const seededRandom = (seed: number) => {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
};

const nombresHombres = ["Jose", "Luis", "Carlos", "Juan", "Miguel", "Pedro", "Rafael", "Jesus", "Daniel", "Alejandro"];
const nombresMujeres = ["Maria", "Ana", "Carmen", "Rosa", "Laura", "Elena", "Patricia", "Andrea", "Paola", "Marta"];
const apellidos = ["Rodriguez", "Gonzalez", "Garcia", "Fernandez", "Perez", "Martinez", "Sanchez", "Lopez", "Gomez", "Diaz"];
const estados: EstadoPersona[] = ["BUSCADO", "LOCALIZADO_BIEN", "EN_REFUGIO", "NECESITA_ASISTENCIA_MEDICA"];

const mock: SerVivienteConEstado[] = [];
let movId = 1;

for (let i = 1; i <= 30; i++) {
  const isAnimal = i > 25;
  const id = `MOCK-${i.toString().padStart(4, "0")}`;
  const isHombre = i % 2 === 0;
  const estado = estados[i % estados.length];
  const ubiIndex = Math.floor(seededRandom(i * 5) * ubicaciones.length);
  const ubicacion = ubicaciones[ubiIndex];

  const cedulaNum = Math.floor(seededRandom(i * 7) * 20000000 + 5000000);

  const mov: MovimientoConUbicacion = {
    id: movId++,
    id_ser_viviente: id,
    id_ubicacion: ubicacion.id,
    id_persona_dueno_telefono: `Rescatista ${i}`,
    estado_persona: estado,
    condicion_medica: estado === "NECESITA_ASISTENCIA_MEDICA" ? "Fractura en pierna derecha" : null,
    con_familiar: seededRandom(i * 13) > 0.5,
    url_foto: null,
    fecha_registro: new Date(Date.now() - i * 3_600_000).toISOString(),
    id_trx: `TRX-MOCK-${i}`,
    ubicacion,
    fotoUrl: null,
  };

  if (isAnimal) {
    mock.push({
      id,
      tipo_ser: "ANIMAL",
      nombre: i % 2 === 0 ? "Boby" : "Misu",
      apellido: null,
      cedula: null,
      sexo: null,
      rango_edad: "ADULTO",
      raza: i % 2 === 0 ? "Mestizo" : "Gato común",
      color: i % 2 === 0 ? "Marrón" : "Blanco y negro",
      estadoActual: estado,
      ubicacionActual: ubicacion,
      ultimoMovimiento: mov,
      movimientos: [mov],
    });
  } else {
    mock.push({
      id,
      tipo_ser: "PERSONA",
      nombre: isHombre ? nombresHombres[i % nombresHombres.length] : nombresMujeres[i % nombresMujeres.length],
      apellido: apellidos[i % apellidos.length],
      cedula: `V-${cedulaNum}`,
      sexo: isHombre ? "Masculino" : "Femenino",
      rango_edad: ["NINO", "ADOLESCENTE", "ADULTO", "ANCIANO"][i % 4] as "NINO" | "ADOLESCENTE" | "ADULTO" | "ANCIANO",
      raza: null,
      color: null,
      estadoActual: estado,
      ubicacionActual: ubicacion,
      ultimoMovimiento: mov,
      movimientos: [mov],
    });
  }
}

export const mockSeres = mock;
