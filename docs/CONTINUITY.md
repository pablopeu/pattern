# Reanudación real · Feedback antes del PRD

Primaria nueva confirmada0% usada a05:30UTC; servicios existentes conservados.
Monitor actualizado: guarda feedback con estado waiting_reset mientras resta
10% o menos en primaria vigente, libera tras reset real o banked reset; secundaria
no bloquea. Panel muestra En cola hasta reset.14 pruebas Python correctas,
incluidos HTTP real aislado, reintento y no duplicación. Se recargó sólo el
monitor tras terminar el proceso anterior; app sigue con el mismo PID. HTTP200.

Ahora resolver feedback acumulado: snaps permanentes/menú contextual y clic
derecho para terminar Bézier; preferencias de usuario persistentes separadas
del arranque geométrico P3; Fill azul inicial, selector visible/foco primero,
elegir color activa Fill y rellenos siempre bajo sus límites. Luego continuar
Fase2 del PRD (figuras/composición/colores) y fases3–7, según criterios originales.
El monitor sigue vigilando primaria; no hay suites E2E activas.

---

# En espera del reset primario · Feedback nuevo pendiente

Pablo aclaró: cuando resta10% o menos de la ventana primaria, el incremento ya
está cerrado y el monitor sigue funcionando, el feedback se GUARDA EN COLA y
se ejecuta después del reset real de5 horas. No iniciar implementación por la
llegada de feedback durante esa pausa. Durante trabajo con cupo disponible,
conservar entrega de feedback activa; secundaria/semanal sólo avisa.

Próxima reanudación, ANTES de continuar Fase2:
1. Corregir uniones de nodos: al unir un extremo de Bézier/línea y después el
   otro, Pablo observa que se desenganchan ambos. La coincidencia geométrica
   actual NO garantiza snaps permanentes; no declarar ese criterio resuelto.
   Implementar vínculo estable y probar unión sucesiva de ambos extremos,
   arrastre desde cualquiera, transformaciones, guardar/abrir y undo/redo.
2. Menú contextual de clic derecho en lienzo: separar snap, añadir nodo en la
   curva preservando su forma y eliminar nodo existente. Acciones según destino.
3. Ajustar monitor para encolar feedback mientras primaria<=10% y trabajo
   cerrado; entregarlo tras reset primario sin perder ni duplicar mensajes.
   No impedir feedback durante trabajo activo con cupo disponible. Esta regla
   quedó registrada, todavía NO implementada en scripts/work_monitor.py.

Feedback original guardado en.runtime/feedback.jsonl, id
933b3fed2daa40a9ba35bbaf85ed6819,2026-11-21T02:40:58Z. No se inició código nuevo
tras ese mensaje. Cambios anteriores en7ded3ed, publicados, Git limpio al
recibirlo. Checks anteriores529 unidades/131 E2E/10 estáticas siguen siendo
históricos válidos, pero NO cubren el fallo nuevo de snaps sucesivos.

Monitor vivo y timer primario+60s existente; no tocar ni posponer al semanal.
PROJECT_COMPLETE ausente, PRD v3.0 pendiente. Mantener servicios4173/4174.

---

# Cierre por cupo · Snap independiente, vértices compartidos y Bézier abiertas

Incremento de feedback en cierre; no iniciar otro mientras primaria<=10%.
Snap de barra controla Atracción entre nodos; Preferencias separa Ajustar a
grilla y Atracción entre nodos, con Distancia de atracción a nodos1–40px
(inicial8), visualmente constante con zoom. Cercanía se calcula en coordenadas
visibles de instancias/placements y transform de cada geometría; nodo más cercano
antes que grilla, círculo verde de destino, no se atrae al propio nodo móvil.

Al iniciar arrastre se detectan nodos coincidentes a1e-7 en la vista y se mueven
juntos usando la inversa de cada matriz. Unión geométrica inferida de coordenadas,
sin IDs/cachés nuevos: persiste al guardar/abrir. Objetos ocultos/bloqueados y
rellenos derivados excluidos. Alt al iniciar permite separar el extremo.
Fuentes siguen independientes y tangentes se conservan. Esta propagación se
aplica al arrastre de nodos; no se añadió un grafo de restricciones para mover
objetos completos ni para cambios numéricos del inspector.

Relleno de paths abiertos desactivado en SVG/preview/hit-test/recorte expandido;
se conserva color elegido, se habilita sólo con cierre explícito o extremos
coincidentes. Para cerrar con otras líneas, Fill detecta la región de conjunto.
Dos triángulos comparten un borde usando5 trazos y2 rellenos independientes.
La tolerancia de Fill sigue siendo distinta del radio de snap.

529 unidades/TypeScript y build correctos. Prueba de navegador confirmó snap
con grilla apagada, tres extremos que se desplazan exactamente juntos, undo/redo,
radio guardado y2 rellenos sin duplicar borde. Bézier abierta/cerrada también
pasó en navegador. Primera regresión129/130 detectó overflow en Preferencias
1366; compactado sin ocultar controles. Cuatro tamaños dirigidos ya pasaron.
La prueba de arrastre continuo usa precisión física4decimales para posición
solicitada por ratón y coincidencia EXACTA entre líneas: SVG/DOM usa float32.

REGRESIÓN FINAL131/131 CORRECTA (210,5s, exit0):
.runtime/node-snap-final-full.log y node-snap-final-full-result.json. Build final
y10 estáticas (5 raíz+5 subcarpeta), con output separado, también correctos.
Logs node-snap-final-{build,static-summary}.log. README actualizado.
No hay suites activas. Incremento listo para commit/push y finalizar el turno.

Servicios4173/4174 conservados; primaria95% usada a02:34UTC, reset real seguido
por monitor (+60s); secundaria sólo avisa. PROJECT_COMPLETE ausente. Después del
reset continuar Fase2 del PRD en docs/prd/prd_v3.0.txt: figuras originales,
silueta enlazada→composición y colores alternados con período de exportación
correcto; luego fases3–7. No declarar PRD completo. Push main autorizado;
no revisar Actions/FTP. Feedback anterior de.runtime revisado, sin otros nuevos.

---

# Vistas completas, Desplazar vista y footer móvil · Verificado

Footer apilado hasta900px: texto, invitación y enlaces sociales completos, sin
scroll horizontal ni vertical de página. Quitado mínimo550px en ese rango para
que también permanezca visible al girar el móvil. Contraste/negritas y enlaces
conservados; escritorio mantiene una línea de38px.

Desplazar vista junto al zoom del lienzo; H/Espacio conservados. En Una celda
permanece fija y centrada, con zoom permitido. Cámara/recorte/límite usan la
misma celda de traslación: antes IH89 encuadraba la tesela triangular mientras
recortaba la celda completa. Ajustar/Restablecer ahora dejan toda la referencia
visible, también por encima de la barra del lienzo. Cambiar bordes no reajusta
el zoom. Revisados93 tipos ×4 resoluciones, con origen y rotación no triviales.

524 unitarias/TypeScript, build y128/128 E2E (209,6s/exit0) correctos.
Después del ajuste exclusivo para alturas móviles menores550px:5/5 E2E de
vistas, incluidos los372 encuadres repetidos y7 tamaños/orientaciones del
footer, y10 estáticas (raíz/subcarpeta) correctas sobre build final.
Logs.runtime/cell-frame-final-{check,build,full,targeted,static-summary}*,
capturas cell-ih89-* y mobile-stacked-footer.png. En la primera regresión falló
por2px un panel IH19 móvil; ayuda abreviada y caso dirigido/regresión128
posteriores correctos, sin relajar el límite de overflow.

README actualizado. Servicios4173/4174 conservados; primaria80% usada a02:10UTC,
secundaria sólo avisa. PROJECT_COMPLETE ausente. Fase2 sigue pendiente de los
ejemplos figurativos, silueta enlazada→composición y colores alternados con
período exportable correcto; fases3–7 pendientes. Prototipos originales en
.runtime/figurative-prototype.mjs todavía NO incorporados a la galería.
Push main autorizado; no inspeccionar Actions/FTP después.

---

# V3.0 · IH93 verificado; seguir ejemplos figurativos para cerrar Fase2

93 tipos integrados:81 de TactileJS y12 propios por reflexión/estabilizador
interior. Los12 no son aliases; matrices/bases/aspectos congelados en
isohedral/marked-data.json y generador reproducible. El motivo se proyecta por H
en Scene sin duplicar su fuente; los bordes marcados permanecen rectos.
Catálogo93 habilitado, filtro Marcas interiores y miniaturas con marca genérica.

524 unitarias/TypeScript,124/124 E2E (207,8s/exit0),10 estáticas,build correctos.
Los12 marcados pasaron exportaciones independientes CairoSVG/Pillow/ezdxf:
tinta interior real, SVG editable/expandido(error máx0,067/255), PNG/JPEG96DPI,
DXF2D/mm y JSON2 fuentes. Siete E2E dirigidas también correctas, edición real de
una fuente IH19 con seis copias interiores y exportación expandida. Logs
.runtime/v30-iso93-* y generador v30-iso-marked-generator.log.

Fase2 NO completa: faltan ejemplos figurativos originales y cierre del flujo
figura→composición. Próximo incremento previsto: peces IH43, aves IH44, reptiles
IH1 y ejemplo de marcas IH63. Evaluar Fill.kind=tile con scope=source como
silueta-motivo enlazada: refreshLinkedFills ya trata kind tile, pero Scene
exterior debe pintar esa silueta una sola vez por tesela; la composición debe
recibirla como parte fuente. Detalles siempre independientes. Colores alternados
requieren una red de exportación que respete su período; no reutilizar la red
geométrica como si incluyera automáticamente el período de color.

No hay suites activas. Servicios4173/4174 vivos; primaria44% usada a01:24UTC
observada, secundaria sólo avisa. PROJECT_COMPLETE ausente. PRD en
docs/prd/prd_v3.0.txt, documentación en docs/, logo src/assets/icono.png; raíz
ordenada y referencias públicas ya publicadas en d4868c6. No revisar Actions/FTP.

---

# V3.0 · IH81 y reorganización verificados; continuar12 marcados/figuras

Integración IH81 en83158ab, raíz organizada en85d22aa, Referencias fe3d74c.
475 unidades/TypeScript,123/123 E2E integradas (exit0,208,2s),
10 estáticas (5 raíz+5 subcarpeta), build correctos. Estáticas prueban catálogo
IH/JSON/worker/SVG y Referencias/avisos, sin orígenes externos. Logs
.runtime/v30-iso81-{full,static-summary}*, v30-iso-ui-check.log y
reorganization-build.log. Captura del catálogo en README. Servicios conservados.

Fase2 NO completa. Pendientes12 IH con marcas interiores y ejemplos figurativos
originales; luego fases3–7. Prototipo puro en.runtime/marked-prototype.mjs y
marked-data.json:12 construcciones por reflexiones de polígonos, estabilizador
interior y red primitiva. Todos dieron cero conflictos de ciclos, número de
aspectos/orden puntual esperado y área de celda correcta. Aún no integrado ni
verificado en aplicación; no presentar como93 implementados. Datos propios,
sin copiar gráficos de referencia. Próximo: trasladar a módulo puro, probar
cada tipo y aplicar simetrías interiores al motivo sin clonar fuentes.

Leer docs/prd/prd_v3.0.txt (ubicación nueva). Docs técnicos en docs/, logo en
src/assets/icono.png, originales de subidas en.runtime/original-assets excluidos.
.gitignore reforzado; no reponer documentos ni archivos crudos en raíz.
Mantener lista de repos consultados en ReferencesDialog; Pablo no quiere
investigación extensa de licencias, sí referencias visibles/avisos originales.

No hay suites E2E activas. Pueden editarse módulos. Comprobar cupo real sólo
primaria5h y feedback; mantener4173/4174 sin duplicar. PROJECT_COMPLETE ausente.
Push autorizado; no inspeccionar Actions/FTP después.

---

# V3.0 · IH81 integrado; verificación transversal y12 marcados a continuación

Motor IH conectado a TilingDefinition (`kind:isohedral`, datos opcionales type/
parameters sin duplicar bordes), Scene, captura, renderer/contornos, Fill, JSON5,
presets, migraciones legadas y SVG editable/expandido. Lectores viejos rechazan
el kind desconocido en vez de perder silenciosamente la construcción.

Teselas → Explorar catálogo IH1–IH93 y Ctrl+K: búsqueda, filtros por familia,
miniaturas reales de tesela/mosaico, preset recto/curvo, indicadores de espejo/
giro y cobertura honesta81/93;12 marcados deshabilitados como pendientes.
Parámetros paginados, bordes/tangentes existentes, centros de espejo editables,
rectos bloqueados, nodos añadidos por de Casteljau sin cambiar la silueta.
Ediciones IH pasan validador geométrico antes de tocar el modelo; rechazo conserva
la última válida y la fuente. Cámara encuadra la celda IH al elegirla.

475 unidades/TypeScript y build correctos;6 E2E dirigidas correctas en dos
corridas:5/6 iniciales y caso IH41 corregido/repetido con éxito. El fallo era
selector ambiguo Forma de objeto/tesela, no geometría. Cuatro resoluciones
inspeccionadas sin scroll/desbordes; imágenes reales en.runtime/iso-*.png.
Gesto/nodo/undo/inversión rechazada/Fill/JSON/SVG/IH93/CtrlK comprobados.
Logs v30-iso-{ui-check,targeted,gesture,layout}.log, reorganization-build.log.

Regresión integrada123 E2E EN CURSO en.runtime/v30-iso81-full.log, runner
resultado v30-iso81-full-result.json. No editar módulos activos ni build/notices
hasta finalizar. Nueva estática IH/referencias añadida; pendiente correr5+5
raíz/subcarpeta sobre build actual. No declarar completa Fase2:12 marcados y
ejemplos figurativos aún pendientes, además de estas verificaciones.

Raíz ordenada en85d22aa antes del próximo push: docs técnicos en docs/, PRD
en docs/prd/prd_v3.0.txt, logo en src/assets/icono.png; hashes originales intactos.
Docs/README índice y enlaces correctos; uploads crudos en.runtime/original-assets,
gitignore reforzado. Revisión pública185 archivos sin IP/tokens/claves detectados.
Referencias visibles fe3d74c y núcleo0f44679 locales; Fase1 publicada0a9a3ce.
Servicios4173/4174 vivos, primaria26% usada a01:00UTC, secundaria sólo avisa.
PROJECT_COMPLETE ausente; seguir PRD completo hasta umbral primario real.

---

# Organización pública del repositorio · Antes del próximo push

A pedido de Pablo, documentación técnica en docs/, seis PRD originales en
docs/prd/, incluido docs/prd/prd_v3.0.txt, y logo original sin cambiar bytes en
src/assets/icono.png. README/AGENTS y archivos fundamentales de herramientas
permanecen en raíz. Índice en docs/README.md. Enlaces e importación actualizados.

caratula.jpg/favicon_io.zip originales se conservan en .runtime/original-assets/,
fuera de Git; public/ conserva los recursos publicados. .gitignore cubre también
archivos locales de entorno/FTP, logs y originales subidos a raíz. Revisión de185
archivos seguidos sin IP privadas completas, tokens reconocibles ni claves
privadas; no se publicó salida sensible ni se reescribió historial. Runtime,
dist, node_modules y test-results siguen sin seguimiento.

475 unidades/TypeScript y build actuales correctos; enlaces locales revisados.
Integración IH81 en trabajo: catálogo/JSON/renderer/Fill conectados, E2E dirigidas:
5/6 correctas; el caso IH41 encontró una ambigüedad de selector del test entre
Forma de objeto/tesela, en corrección. No se declara completa Fase2 ni el PRD. Antes de publicar, cerrar
estas verificaciones y conservar servicios4173/4174. No generar build ni editar
módulos durante E2E activas. La reanudación debe leer el PRD en su nueva carpeta.

---

# Pedido de Pablo · Referencias visibles, continuar PRD3.0

Nuevo botón Referencias (libro) junto a Ayuda, modal nativo con scroll,16 enlaces
a repositorios consultados/bibliotecas y otras referencias. Ctrl+K encuentra
Repositorios y referencias. Lista ampliable en src/ui/ReferencesDialog.tsx.
No cambia el documento; Escape restaura foco y cierre siempre accesible.
387 unidades/TypeScript,build y revisión real1366/1440/1920/390 correctos:
.runtime/references-{check,build,browser}.log; capturas references-*.png.
Pablo pidió reutilizar código open source sin investigación extensa de licencias;
conservar avisos y actualizar este modal/THIRD_PARTY_NOTICES al usar más fuentes.

Monitor confirmó un reset real nuevo: primaria2%/secundaria0% a00:31UTC;
00:37 primaria8% y secundaria1%. No se cambió timer manualmente. Continuar
el PRD, próxima integración del núcleo IH81 a modelo/archivos/UI/exportaciones.
Fase2 y12 IH marcados pendientes. App4173/monitor4174 vivos.

---

# V3.0 · Fase2: núcleo isoédrico81 verificado, integración pendiente

Fase1 publicada en0a9a3ce. Nuevo módulo puro isohedral/{model,engine,validate},
adaptador propio a matrices SVG, partes canónicas J/U/S/I, contornos Bézier y
órbitas por red/aspectos. TactileJS BSD3 vendored sin modificar y con hash/licencia
verificados. Ningún asset de referencia copiado; notices incluye atribución.

387 unitarias/TypeScript correctas:164 nuevas, incluyendo dos casos por cada
uno de81 tipos. Prueban área/densidad, isometrías e inversas, IDs determinísticos,
cierre angular2π sin huecos/solapamientos alrededor de cada vértice, deformaciones
Bézier y restricciones de espejo recto, errores y presupuesto. Validador revisa
autointersección, orientación, área y solapamiento con vecinos. Log
.runtime/v30-iso-core-check.log; build correcto en v30-iso-core-build.log.

TODAVÍA no integrado a Pattern.tiling, archivos, renderer/captura, UI, Fill o
exportaciones: la aplicación publicada sigue mostrando sólo las5 familias
geométricas anteriores. Próximo incremento: conectar el nuevo motor sin alterar
formatos legados ni duplicar bordes, galería IH y edición de siluetas. Fase2 NO
completa:12 tipos marcados también pendientes, lista en REFERENCES_V30.md.

Servicios4173/4174 activos, PROJECT_COMPLETE ausente; sólo primaria5h pausa.
Secundaria100% sólo avisa. No hay suites E2E activas; pueden editarse módulos.

---

# V3.0 · Fase1 verificada; continuar Fase2

Recursión y semejanzas integradas sin duplicar fuentes: UI contextual, cuatro
ejemplos originales, galería de12 proyectos, recetas personales y portables,
JSON/presets5 (migración4 pura), captura inversa y SVG/PNG/JPEG/DXF.
Culling del lienzo conserva IDs/matrices, usa tinta fuera del marco original y
presupuesto previo al descarte. Exportación usa detalle físico, independiente
del zoom. Fill reconoce cambios geométricos de composición, no de paleta;
suspende fondos de tesela sin borrar fuentes y conserva regiones de órbita.

Verificación real:223 unidades/TypeScript,117/117 E2E en205,2s (exit0),build,
8 estáticas raíz/subcarpeta sin solicitudes externas. Cuatro ejemplos originales
validados con CairoSVG/Pillow/ezdxf: editable/expandido con error medio máximo
0,184/255, paletas/tinta, medidas180mm,120DPI y DXF2D en mm/región correcta.
Logs .runtime/v30-{culling-check,culling-build,phase1-full,static-summary,
independent-artifacts,independent-check}*, resultados full JSON exit0.
Medición local10 fuentes/4096 colocaciones:24 visibles/4072 descartadas,
28667 nodos, mediana5,4ms/p9512,5ms. No es garantía de FPS.
README: galería, peces y roseta con capturas reales; cuatro JSON descargables
correctos. Cinco capturas revisadas; scripts validate-v30-composition.mjs y
validate_v30_composition.py reproducen artefactos.

Fase1 satisface AC08/09; PRD entero NO completo. Seguir Fase2 (relaciones de
bordes, figurativas e IH1–IH93). Investigación inicial: TactileJS BSD3, commit
fd58ec372a4398e3dfc22663d120da186790834e, implementa81 tipos, NO93. Los12
restantes requieren marcas interiores según Kaplan/Schattschneider2025. No
presentar81 como93. Fuente/licencia de referencia descargadas sólo en.runtime;
ningún código de terceros integrado todavía. No copiar assets del artículo.

Monitor00:08UTC: primaria52% usada, secundaria99% sólo avisa. Servicios4173/4174
conservados, PROJECT_COMPLETE ausente. Git main/push autorizado; no revisar FTP.
Originales no seguidos caratula.jpg/favicon_io.zip intactos. No editar módulos
ni generar notices/build mientras corran E2E. Ahora no hay suites activas.

---

# V3.0 · Fase1 integrada, cierre de validación pendiente

Núcleo en abbda26; Fase0 en f12c78d. Integrados Pattern.composition, esquema5
(migración4→5 sin cambiar fuente), presets5, escenas finitas/IDs de captura,
colores por nivel compartidos con SVG editable/expandido. Sin composición se
conserva el pipeline anterior. Composición suspende wallpaper/teselas guardados.
UI Simetrías → Composición: recetas, geometría agrupada, paleta, recetas locales,
Editar motivo/Ver composición y Ctrl+K. Archivo → Galería con filtros/miniaturas.
Cuatro ejemplos originales vectoriales: peces/anillos, aves/cuadrantes,
cardumen/espiral y roseta/aves. No se copiaron gráficos Escher ni código GPL.

220 unidades/TypeScript,build y6 E2E nuevas correctos en cuatro resoluciones,
edición de fuente/undo/JSON/SVG reales y recetas personales. Evidencia
.runtime/v30-{ui-check,ui-build,targeted-e2e}.log. Corregidos overflow de tarjetas,
altura del contexto1366 y defs SVG de composiciones sobre Libre.
Pendientes antes de cerrar Fase1: culling/contextos Fill, mediciones de presupuesto,
comparación independiente de salidas/raster/DXF, capturas/JSON README y regresión
completa de117 E2E con estáticas. Todavía NO se declara terminada Fase1 ni v3.0.
Servicios LAN vivos; revisar monitor sólo primaria5h; no PROJECT_COMPLETE.

---

# V3.0 · Fase1 en desarrollo: núcleo afín listo

Fase0 documentada y commit f12c78d. Núcleo nuevo independiente de React en
src/composition/{model,functional,evaluate}.ts: operadores, árbol acotado,
matrices/IDs/niveles, recetas recursivas y espirales, cortes por detalle y culling.
216 pruebas unitarias/TypeScript correctos (206 previas+10 nuevas), log
.runtime/v30-composition-core-check.log. Todavía no está integrado a UI/JSON/
exportación; Fase1 NO completa. Próximo: datos opcionales de composición en
Pattern, escena finita/captura, estilos por nivel y exportación compartida,
UI contextual, galería y ejemplos originales con E2E reales.

Baseline8be6668:111 E2E,206 unidades,12 monitor,build y6 estáticas verificados.
Servicios LAN activos; secundaria sólo avisa. PROJECT_COMPLETE ausente.
No editar módulos/build mientras corran E2E. Mantener originales no seguidos
caratula.jpg/favicon_io.zip. Plan/matriz/inventario/referencias en docs/*V30.md.

---

# V3.0 · Fase0 verificada, Fase1 a continuación

Reset real confirmado23:24:58UTC: primaria0% usada. Baseline desde8be6668 sin
modificar código:206 unidades/TypeScript,111 E2E (203,5s/exit0),12 monitor,
build y6 estáticas raíz/subdirectorio correctos. Evidencia .runtime/v30-baseline-*.
Lecturas obligatorias e inspección de motores realizadas. Sin cambios en fuentes,
servicios o navegador del autor. No hay nuevos feedback pendientes conocidos.

Plan de dependencias/arquitectura: docs/PLAN_V30.md. Matriz de pendientes:
ACCEPTANCE_V30.md; rutas UX propuestas: UX_V30_INVENTORY.md; referencias y
licencias: REFERENCES_V30.md. Ninguna fase de producto v3.0 implementada aún.
Próximo incremento: Fase1, composición recursiva y espirales, persistencia,
exportación y ejemplos originales/galería. Mantener8 ejemplos/fixtures previos,
P3/defaults, celda fija, Fill y logo. No marcar completo el PRD hasta auditar25AC.

Servicios4173/4174 vivos. Sólo primaria5h limita ejecución; secundaria avisa.
PROJECT_COMPLETE ausente. Commits pequeños y push autorizado; no revisar FTP.
No editar módulos ni generar notices mientras haya E2E activas.

---

# PRD v3.0 recibido · Reanudación en ventana primaria

Archivo correcto subido por Pablo: prd_v3.0.txt; se conserva el original y pasa
al seguimiento Git. Incluye el pedido de ejemplos nuevos; no duplicarlo como
encargo aislado. Próximo trabajo: Fase0 del PRD (lecturas/auditoría/baseline),
luego sus fases en orden, conservando v1–v2.3 y todos los ajustes posteriores.
No se inició implementación v3.0 durante esta espera. Revisar especialmente
sus requisitos UX, exactitud matemática, compatibilidad y derechos de ejemplos.

**Aclaración operativa de Pablo:** pausa/resume se rigen sólo por la ventana de
5 horas. El secundario/semanal sólo avisa; Pablo decide banked resets. Esto
reemplaza la espera al reset secundario registrada en el cierre histórico de abajo.
Monitor ajustado y12 pruebas Python correctas (incluidos aviso secundario sin
pausa, migración del timer, deduplicación y rearmado tras banked reset). Monitor
reiniciado una sola vez, app conservada. API real confirma primary/notify_only;
servicios4173/4174 activos. No se envió feedback de prueba al hilo real.

Timer migrado al reset primario observado1795217026+60:20/11/2026 a20:24:46
Argentina (23:24:46UTC), resume_at1795217086. PROJECT_COMPLETE sigue ausente;
reanudar este mismo hilo leyendo prd_v3.0.txt/AGENTS/continuidad/progreso/feedback/
Git y uso real, sin duplicar servicios. Evidencia .runtime/primary-monitor-tests.log
y usage.json/timer.json. El reset semanal no debe sustituir este timer.

---

# Celda fija en split y Patrón → Una celda · Verificado

La cámara de una celda periódica mantiene su centro. Bloqueados Espacio+arrastre,
botón central, herramienta Desplazar y rueda sin modificadores. Zoom con botones/
Ctrl+rueda y Restablecer vista conservan el centro, también en Patrón → Una celda.
El patrón repetido mantiene pan; escenas sin celda periódica/Fuente pura conservan
navegación libre. Cámara de sesión: sin cambios de fuente, esquema ni geometría.
206 unitarias/TypeScript, build,4 E2E dirigidas,111/111 integradas (203.8s,
exit0) y6 estáticas correctos. Evidencia .runtime/cell-fixed-{check,build,targeted,
full}* y cell-fixed-static-summary.log. README actualizado. Servicios4173/4174
conservados; commit/push autorizado sin consultar Actions/FTP.

**Nuevo pedido pendiente:** Pablo solicita buscar referencias de Escher y patrones
interesantes en la web, recrearlos como ejemplos editables de mayor calidad.
Cámara publicada en bd96641. Monitor20:13UTC: primaria86% usada, secundaria90%
(10% restante), status=winding_down; timer para el reset real secundario+60s.
Por regla de cupo, no se inicia implementación de ejemplos. PROJECT_COMPLETE
continúa ausente para que el monitor retome el pedido pendiente. No duplicar
servicios4173/4174. Leer este estado y comprobar uso al reanudar.

Referencias encontradas (lectura, sin copiar código ni descargar originales):
- Museo Escher, peces/aves y división del plano:
  https://www.escherinhetpaleis.nl/en/about-escher/escher-today/experimenting-fishes-birds
- Museo Escher, reptiles:
  https://www.escherinhetpaleis.nl/en/about-escher/escher-today/repeating-reptiles
- Galería oficial de simetrías: https://mcescher.com/gallery/symmetry/
- Truchet, artículo primario sobre variantes:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7660392/
- Girih, Lu/Steinhardt, patrones geométricos:
  https://bpb-us-w2.wpmucdn.com/sites.uwm.edu/dist/0/158/files/2017/04/Lu-Steinhardt.Decagonal-and-Quasi-Crystalline-Tilings-in-Medieval-Islamic-Architecture.2017-23rjxd4.pdf

Propuesta pendiente: motivos figurativos entrelazados (peces/aves/reptiles),
Truchet de arcos y estrellas geométricas. Crear geometría vectorial propia,
editable en el modelo canónico, con paletas y composiciones cuidadas; revisar
visualmente antes de entregar. Conservar los8 ejemplos anteriores para regresión
(índices usados en fixtures). Auditar teselado/simetría real, JSON y exportaciones;
agregar capturas, descargas y referencias en README. Ninguno creado todavía.

---

# Celda: recorte de selección y nodos · Verificado

Pablo reprodujo un garabato iniciado fuera de la celda que reaparecía suelto en
la referencia. La repetición ya se recortaba; faltaba recortar el contorno de
selección. Selección/nodos/tangentes y preview de Fill ahora comparten el clip de
la celda en coordenadas mundiales, antes de transformar la instancia seleccionada.
Aplica a split/Una celda y conserva fuente completa, simetría y exportaciones.
Fuente pura y escenas sin celda periódica conservan su edición completa.

Prueba real reproduce el fallo antes del arreglo (234 píxeles de selección fuera
del borde superior) y pasa después sin tinta afuera. Comprueba dibujo libre,
nodos, Una celda, geometría idéntica y undo/redo. 206 unidades/TypeScript, build,
2 E2E dirigidas,109/109 E2E integradas (197.4s, exit0) y6 estáticas
raíz/subcarpeta correctos. Logs .runtime/cell-clip-{check,build,targeted,full}*,
cell-clip-full-result.json y cell-clip-static-summary.log. README incluye captura
real docs/images/cell-reference-freehand.png, inspeccionada. Sin pendientes de
este pedido. Servicios4173/4174 activos; commit/push autorizados sin revisar FTP.

---

# Footer: textos destacados a13px · Verificado

Patterns, «¿Te gustan los cuchillos?» y PEU.NET pasan de12 a13px. Resto del pie,
incluido Seguime en:, conserva12px/peso500; destacados conservan negrita700.
Build/TypeScript y vista real1440/390 correctos: altura38px, seis enlaces,
una línea y sin overflow de página. Evidencia .runtime/footer-size-{build.log,qa.json}
y capturas footer-size-*.png; README/captura actualizados. Sólo CSS; no se repiten
suites geométricas. Servicios4173/4174 activos. Push autorizado sin revisar FTP.

---

# Footer negro y negritas selectivas · Verificado

Pedido de Pablo y aclaración incorporada: Patterns, «¿Te gustan los cuchillos?»
y PEU.NET en peso700. «Seguime en:» y descripción en peso500. Texto/enlaces
negro puro, tamaño12px; iconos con trazo2. Contraste real19,79:1 sobre el fondo
claro. Conserva una línea/38px y scroll horizontal propio en móvil.
Build/TypeScript correctos; estilos y revisión visual real1440/390, seis enlaces,
negritas exactas y ausencia de overflow de página comprobados. Capturas incluyen
el footer móvil desplazado hasta PEU.NET. Evidencia .runtime/footer-bold-qa.json,
footer-bold-build.log y footer-bold-*.png. README y captura de inicio actualizados.
Ajuste de presentación: no se repiten suites geométricas. Servicios4173/4174 vivos.
Push autorizado sin inspeccionar Actions/FTP; cierre en .runtime/LAST_PUSH.json.

---

# Footer con mayor contraste · Verificado

Pedido de Pablo: texto del pie más oscuro. Se usa --ink (#24382b) sobre
--panel (#f7f9f2), con peso500; contraste real11,81:1. Conserva38px de alto,
una línea, seis enlaces y desplazamiento propio en móvil.
Build/TypeScript correctos; revisión real en1440/390 sin overflow de página,
con estilos computados y capturas inspeccionadas. Evidencia
.runtime/footer-contrast-build.log, footer-contrast-qa.json y capturas
footer-contrast-{1440,390}.png. README/captura de inicio actualizados.
Cambio sólo CSS; no se repiten suites geométricas por este ajuste visual.
Servicios4173/4174 conservados. Push autorizado; no consultar Actions/FTP.
Registro de publicación en .runtime/LAST_PUSH.json al finalizar.

---

# Cámara, guardado y cabecera · Entrega verificada

Pedidos sucesivos de Pablo incorporados al mismo incremento. Cabecera Patterns,
subtítulo «Patrones Geométricos», tamaños mayores y sin separador junto al logo.
Nombre movido a Archivo. Guardar pide nombre; blanco/sin título propone
Estudio-AA-MM-DD-HH-MM en hora local, sin extensión en el campo. Cancelar no
modifica el documento; descarga conserva schema4 y fuentes.

Trazo usa PenLine y slider0–2mm; entrada numérica conserva hasta50mm para proyectos
anteriores. Zoom100 equivale al200 anterior (7,559055118px/mm), sin alterar medidas
ni exportación. Vista dividida: celda activa editable a izquierda, centrada/ajustada
al entrar y al cambiar configuración; repetición de conjuntos visibles a derecha.
Zoom compartido en botones/rueda/ajustar/restablecer, escala conservada al resize.
Una celda sale de split; Fuente pura en Preferencias → Vista avanzada conserva
edición de originales completos/Penrose. Sin celda periódica se muestra motivo
completo; no se inventa una celda para Penrose.

206 unitarias/TypeScript, build y4 E2E dirigidas correctos (arranque1440/390,
centro/zoom/rueda/resize/rango y guardar/cancelar/nombre/descarga/recuperación).
108/108 E2E integradas correctas en 190.5s, exit0:
.runtime/cell-header-full.log y cell-header-full-result.json. Seis estáticas del
build final correctas, raíz y /pattern/, sin Internet; resumen
cell-header-static-summary.log. Pruebas heredadas adaptadas a nombre en Archivo
y rango0–2mm conservan aserciones de persistencia, biblioteca y undo por gesto.
Probe real de dibujo desde la celda: una fuente canónica, repetición visible y
undo compartido; captura split-draw.png. Capturas nuevas reales en README,
inspeccionadas junto a cabecera en1440/1024/768/390. Sin pendientes conocidos.
Servicios4173/4174 activos, sin duplicados. Al publicar el cierre se registra
.runtime/LAST_PUSH.json y PROJECT_COMPLETE; feedback independiente sigue activo.

**Preferencia vigente: push autorizado a main al finalizar; no comprobar Actions
ni FTP después del push. Pablo recibe errores de GitHub por email.** Esto reemplaza
las instrucciones históricas de comprobar workflow que siguen más abajo.

---

# Incremento P3 y grilla negra · Verificado, push autorizado

Nuevo pedido de Pablo, también enviado por monitor con id
c1a1f5d808be4cb194ced69217f9048b (duplicado atendido una sola vez).
P3 primero y Libre último; restantes simetrías conservan orden. Estudio nuevo
por newStudy (UI) usa P3/estructura visible50%; motor newProject sigue neutro
para importaciones/fixtures. Recuperación mantiene configuración existente.
Dibujo libre al iniciar; activarlo explícitamente abre Trazo, sin desplegar el
panel al cargar. Cámara100% centrada en origen al crear estudio/Restablecer vista;
conserva captura y escala al dibujar y al cambiar ancho. Panel izquierdo inicial
plegado en móvil; controles flotantes envuelven filas para mantener acceso.

Aclaración de Pablo: se refería a Grilla, el cuadrado antes del ojo. Mostrar/
ocultar puntos cada5mm, independiente de Snap. Se conserva con título claro y
estado accesible. Puntos negro puro/radio0,25mm, completos dentro de la celda
SVG: el punto anterior en esquina quedaba recortado. Celda desplazada−2,5mm y
centro2,5mm conservan posiciones globales múltiplos de5mm y alineación con Snap.
Prueba raster real a100% confirma tinta visible en1440/390.

206 unitarias/TypeScript, build y5 E2E dirigidas correctos. Pruebas de estudio
nuevo en1440/390 confirman P3, herramienta, opacidad, escala física, centro,
Nuevo tras zoom y recuperación. Regresiones Libre usan fixture neutro explícito;
no se rebajan assertions de geometría. Selección de objetos/origen en fixtures
antiguos se activa explícitamente porque ahora el arranque es dibujo libre.
Cierre:206 unitarias/TypeScript, build,106/106 E2E integradas y6 estáticas
raíz/subcarpeta correctas. Corrida integrada completa con exit code0,198,5s:
.runtime/p3-full-final.log y p3-full-final-result.json. Logs finales
p3-final-{check,build,static-summary}.log; casos dirigidos p3-grid-final-targeted.
Captura docs/images/new-study-p3.png real, escritorio y móvil inspeccionados.
Publicado e2ca8bef6181be4339cc4d15c92169efa20384fd en main. Deploy FTP44796746721
terminó con success (206 unitarias/TypeScript,3 tests de despliegue,build y FTP).
https://github.com/pablopeu/pattern/actions/runs/44796746721
Hosting https://peu.net/pattern/ sirve el mismo bundle que dist/ verificado;
evidencia .runtime/p3-published.html. No quedan criterios pendientes conocidos.
El registro documental de cierre se publica también; comprobar su workflow y
conservar resultado externo final en .runtime/LAST_DEPLOY.json.
Servicios4173/4174 conservados. Publicar en GH al finalizar, por pedido explícito.

---

# Cierre de incremento · Archivo/Exportar y publicación autorizada

Pablo autorizó explícitamente «al terminar push a gh»: publicar todos los commits
locales pendientes en main y comprobar el workflow FTP. Se levanta la espera de
aprobación que figura en entregas históricas de abajo. Servicios4173/4174 activos.

Archivo cierra el panel derecho antes de su apertura nativa (mouse/teclado).
Enter/Espacio del summary no llegan a atajos del lienzo. Exportar usa una única
acción de cierre/apertura, tanto en botón como en Ctrl+K. También respeta cierre
explícito si el panel estaba fijado. No se reabre automáticamente al salir.

204 unitarias/TypeScript, build y4 E2E dirigidas correctos:1440/768/390, panel
fijado, clic/Enter, menú Archivo accionable sin intercepción, Exportar/Escape,
proyecto y selección conservados. Logs menu-panel-{check,build,e2e}.log.
Cupo91% usado al cierre: terminar documentación/commit/push autorizado y verificar
FTP; no iniciar otro incremento.

Publicado main8614d951533696df410bae569f3b63f242e87688, incluidos los ocho commits
pendientes. Deploy FTP44773564280 completó con success (push): instalación,
3 pruebas de despliegue,204 unitarias/TypeScript, build y transferencia correctos.
https://github.com/pablopeu/pattern/actions/runs/44773564280
HTML público https://peu.net/pattern/ sirve el mismo bundle que el build local,
carátula OG e iconos revisión f6108aa8c880. Evidencia .runtime/published-final.html.
El commit documental de cierre también se publica y su ejecución FTP se comprueba
antes de finalizar; resultado final se conserva en .runtime/LAST_DEPLOY.json.
Servicios LAN siguen activos. Incremento terminado, sin otros trabajos pendientes.

---

# Revisión LAN · Fill y color sin saltos entre pestañas

**Sin push hasta aprobación de Pablo; cada push despliega por FTP.**
Incremento actual por feedback: Fill incluye selector HEX/color y opacidad;
Trazo incluye su color. Se quita Colores de tabs/accesos superiores y se mantiene
un acceso de dos muestras al pie de la barra derecha para editar ambos juntos.
Encabezado contextual (Rellenar región/Trazo/etc.) y Aplicar a sustituyen lenguaje
genérico de estilos. Regla de relleno sólo en Opciones avanzadas, con explicación.

El antiguo banner de estadísticas queda oculto; sólo se muestran progreso y
cancelación si una operación tarda al menos700ms. Otra región aparece únicamente
si existen varias candidatas. Diagnóstico/data-fill-applied conservado oculto
para automatización, sin tapar el dibujo. Query también informa busy para poder
cancelar una búsqueda local lenta. No cambia geometría, persistencia ni reglas.

204 unitarias/TypeScript, build y8 E2E dirigidas correctos en cuatro tamaños.
101/101 E2E integradas y6 estáticas (raíz/subcarpeta) correctas. Evidencia
fill-flow-{check,build,layout,full-e2e,static-summary,preview}.log.
Playwright dejó status=passed y failedTests=[] (fill-flow-last-run.json);
el wrapper npx terminó con143 tras emitir el reporte completo, sin tests fallidos.
Probes de producción también verifican imagen real y assets. QA temporal cerrada.
Captura docs/images/penrose-fill.png actualizada desde producción local real.
Servicios4173/4174 conservados; originales caratula.jpg/favicon_io.zip intactos.

---

# Entrega local para revisión · Fill, panel derecho e iconos actualizados

**No hacer push hasta que Pablo apruebe esta vista previa LAN.** Cada push
publica por FTP, incluso si sólo cambia documentación. Esta condición posterior
limita la autorización anterior. GitHub conserva 4bd8938; servicios 4173 y 4174
activos, sin duplicados. Pendiente únicamente revisión de Pablo para publicar.

## Cambios actuales

- Fill en Penrose: el modelo guardaba el color debajo de caras opacas. Separamos
  fondos del generador y perímetros en sceneLayers, con Fill entre ambos. Fuente
  pura comparte el orden; se conserva en SVG editable/expandido y al recargar.
- Reactivar Fill por clic, F o comandos abre controles aunque la herramienta ya
  esté activa. Barra derecha persistente con ocho accesos, Objeto condicionado
  a selección y toggle inferior que conserva tab. Overlays móviles dejan libres
  ambos rails y sus controles. Ajustar al patrón encuadra Penrose como finito.
- Fill denso: al superar el presupuesto global, analiza la región clickeada;
  un contorno cerrado se recolorea directamente. Para varios trazos, una cara
  fuente sólo propone la ventana: se valida con todas las curvas/capas/instancias
  que la cruzan. No se aceptan caras que excedan la ventana; agujeros, Béziers e
  índices originales preservados. Seguridad sin elevar presupuestos. Vínculos
  automáticos y recálculo manual usan el mismo criterio local si es necesario.
- Nuevo favicon_io.zip: seis archivos reemplazados byte a byte; revisión
  f6108aa8c880 en URLs de ICO/PNG/Apple/manifest/Android para evitar caché antigua.
  Nombre/colores y rutas relativas del manifest preservados. icono.png intacto.
- Footer de autor en una línea con seis enlaces de FutureForge, estética propia
  y Lucide; desplazamiento horizontal sólo del footer en móvil. Logo preservado.
- Metadatos SEO/canonical/Open Graph/Twitter estáticos con caratula.jpg original
  1176×775. https://peu.net/pattern/ comprobado contra la app publicada; imagen
  absoluta apunta allí y estará disponible después de aprobar el push.
- README mantiene explicaciones/imágenes primero e instalación/trabajo al final;
  nueva captura real docs/images/penrose-fill.png. Archivos fuente caratula.jpg y
  favicon_io.zip intactos y sin seguimiento; las copias públicas sí van a Git.

## Verificación real

- 204 unitarias y TypeScript estricto; build final correcto:
  .runtime/fill-local-final-{check,build}.log.
- 101/101 E2E en una corrida integrada de3,1min:
  .runtime/fill-local-full-e2e.log. Incluye regresiones anteriores, cuatro tamaños,
  tinta real, fuente/undo/recarga, perímetro SVG, Fill denso y accesos de paneles.
- Después se añadió el fallback al recálculo manual y se repitieron 204 unitarias,
  build y los2 E2E densos, incluido su botón real. Log fill-local-recalculate-e2e.
  Se conserva el ID y la familia de límites; no sólo el solapamiento geométrico.
- 6 E2E estáticas sobre el build final, raíz y /pattern/, sin Internet:
  fill-local-static-{root,sub}.log. Servidor temporal de QA detenido al terminar.
- Probes de iconos/manifest HTTP200, revisión, dimensiones/decodificación y bytes
  correctos en raíz/subcarpeta; ejemplo Penrose real de340 caras con tinta al
  primer clic en producción local: preview-icons-qa.log, verify-preview.mjs.
- Capturas .runtime/right-rail-{1440,390}.png y penrose-production.png.
  Logs/scripts de ejecución sólo en .runtime; sin direcciones LAN en Git.

## Git y seguimiento

Footer/iconos iniciales 84d7415, metadatos7db5cb7; correcciones Fill/paneles
474fa8c y2afe5b4, recálculo denso52c58eb. Todos exclusivamente locales.
El cierre de iconos y documentación se guarda también local, sin publicar.
.runtime/PROJECT_COMPLETE registra entrega verificada pendiente de revisión,
no una publicación. Feedback del monitor sigue activo. Ante un nuevo pedido,
retirar el marcador al iniciar trabajo real, como indica AGENTS.md.

---

# Continuidad · PRD v2.3 verificado

## Estado y alcance

Implementado prd_v2.3.txt como evolución no destructiva de v2.2. Se conservan
las regresiones v1/v2/v2.1/v2.2, icono.png y schemaVersion 4. Main local con
push autorizado a https://github.com/pablopeu/pattern. Sin criterios pendientes
conocidos: matriz en docs/ACCEPTANCE_V23.md e inventario en UX_V23_INVENTORY.md.

## Distribución final

- Rail con categorías Dibujo/Formas/Simetrías/Teselas/Capas/Aplicación/Preferencias
  y herramientas frecuentes directas. Un contexto por vez, plegado completo,
  tabs recordadas por categoría durante la sesión, sin agregar undo al navegar.
- Derecha: Colores/Trazo/Perfil/Fill/Paleta/Presets/Objeto/Opciones. Objeto separa
  Forma/Transformar/Nodos/Acciones y conserva handlers geométricos originales.
  Polígono identificado con parámetros, relleno/trazo y preview inmediatos.
- Selector compacto con activo/recientes/favoritos y catálogo modal de 27 opciones,
  filtros, miniaturas vivas y paginación adaptable. Red y colocación separadas.
- Teselas Forma/Colocación/Bordes/Tangentes; generador por páginas de 4 parámetros;
  aplicación Perímetro/Transformar/Vínculo. Un scroll de respaldo por superficie.
- Ctrl+K conecta a handlers reales; modales nativos con foco/inert/Escape. Resize
  alterna overlays para no tapar ambos lados. Capturar punto antes del autocierre
  conserva dibujo/Fill. Lápiz respeta el destino de estilo que eligió el usuario.

## Verificación final real

- 203 unitarias + TypeScript estricto: .runtime/v23-final-check.log.
- 94/94 E2E en corrida final de 4,3 min:75 anteriores +19 nuevos. Log
  .runtime/v23-full-regression-final.log. Cuatro resoluciones solicitadas,
  tinta/modelo/undo reales, catálogo/foco/teclado y todas las tabs sin scroll.
- 9 pruebas Python del monitor; sin mensajes de prueba al hilo real.
-Builds raíz/subdirectorio correctos;3+3 estáticas con orígenes externos
  bloqueados: .runtime/v23-static-root.log y v23-static-subdir.log.
-Exportación independiente completa nuevamente correcta: CairoSVG/Pillow/ezdxf,
  regresiones previas y seis escenarios v2.2. Log v23-export-independent.log.
-Benchmarks adaptados y ejecutados; referencias locales, no garantías de FPS.
-Cinco capturas reales inspeccionadas y cuatro JSON descargables validados
  en README; node scripts/capture-readme.mjs reproduce estos artefactos.

## Servicios y feedback

Mantener app 4173 y monitor 4174 vivos; no duplicarlos. npm run local:status
verifica sus PIDs. Los dos feedback históricos siguen revisados y atendidos;
no hubo nuevos durante este incremento. La entrega independiente sigue
activa incluso con PROJECT_COMPLETE.

PROJECT_COMPLETE registra este cierre y cancela timers de reanudación de un
PRD ya terminado. Ante una nueva solicitud real de cambios: retirar el marcador,
leer AGENTS.md/continuidad/progreso/feedback/Git y comprobar cupo real. No borrar
el marcador como prueba ni reiniciar trabajo por una reanudación vieja sin
pendientes. Con10% o menos en ventana vigente, verificar/documentar/commit y
finalizar; el monitor solicita continuar tras reset real +60s.

## Convenciones persistentes

Git local y push main autorizados. Documentación pública sólo con <IP_LOCAL>;
no publicar IP concretas ni datos de .runtime. README: explicaciones/imágenes
primero, instalación y trabajo al final. No editar módulos activos ni generar
notices durante E2E; no ejecutar suites con el mismo outputDir simultáneamente.
El scroll de respaldo es admisible para ventanas menores/zoom/listas extensas;
no se promete ausencia absoluta en cualquier contenido o resolución.

Auditoría final: cabecera móvil en dos filas con bounds completos de Archivo,
Buscar comandos y Exportar comprobados. El nombre del proyecto también está
en Preferencias. Capturas de las cuatro resoluciones inspeccionadas. Corrida
posterior 94/94 correcta en 4,3 min, estado de salida 0 registrado en
.runtime/v23-full-regression-final.status.json. Ambos builds y3+3 estáticas
repetidos correctamente. Se registra PROJECT_COMPLETE al publicar este cierre.

## Hosting FTP automático confirmado

Pablo autorizó producción FTP automática con cada push. Workflow
.github/workflows/deploy-ftp.yml activo para push (sin filtros de rama/archivo)
y workflow_dispatch. Usa los cuatro Repository secrets FTP_HOST, FTP_USERNAME,
FTP_PASSWORD y FTP_FOLDER, sin extraer sus valores a esta máquina.

Destino public_html/<FTP_FOLDER>/ con barra final automática; también acepta
el prefijo public_html sin duplicarlo. BASE_PATH=./, sólo dist/, FTP puerto 21.
Transferencias serializadas, sin cancelar la que está en curso ni vaciar la
carpeta completa. Checkout/setup-node/FTP action fijados por SHA.

Verificado localmente: actionlint 1.7.12, 3 pruebas de configuración del destino,
203 unitarias/TypeScript y build. Verificado realmente en GitHub: instalación
npm ci, todas esas pruebas/build, preparación de secretos y subida FTP correctas.
Primera ejecución: https://github.com/pablopeu/pattern/actions/runs/44744523772, commit df4e712.
La publicación del cierre documental dispara otra ejecución automáticamente;
su resultado final se registra en el marcador local de cierre.

V2.3 conserva toda su auditoría anterior. Se mantienen app 4173 y monitor 4174,
y la entrega independiente de feedback. Ante cambios nuevos, retirar
PROJECT_COMPLETE y comprobar uso real antes de continuar.
