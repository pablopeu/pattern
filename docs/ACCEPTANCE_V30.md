# Aceptación · PRD v3.0

Estado: **Fases0–7 verificadas el 22/11/2026**. Gate FULL final: 34
infraestructura, 1168 unitarias/TypeScript, 215 E2E y 16 estáticas
(8 raíz + 8 subcarpeta), builds y validadores independientes correctos.

| AC | Requisito | Estado y evidencia necesaria |
|---|---|---|
|01|Compatibilidad|1152 unidades/TypeScript; entrega de galería/perfiles en verificación final. Baseline previo200 E2E/16 estáticas|
|02–03|Navegación/scroll|UX actualizada por feedback:4 contextos útiles, familias visuales, controles por grupos y sin scroll en4 resoluciones; futuras familias pendientes|
|04–05|Edición/simetría|Base euclidiana verificada; extensiones pendientes|
|06|IH1–IH93|93/93 verificados/integrados;81 geométricos+12 marcados propios, pruebas individuales/Scene/JSON y exportación independiente de los12 marcados|
|07|Figurativas|Verificado: 3 figuras C1 y ornamento IH63; bordes relacionados, fuente/detalles conservados, silueta en vivo y composición|
|08–09|Recursión/espirales|Verificado: operadores/inversas, determinismo, fuente única, detalle/IDs, UI/undo/JSON/exportaciones|
|10|Hat/Spectre|Implementados por sustitución publicada,13 semillas/quiralidad/áreas; tres ejemplos, UI/JSON/exportaciones verificados|
|11|Girih|Verificado:5 formas/adyacencias, ensamblado, rayos54°, hebras globales, conflictos/cortes explícitos y regiones vectoriales; SVG/raster/DXF independientes|
|12–14|Hiperbólica/artística/esférica|Parcial: núcleo/compositor Poincaré:92 pares, cámara/LOD, contornos, fuente finita desde escena/celda/ventana con Fill y worker cancelable, presupuestos y diagnósticos independientes; UI no editable/JSON7/SVG/PNG/JPEG geométricos verificados; disco artístico/UI/nativo/exportaciones verificados; bordes canónicos C0 y UI/nativo verificados; coloración por tesela/clase de orientación verificada; esfera verificada: 5 sólidos platónicos por planos de soporte, subdivisión geodésica0–4 (cobertura sin huecos, determinística), textura artística, vista con orientación/zoom/giro/iluminación/fondo/bordes, PNG real y persistencia JSON|
|15|Fuente intacta|Poincaré y esfera: fuente intacta al entrar/salir, regenerar, guardar y reabrir|
|16–19|Timeline/loop/GIF/video|Verificado: controlador común (play/pausa/stop/reiniciar/velocidad/sentido/duración/fps/loop/línea temporal), frames deterministas por t sin acumulación, presets cíclicos cerrados (esfera/disco/artístico) y revelado recursivo no periódico; GIF real por gifenc (cuantización rgb444, loop/once) y WebM con MediaRecorder; progreso, cancelación y sin descarga de archivos vacíos|
|20|Exportación|Base SVG/PNG/JPEG/DXF; nuevas familias pendientes|
|21–22|Ejemplos/derechos|18 estudios:15 previos + lagarto de referencia APPROXIMATED y2 ornamentales Bézier EXACT (MIT/dominio público); JSON/miniaturas reales y atribución SVG/JSON. Esfera/animación pendientes|
|23–24|Acceso/rendimiento|Base verificada; mediciones de nuevas familias pendientes|
|25|Regresiones|Figuras/paletas/JSON6:150/150 E2E,637 unidades,10 estáticas,build y14 monitor. Repetir tras próximas fases|

Baseline: .runtime/v30-baseline-{check,monitor,build,full}.log,
v30-baseline-full-result.json y v30-baseline-static-summary.log. Logs/artefactos
locales excluidos de Git. Matriz se actualiza con evidencia de cada incremento.

Fase1: logs v30-culling-*, v30-phase1-full-result.json (exit0/205,2s),
v30-static-summary.log y v30-independent-check.log. README contiene capturas
y cuatro JSON. Mediciones en TESTING.md. PRD completo todavía pendiente.

Fase2 cerrada21/11/2026UTC: IH93 y figuras originales con colores2–6,
período de color validado por tipo, silueta editable y detalles independientes.
637 unidades,150/150 E2E(229,8s),10 estáticas,build,14 monitor. Primera corrida
149/150 por igualdad de inputs derivados de Fill bajo actualización asíncrona;
2 dirigidas y repetición completa correctas sin cambiar código/aserciones.
CairoSVG comparó4 celdas exportadas/repetidas contra vista directa: máximo
0,176/255. Fuentes únicas, paletas y JSON/PNG/JPEG/DXF verificados.
Logs tile-colors-* y tile-colors-confirmed-*; fases3–7 aún pendientes.

Fase3 cerrada con regresión164/164(248,2s), clasificación afín posterior con
677 unidades/14 dirigidas y10 estáticas/build finales. Girih verifica ángulos,
bordes completos, ciclos de alternancia y5 cruces rasterizados por SVG, no sólo
metadatos. Refuerzos exactos y cortes explícitos diferenciados. Logs girih-*.

## Auditoría final v3.0 (22/11/2026)

Gate FULL real: `QA FULL PASS · INFRASTRUCTURE 34/34 · UNIT 1168/1168 ·
E2E 215/215 · STATIC-ROOT 8/8 · STATIC-SUB 8/8` (.runtime/qa, 532 s).

| AC | Evidencia |
|---|---|
|01 Compatibilidad|Esquema7 con campos opcionales (animation, colors, kind esfera) retrocompatible; pruebas de ida y vuelta por tipo; regresiones v1–v2.3 incluidas en las 1168 unitarias y 215 E2E |
|02 Navegación|Familias por categorías existentes; visualizaciones desde «Visualizar» y modalidad del disco; animación desde «Animar»; ambos con comandos en la paleta |
|03 Scrollbars|Diálogos de disco, esfera y animación sin scroll horizontal en 1440 y 390 (E2E) |
|04–05 Edición/simetría|Editor vectorial existente; transformaciones declaradas exactas con validadores (tilingIssue, isohedralIssue, independent-*) |
|06 IH1–IH93|93/93 verificados/integrados (81 geométricos + 12 marcados), pruebas individuales/Scene/JSON y exportación independiente |
|07 Figurativas|Peces/aves/reptiles IH con bordes relacionados editables en vivo; silueta y detalles independientes |
|08–09 Recursión/espirales|Operadores/inversas, determinismo, fuente única, UI/undo/JSON/exportaciones |
|10 Hat/Spectre|Sustitución publicada, semillas/quiralidad/áreas, ejemplos y exportaciones |
|11 Girih|5 formas, adyacencias, rayos54°, hebras globales, cortes explícitos, SVG/raster/DXF independientes |
|12 Hiperbólica|{p,q} validados, geodésicas/adyacencias verificadas, presupuestos y culling; poincare.spec |
|13 Artístico|Deformaciones rotuladas como tales en UI y reportes |
|14 Esférica|5 sólidos por planos de soporte, cobertura esférica sin huecos (prueba), subdivisión geodésica y vista rotatoria; sphere.test/sphere.spec |
|15 Fuente intacta|Entrar/salir/regenerar/guardar/reabrir conserva la fuente en disco, esfera y animación (E2E) |
|16 Animación|Tiempo normalizado por cuadro, pausa, velocidad, sentido y línea temporal; animation.spec |
|17 Loop|Presets cíclicos cierran en t=0/t=1 (unitario); no periódicos se rotulan y ofrecen once/ida y vuelta |
|18 GIF|GIF real por gifenc con cuantización, delay por fps y loop/once; tamaño y descarga verificados en E2E |
|19 Video|WebM (vp9→vp8) por MediaRecorder con progreso y cancelación; archivo real >1KB verificado |
|20 Exportación|PNG/JPEG/SVG/DXF por representación; 16 estáticas y comparaciones raster previas |
|21 Ejemplos|Galería 19 estudios con todas las familias, incluida «Esféricas»; miniaturas reales por el renderer |
|22 Derechos|Procedencia por ejemplo y docs/ESCHER_VECTOR_SOURCES.md; reconstrucciones APPROXIMATED rotuladas; fuentes sin licencia no redistribuidas |
|23 Accesibilidad|Comandos «Visualizar patrón» y «Animar · GIF y WebM» con palabras clave en Ctrl+K |
|24 Rendimiento|Presupuestos por motor, LOD, cancelación, límites de cuadros y de segmentos; sin bloqueos indefinidos |
|25 Regresiones|215/215 E2E y 1168/1168 unitarias en el cierre; fixture históricos conservados |

Los ejemplos adicionales del PRD de galería (fuentes Openclipart/Ragan pendientes)
quedan **explícitamente diferidos por pedido de Pablo** hasta después de v3.1; no
afectan a los criterios de v3.0.
