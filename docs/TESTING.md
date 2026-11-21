# Pruebas y mediciones

## Suite principal

```bash
npm ci
npm run check
npm run test:monitor
npx playwright install chromium
npm run test:e2e
npm run build
```

`check` combina TypeScript estricto y Vitest. Playwright usa Chromium, 1440×900, y reutiliza el servidor de desarrollo en 4173; si no existe lo inicia. Los tests viven en `src/tests/` y `tests/`. Capturas/trazas de fallos quedan en `test-results/`, excluido de Git.

## Cobertura

- Matrices, composiciones, inversas, reflexiones, unidades y rechazo de singularidades.
- Los 17 grupos: orden, cierre, isometrías y preservación de la red; regiones fundamentales con área correcta, incluyendo redes oblicuas extremas. Siete frisos y centros radiales.
- Todos los generadores: salida vectorial determinística, semillas, Penrose y warps.
- JSON completo, validación semántica, historial y round-trip de los ocho ejemplos.
- Booleanas y recorte con agujeros; Bézier abiertas, contornos afines, celdas rectangulares/oblicuas y snapshots congelados.
- Navegador: dibujo antes de pointerup, nodos editados desde copias reflejadas y rotadas, pluma con tangentes, parámetros, vista dividida, guardado/recuperación, biblioteca/presets, aplicaciones y undo/redo.
- SVG hostil: scripts/eventos/recursos externos, conservación de escala y transforms, rechazo de paths abiertos como perímetro.
- Descargas SVG/PNG/JPEG/DXF desde el worker; expansión sin máscaras. Cancelación tanto del worker como de la rasterización, sin descarga tardía.
- Comparación rasterizada de una escena 3×3 contra mosaicos de la celda SVG para p1, p4g y p6m con formas que cruzan bordes. Diferencia media permitida <2 niveles por canal (0–255), admitiendo antialiasing entre renderizados.
- Monitor Python: umbral real, ventana semanal, eventos expirados y advertencia de fallo de reanudación. No se encolan mensajes reales en sus pruebas.

## Despliegue estático

Servir el build con Python, sin Vite ni API:

```bash
npm run build
npm run serve:dist
TEST_STATIC=1 TEST_BASE_URL=http://127.0.0.1:4180/ npm run test:e2e
```

Para validar un subdirectorio, copiar dist a un directorio de pruebas como `static-root/pattern/`, servir `static-root` y ejecutar:

```bash
TEST_STATIC=1 TEST_BASE_URL=http://127.0.0.1:4180/pattern/ npm run test:e2e
```

También se comprueba `BASE_PATH=/pattern/ npm run build`. El test bloquea solicitudes HTTP a orígenes ajenos al servidor local y verifica dibujo más exportación con worker: esto representa una LAN sin acceso a Internet, conservando el acceso local a los archivos estáticos. No equivale a cortar la conexión con el servidor HTTP.

## Benchmark reproducible

```bash
npm run dev
# En otra terminal:
npm run benchmark
```

El script abre un navegador aislado a 1920×1080, construye 100 objetos fuente, p4m, Warp Grid 2×2 y un perímetro irregular. Mide 60 reconstrucciones del motor sobre un área con más de 300 celdas primitivas, luego cambios reales de parámetros y arrastre de nodos. Escribe `.runtime/benchmark.json` y `.runtime/benchmark.png`. No modifica proyectos del navegador del usuario.

Medición de referencia del 19/11/2026 en esta máquina:

| Operación | Mediana | p95 |
|---|---:|---:|
| Motor, 336 celdas / 2.688 operaciones, 100 fuentes | 0,6 ms | 1,2 ms |
| Actualización de parámetro, escena interactiva | 16,6 ms | 21,1 ms |
| Arrastre de nodo con control Playwright + frame presentado | 33,4 ms | 83,0 ms |

El último dato incluye ida/vuelta del protocolo del navegador. Hay picos y no se garantiza 30 FPS para cualquier composición. La optimización de `<pattern>` redujo el caso de parámetros desde una mediana previa de 71,9 ms. La escena del motor supera 300 celdas; la escena interactiva usa el viewport habitual del editor, sin fingir que ambos tamaños son idénticos.

## Validación independiente de archivos

Dependencias opcionales de QA, **no** del producto:

```bash
python3 -m venv .runtime/validation-env
.runtime/validation-env/bin/pip install ezdxf cairosvg Pillow
npm run validate:exports
.runtime/validation-env/bin/python scripts/validate_exports.py
```

El primer script usa el exportador real para escribir artefactos en `.runtime/exports/`. CairoSVG renderiza el SVG con un motor distinto; Pillow inspecciona píxeles/densidad de PNG y JPEG; ezdxf analiza entidades, unidades y ausencia de coordenadas Z.

Resultados confirmados: SVG aplicado expandido sin clipPath; PNG/JPEG de 1522×1301 px a 200 DPI (PNG pHYs ≈199,9996 por discretización a píxeles/metro); render Cairo con iguales dimensiones; DXF con 36 LWPOLYLINE 2D, unidad mm.

## Revisión visual y límites

Se capturan Diseño, Patrón y Aplicar a 1440×900 y Diseño a 1366×768; también se inspeccionan aplicación irregular, exportación y benchmark 1920×1080. Se comprueban desbordes y errores de consola. Son capturas de inspección real, no snapshots aprobados automáticamente de una referencia externa.

Los resultados finales, fallos corregidos y relación con AC-01…AC-20 están en `docs/ACCEPTANCE.md` y `docs/PROGRESS.md`. No se interpreta un build correcto como evidencia suficiente de geometría o interacción.

## PRD v2: regresión y evidencias nuevas

Se conservan los 57 tests unitarios de v1 y sus 19 flujos de navegador. Las pruebas que requerían un documento periódico declaran ahora explícitamente wallpaper/p1; el inicio real del producto es Libre. Los fixtures de `src/tests/fixtures/v1-examples.json` proceden de los ocho documentos generados por el commit v1 `2aa0987`.

V2 agrega migración 1→2, snapshots/presets, identidad Libre, perfiles sin deriva tras 100 cambios, herencia propia/libre, origen/orientación y área fundamental, inversas fijas pm/p4/p6, exportación compuesta y aplicaciones congeladas. `tests/v2.spec.ts` comprueba miniaturas/hover sin modificar IndexedDB, confirmación por teclado/toque, continuidad de herramienta/estilo, creación desde copias y cruce de celdas, Pluma abierta y pointer capturado al cambiar grupo, origen arrastrable, composición y undo del conjunto activo.

Las comparaciones matemáticas puras conservan tolerancia de cálculo doble y las fuentes JSON se comparan exactamente. En coordenadas tomadas del puntero SVG se permite <0,00005 mm: DOMPoint/Chromium cuantizan coordenadas de pantalla con float32; esto no redondea los datos persistidos.

El benchmark también informa ocho cambios confirmados de grupo hasta dos frames de presentación y la duración de la tanda de 27 miniaturas, incluidas las cesiones programadas. Se separa el área grande del motor del viewport habitual. Las mediciones son locales y no representan una garantía universal de FPS.

### Medición v2 final · 19/11/2026 19:13 UTC

Chromium headless 1920×1080, servidor de desarrollo, sin otra suite de navegador en paralelo. Informe local en `.runtime/benchmark.json`.

| Operación | Mediana | p95 |
|---|---:|---:|
| Motor, 100 fuentes y 336 celdas / 2688 operaciones | 0,6 ms | 1,2 ms |
| Parámetro y frame, 35 muestras | 16,7 ms | 47,3 ms |
| Nodo con ida/vuelta Playwright y frame, 25 muestras | 50,0 ms | 77,3 ms |
| Cambio confirmado de grupo hasta dos frames, 8 muestras | 68,6 ms | — |
| Tanda completa de 27 miniaturas, con cesiones | 1558,2 ms total | — |

El tiempo de grupo incluye preparación y presentación: los dos requestAnimationFrame dan una cota práctica de primera representación, no una medición de pintura de GPU. La tanda comienza tras el debounce de 180 ms; su tiempo no incluye ese debounce. La edición sigue mostrando las miniaturas anteriores y suspende la generación durante gestos de canvas/sliders. Se cachea la URL SVG y el icono matemático para no recodificar ni reconstruir esos elementos durante cada actualización.

Una medición previa sin suspender gestos tuvo arrastre de nodo de 77,5 ms / p95 303,9 ms. La mejora reduce esos picos; siguen existiendo pausas en escenas densas. La mediana de parámetros cumple interacción habitual fluida, pero no se afirma 30 FPS para todo caso ni se convierte el tiempo de protocolo de nodos en FPS del renderer.

Auditoría visual final: miniaturas reales del Jardín a 1440×900 y 1366×768, primera fila completa visible, sin desborde ni errores de consola. Capturas locales `.runtime/v2-gallery-1440.png` y `.runtime/v2-gallery-1366.png`.


## PRD v2.1 · Overlay, captura y teselas

Las pruebas nuevas en `src/tests/v21.test.ts`, `src/tests/tiles.test.ts` y `tests/v21.spec.ts` conservan la suite v2. Verifican isometrías testigo, 17 wallpaper/7 frisos/Cn/Dn en cálculo y SVG, p3m1/p31m, centros a medias traslaciones y deduplicación. Las muestras de tinta rasterizan el SVG real excluyendo contornos de selección y handles; no se aceptan sólo conteos de use en el DOM.

Cada familia de tesela se verifica con bordes rectos y Bézier: emparejamientos, área, cruces, vecinos y cobertura de una región independiente. En navegador se dibuja dentro y fuera de la tesela inicial, se editan bordes con undo/redo y se comprueba recuperación sin alterar fuentes. Se edita un nodo de motivo desde una copia reflejada dentro de otra tesela. Los mosaicos raster de SVG exportados se comparan con la escena grande para cuadrado, rectángulo, triángulo y hexágono curvos, con diferencia media <2 por canal.

```bash
node scripts/benchmark-structure.mjs
```

Medición aislada del 19/11/2026 21:36 UTC, Chromium headless 1440×900, 100 fuentes, p6m, viewport 300×190,32 mm:

| Desplazamiento real, 25 muestras | Mediana | p95 |
|---|---:|---:|
| Overlay apagado | 33,19 ms | 34,49 ms |
| Overlay encendido | 33,33 ms | 34,21 ms |

Las muestras incluyen protocolo Playwright y un frame: no equivalen a FPS del renderer. La diferencia observada está dentro de la variación de la medición. El cálculo sin caché del overlay tuvo medianas de 0,1 a 1,6 ms entre los 17 grupos; p6m: 1,6 ms y p95 1,9 ms, con 97 ejes, 110 centros y 419 segmentos de dominio en ese encuadre. Ningún caso requirió reducción por densidad. Informe en `.runtime/benchmark-structure.json`.

Auditoría visual: `.runtime/v21-review-1440.png`, `v21-review-1366.png` y `v21-tiles-1366.png`. Logo local cargado a 142×66 px, sin desbordes ni errores de consola; se inspeccionaron el fondo matemático tenue y la edición de un hexágono irregular con motivo local.


Cierre v2.1: **140 unitarias, 50 E2E y 4 tests de monitor correctos**. Producción: **4 pruebas estáticas correctas**, dos por raíz/subdirectorio, manteniendo el caso previo y añadiendo logo local, tesela curva, exclusión de guías y contornos explícitos desde el worker. TypeScript y build correctos.

El validador independiente ahora produce también tile-editable.svg, tile-expanded.svg, tile.png y tile.dxf. CairoSVG y el raster del navegador muestran tinta real de un hexágono Bézier a 787×630; ezdxf comprueba 58 polilíneas 2D en mm dentro de la región de 100×80. Se sigue verificando la aplicación irregular v1 a 200 DPI. El test de parametrización compara puntos cúbicos continuos tras reflexión e inversión del recorrido.

## PRD v2.2 · Estilos, trazo físico y Fill

`src/tests/v22.test.ts`, `precision.test.ts`, `fill.test.ts`, `planar.test.ts` e `interaction-geometry.test.ts` comprueban estilos por valor, migración a esquema 4, geometría de guiones/perfiles, tolerancia física bajo afinidades, disposición planar, huecos, referencias de órbita, vínculos y contornos fijos. Se conservan las suites previas: total **203 unitarias** y TypeScript estricto correctos.

`tests/v22.spec.ts` agrega 9 flujos: vigente, selección mixta/política, paletas/presets, panel/indicador, un gesto/un undo, apariencia sólo derecha, límites recuperables, Pluma/Escape y panel superpuesto. `v22-fill.spec.ts` agrega 16: clic y primer toque directos, color persistente al retirar el puntero, cola/autocierre/undo, cuatro límites, Bézier, agujeros, apertura y cierre explícito, instancias cruzadas y reflejadas, recálculo/cancelación y teselas vinculadas/fijas. Las comprobaciones raster eliminan previews y handles: el color debe pertenecer al modelo real.

Producción: tres pruebas estáticas en raíz y tres con base `/pattern/`, bloqueando todo origen externo. Cubren regresión previa, logo local, teselas curvas, panel/Fill/presets/perfiles, JSON guardado y SVG producido por worker. Ambos builds compilados con `npm run build` y `BASE_PATH=/pattern/ npm run build`.

La validación externa existente incorpora seis escenarios v2.2: trazos con alfa/puntos/perfiles, template escalado, cara con agujeros, órbita/composición, tesela curva y aplicación congelada tras vaciar la fuente viva. CairoSVG compara SVG editable/expandido y raster del navegador; Pillow verifica píxeles, tamaño y DPI; ezdxf verifica mm, contornos 2D, agujeros y límites del recorte. Los seis aprobaron. MAE máxima editable/expandido:0,06681 sobre 255; Chrome/CairoSVG:0,88727. Artefactos e informe en `.runtime/exports/v22/`.

```bash
node scripts/benchmark-fill.mjs
node scripts/benchmark-structure.mjs
node scripts/capture-readme.mjs
```

Fill, referencia del 20/11/2026: rejillas de 25 caras rectas y curvas, construcción59,0/76,6 ms;60 consultas con un solo build, p95=0,2 ms. El exceso explícito de1.200 entradas se informa en100,1 ms. rAF máximo16,8 ms en esas escenas. No se extrapola a cualquier complejidad. Overlay apagado/encendido con 100 fuentes: medianas 33,36/33,44 ms; p95 34,82/34,56 ms, incluyendo protocolo Playwright y un frame presentado. Informes en `.runtime/v22-benchmark-fill-final.log` y `.runtime/benchmark-structure.json`.

Las imágenes del README y sus JSON se generan en un contexto de navegador aislado. Los JSON se vuelven a validar con parseProject/serialize antes de escribirlos. No se capturan direcciones de la barra del navegador ni se usan proyectos del usuario.

Monitor: **9 pruebas Python**, incluyendo POST HTTP real con cola simulada, entrega en trabajo/espera/completado, persistencia del estado, reintento y exclusión mutua. No se envían mensajes de prueba a la conversación real ni se altera su marcador PROJECT_COMPLETE.

Regresión completa: **75/75 flujos correctos** en una sola corrida (6,7 minutos), conservando los 50 de v1/v2/v2.1. Resultado y matriz de aceptación en docs/ACCEPTANCE.md y docs/PROGRESS.md.


## PRD v2.3 · Navegación contextual

TypeScript y203 unitarias correctos. La corrida final aprueba **94/94 E2E**
en 4,3 min: los 75 recorridos anteriores, adaptados a categorías/tabs mediante
`tests/navigation.ts`, y19 nuevos en `tests/v23.spec.ts`. Se conservan sus
aserciones de geometría/tinta/exportación/persistencia/undo. Los nuevos
cubren cuatro resoluciones (1366×768,1440×900,1920×1080,390×844), documento
intacto al navegar, todos los contextos sin scroll de configuración,
polígono, catálogo completo/favoritos/hover/undo, propiedades/nodos/booleana,
presets/paletas, comandos, foco/Escape y resize sin overlays simultáneos.

La comprobación de selects compactos incluye que padding y línea de texto
quepan dentro del control. Se inspeccionaron las cinco capturas regeneradas
del README. Las colecciones extensas se paginan o seleccionan explícitamente;
listas inherentemente largas mantienen un scroll de respaldo accesible.

Ambos builds aprobaron y hay **6 pruebas estáticas correctas**,3 en raíz y3
con base `/pattern/`, bloqueando orígenes externos. La prueba espera que la
cámara termine de ajustar el ancho antes de convertir un probe a coordenadas
de pantalla. No confunde opciones de exportación con el panel de teselas.
El servidor temporal de QA se inicia como proceso independiente para que
la vida de una llamada de herramienta no interrumpa las pruebas.

Se reejecutó la validación independiente completa: escenarios v1/v2.1 y los
seis v2.2 correctos en CairoSVG/Pillow/ezdxf. Los scripts de benchmark usan
las nuevas rutas de navegación y se ejecutaron correctamente. Sus datos son
referencias locales (con otras verificaciones concurrentes); no se afirma una
mejora de FPS. Core100 fuentes: mediana 0,7 ms/p95 1,2 ms;27 miniaturas completas
en 1707 ms. El tiempo de nodos incluye protocolo y presentación y varía con carga.

Logs `.runtime/v23-*`; matriz final en `docs/ACCEPTANCE_V23.md` e inventario
con rutas por función en `docs/UX_V23_INVENTORY.md`. Monitor:9 pruebas correctas,
sin feedback de prueba ni modificación del marcador real de cierre.

La última auditoría visual encontró acciones fuera del ancho de la cabecera
a 390px. Se corrigieron con dos filas y una etiqueta Archivo visible. El E2E
comprueba los bounds completos de esas acciones, y el nombre del documento
se puede editar desde Preferencias también en móvil. Sobre este ajuste final
pasaron nuevamente 94 E2E,203 unitarias y ambos builds con 6 estáticas.


## v3.0 · Recursión y semejanzas

`composition.test.ts` y `composition-scene.test.ts` verifican operadores, inversas,
potencias, IDs/niveles, cortes por presupuesto/detalle/vista, conservación de
fuentes y contextos Fill, paletas, migración4→5, presets/snapshots y SVG.
`v30.spec.ts` cubre galería sin mutación al cancelar, cuatro resoluciones, fuente
editada con nodos/undo, regeneración, descargas JSON/SVG y recetas personales.
`static.spec.ts` incluye galería, receta nativa5 y PNG con orígenes externos bloqueados.

Para producir artefactos independientes y mediciones, con la app4173 activa:

```bash
node scripts/validate-v30-composition.mjs
.runtime/validation-env/bin/python scripts/validate_v30_composition.py
# Opcional: actualizar cinco capturas reales y cuatro JSON para el README
node scripts/validate-v30-composition.mjs --capture
```

Dependencias opcionales de QA: las mismas CairoSVG, Pillow y ezdxf del apartado
anterior. Los archivos quedan en `.runtime/v30-exports/`. Se comparan SVG
editable/expandido y raster navegador/Cairo; se comprueban tinta, paletas, medidas,
DPI, JSON5 y DXF plano en mm dentro de la región solicitada. Ningún script
reemplaza proyectos del navegador del autor; usa un contexto aislado.

Medición local21/11/2026UTC: cuadrantes de profundidad6 con10 fuentes,4096
colocaciones solicitadas y28667 nodos; en una vista10×10mm quedan24 visibles
y4072 descartadas. Mediana de20 evaluaciones5,4ms y p95 observado12,5ms, luego
de5 calentamientos. Es tiempo del motor, sin render/protocolo; no garantiza FPS.
Datos en `.runtime/v30-exports/manifest.json`.


## IH1–IH93 · Verificación matemática e independiente

524 pruebas unitarias/TypeScript, incluidos dos casos geométricos por cada tipo,
93 recorridos Scene/JSON,13 casos adicionales de marcas interiores, de Casteljau
y exportaciones. Siete E2E dirigidas verifican cuatro resoluciones, gestos,
rechazos sin perder estado, Fill, JSON/SVG, IH93 y edición de una única fuente
con copias interiores IH19. Regresión integrada124/124 en207,8s y10 estáticas
raíz/subcarpeta correctas; build correcto. Logs v30-iso93-* en.runtime.

```bash
node scripts/generate-marked-isohedral.mjs
node scripts/validate-v30-isohedral.mjs
.runtime/validation-env/bin/python scripts/validate_v30_isohedral.py
```

El primer comando verifica las12 definiciones congeladas sin escribir. QA se
ejecutó con Node24.22.3. Los otros generan/analizan SVG editable/expandido,
PNG/JPEG96DPI, DXF2D y JSON de los12 tipos marcados. Se comprueba tinta interior
real, no sólo fondos: CairoSVG frente a navegador y geometría expandida. Error
medio máximo observado0,067/255 entre SVG editable y expandido. Fuente de dos
objetos conservada, unidades180×140mm y contornos dentro de región verificadas.


## Figuras y período de color · Fase2

`tile-colors.test.ts` comprueba período positivo/negativo para IH1–IH93,
independencia entre geometría y RGB, conservación de vínculos, fuente única,
JSON6/tiling2 y supercelda SVG. Incluye el recorte de ejes con varios subpaths
abiertos: Paper.js requiere intersectar cada eje antes de reunirlos en una sola
geometría de trazo. `tile-colors.spec.ts` prueba2–6 colores sin scroll a cuatro
resoluciones y Fill por clase tras cambiar N, conservado después de recargar.

```bash
node scripts/validate-v30-figurative.mjs
.runtime/validation-env/bin/python scripts/validate_v30_figurative.py
node scripts/capture-v30-figurative.mjs
```

El validador independiente compara SVG editable/expandido, raster/DPI, DXF plano
y las cuatro fuentes. También repite la supercelda transparente por sus vectores
reales y compara con una vista directa del mosaico usando CairoSVG. Comprueba
tinta de cada color, además de detalles claros; no acepta sólo cadenas RGB en
el XML. Capturas/JSON públicos se generan desde un contexto aislado del editor.


## Hat / Spectre · Sustitución, quiralidad y fuente

`aperiodic.test.ts` comprueba conteos de cinco generaciones, IDs deterministas,
isometrías y mano positiva en todos los Spectre, incluidas generaciones impares.
Las13 semillas pasan unión booleana a profundidad2: área suma=área unión, un
componente sin agujeros de área>1e-9 en coordenadas canónicas. Paper puede dejar
subpaths degenerados del orden1e-15 en las costuras cúbicas. Se conservan estos
límites numéricos explícitos; no se deduce aperiodicidad de una captura.

`aperiodic-scene.test.ts` verifica JSON6/generador2, rechazo de celda periódica,
fuente única, paletas, edición/retorno y culling con IDs/clases conservados.
`aperiodic.spec.ts` prueba cuatro resoluciones sin scroll, recarga real, dibujo
en la fuente, exportación y Fill visible/persistente bajo el perímetro.

```bash
node scripts/validate-v30-aperiodic.mjs
.runtime/validation-env/bin/python scripts/validate_v30_aperiodic.py
node scripts/capture-v30-aperiodic.mjs
```

CairoSVG/Pillow/ezdxf verificó los3 ejemplos: error medio máximo0,077/255 entre
SVG editable/expandido, tinta de paletas, PNG/JPEG907×907 a96DPI sobre240mm y
DXF plano/mm. La captura usa un contexto aislado, sin tocar proyectos del autor.
