# Arquitectura

## Documento canónico

`src/app/model.ts` define el proyecto serializable. Una geometría fuente existe una vez. Un patrón contiene geometrías, generador con versión/semilla y simetría; una aplicación enlaza un patrón y un perímetro mediante una matriz. Una aplicación congelada incluye un snapshot del patrón.

React es la interfaz. Paper.js es un servicio geométrico temporal, no el formato persistente ni una segunda copia editable del documento. Las operaciones crean paths sin insertarlos y los liberan al terminar.

## Módulos

| Directorio | Responsabilidad |
|---|---|
| `app/` | Contratos, ejemplos, estado e integración |
| `editor/` | Interacciones, dibujo, selección, inversas de instancias, viewport e historial |
| `geometry/` | Matrices afines, unidades, Bézier y adaptadores Paper.js |
| `symmetry/` | Generadores de grupos, cierre, redes, dominio fundamental, guías y verificación |
| `generators/` | Familias determinísticas, colocaciones y subdivisión Penrose |
| `patterns/` | Evaluación del motivo y culling de sus transformaciones |
| `application/` | Perímetros, agujeros, intersecciones y conversión de trazos |
| `export/` | SVG, worker cancelable, DXF, raster y densidad física |
| `persistence/` | Esquemas, validación semántica, migraciones, IndexedDB, SVG y presets |
| `ui/` | Controles contextuales, paneles, estilos y exportación |
| `scripts/` | Servicios LAN, monitor, benchmark y verificaciones independientes |

## Evaluación

```
Geometría fuente → generación de motivo/colocaciones → operaciones de simetría
→ traslaciones visibles → transformación de aplicación → máscara/recorte → exportación
```

Warp Grid deforma el motivo antes de aplicar el grupo. Esto conserva las simetrías de la órbita completa. Penrose interrumpe la repetición y devuelve una región finita. Cambiar de generador conserva la fuente; convertirlo a paths es una acción explícita y reversible.

La clasificación matemática proviene de la construcción, no del aspecto visual. La verificación adicional comprueba preservación de red y cierre del grupo módulo traslaciones.

## Renderizado

El editor usa SVG. Las geometrías están en `<defs>` y las instancias usan `<use>`. Sólo se enumeran traslaciones que pueden contribuir al viewport, considerando la extensión real del motivo y sus colocaciones. El pan y zoom pertenecen al viewport, no transforman coordenadas del documento.

Cuando `instancias × objetos` supera 15.000, la vista reutiliza un `<pattern>` SVG con la base de red real. El navegador puede cachear una celda y repetirla. La edición sigue siendo vectorial: el hit test resuelve la transformación correspondiente y usa su inversa. Esta optimización no cambia la exportación ni el documento.

La vista dividida monta dos vistas del mismo estado. Los borradores de dibujo entran en el modelo de pantalla durante pointermove. Un arrastre se confirma como una operación de historial al terminar; los sliders agrupan pointerdown/pointerup.

## Estado e historial

`useStudio` mantiene el proyecto actual y un historial acotado a 100 estados inmutables. Los borradores no agregan cientos de acciones. Undo/redo sustituye el documento canónico; la escena se deriva nuevamente. Las preferencias y parámetros se guardan junto al proyecto.

La edición desde una instancia aplica la inversa de la colocación/simetría para mover la fuente; los nodos añaden la inversa de la matriz del objeto. No se materializan clones independientes al mover una copia.

## Exportación

Un Web Worker evalúa, expande y recorta la geometría. Cancelar termina el worker. La vista previa muestra el mismo SVG que origina la descarga. Para PNG/JPEG, Canvas rasteriza ese SVG al tamaño físico/DPI solicitado y se escriben pHYs/JFIF correctos.

Paper.js calcula intersecciones de regiones y curvas abiertas. Clipper construye contornos de trazos con aproximación controlada antes de aplicar la matriz afín, conservando escalas no uniformes. DXF usa subdivisión adaptativa de Paper.js en coordenadas físicas ya transformadas.

## Operación

`dist/` funciona por sí solo, sin Node ni Python en producción. Vite y el monitor Python sirven únicamente al desarrollo/revisión LAN. El monitor permite tres rutas HTTP explícitas; no sirve el repo ni los logs de sesiones. Los proyectos permanecen en IndexedDB del cliente o JSON descargado.
