# Aceptación · PRD v3.0

Estado: Fases0–3 verificadas; Fases4–7 pendientes. Baseline 8be6668.
No se declara completo v3.0: proyecciones y animaciones pendientes.

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
