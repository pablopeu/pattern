# Auditoría UX · PRD v2.3

Estado: implementado y verificado el 20/11/2026. Sin criterios pendientes conocidos. Baseline: v2.2, c2083a1.
Inventario completo y rutas por función en [UX_V23_INVENTORY.md](UX_V23_INVENTORY.md).

| Criterio del PRD | Distribución y evidencia |
| --- | --- |
| Auditoría inicial y ninguna función perdida | Inventario A01–E06; handlers trasladados de Panels a ObjectProperties; recorridos originales preservan sus aserciones |
| Siete categorías y panel exclusivo | Rail nombrado; contenido reemplazado por categoría; E2E navegación compara proyecto antes/después en cuatro viewports |
| Panel izquierdo plegable y altura útil | Plegado sin desmontar, cierre/Escape, tabs de sesión; un contenedor de scroll de respaldo |
| Apariencia y propiedades a la derecha | Ocho tabs; Objeto con Forma/Transformar/Nodos/Acciones. E2E anclaje, selección, pin, Escape y fuentes intactas |
| Revelación progresiva | Lápiz→Trazo, Fill→Fill, Nodos→propiedades/tangentes; radial→sectores/centro, wallpaper→red; teselas→bordes/tangentes |
| Polígono paramétrico descubrible | Acción con nombre en Formas y comando; derecha muestra lados, tamaño, rotación, relleno, trazo y preview dentro del viewport |
| Catálogo completo sin listas anidadas | Selector activo/recientes/favoritos; modal adaptable de 27 opciones, filtros y páginas en móvil; hover/clic/teclado/undo comprobados |
| Iconos y accesibilidad | aria-label, títulos/tooltip CSS, estado activo, atajos existentes; tabs/botones, foco modal y Escape |
| Espacio y pantallas pequeñas | Overlay lateral estrecho, apertura de uno pliega el otro; sin overflow horizontal; medidas/cámara conservadas |
| Estado y undo | Navegar compara documento idéntico; se conserva selección/herramienta; tabs por categoría y UI fuera del proyecto |
| Comandos conectados a handlers | Ctrl+K, normalización de acentos, flechas/Enter/Escape; polígono, Fill, grupos, teselas, grosor y exportación SVG |
| Restricciones y regresiones | Motor/esquema 4/dependencias/logo sin cambios; 203 unitarias,94 E2E y6 pruebas estáticas correctos; ambos builds verificados |

## Resoluciones

1366×768,1440×900,1920×1080 y 390×844. Se prueban accesos principales,
propiedades/estilos, todas las tabs de teselas, red p1, generador warp,
preferencias, aplicación y exportación. Los asserts comparan scrollHeight
con clientHeight; las barras no se esconden para aprobar el criterio.

El scroll queda disponible como respaldo para ventanas más bajas/zoom de
navegador, listas de muchas capas, biblioteca y mensajes extensos. La
paginación mantiene accesibles todos los parámetros de una colección larga.

## Evidencia final real

- `npm run check`: TypeScript estricto y203 unitarias correctas; log
  `.runtime/v23-final-check.log`.
- Regresión completa **94/94** en una sola corrida final de 4,3 min:
  **75 flujos previos +19 de v2.3**, con aserciones originales de geometría,
  tinta, persistencia y undo conservadas. Log `v23-full-regression-final.log`.
- 19 nuevos: navegación×4, polígono, catálogo×2, propiedades/estilos sin scroll×4,
  comandos, contextos/exportación×4, edición secundaria, presets y resize/foco.
- Builds raíz y `/pattern/` correctos. **3+3 pruebas estáticas correctas** con
  orígenes externos bloqueados, edición/Fill/JSON/SVG/worker operativos. Logs
  `v23-final-build-root/subdir.log` y `v23-static-root/subdir.log`.
- **9 pruebas del monitor** correctas; delivery de feedback durante trabajo,
  espera y cierre sigue vigente. Sin envío de mensajes de prueba al hilo.
- `npm run validate:exports` y validación CairoSVG/Pillow/ezdxf: regresiones
  previas y los seis escenarios v2.2 correctos. Log `v23-export-independent.log`.
- `npm run benchmark` y benchmark de estructura adaptados y ejecutados.
  Informes locales de referencia; no se usan como garantía de FPS.
- Cinco capturas de la aplicación real regeneradas e inspeccionadas. Los
  cuatro proyectos JSON descargables pasan parseProject/serialize; el logo
  `icono.png`, esquema 4 y motor matemático no se alteran.

En la primera comprobación estática se corrigieron dos recorridos de QA:
un selector confundía «Exportar contornos de teselas» con el contexto Teselas,
y las coordenadas del probe se leían antes de que terminara el cambio de
ancho del panel. Después, un servidor temporal terminó durante la prueba de
subdirectorio: se reinició desacoplado de la sesión y se repitieron ambas
rutas completas con resultado3/3 por ruta. No se ocultaron fallos de producto
ni se redujeron las aserciones de tinta/modelo para aceptar el resultado.

La inspección visual final cubrió 1366×768,1440×900,1920×1080 y 390×844.
Detectó acciones fuera de la cabecera móvil; se corrigió con dos filas,
etiquetas visibles y aserciones de bounds completos en los cuatro viewports.
Nombre del documento también está en Preferencias para que siga accesible
en móvil. La corrida posterior completa aprobó 94/94 en 4,3 min (exit_code 0),
y ambos builds y las 6 estáticas se repitieron correctamente.


## Feedback posterior · Cámara, archivos y cabecera

Verificado el20/11/2026: 206 unitarias/TypeScript, build,108/108 E2E integradas
(exit0) y6 estáticas raíz/subdirectorio. Regresiones geométricas, Fill, biblioteca,
exportación y undo conservadas. Nuevas pruebas cubren celda centrada/zoom físico
compartido/rueda/resize, rango0–2mm sin alterar grosores mayores guardados y diálogo
de nombre con fecha/hora local/cancelación/descarga JSON/recuperación.
Fuente pura se conserva en Preferencias → Vista avanzada. Logo icono.png intacto.
Evidencia: .runtime/cell-header-full.log, cell-header-full-result.json y
cell-header-static-summary.log; capturas reales en README.
