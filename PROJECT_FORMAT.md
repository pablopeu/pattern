# Formato de proyecto

El archivo nativo es JSON UTF-8, extensión sugerida `.pattern.json`. Versión actual: **5**. El proyecto no almacena objetos Paper.js, píxeles del canvas ni cientos de clones del motivo.

## Estructura

```json
{
  "schemaVersion": 4,
  "metadata": { "id": "uuid", "name": "Mi estudio", "createdAt": "ISO-8601", "updatedAt": "ISO-8601" },
  "documentUnits": "mm",
  "mainSymmetry": { "family": "none", "group": "none", "width": 60, "height": 60, "angle": 90, "sectors": 8, "center": {"x": 0, "y": 0}, "origin": {"x": 0, "y": 0}, "orientation": 0 },
  "mainSymmetryProfiles": {},
  "drawingStyle": {},
  "stylePresets": [],
  "palette": { "colors": [], "recent": [], "favorites": [] },
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

Se leen presets `presetVersion:1` mediante la misma migración y presets `presetVersion:2`/`presetVersion:3`. El formato de preset actual es 3. Al exportar un conjunto heredado se resuelve y congela su simetría efectiva en modo propio, para que el preset sea autónomo. Al importar se regeneran IDs de fuentes y grupos.

Hover, miniaturas, identificadores de revisión, candidatos y matrices inversas de captura permanecen fuera del JSON. `preferences.sourceView` y `preferences.repetitionView` guardan únicamente las preferencias visuales. La versión de IndexedDB sigue siendo 1: no cambia su estructura de almacenes.

## Ejemplo de cambio de versión

Fragmento v1 de un conjunto periódico (el documento completo incluye fuente y generador):

```json
{"schemaVersion":1,"patterns":[{"id":"motivo-a","symmetry":{"family":"wallpaper","group":"p1","width":60,"height":60,"angle":90,"sectors":8,"center":{"x":0,"y":0}}}]}
```

El fragmento equivalente v2 conserva p1 propio y añade los campos del marco:

```json
{"schemaVersion":2,"patterns":[{"id":"motivo-a","symmetryMode":"own","visible":true,"placementTransform":[1,0,0,1,0,0],"symmetryProfiles":{},"symmetry":{"family":"wallpaper","group":"p1","width":60,"height":60,"angle":90,"sectors":8,"center":{"x":0,"y":0},"origin":{"x":0,"y":0},"orientation":0}}]}
```

Estos fragmentos muestran sólo los campos afectados, no son documentos autónomos. Los ocho documentos v1 completos están en [fixtures/v1-examples.json](src/tests/fixtures/v1-examples.json); la suite los migra y comprueba su round-trip v2.

## Esquema 3 · PRD v2.1

La migración 2→3 agrega únicamente `preferences.structureVisible:false` y `preferences.structureOpacity:0.22`. No altera entidades existentes. La migración v1 continúa pasando por v2 y conserva p1 periódico. El overlay y su caché no se exportan como parte del diseño ni se almacenan como geometría. La visibilidad/opacidad son preferencias de edición.

## Teselas en esquema 3

`patterns[].tiling` es opcional. No tenerlo conserva íntegramente el comportamiento v2. Un snapshot congelado incluye su propia definición. Los presets v2.1 declaran `presetVersion:3`. La versión actual es4 y se siguen leyendo las versiones 1, 2 y 3.

```json
{
  "version": 1,
  "kind": "square",
  "width": 60, "height": 60, "shear": 15,
  "origin": {"x": 0, "y": 0}, "rotation": 0,
  "showOutline": true,
  "edges": [
    [{"x":0,"y":0,"in":{"x":0,"y":0},"out":{"x":0,"y":0}}, {"x":0.5,"y":0,"in":{"x":0,"y":0},"out":{"x":0,"y":0}}, {"x":1,"y":0,"in":{"x":0,"y":0},"out":{"x":0,"y":0}}],
    [{"x":0,"y":0,"in":{"x":0,"y":0},"out":{"x":0,"y":0}}, {"x":0.5,"y":0,"in":{"x":0,"y":0},"out":{"x":0,"y":0}}, {"x":1,"y":0,"in":{"x":0,"y":0},"out":{"x":0,"y":0}}]
  ]
}
```

La definición anterior es el valor de `tiling`, no un proyecto completo. `kind` admite `square`, `rectangle`, `parallelogram`, `triangle`, `hexagon`. Dimensiones y marco usan mm/grados. Los nodos de borde son coordenadas normalizadas: x recorre el segmento y y es el desplazamiento normal, con tangentes relativas en ese mismo marco. Cuadriláteros guardan dos bordes maestros; hexágonos tres. Triángulos guardan tres medios bordes con extremo x=0.5. Las parejas y las instancias se derivan, no se serializan.

Los nodos y controles deben permanecer en sus corredores y el extremo estructural es fijo. Se valida el área, autointersección y solapamiento con vecinos antes de sustituir el documento. Los parámetros de forma no reemplazan `sourceGeometry` ni `generator`. Cambiar la familia reinicia sus perfiles de borde mediante una acción reversible; el motivo se conserva.

`showOutline` sólo controla la edición. `includeTileOutlines` es una opción explícita de exportación, inicialmente false. Los contornos exportados comparten la misma geometría de borde y DXF recibe líneas centrales deduplicadas. El overlay matemático nunca forma parte de la exportación. No se guardan clips, fragmentos recortados, SVG de miniaturas ni colocaciones derivadas.

## Esquema 4 · Estilos y regiones vectoriales

El ejemplo de estructura anterior es abreviado: `drawingStyle` requiere todas las propiedades de `DrawingStyle` de `src/app/styles.ts`. El mismo contrato lo implementa cada `Geometry`: colores hex RGB o `none`, ancho en mm, cap/join/inglete, opacidad global/de trazo/de relleno, fill-rule, `strokeDash`, `strokeDashOffset` y `strokeProfile:{version:1,kind,points:[{at,width}]}`. El alfa HEX se normaliza a RGB y opacidad; no se almacena un alfa redundante.

`drawingStyle` controla objetos futuros; `stylePresets:[{id,name,style}]` son valores completos independientes, sin vínculos retroactivos. `palette` almacena `colors`, `recent` y `favorites`. Preferencias nuevas: `styleDefaultsFollowSelection`, `stylePanelPinned`, `fillCloseTolerance` y `fillLinkedDefault`.

La migración pura 3→4 agrega los valores predeterminados y normaliza estilos de fuentes, perímetros y snapshots congelados, conservando IDs, fuentes, unidades y simetrías. Archivos1/2/3 siguen pasando por el registro de migraciones; versiones futuras se rechazan. Los presets de patrón actuales usan versión 4; al importar un preset se remapean IDs y sus regiones derivadas quedan fijas para no vincularse accidentalmente con entidades ajenas.

Una geometría de relleno tiene pathData vectorial y `fillRegion` opcional, versión 1:

| Campo | Contrato |
|---|---|
| `kind`, `scope` | Cara o tesela; fuente canónica, órbita concreta o fondo de tesela |
| `linked`, `status`, `reason` | Vínculo activo, fijo o stale; último contorno válido conservado ante ambigüedad |
| `faceKey`, `topologyKey`, `refs` | Identidad de límites y subdivisiones, independiente del cursor aproximado |
| `inputs`, `context` | IDs de patrón/fuente, matrices capturadas y configuración geométrica; no se clonan límites |
| `captureMatrix`, `orbitMatrices` | Marco de captura y órbita geométricamente verificada |
| `closeTolerance` | Cierre ampliado explícito en mm, cero por defecto |

El eje de un trazo de perfil variable sigue siendo fuente editable; su contorno y las cachés no se serializan. Una región Fill derivada sí conserva su contorno y referencias. Se evita depender de otras regiones Fill para impedir ciclos. El esquema limita claves, referencias y pathData antes de aceptar una entidad nueva; las operaciones no pueden dejar un autosave inválido.


La reorganización v2.3 conserva schemaVersion4. Categorías, pestañas,
modales y búsqueda pertenecen al estado de interfaz y no se serializan en el
proyecto ni en undo. Recientes de simetría son de sesión; favoritos son una
preferencia local del navegador. El JSON portable sigue conteniendo el
mismo documento geométrico/estilos y se abre en los recorridos anteriores.


## Esquema5 · Composiciones reproducibles

La migración pura4→5 sólo cambia la versión; conserva exactamente geometrías,
IDs, estilos, simetrías, Fill, teselas, preferencias y snapshots. Lectura1–4
continúa por el registro existente. Presets actuales5; se leen1–4.

`patterns[].composition` es opcional: versión1, enabled, kind recursive/spiral,
receta, marco fuente, centro/tamaño/detalle mínimo, parámetros de recursión o
semejanza y paleta por nivel. El árbol, sus matrices/IDs/niveles, las miniaturas
y los clones temporales de color se derivan: no se serializan miles de copias.
Desactivar conserva la definición y recupera generador/simetría/tesela previos.
Los snapshots congelados y presets conservan su propia definición.

`metadata.example` opcional registra identificador/categoría, descripción,
construcción, validez específica, autor, tipo de obra y referencias HTTPS.
La geometría original sigue en sourceGeometry. Se usa versión5 para que un
lector anterior rechace los nuevos datos en vez de eliminarlos silenciosamente.
El nuevo estudio conserva P3/cámara100%/estructura50%/Dibujo libre.
