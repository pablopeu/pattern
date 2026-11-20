# Continuidad · PRD v2.3 en curso

## Alcance y estado

Pablo autorizó explícitamente implementar prd_v2.3.txt después del cierre
verificado de v2.2 (c2083a1). Se retiró PROJECT_COMPLETE para reactivar la
vigilancia de cupo. PRD v2.3 NO completo. Se preservan motor, esquema 4,
logo icono.png y handlers de la aplicación. Main con push autorizado.

## Primer incremento

- Auditoría del baseline y cobertura de funciones en docs/UX_V23_INVENTORY.md.
- Rail con siete categorías nombradas: Dibujo, Formas, Simetrías, Teselas,
  Capas, Aplicación, Preferencias. Herramientas directas en dos columnas.
- Panel izquierdo muestra sólo el contexto activo; Simetrías separa Grupo
  y red de Generador, Capas separa lista de objetos de Conjuntos. Las
  pestañas se recuerdan por categoría durante la sesión; plegar no desmonta
  el panel. Navegar no cambia el documento ni agrega undo.
- Formas tiene acción explícita Polígono paramétrico, preview y parámetros
  de la forma creada. Usa el mismo handler del rail y ahora toma drawStyle.
- Se eliminó el cierre en capture del panel derecho para todos los trazos:
  pointerDown captura el punto antes del cambio de tamaño, como ya hacía Fill.
- El panel derecho conserva su ubicación y funcionamiento independiente.

## Verificación y límites

Logs del incremento en .runtime/v23-navigation-{check,build,e2e,regressions}.log.
La última corrida dirigida previa al cierre aprobó cinco E2E nuevos (cuatro
viewports 1366×768,1440×900,1920×1080,390×844 más polígono). La regresión de
estilo vigente/tinta y Fill rápido aprobó 2/2 tras la corrección de capture.
Verificación final después del cambio de Canvas: 203 unitarias y TypeScript,
build y cinco nuevos E2E aprobados.
Captura .runtime/v23-shapes-1366.png inspeccionada: sin overflow horizontal,
rail y accesos visibles. Persiste scroll en geometría extensa: no se
considera aceptada la UX final.

## Próximo incremento pendiente

1. Galería compacta con recientes/favoritos y galería ampliada adaptable;
   conservar hover, nombres, preview, familias, cambio inmediato y undo.
2. Propiedades del objeto a la derecha y tabs compactas de estilo; Formas
   debe mostrar inmediatamente lados/tamaño/rotación sin scroll. Terminar
   contextos compactos de dibujo, Fill, nodos, teselas y generador.
3. Buscador de comandos conectado a handlers reales; foco, Escape, teclado,
   tooltips/atajos, menús y overlays estrechos sin superposiciones.
4. Adaptar recorridos E2E v1–v2.2 a las categorías sin quitar aserciones y
   ejecutar regresión completa. No afirmar 75/75 sobre la UI nueva: sólo se
   verificaron las dos regresiones dirigidas de este incremento.
5. Completar ubicación final de cada fila del inventario, matriz de criterios,
   auditoría visual/funcional de cuatro resoluciones, builds estáticos raíz y
   subdirectorio, README con capturas finales (explicaciones primero,
   instalación/trabajo al final). Ninguna función inventariada puede perderse.

## Servicios y monitor

Mantener app 4173 (PID1046850) y monitor 4174 (PID2324731), sin duplicarlos.
Los dos feedback históricos siguen revisados, sin feedback nuevo al inicio.
Consultar status y feedback al reanudar. Al llegar a 10% restante en ventana
vigente: verificar/documentar/commit y finalizar; el monitor pide reanudación
tras reset real +60s. No crear PROJECT_COMPLETE hasta auditar todo v2.3.
No publicar IP concretas: sólo <IP_LOCAL>; runtime ignorado. No ejecutar dos
suites Playwright con outputDir compartido ni editar código durante una suite.

Cierre por cupo: telemetría real 90% usado (10% restante), reset primario
2026-11-20 06:47:54 UTC; reanudación del monitor a partir de06:48:54 UTC
(03:48:54 Argentina). Estado winding_down, resume_at1795157334. No iniciar
otro incremento en esta ventana. Se conserva vigilancia independiente de feedback.

## Reanudación y segundo incremento

Reset confirmado por telemetría nueva (0% usado). Catálogo ampliado implementado:
selector compacto, recientes/favoritos,27 opciones paginadas según ancho,
hover/clic real, Escape/foco y undo.203 unitarias/TypeScript y2 E2E dirigidos
correctos. Continúan pendientes propiedades/estilos compactos, comandos y
regresión completa. La nota de winding_down anterior corresponde a la ventana
previa, ya reiniciada.

## Tercer incremento

Propiedades a la derecha, estilos por pestañas, paginación de paletas/perfiles
y comandos Ctrl+K implementados.203 unitarias/TypeScript, build y12 E2E de v2.3
aprobados, incluyendo cuatro resoluciones con todas las tabs derechas sin scroll.
Pendientes de la lista inicial: compactar otros contextos, adaptar regresiones,
exportación/menús/teclado completos y documentación final. No declarar completo.

## Cuarto incremento

Contextos de teselas, simetrías, generador y aplicación compactados; exportación
con tabs y diálogos nativos con foco/inert/Escape.203 unitarias/TypeScript,
21 E2E de propiedades/estilos y4 nuevos de contextos sin scroll correctos.
Los helpers tests/navigation.ts recorren la UI real y conservan aserciones.
Próximo paso inmediato: regresión completa y corrección de recorridos/defectos,
auditoría de cobertura, builds estáticos y documentación/capturas finales.

## Auditoría de regresión

Primera corrida:85/91 correctos;4 aserciones de título y1 apertura de catálogo
adaptadas; regresión real de destino de estilo en Lápiz corregida. Las6
repeticiones dirigidas y3 coberturas secundarias pasaron.9 tests del monitor
correctos. Preparada corrida completa final de94; pendiente estático y cierre.

## Último ajuste antes del cierre

94 E2E completos correctos. Después se corrigió clipping de texto en selects,
Corregir trazo→Trazo, acceso explícito al color de Fill y foco SVG al cerrar
modal.9 repeticiones dirigidas correctas. No cambiar más fuentes durante las
próximas suites. Falta producción raíz/subdirectorio, corrida completa final,
regenerar/inspeccionar capturas ajustadas y cerrar docs/README con evidencia.
