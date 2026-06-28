import { SerViviente, Ubicacion, MovimientoSerViviente } from './types';

const zonas = ['Macuto', 'Caraballeda', 'Catia La Mar', 'La Guaira', 'Naiguata', 'Tanaguarena', 'Caruao'];

export const ubicaciones: Ubicacion[] = zonas.map((zona, index) => ({
  id: index + 1,
  nombre_lugar: `Refugio ${zona} / Punto de Control`,
  geolocalizacion_red: null,
  zona,
}));

const getUbicacionById = (id: number): Ubicacion => ubicaciones.find(u => u.id === id)!;

const seededRandom = (seed: number) => {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
};

const nombresHombres = ['Jose', 'Luis', 'Carlos', 'Juan', 'Miguel', 'Pedro', 'Rafael', 'Jesus', 'Daniel', 'Alejandro'];
const nombresMujeres = ['Maria', 'Ana', 'Carmen', 'Rosa', 'Laura', 'Elena', 'Patricia', 'Andrea', 'Paola', 'Marta'];
const apellidos = ['Rodriguez', 'Gonzalez', 'Garcia', 'Fernandez', 'Perez', 'Martinez', 'Sanchez', 'Lopez', 'Gomez', 'Diaz', 'Torres'];

const estados = ['BUSCADO', 'LOCALIZADO_BIEN', 'EN_REFUGIO', 'NECESITA_ASISTENCIA_MEDICA'] as const;
const edades = ['NINO', 'ADOLESCENTE', 'ADULTO', 'ANCIANO'] as const;

export const seresVivientes: SerViviente[] = [];
export const movimientos: MovimientoSerViviente[] = [];

let movId = 1;

for (let i = 1; i <= 35; i++) {
  const isAnimal = i > 29;
  const id = `SER-${i.toString().padStart(4, '0')}`;
  let nombre: string | null = null;
  let apellido: string | null = null;
  let sexo: 'Masculino' | 'Femenino' | null = null;
  let raza: string | null = null;
  let color: string | null = null;
  let cedula: string | null = null;

  if (isAnimal) {
    const isPerro = i % 2 === 0;
    nombre = isPerro ? 'Boby' : 'Misu';
    raza = isPerro ? 'Mestizo' : 'Gato comun';
    color = isPerro ? 'Marron' : 'Blanco y negro';
  } else {
    const isHombre = i % 2 === 0;
    nombre = isHombre ? nombresHombres[i % nombresHombres.length] : nombresMujeres[i % nombresMujeres.length];
    apellido = apellidos[i % apellidos.length];
    sexo = isHombre ? 'Masculino' : 'Femenino';
    const cedulaNum = Math.floor(seededRandom(i * 7) * 20000000 + 5000000);
    cedula = `V-${cedulaNum}`;
  }

  seresVivientes.push({
    id,
    tipo_ser: isAnimal ? 'ANIMAL' : 'PERSONA',
    nombre,
    apellido,
    cedula,
    sexo,
    rango_edad: edades[i % edades.length],
    raza,
    color,
  });

  const numMovimientos = Math.floor(seededRandom(i * 3) * 3) + 1;
  const hasPhoto = seededRandom(i * 11) > 0.3;

  for (let j = 0; j < numMovimientos; j++) {
    const ubiIndex = Math.floor(seededRandom(i * 5 + j) * ubicaciones.length);
    const ubicacion = ubicaciones[ubiIndex];
    const estado = estados[(i + j) % estados.length];
    const d = new Date('2026-06-25T00:00:00Z');
    d.setHours(d.getHours() + (j + 1) * 6);

    movimientos.push({
      id: movId++,
      id_ser_viviente: id,
      id_ubicacion: ubicacion.id,
      id_persona_dueno_telefono: `RESCATISTA-${Math.floor(seededRandom(i * 13 + j) * 100)}`,
      estado_persona: estado,
      condicion_medica: estado === 'NECESITA_ASISTENCIA_MEDICA' ? 'Heridas leves' : null,
      con_familiar: seededRandom(i * 17 + j) > 0.8,
      url_foto: hasPhoto && j === numMovimientos - 1 ? `photos/${id}/avatar.svg` : null,
      fecha_registro: d.toISOString(),
      id_trx: `TRX-${movId}`,
    });
  }
}

export function getUbicacionForMovimiento(id_ubicacion: number): Ubicacion {
  return getUbicacionById(id_ubicacion);
}
