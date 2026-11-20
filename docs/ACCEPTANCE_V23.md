# Auditoría UX · PRD v2.3

Estado: implementación en verificación. No declarar terminado hasta cerrar
regresión completa y producción estática. Baseline: v2.2, c2083a1.
Inventario completo y rutas por función en [UX_V23_INVENTORY.md](UX_V23_INVENTORY.md).

| Criterio del PRD | Distribución y evidencia |
| --- | --- |
| Auditoría inicial y ninguna función perdida | Inventario A01–E06; handlers trasladados de Panels a ObjectProperties; recorridos originales preservan sus aserciones |
| Siete categorías y panel exclusivo | Rail nombrado; contenido reemplazado por categoría; E2E navegación compara proyecto antes/después en cuatro viewports |
| Panel izquierdo plegable y altura útil | Plegado sin desmontar, cierre/Escape, tabs de sesión; un contenedor de scroll de respaldo |
| Apariencia y propiedades a la derecha | Ocho tabs; Objeto con Forma/Transformar/Nodos/Acciones. E2E anclaje, selección, pin, Escape y fuentes intactas |
| Revelación progresiva | Lápiz→Trazo, Fill→Fill, Nodos→propiedades/tangentes; radial→sectores/centro, wallpaper→red; teselas→bordes/tangentes |
| Polígono paramétrico descubrible | Acción con nombre en Formas y comando; derecha muestra lados, tamaño, rotación, relleno, trazo y preview dentro del viewport |
| Catálogo completo sin listas anidadas | Selector activo/recientes/favoritos; modal adaptable de27 opciones, filtros y páginas en móvil; hover/clic/teclado/undo comprobados |
| Iconos y accesibilidad | aria-label, títulos/tooltip CSS, estado activo, atajos existentes; tabs/botones, foco modal y Escape |
| Espacio y pantallas pequeñas | Overlay lateral estrecho, apertura de uno pliega el otro; sin overflow horizontal; medidas/cámara conservadas |
| Estado y undo | Navegar compara documento idéntico; se conserva selección/herramienta; tabs por categoría y UI fuera del proyecto |
| Comandos conectados a handlers | Ctrl+K, normalización de acentos, flechas/Enter/Escape; polígono, Fill, grupos, teselas, grosor y exportación SVG |
| Restricciones y regresiones | Motor/esquema4/dependencias/logo sin cambios; pendiente resultado de la regresión completa y builds estáticos |

## Resoluciones

1366×768,1440×900,1920×1080 y390×844. Se prueban accesos principales,
propiedades/estilos, todas las tabs de teselas, red p1, generador warp,
preferencias, aplicación y exportación. Los asserts comparan scrollHeight
con clientHeight; las barras no se esconden para aprobar el criterio.

El scroll queda disponible como respaldo para ventanas más bajas/zoom de
navegador, listas de muchas capas, biblioteca y mensajes extensos. La
paginación mantiene accesibles todos los parámetros de una colección larga.

## Evidencia provisional

-203 unitarias/TypeScript correctos.
-21 E2E dirigidos de estilos/propiedades y recorridos v2.2 correctos.
-Cuatro E2E adicionales de contextos completos sin scroll correctos.
-Regresión completa en curso en .runtime/v23-full-regression-first.log.
