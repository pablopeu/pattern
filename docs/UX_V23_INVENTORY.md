# Inventario y cobertura UX · v2.3

Auditoría del baseline v2.2, commit c2083a1. Alcance: App.tsx, Panels.tsx,
SymmetryGallery.tsx, TilePanel.tsx, StylePanel.tsx, ExportDialog.tsx,
Controls.tsx, Canvas.tsx, useStudio.ts y style.css. Este documento acompaña
la implementación incremental: una ubicación propuesta no equivale a aceptación.

## Problemas observados antes de reorganizar

- Simetrías (máximo 52% del panel), su cuadrícula (240 px), teselas
  (38%) y panel-scroll competían por altura y tenían scroll independiente.
- Diseño acumulaba geometría, patrón, generador y preferencias. La selección
  cambiaba qué controles del generador quedaban disponibles.
- Polígono regular sólo se descubría por un hexágono pequeño con +. Sus
  parámetros aparecían dentro de Geometry después de crearlo.
- Apariencia estaba correctamente a la derecha, pero todos sus controles,
  perfiles, paletas, Fill y presets formaban otra columna larga.
- El rail de herramientas de una columna superaba la altura disponible en
  ventanas bajas. Los tooltips nativos y aria-label existían para sus botones.
- Cerrar el panel izquierdo lo desmontaba y perdía la pestaña Diseño/Capas.
- Exportación usa una lista de opciones con aparición contextual y preview;
  debe auditarse también en móvil. Archivo concentra biblioteca/ejemplos.

## Cobertura de funciones

Cada fila agrupa una familia de controles; los nombres entre paréntesis
identifican sus parámetros y acciones. Se mantienen los handlers originales.
«Actual» describe este primer incremento, no la distribución final aceptada.

| ID | Funciones inventariadas v2.2 | Ubicación actual v2.3 / destino |
| --- | --- | --- |
| A01 | Nombre de proyecto, estado de guardado, guardar JSON | Cabecera |
| A02 | Nuevo, abrir JSON, duplicar proyecto | Archivo |
| A03 | Biblioteca local, abrir proyecto anterior | Archivo → biblioteca |
| A04 | Siete ejemplos editables | Archivo → ejemplos |
| A05 | Importar/exportar preset de patrón | Archivo |
| A06 | Ayuda, atajos, avances/feedback LAN en desarrollo | Archivo y pie del rail |
| A07 | Importar SVG, ancho físico, destino fuente/perímetro, cancelar | Rail → diálogo de importación |
| A08 | Diseño, Patrón, Aplicar | Cabecera; Aplicación ofrece acceso explícito a Aplicar |
| D01 | Selección V, nodos A, pluma P, lápiz B | Rail directo; contexto Dibujo |
| D02 | Línea L, rectángulo R, elipse E, polígono libre | Rail directo; contexto Formas para figuras |
| D03 | Polígono regular paramétrico, lados, ancho, alto, rotación | Formas → acción con nombre y preview; alias en rail |
| D04 | Pan H, espacio+arrastre, zoom al cursor | Rail y lienzo |
| D05 | Pluma: terminar, cerrar, cancelar; tangentes/Alt | Lienzo, teclado y ayuda |
| D06 | Nombre, posición XY, dimensiones, radio de esquinas | Dibujo/Formas → geometría seleccionada; pendiente trasladar propiedades al derecho |
| D07 | Rotación, escala, reflejar X/Y | Dibujo/Formas → geometría seleccionada |
| D08 | Convertir forma a paths editables | Dibujo/Formas → geometría seleccionada |
| D09 | Path cerrado, nodo activo, nodo XY | Dibujo/Formas → path seleccionado |
| D10 | Insertar/eliminar nodo, curvar/enderezar segmento | Dibujo/Formas → path seleccionado |
| D11 | Suavizar, nodo angular, tiradores de tangentes | Dibujo/Formas y lienzo; pendiente contexto de nodos más compacto |
| D12 | Duplicar, eliminar, agrupar/desagrupar | Geometría seleccionada, rail/teclado y Capas |
| D13 | Unión, intersección, diferencia, diferencia inversa, XOR | Geometría con selección múltiple |
| S01 | Simetría de conjunto/principal, propia/heredada/libre | Simetrías → Grupo y red |
| S02 | Libre, 17 wallpaper, 7 frisos, Cn/Dn | Simetrías → Grupo y red; pendiente selector compacto y galería ampliada |
| S03 | Filtro de familia, encuadre físico/por celda, hover y previews | Simetrías → Grupo y red |
| S04 | Orientación de red, origen XY, sectores, celda ancho/alto/ángulo | Simetrías → Grupo y red según familia |
| S05 | Adaptar patrón, restablecer colocación, guías detalladas | Simetrías → Grupo y red |
| G01 | Familia de generador y preview del motivo | Simetrías → Generador |
| G02 | Filas, columnas, espaciado, desfase, rotación, escala, relación de escala | Simetrías → Generador según familia |
| G03 | Cantidad, amplitud, frecuencia, fase, radio, relación de radios/ejes | Simetrías → Generador según familia |
| G04 | Distribución rectangular/circular/freeform, escalonar filas/columnas | Simetrías → Generador según familia |
| G05 | Semilla/nueva semilla, añadir/eliminar instancia, instancia XY | Simetrías → Generador según distribución |
| G06 | Convertir generador a paths, avisos Penrose/warp | Simetrías → Generador |
| T01 | Habilitar teselas y seleccionar familia | Teselas, abiertas al entrar |
| T02 | Ancho/alto, shear, orientación, origen XY, contornos | Teselas según familia |
| T03 | Editar bordes, borde maestro, nodo activo | Teselas → edición |
| T04 | Posición/desvío, tangentes entrantes/salientes XY | Teselas → nodo/tangentes |
| T05 | Añadir/quitar nodo, restablecer bordes rectos | Teselas → edición |
| L01 | Selección, visibilidad y orden de conjuntos | Capas → lista de conjuntos |
| L02 | Patrón activo, nuevo, duplicar, nombre | Capas → Conjuntos |
| L03 | Lista de objetos, selección/Shift, visibilidad, bloqueo | Capas → Capas |
| L04 | Subir/bajar objeto, duplicar, eliminar | Capas → Capas |
| P01 | Elegir perímetro, dibujar nuevo, importar SVG | Aplicación → entrar en Aplicar |
| P02 | Elegir patrón, aplicar al perímetro, aplicación activa | Aplicación en modo Aplicar |
| P03 | Cambiar patrón vinculado, escala uniforme/XY, rotación/fase XY, ver patrón fuera del contorno | Aplicación seleccionada |
| P04 | Contorno del perímetro, congelar/revincular, eliminar aplicación | Aplicación seleccionada |
| V01 | Snap, guías, región fundamental, ejes, centros, continuidad | Preferencias |
| V02 | Unidades y fondo del lienzo | Preferencias |
| V03 | Fuente pura, una celda, vista dividida, snap rápido | Barras sobre lienzo |
| V05 | Acercar/alejar, ajustar contenido/patrón, restablecer vista | Barra flotante del lienzo |
| V06 | Estructura matemática, opacidad, grilla, guías; origen/orientación arrastrables | Barra flotante y tiradores del lienzo |
| V04 | Estado periódico, celda común, objetos/selección/unidades | Pie del workspace |
| H01 | Undo/redo, atajos Ctrl Z/Y/Shift Z, duplicar/todo/eliminar | Barra del lienzo y teclado |
| R01 | Estilo vigente/selección, selección mixta, seguir selección | Panel derecho, independiente del izquierdo |
| R02 | Color/HEX/ninguno, alfa de trazo/relleno y opacidad global | Panel derecho |
| R03 | Grosor/unidades, extremos, uniones, miter | Panel derecho |
| R04 | Línea sólida/discontinua/punteada/personalizada, secuencia y fase | Panel derecho |
| R05 | Perfil, curva visual y controles/añadir/eliminar puntos | Panel derecho |
| R06 | Regla de relleno, intercambiar, restablecer estilo | Panel derecho |
| R07 | Paletas frecuentes/recientes/favoritos/proyecto y destino | Panel derecho |
| R08 | Presets guardar/aplicar/renombrar/duplicar/actualizar/eliminar | Panel derecho |
| R09 | Abrir/cerrar, fijar, Escape, indicador vigente | Panel derecho y barra del lienzo |
| F01 | Fill F: clic/toque persistente, otra región, cancelar | Rail y lienzo; pendiente opciones contextuales compactas |
| F02 | Tolerancia y vínculo por defecto | Panel derecho |
| F03 | Región derivada fija/vinculada/stale, recalcular, cancelar | Panel derecho según selección |
| F04 | Aviso de límite de trazo y corregir | Lienzo → panel derecho |
| E01 | Exportar contenido conjunto/composición y destino | Cabecera → diálogo de exportación |
| E02 | Región finita, celda rectangular/de red, fundamental, aplicación | Exportación según documento |
| E03 | SVG/PNG/JPEG/DXF, editable/expandido, contornos tesela | Exportación según formato |
| E04 | Ancho/alto físicos, resolución, calidad, transparencia/fondo | Exportación según formato |
| E05 | Tolerancia, convertir trazo a contornos, preview/avisos | Exportación según formato |
| E06 | Descargar, progreso, cancelar, cerrar | Exportación |

## Primer incremento y comprobación pendiente

Se separan categorías y se conserva la pestaña por categoría en estado de
sesión; plegar ya no desmonta el panel. Navegar no llama a change ni agrega
undo. La galería, las teselas y las opciones generales ya no se apilan.
Se elimina el scroll interno de las antiguas galerías: queda un único
contenedor izquierdo. Eso todavía no satisface el objetivo de descubrir
todo el catálogo sin scroll; falta la galería ampliada.

Pendiente para aceptación: selector compacto/recientes/favoritos y galería
ampliada, tabs compactas de estilos y propiedades a la derecha, opciones
contextuales de dibujo/Fill/nodos/teselas/generador, buscador conectado a
handlers, menús/foco/teclado, cobertura completa de recorridos y matriz
final de cada fila. No se declara terminado ningún criterio global por
verificar únicamente el acceso a categorías. Las pruebas v1–v2.2 deberán
adaptar los recorridos que asumían controles visibles simultáneamente,
conservando todas sus aserciones geométricas y de persistencia.
