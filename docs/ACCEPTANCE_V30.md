# Aceptación · PRD v3.0

Estado: Fases0–3 verificadas; Fases4–7 pendientes. Baseline 8be6668.
No se declara completo v3.0: proyecciones y animaciones pendientes.

| AC | Requisito | Estado y evidencia necesaria |
|---|---|---|
|01|Compatibilidad|677 unidades/164 E2E y10 estáticas verificadas tras JSON6 y feedback; repetir con próximas familias|
|02–03|Navegación/scroll|Base UX v2.3 conservada; nuevas familias pendientes|
|04–05|Edición/simetría|Base euclidiana verificada; extensiones pendientes|
|06|IH1–IH93|93/93 verificados/integrados;81 geométricos+12 marcados propios, pruebas individuales/Scene/JSON y exportación independiente de los12 marcados|
|07|Figurativas|Verificado: 3 figuras C1 y ornamento IH63; bordes relacionados, fuente/detalles conservados, silueta en vivo y composición|
|08–09|Recursión/espirales|Verificado: operadores/inversas, determinismo, fuente única, detalle/IDs, UI/undo/JSON/exportaciones|
|10|Hat/Spectre|Implementados por sustitución publicada,13 semillas/quiralidad/áreas; tres ejemplos, UI/JSON/exportaciones; fase3 aún requiere Girih|
|11|Girih|Verificado:5 formas/adyacencias, ensamblado, rayos54°, hebras globales, conflictos/cortes explícitos y regiones vectoriales; SVG/raster/DXF independientes|
|12–14|Hiperbólica/artística/esférica|Pendiente|
|15|Fuente intacta|Base verificada; nuevos recorridos pendientes|
|16–19|Timeline/loop/GIF/video|Pendiente|
|20|Exportación|Base SVG/PNG/JPEG/DXF; nuevas familias pendientes|
|21–22|Ejemplos/derechos|21 ejemplos:8 legados+8 originales+3 aperiódicos+2 Girih matemáticos; JSON/capturas portables, atribución BSD3; familias posteriores pendientes|
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
