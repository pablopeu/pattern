# Formato de proyecto

El archivo nativo es JSON UTF-8, extensión sugerida `.pattern.json`. Versión actual: **1**. El proyecto no almacena objetos Paper.js, píxeles del canvas ni cientos de clones del motivo.

## Estructura

```json
{
  "schemaVersion": 1,
  "metadata": { "id": "uuid", "name": "Mi estudio", "createdAt": "ISO-8601", "updatedAt": "ISO-8601" },
  "documentUnits": "mm",
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
| `patterns[].symmetry` | Familia, grupo, ancho, alto, ángulo, sectores y centro |
| `regions[].geometry` | Una o varias geometrías cerradas interpretadas como región de paridad |
| `applications[]` | IDs de patrón/región, matriz de colocación, vínculo, snapshot congelado y contorno |
| `preferences` | Grilla, snapping, vista dividida, fondo, guías y controles de inspección |

## Geometrías

Cada objeto contiene `id`, `name`, `kind`, `nodes`, `closed`, `transform`, estilo, visibilidad y bloqueo. `groupId` relaciona miembros de un grupo sin duplicarlos.

- Un nodo tiene `x,y` y tangentes relativas `in:{x,y}`, `out:{x,y}`.
- Rectángulos, elipses y polígonos conservan `parameters:{x,y,width,height,radius,sides}`. Sólo la conversión explícita los materializa como nodos.
- `compound` contiene `pathData` SVG; las operaciones booleanas pueden crear varias subregiones y agujeros.
- El estilo incluye colores hex o `none`, grosor en mm, `fillRule`, `opacity`, `fillOpacity`, `strokeOpacity`.
- Las matrices siguen `[a,b,c,d,e,f]` de SVG y se aplican a coordenadas del documento.

Una aplicación con `linked:true` usa el patrón referenciado. Una aplicación con `linked:false` exige `frozenPattern`; editar el original no altera ese snapshot. Al volver a vincular se descarta el snapshot y se usa el patrón actual.

## Validación y migraciones

`persistence/schema.ts` valida estructura, límites y tipos con Zod antes de sustituir el documento. Rechaza JSON corrupto, versiones futuras, IDs de entidad duplicados, vínculos rotos, geometrías paramétricas incompletas, matrices singulares y comandos compound inválidos. Los perímetros abiertos importados como regiones se rechazan.

`migrations.ts` centraliza la versión y un registro de funciones puras de actualización. La versión 1 no necesita migraciones anteriores. Nuevas propiedades de esta implementación tienen defaults de lectura para conservar archivos v1 tempranos. Una versión futura requiere agregar una migración comprobada y actualizar el número de esquema. Nunca se sobrescribe un archivo original durante la lectura.

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
