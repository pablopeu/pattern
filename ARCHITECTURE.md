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

## Evolución v2

`src/symmetry/config.ts` centraliza la resolución pura de Libre/propia/heredada, las configuraciones por grupo, el congelado efectivo y la verificación conservadora de una celda rectangular común. Canvas, galería y exportación consumen patrones resueltos; las aplicaciones vinculadas resuelven contra la principal confirmada y las congeladas almacenan un conjunto autónomo.

El orden es `G · P · Q · S`: operación/traslación de grupo, colocación independiente del patrón, colocación del generador y transformación del objeto. Cambiar grupo modifica sólo configuración y perfiles. Adaptar a celda modifica P; cambiar origen/orientación conjuga las operaciones y rota la red, conservando las coordenadas fuente absolutas.

`editor/capture.ts` produce candidatos ordenados por prioridad explícita, hit geométrico, distancia de referencia e ID estable. El contexto del gesto guarda patrón, herramienta, matriz C e inversa. Cada punto usa C⁻¹ hasta finalizar; cada nodo existente añade la inversa del objeto. El orden de nodos SVG no elige el contexto.

`SymmetryGallery` agenda las 27 miniaturas después de 180 ms y cede el hilo entre opciones. Comparte una generación de motivo por tanda; cancela por firma de contenido y conserva las miniaturas anteriores. Las preferencias sin cambios geométricos no cancelan una tanda útil. Durante gestos de canvas/sliders la generación se suspende; URLs SVG e iconos se cachean para evitar recodificación y reconstrucción por cada punto. Hover se aloja fuera de Project/History/IndexedDB y sólo afecta los patrones correspondientes al objetivo del preview.

La composición reutiliza `patterns[]` como capas visibles ordenadas. Cada conjunto mantiene generador, modo y colocación; no se introduce un scene graph. El SVG compuesto asigna prefijos a las referencias locales de cada conjunto y los demás formatos reutilizan la misma geometría efectiva. Un friso, radial, Libre o Penrose no certifica una baldosa bidimensional común.

Los trazos se registran una vez al iniciarse y su contenido final actualiza las versiones históricas que contienen ese ID. Así un cambio de grupo durante una Pluma abierta sigue siendo una acción separada, y undo no recupera un path parcialmente capturado. El viewport de cada canvas permanece estable al cambiar entre Diseño y Patrón.

## Incremento v2.1

`structure.ts` deriva marcas con una isometría testigo T(Bn)G, no sólo con representantes de una celda. Incluye centros intermedios, ejes deslizantes y marcos girados. Recorta al viewport y deduplica coincidencias; los centros conservan su orden máximo. Un caché de contenido acotado evita recomputar cuando sólo cambia una fuente. El renderer aplica opacidad al grupo completo y vector-effect para grosor visual constante. Las miniaturas usan el mismo cálculo, las exportaciones no lo reciben.

`tiling/tiles.ts` construye vértices, bordes emparejados, redes, colocaciones y contornos únicos. `validate.ts` contrasta esas construcciones con Paper.js. La definición opcional permanece separada del generador y de las fuentes. `TilePanel` y `TileEditor` actualizan nodos/tangentes normalizados mediante el historial existente; no materializan vecinos editables.

`buildScene` compone una escena interior de motivo, sus continuaciones por adyacencia y las copias de la tesela. El renderer comparte una plantilla vectorial recortada, con contornos deduplicados externos. La captura filtra las copias por su clip real, incorpora la matriz exterior y mantiene una inversa fija.

`materializeTiling` crea únicamente una plantilla temporal para exportaciones expandidas/DXF. Reutiliza el mismo interior y el recorte real, conservando aplicaciones vinculadas/congeladas. SVG editable conserva defs/use y clips; los demás formatos usan la geometría derivada. Contornos se solicitan aparte y no se convierten accidentalmente en bordes duplicados para corte.

Esquema nativo 3 y presets 3, con lectura compatible v1/v2; formato geométrico canónico intacto. El logo del usuario es un asset PNG local de Vite, sin servicio remoto.
