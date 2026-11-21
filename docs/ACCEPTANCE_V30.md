# Aceptación · PRD v3.0

Estado: Fases0–1 verificadas; Fases2–7 pendientes. Baseline 8be6668.
No se declara completo v3.0 ni su catálogo IH, proyecciones o animaciones.

| AC | Requisito | Estado y evidencia necesaria |
|---|---|---|
|01|Compatibilidad|537 unidades/140 E2E y10 estáticas verificadas tras JSON6 y feedback; repetir con próximas familias|
|02–03|Navegación/scroll|Base UX v2.3 conservada; nuevas familias pendientes|
|04–05|Edición/simetría|Base euclidiana verificada; extensiones pendientes|
|06|IH1–IH93|93/93 verificados/integrados;81 geométricos+12 marcados propios, pruebas individuales/Scene/JSON y exportación independiente de los12 marcados|
|07|Figurativas|Bordes existentes válidos; ampliación de relaciones pendiente|
|08–09|Recursión/espirales|Verificado: operadores/inversas, determinismo, fuente única, detalle/IDs, UI/undo/JSON/exportaciones|
|10|Hat/Spectre|Pendiente; Penrose previo conservado|
|11|Girih|Pendiente|
|12–14|Hiperbólica/artística/esférica|Pendiente|
|15|Fuente intacta|Base verificada; nuevos recorridos pendientes|
|16–19|Timeline/loop/GIF/video|Pendiente|
|20|Exportación|Base SVG/PNG/JPEG/DXF; nuevas familias pendientes|
|21–22|Ejemplos/derechos|12 ejemplos:8 legados+4 originales portables; familias posteriores pendientes; sin assets Escher copiados|
|23–24|Acceso/rendimiento|Base verificada; mediciones de nuevas familias pendientes|
|25|Regresiones|Feedback/JSON6:140/140 E2E,537 unidades,10 estáticas,build y14 monitor. Repetir tras próximas fases|

Baseline: .runtime/v30-baseline-{check,monitor,build,full}.log,
v30-baseline-full-result.json y v30-baseline-static-summary.log. Logs/artefactos
locales excluidos de Git. Matriz se actualiza con evidencia de cada incremento.

Fase1: logs v30-culling-*, v30-phase1-full-result.json (exit0/205,2s),
v30-static-summary.log y v30-independent-check.log. README contiene capturas
y cuatro JSON. Mediciones en TESTING.md. PRD completo todavía pendiente.
