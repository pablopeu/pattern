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
