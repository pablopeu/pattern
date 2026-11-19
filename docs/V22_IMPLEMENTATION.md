# PRD v2.2 · Decisiones de implementación

Implementar todo el PRD sobre 9fde876, sin reemplazar motor/modelo ni perder logo y regresión. Baseline 140 unitarias, 50 E2E; marcado de cierre retirado. Git main/push y LAN autorizados.

## Estilos

Un DrawingStyle compartido por Geometry, proyecto.drawingStyle y presets de valor. Política visible: seleccionar no sobrescribe el vigente; por defecto editar campos de selección también actualiza esos campos del vigente, con opción para desactivar. Estado mixto por propiedad. Controles compartidos izquierda/derecha, indicador siempre visible. Panel independiente, pin/Escape/autocierre; reservar espacio en desktop manteniendo mm/píxel al redimensionar Canvas y ancla documental estable.

Esquema 4 y presets de patrón 4, migración 3→4 (incluye snapshots). Dash array/offset en mm; perfil de ancho normalizado por longitud de eje con control visual y geometría derivada. Conservar eje editable. Reutilizar Clipper/Paper para contornos, tapas/uniones, intersecciones; SVG nativo para dashes uniformes, contorno vectorial para variable/expansión. Cache geométrica acotada, precisión física documentada, límites de segmentos y coordenadas. Colores HEX se normalizan con alfa en opacity; recientes/favoritos/paleta y presets persistidos sin vínculos retrospectivos.

## Fill: arreglo planar y entidades

Usar curvas Bézier visibles reales (no overlays/guías; ejes editables de trazos). Grafo de medias aristas: intersecciones Paper, subdivisión por parámetros, vértices con tolerancia numérica, tangentes ordenadas, recorridos de caras acotadas. Ciclos positivos + árbol de contención para agujeros; rechazar cara exterior. Cierre ampliado explícito y avisado, sin modificar originales. Límites de curvas/intersecciones y worker cancelable. Cache por geometría/contexto/viewport, no por movimiento de puntero ni cambios sólo de color.

Guardar en Geometry.fillRegion referencias de límites y firma combinatoria de ciclos (IDs fuente/curva/instancia/subdivisión, no sólo cursor). Fuentes derivadas excluidas de límites para evitar ciclos. Resultado vinculado por defecto; fijo conserva contorno. Recalcular sólo con identidad topológica válida; si desaparece, mantener geometría y estado stale con aviso. Edición manual de contorno desvincula; cambios sólo de estilo conservan vínculo. Recalcular explícitamente usa dependencias y equivalencia geométrica, no un punto aproximado como única identidad.

Un path cerrado existente puede recibir fill directamente desde su instancia. Una cara cuyas fronteras comparten transformación admite fuente canónica. Para caras entre distintas instancias verificar equivalencia de la órbita contra caras reales; si no se puede demostrar, usar una fuente de región con lista de matrices de órbita permitidas y contexto congelado explícito. No duplicar centenas de objetos ni afirmar equivalencia falsa. Cambiar grupo no destruye la región; marca contexto anterior/stale cuando corresponda.

Los fills derivados se generan después del generador para no deformar dos veces curvas warp ni perderlos en generadores procedurales. Extender Scene/renderer/selección/exportación para órbitas restringidas. Por defecto debajo de trazos; mantener editabilidad y recolorear sin duplicados. Linked refs con matrices y configuración de creación: si cambia sólo geometría fuente y la firma de caras permanece, actualizar. Si cambia simetría/topología sin equivalencia demostrada, conservar contorno válido y explicar vínculo. Actualización pesada por worker al commit, preservando una acción de historial por gesto.

Tesela como candidato material separado: interior vinculado a definición real, no a overlay. Usar estructura tiling existente y sus marcos; los límites gráficos de ayuda nunca son entradas del arreglo.

## Pendientes

Modelo/migración, estilos/panel, contornos/dashes, arreglo planar, Fill/preview/ciclo/confirmación, vínculos/órbitas/teselas, exportación, tests geométricos/E2E, auditoría visual/estática/regresión/docs. No declarar completo hasta cerrar todo. Con <=10% vigente, cerrar incremento verificado/documentado/commit y finalizar para el timer real.

## Incremento verificado: estilos y trazo

Implementados estilos/panel/presets/paletas/esquema 4 y trazo derivado. 151 unitarias +5 E2E específicas; regresión anterior 50 verificada entre corrida y repeticiones aisladas, build/monitor correctos. Contorno en coordenadas locales antes de afinidad, tolerancia física dividida por cota de escala. Límites: 64 longitudes (0–1000 mm), período ≥0,001 mm, 2048 segmentos pintados/eje, 8192 pasos de patrón y 16000 muestras por intervalo variable; fallo explícito. Perfil: 2–64 controles ordenados [0,1], ancho relativo [0,4], interpolación monótona. Caché 128 contornos. Round joins usan sectores exteriores, no discos completos que invadirían gaps con tapas butt. Capas físicas en mm; control numérico muestra unidades del documento.

DXF sigue ofreciendo polilíneas de contornos/ejes según opción; no representa alfa ni superficies de color sólido (contornos de agujeros incluidos). SVG y raster conservan colores/opacidades. Resta auditar la validación externa de este incremento junto con Fill.
