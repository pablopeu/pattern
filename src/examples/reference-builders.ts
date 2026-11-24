/**
 * Estudios de referencia construidos sobre geometría medida de fuentes públicas.
 * Cada estudio conserva una fuente canónica editable (trazados Bézier) y deriva
 * sus repeticiones con matrices exactas: no hay imágenes raster ni clones mudos.
 *
 * Fuentes (todas CC0 salvo indicación): HenryM · openclipart 357838 (espiral de
 * lagartos) y 340157 (lagarto torturado); donchico · openclipart 249414 (aves
 * estilo Night and Day); GDJ · openclipart 295026 (peces con ojos). Atribuciones
 * completas en THIRD_PARTY_NOTICES.md, docs/ESCHER_VECTOR_SOURCES.md y el modal
 * Referencias. Los datos geométricos se extrajeron de los SVG publicados
 * (medidos, no reinterpretados): ver reference-assets.ts.
 */
import { geometry, newProject, type Geometry, type Project } from '../app/model';
import { defaultComposition } from '../composition/model';
import {
  nightDark,
  nightDarkDetails,
  nightDayCell,
  nightLight,
  nightTown,
  spiralDetail,
  spiralMotif,
  spiralRing,
  spiralRingRadius,
  tortureCell,
  tortureCellSize,
  torturePalette,
  gdjFish,
  gdjFishDetails,
  gdjFishSize,
} from './reference-assets';

const ref = (title: string, url: string) => ({ title, url });
const SPIRAL_REF = ref(
  'HenryM · Escher Lizard Spiral Set (dominio público, Openclipart)',
  'https://openclipart.org/detail/357838/escher-lizard-spiral-set',
);
const TORTURE_REF = ref(
  'HenryM · Tortured Lizard (dominio público, Openclipart)',
  'https://openclipart.org/detail/340157/tortured-lizard',
);
const NIGHT_REF = ref(
  'donchico · Escher style (dominio público, Openclipart)',
  'https://openclipart.org/detail/249414/escher-style',
);
const FISH_REF = ref(
  'GDJ · Seamless Lizards Tessellation (dominio público, Openclipart)',
  'https://openclipart.org/detail/295026/seamless-lizards-tessellation',
);

const scene = (background: string) => ({
  grid: false,
  guides: false,
  structureVisible: false,
  snap: false,
  split: false,
  background,
});

/**
 * Motivo unitario + celda periódica p1: la repetición la resuelve el motor sobre la
 * vista, no una lista finita de copias. `cell` es el vector (ancho, alto) medido del
 * original y `unit` la matriz que lleva el motivo medido (en mm) a la celda unitaria
 * que consume el motor.
 */
function periodize(
  pattern: Project['patterns'][number],
  cell: { width: number; height: number; angle?: number },
) {
  pattern.symmetry = {
    ...pattern.symmetry,
    family: 'wallpaper',
    group: 'p1',
    width: cell.width,
    height: cell.height,
    angle: cell.angle ?? 90,
    orientation: 0,
  };
}

function painted(
  name: string,
  d: string,
  fill: string,
  stroke = '#25312a',
  width = 0.5,
): Geometry {
  const g = geometry('compound', [], true);
  return { ...g, name, pathData: d, fill, stroke, strokeWidth: width };
}


/* ------------------------------------------------------------------ */
/* Espiral de lagartos (357838)                                        */
/* ------------------------------------------------------------------ */

export function spiralLizards(): Project {
  const project = newProject(),
    pattern = project.patterns[0],
    detailPalette = ['#e0b07e', '#a9b5a3', '#8b7a68'];
  pattern.name = 'Lagartos en espiral · fuente única';
  // La fuente canónica es el lagarto del anillo exterior con sus detalles; cada
  // nivel de la espiral reutiliza esa misma fuente (no hay copias independientes).
  const motif = painted('Lagarto · remolino', spiralMotif, '#c9805a', '#2f352f', 0.45);
  const detail = painted('Lagarto · cuerpo', spiralDetail, detailPalette[0], '#2f352f', 0.4);
  pattern.sourceGeometry = [motif, detail];
  // La espiral es la vista derivada (tipo semejanza); la fuente plana sigue editable.
  const spiral = defaultComposition('spiral', { x: -85, y: -85, width: 170, height: 170 });
  if (spiral.kind !== 'spiral') throw Error('Se esperaba una composición en espiral');
  spiral.recipe = 'logarithmic';
  // 12 motivos por vuelta y un factor 0.7457 por vuelta: ratio = 0.7457^(1/12).
  spiral.count = 48;
  spiral.ratio = 0.9758;
  spiral.angle = 30;
  spiral.arms = 1;
  spiral.colorByLevel = true;
  spiral.palette = ['#c9805a', '#7d8f80', '#4d5d55', '#e0b07e', '#a9b5a3'];
  spiral.size = 290;

  pattern.composition = spiral;
  pattern.generator.kind = 'motif';
  pattern.symmetry.family = 'none';
  pattern.symmetryMode = 'free';
  project.metadata.name = 'Lagartos en espiral · reconstrucción';
  project.metadata.example = {
    id: 'gallery-spiral-lizards',
    category: 'Referencias',
    description:
      'Remolino de lagartos por semejanza: doce motivos por vuelta, tres vueltas a escala 1/√1.8 y un lagarto interior a tres colores. Fuente Bézier editable extraída del original.',
    construction: 'Espiral de semejanzas · rotación 60° · escala 1/√1.8 por nivél',
    validity: 'APPROXIMATED',
    artwork: 'licensed',
    author: 'HenryM (dominio público) · extracción y reconstrucción Pattern Studio',
    references: [SPIRAL_REF],
  };
  project.preferences = { ...project.preferences, ...scene('#f4ede0') };
  return project;
}

/* ------------------------------------------------------------------ */
/* Night and Day: aves de dos motivos (249414)                         */
/* ------------------------------------------------------------------ */

export function nightDayBirds(): Project {
  const project = newProject(),
    pattern = project.patterns[0];
  pattern.name = 'Aves Night and Day · celda de dos motivos';
  const dark = painted('Ave oscura · silueta', nightDark, '#20262a', '#20262a', 0.4),
    light = painted('Ave clara · líneas', nightLight, 'none', '#6d747a', 0.55);
  const town = nightTown.map((d, i) =>
    painted(`Pueblo · pieza ${i + 1}`, d, '#b9b4a8', '#4a5157', 0.35),
  );
  const feathers = nightDarkDetails.map((detail, i) =>
    painted(`Ave oscura · pluma ${i + 1}`, detail.d, 'none', '#7d858c', detail.w * 0.9),
  );
  pattern.sourceGeometry = [dark, light, ...town, ...feathers];
  pattern.generator.kind = 'motif';
  pattern.symmetryMode = 'own';
  // Celda rómbica: traslación (209.2, -4) con red de filas (27, 180,4).
  // Vectores medidos: columna (209.2, -4) → ancho 209.2; fila (27, 180.4) → alto 182.4, ángulo 81.5°.
  periodize(pattern, { width: nightDayCell.width, height: 182.4, angle: 81.5 });
  project.metadata.name = 'Night and Day · aves de dos motivos';
  project.metadata.example = {
    id: 'gallery-night-day',
    category: 'Referencias',
    description:
      'Reconstrucción vectorial del mosaico de aves claro/oscuro: silueta oscura rellena con plumas interiores, ave clara trazada y pueblo inferior, todo en una celda rómbica de 209×180 mm.',
    construction: `Retícula rómbica ${nightDayCell.width}×${nightDayCell.height} · dos motivos por celda`,
    validity: 'APPROXIMATED',
    artwork: 'licensed',
    author: 'donchico (dominio público) · reconstrucción Pattern Studio',
    references: [NIGHT_REF],
  };
  project.preferences = { ...project.preferences, ...scene('#eeeade') };
  return project;
}

/* ------------------------------------------------------------------ */
/* Lagarto torturado (340157)                                          */
/* ------------------------------------------------------------------ */

export function torturedLizards(): Project {
  const project = newProject(),
    pattern = project.patterns[0];
  pattern.name = 'Lagarto torturado · celda de nueve piezas';
  // La celda original: piezas cerradas de la capa Cut, coloreadas por orden de borde.
  pattern.sourceGeometry = tortureCell.map((piece, i) =>
    painted(`Celda · pieza ${i + 1}`, piece.d, torturePalette[piece.color], '#2b2620', 0.35),
  );
  pattern.generator.kind = 'motif';
  pattern.symmetryMode = 'own';
  // Retícula hexagonal del original: celda de lado ~52 mm, paso de 60°.
  periodize(pattern, { width: tortureCellSize * 0.72, height: tortureCellSize * 0.72, angle: 60 });
  project.metadata.name = 'Lagarto torturado · mosaico de referencia';
  project.metadata.example = {
    id: 'gallery-tortured-lizard',
    category: 'Referencias',
    description:
      'Celda figurativa de nueve piezas extraída del mosaico original de HenryM: contorno dentado y lagartos que se muerden el cuerpo en una retícula hexagonal.',
    construction: 'Celda hexágono deformado · 9 piezas cerradas · retícula 60°',
    validity: 'APPROXIMATED',
    artwork: 'licensed',
    author: 'HenryM (dominio público) · reconstrucción Pattern Studio',
    references: [TORTURE_REF],
  };
  project.preferences = { ...project.preferences, ...scene('#f6efe4') };
  return project;
}

/* ------------------------------------------------------------------ */
/* Peces GDJ (295026)                                                  */
/* ------------------------------------------------------------------ */

export function gdjFishTessellation(): Project {
  const project = newProject(),
    pattern = project.patterns[0];
  pattern.name = 'Peces con ojos · motivo único';
  const fish = painted('Pez · silueta', gdjFish, '#cfd9d2', '#2c3a35', 0.45),
    details = gdjFishDetails.map((d, i) =>
      painted(`Pez · detalle ${i + 1}`, d, 'none', '#2c3a35', 0.4),
    );
  pattern.sourceGeometry = [fish, ...details];
  pattern.generator.kind = 'motif';
  pattern.symmetryMode = 'own';
  // Retícula rómbica del original: motivos de 287×327 mm en paso de 60°.
  periodize(pattern, { width: gdjFishSize * 0.9, height: gdjFishSize * 0.9, angle: 60 });
  project.metadata.name = 'Peces con ojos · mosaico GDJ';
  project.metadata.example = {
    id: 'gallery-gdj-fish',
    category: 'Referencias',
    description:
      'Mosaico de peces con ojos y aletas trazadas, extraído del original de GDJ: una silueta editable y sus detalles interiores repetidos sobre una retícula rómbica.',
    construction: 'Retícula rómbica · silueta única · detalles interiores',
    validity: 'APPROXIMATED',
    artwork: 'licensed',
    author: 'GDJ (dominio público) · reconstrucción Pattern Studio',
    references: [FISH_REF],
  };
  project.preferences = { ...project.preferences, ...scene('#eef1ea') };
  return project;
}

export const spiralRingAngles = spiralRing.map((piece) => piece.angle);
export const spiralRadius = spiralRingRadius;

/** Tabla que consume scripts/studio-preview.mjs para revisar los borradores. */
export const referenceDrafts = {
  'gallery-spiral-lizards': spiralLizards,
  'gallery-night-day': nightDayBirds,
  'gallery-tortured-lizard': torturedLizards,
  'gallery-gdj-fish': gdjFishTessellation,
} as const;
