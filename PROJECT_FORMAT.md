# Formato de proyecto

El archivo nativo es JSON UTF-8, extensión sugerida `.pattern.json`. Versión actual: **2**. El proyecto no almacena objetos Paper.js, píxeles del canvas ni cientos de clones del motivo.

## Estructura

```json
{
  "schemaVersion": 2,
  "metadata": { "id": "uuid", "name": "Mi estudio", "createdAt": "ISO-8601", "updatedAt": "ISO-8601" },
  "documentUnits": "mm",
  "mainSymmetry": { "family": "none", "group": "none", "width": 60, "height": 60, "angle": 90, "sectors": 8, "center": {"x": 0, "y": 0}, "origin": {"x": 0, "y": 0}, "orientation": 0 },
  "mainSymmetryProfiles": {},
  "patterns": [],
  "regions": [],
  "applications": [],
  "preferences": {}
}
```

El proyecto real requiere al menos un patrón. Los valores completos pueden inspeccionarse exportando cualquiera de los ocho ejemplos.

| Campo | Contenido |
|---|---|
| `patterns[].sourceGeometry` | Fuente canónica; orden del array = orden de capas |
| `patterns[].generator` | `kind`, `version:1`, semilla, parámetros y matrices de colocación libre |
| `mainSymmetry` | Configuración principal compartida por conjuntos heredados |
| `mainSymmetryProfiles` | Configuraciones guardadas por clave `familia:grupo` |
| `patterns[].symmetry` | Configuración propia: familia, grupo, ancho/alto/ángulo, sectores, centro, origen y orientación |
| `patterns[].symmetryMode` | `own`, `inherit` o `free`; Libre explícito usa `family:none`, `group:none` |
| `patterns[].symmetryProfiles` | Configuraciones propias por `familia:grupo` |
| `patterns[].placementTransform` | Colocación del motivo entre generación y simetría; no modifica fuentes |
| `patterns[].visible` | Visibilidad del conjunto; su posición en `patterns[]` determina el orden |
| `regions[].geometry` | Una o varias geometrías cerradas unidas respetando sus fill-rules |
| `applications[]` | IDs de patrón/región, matriz de colocación, vínculo, snapshot congelado y contorno |
| `preferences` | Grilla, snapping, vista dividida, fondo, guías y controles de inspección |

## Geometrías

Cada objeto contiene `id`, `name`, `kind`, `nodes`, `closed`, `transform`, estilo, visibilidad y bloqueo. `groupId` relaciona miembros de un grupo sin duplicarlos.

- Un nodo tiene `x,y` y tangentes relativas `in:{x,y}`, `out:{x,y}`.
- Rectángulos, elipses y polígonos conservan `parameters:{x,y,width,height,radius,sides}`. Sólo la conversión explícita los materializa como nodos.
- `compound` contiene `pathData` SVG; las operaciones booleanas pueden crear varias subregiones y agujeros.
- El estilo incluye colores hex o `none`, grosor en mm, `fillRule`, `opacity`, `fillOpacity`, `strokeOpacity`, extremos, uniones y límite de inglete.
- Las matrices siguen `[a,b,c,d,e,f]` de SVG y se aplican a coordenadas del documento.

Una aplicación con `linked:true` usa el patrón referenciado. Una aplicación con `linked:false` exige `frozenPattern`; editar el original no altera ese snapshot. Al volver a vincular se descarta el snapshot y se usa el patrón actual.

## Validación y migraciones

`persistence/schema.ts` valida estructura, límites y tipos con Zod antes de sustituir el documento. Rechaza JSON corrupto, versiones futuras, IDs de entidad duplicados, vínculos rotos, geometrías paramétricas incompletas, matrices singulares y comandos compound inválidos. Los perímetros abiertos importados como regiones se rechazan.

`migrations.ts` centraliza la versión y un registro de funciones puras de actualización. La migración pura 1→2 incorpora origen cero, orientación cero, colocación identidad, visibilidad y modo propio. Mantiene cada grupo previo: p1 continúa siendo periódico. Migra también los snapshots congelados y conserva IDs, fuente, estilo, generador, unidades y regiones. La simetría principal inicial es Libre y no altera esos conjuntos propios. Ocho fixtures reales de v1 verifican este contrato. Nunca se sobrescribe un archivo original durante la lectura.

No se redondean nodos ni dimensiones al serializar. Los parámetros de generadores y su versión se conservan. Un cambio de algoritmos que modifique la salida debe actualizar la versión del generador y proporcionar migración o compatibilidad.

## IndexedDB

Base `pattern-studio`, versión de almacén 1, object store `projects`:

- `last`: JSON del último estado válido autosalvado.
- `project:<metadata.id>`: JSON de cada proyecto de la biblioteca.

Ambas entradas se escriben en una transacción. El debounce de 600 ms evita escrituras por cada movimiento; no se guarda un perímetro abierto a medio trazar. El botón de archivo intenta completar la escritura local antes de descargar el JSON; si falla el almacenamiento, la descarga portable sigue disponible.

No se elimina la biblioteca al abrir un ejemplo. Cada nuevo proyecto y restauración de ejemplo recibe un ID independiente. La biblioteca no sincroniza entre PCs, navegadores u orígenes. El formato JSON es el mecanismo portable.

## Presets

```json
{ "presetVersion": 1, "pattern": { "...": "patrón completo" } }
```

La importación utiliza la misma validación de patrones, conserva parámetros/semilla y asigna nuevos IDs de patrón, fuentes y grupos para evitar colisiones. Los ejemplos incluidos se restauran desde Archivo sin borrar proyectos guardados.

## Presets y estado transitorio de v2

Se leen presets `presetVersion:1` mediante la misma migración y presets `presetVersion:2`. Al exportar un conjunto heredado se resuelve y congela su simetría efectiva en modo propio, para que el preset sea autónomo. Al importar se regeneran IDs de fuentes y grupos.

Hover, miniaturas, identificadores de revisión, candidatos y matrices inversas de captura permanecen fuera del JSON. `preferences.sourceView` y `preferences.repetitionView` guardan únicamente las preferencias visuales. La versión de IndexedDB sigue siendo 1: no cambia su estructura de almacenes.
