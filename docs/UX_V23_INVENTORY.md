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
Las ubicaciones siguientes describen la distribución implementada. La aceptación
global y los resultados de regresión se registran en ACCEPTANCE_V23.md.

| ID | Funciones inventariadas v2.2 | Ubicación implementada v2.3 |
| --- | --- | --- |
| A01 | Nombre de proyecto, estado de guardado, guardar JSON | Cabecera; nombre también en Preferencias (disponible en móvil) |
| A02 | Nuevo, abrir JSON, duplicar proyecto | Archivo |
| A03 | Biblioteca local, abrir proyecto anterior | Archivo → biblioteca |
| A04 | Ocho ejemplos editables | Archivo → ejemplos |
| A05 | Importar/exportar preset de patrón | Archivo |
| A06 | Ayuda, atajos, avances/feedback LAN en desarrollo | Archivo y pie del rail |
| A07 | Importar SVG, ancho físico, destino fuente/perímetro, cancelar | Rail → diálogo de importación |
| A08 | Diseño, Patrón, Aplicar | Cabecera; Aplicación ofrece acceso explícito a Aplicar |
| D01 | Selección V, nodos A, pluma P, lápiz B | Rail directo; contexto Dibujo |
| D02 | Línea L, rectángulo R, elipse E, polígono libre | Rail directo; contexto Formas para figuras |
| D03 | Polígono regular paramétrico, lados, ancho, alto, rotación | Formas → acción con nombre y preview; alias en rail |
| D04 | Pan H, espacio+arrastre, zoom al cursor | Rail y lienzo |
| D05 | Pluma: terminar, cerrar, cancelar; tangentes/Alt | Lienzo, teclado y ayuda |
| D06 | Nombre, posición XY, dimensiones, radio de esquinas | Derecha → Objeto → Forma/Transformar |
| D07 | Rotación, escala, reflejar X/Y | Derecha → Objeto → Forma/Transformar/Acciones |
| D08 | Convertir forma a paths editables | Derecha → Objeto → Forma/Transformar/Acciones |
| D09 | Path cerrado, nodo activo, nodo XY | Derecha → Objeto → Nodos |
| D10 | Insertar/eliminar nodo, curvar/enderezar segmento | Derecha → Objeto → Nodos |
| D11 | Suavizar, nodo angular, tiradores de tangentes | Derecha → Objeto → Nodos y tiradores del lienzo |
| D12 | Duplicar, eliminar, agrupar/desagrupar | Derecha → Objeto → Acciones, rail/teclado y Capas |
| D13 | Unión, intersección, diferencia, diferencia inversa, XOR | Derecha → Objeto → Acciones con selección múltiple |
| S01 | Simetría de conjunto/principal, propia/heredada/libre | Simetrías → Grupo y red / Colocación |
| S02 | Libre, 17 wallpaper, 7 frisos, Cn/Dn | Simetrías → selector compacto → Explorar todas; catálogo modal por familias |
| S03 | Filtro de familia, encuadre físico/por celda, hover y previews | Simetrías → Grupo y red / Colocación |
| S04 | Orientación de red, origen XY, sectores, celda ancho/alto/ángulo | Simetrías → Grupo y red, parámetros según familia |
| S05 | Adaptar patrón, restablecer colocación, guías detalladas | Simetrías → Grupo y red / Colocación |
| G01 | Familia de generador y preview del motivo | Simetrías → Generador |
| G02 | Filas, columnas, espaciado, desfase, rotación, escala, relación de escala | Simetrías → Generador → páginas de hasta cuatro parámetros |
| G03 | Cantidad, amplitud, frecuencia, fase, radio, relación de radios/ejes | Simetrías → Generador → páginas de hasta cuatro parámetros |
| G04 | Distribución rectangular/circular/freeform, escalonar filas/columnas | Simetrías → Generador → páginas de hasta cuatro parámetros |
| G05 | Semilla/nueva semilla, añadir/eliminar instancia, instancia XY | Simetrías → Generador → páginas y selector de instancia |
| G06 | Convertir generador a paths, avisos Penrose/warp | Simetrías → Generador |
| T01 | Habilitar teselas y seleccionar familia | Teselas, abiertas al entrar |
| T02 | Ancho/alto, shear, orientación, origen XY, contornos | Teselas → Forma/Colocación según familia |
| T03 | Editar bordes, borde maestro, nodo activo | Teselas → Bordes |
| T04 | Posición/desvío, tangentes entrantes/salientes XY | Teselas → Bordes/Tangentes |
| T05 | Añadir/quitar nodo, restablecer bordes rectos | Teselas → Bordes |
| L01 | Selección, visibilidad y orden de conjuntos | Capas → lista de conjuntos |
| L02 | Patrón activo, nuevo, duplicar, nombre | Capas → Conjuntos |
| L03 | Lista de objetos, selección/Shift, visibilidad, bloqueo | Capas → Capas |
| L04 | Subir/bajar objeto, duplicar, eliminar | Capas → Capas |
| P01 | Elegir perímetro, dibujar nuevo, importar SVG | Aplicación → entrar en Aplicar |
| P02 | Elegir patrón, aplicar al perímetro, aplicación activa | Aplicación → Perímetro en modo Aplicar |
| P03 | Cambiar patrón vinculado, escala uniforme/XY, rotación/fase XY, ver patrón fuera del contorno | Aplicación → Transformar/Vínculo según acción |
| P04 | Contorno del perímetro, congelar/revincular, eliminar aplicación | Aplicación → Transformar/Vínculo según acción |
| V01 | Snap, guías, región fundamental, ejes, centros, continuidad | Preferencias |
| V02 | Unidades y fondo del lienzo | Preferencias |
| V03 | Fuente pura, una celda, vista dividida, snap rápido | Barras sobre lienzo |
| V05 | Acercar/alejar, ajustar contenido/patrón, restablecer vista | Barra flotante del lienzo |
| V06 | Estructura matemática, opacidad, grilla, guías; origen/orientación arrastrables | Barra flotante y tiradores del lienzo |
| V04 | Estado periódico, celda común, objetos/selección/unidades | Pie del workspace |
| H01 | Undo/redo, atajos Ctrl Z/Y/Shift Z, duplicar/todo/eliminar | Barra del lienzo y teclado |
| R01 | Estilo vigente/selección, selección mixta, seguir selección | Panel derecho por pestañas, independiente del izquierdo |
| R02 | Color/HEX/ninguno, alfa de trazo/relleno y opacidad global | Panel derecho |
| R03 | Grosor/unidades, extremos, uniones, miter | Panel derecho |
| R04 | Línea sólida/discontinua/punteada/personalizada, secuencia y fase | Panel derecho |
| R05 | Perfil, curva visual y controles/añadir/eliminar puntos | Panel derecho |
| R06 | Regla de relleno, intercambiar, restablecer estilo | Panel derecho |
| R07 | Paletas frecuentes/recientes/favoritos/proyecto y destino | Panel derecho |
| R08 | Presets guardar/aplicar/renombrar/duplicar/actualizar/eliminar | Panel derecho |
| R09 | Abrir/cerrar, fijar, Escape, indicador vigente | Panel derecho y barra del lienzo (pin/cierre/Escape) |
| F01 | Fill F: clic/toque persistente, otra región, cancelar | Rail y lienzo; Derecha → Fill |
| F02 | Tolerancia y vínculo por defecto | Panel derecho |
| F03 | Región derivada fija/vinculada/stale, recalcular, cancelar | Derecha → Fill según selección |
| F04 | Aviso de límite de trazo y corregir | Lienzo → panel derecho |
| E01 | Exportar contenido conjunto/composición y destino | Cabecera → diálogo de exportación |
| E02 | Región finita, celda rectangular/de red, fundamental, aplicación | Exportación → Contenido según documento |
| E03 | SVG/PNG/JPEG/DXF, editable/expandido, contornos tesela | Exportación → Formato y tabs Contenido/Tamaño/Precisión |
| E04 | Ancho/alto físicos, resolución, calidad, transparencia/fondo | Exportación → Formato y tabs Contenido/Tamaño/Precisión |
| E05 | Tolerancia, convertir trazo a contornos, preview/avisos | Exportación → Formato y tabs Contenido/Tamaño/Precisión |
| E06 | Descargar, progreso, cancelar, cerrar | Exportación |

## Auditoría de conservación

Las filas A01–E06 tienen una ruta explícita; ninguna depende de una sección
eliminada. ObjectProperties conserva los handlers originales de geometría,
conversión, nodos, booleanas y grupos. Los campos de generador se enumeran con
las mismas generatorParameters y condiciones; la paginación cambia sólo qué
bloque se presenta. Cada borde/nodo/instancia/punto de perfil/color sigue
seleccionable. Las listas potencialmente largas de capas/proyectos pueden
usar el único scroll de su superficie.

Los recorridos de tests/navigation.ts abren categorías/tabs/catálogo mediante
clics reales. Se conservan las aserciones originales de geometría, tinta,
exportación, persistencia y undo; no se reemplazan por conteos de controles.
La cobertura de contextos compactos prueba todas las pestañas derechas y las
familias de controles izquierdos a las cuatro resoluciones solicitadas.

El catálogo tiene una sola superficie modal; en pantallas estrechas pagina
opciones. No se ocultan barras para simular que todo cabe. En escritorios y
el viewport móvil auditado los controles de configuración caben sin scroll.
En ventanas más bajas, zoom de navegador o contenido excepcionalmente largo,
el scroll de respaldo sigue visible y accesible.

La auditoría final y sus límites se completan en ACCEPTANCE_V23.md después
de la corrida completa y las pruebas de hosting estático.
