# Verificación del PRD v1

Fecha de implementación y revisión: 19 de noviembre de 2026. La evidencia se obtiene de código ejecutado y navegadores reales; no equivale a certificar cualquier SVG o complejidad arbitraria.

## Criterios funcionales

| Criterio | Evidencia |
|---|---|
| AC-01 · Primera línea | Playwright verifica el path actualizado y varias instancias **antes de pointerup** |
| AC-02 · Nodos Bézier | Edición de nodos y tangentes sobre fuente canónica; escena SVG derivada en vivo |
| AC-03 · Desde instancia | E2E mueve un nodo desde copia reflejada pm y desde copia rotada p4; comprueba cambio de la fuente |
| AC-04 · 17 grupos | Vitest: orden, cierre, isometrías y preservación de red de los 17; p4g/pg/pgg y diferencia p3m1/p31m incluidos |
| AC-05 · Frisos/radiales | Siete frisos con sus órdenes; Cn/Dn con centro móvil fijo bajo todas las operaciones; UI describe la periodicidad unidimensional |
| AC-06 · Seamless | Mosaicos SVG rasterizados 3×3 frente a escena completa para p1, p4g, p6m y geometría que cruza bordes; comparación por píxel con tolerancia de antialiasing |
| AC-07 · Warp | Deformación del motivo previa a su órbita; no anuncia un warp global incompatible como preservador del grupo. Verificación algebraica de cierre/red |
| AC-08 · Parámetros | E2E cambia Warp Grid y spacing, conserva fuentes y revierte con undo. Vitest cubre determinismo, semilla, distribución circular y relación elíptica |
| AC-09 · Perímetro irregular | Ejemplo Bézier editable, creación/importación y aplicación; E2E escala, rota y congela, con undo/redo |
| AC-10 · Agujeros | Intersección real comprueba interior, exterior y hueco; área resultante 7.500 mm² en región 100×100 con hueco 50×50 |
| AC-11 · Expanded SVG | E2E descarga SVG aplicado sin `<clipPath>` ni `<use>`; tests comprueban recorte de curvas, regiones y contornos reales |
| AC-12 · Medidas | Rectángulo 100×50 mm guardado, reabierto y recuperado; SVG en mm, DXF en mm, importación SVG física y regiones submilimétricas |
| AC-13 · Proyecto completo | Round-trip de ocho ejemplos, aplicaciones congeladas, biblioteca, presets, versiones y relaciones validadas antes de reemplazar el documento |
| AC-14 · Determinismo | Todas las familias producen la misma geometría con parámetros/semilla/versión idénticos; Penrose verifica sus dos áreas |
| AC-15 · Interoperabilidad | SVG renderizado por CairoSVG; PNG/JPEG inspeccionados con Pillow; DXF leído con ezdxf. Resolución y metadatos 200 DPI comprobados |
| AC-16 · SVG hostil | E2E scripts/eventos/imágenes remotas inertes; sanitización de elementos/atributos y rechazo de referencias recursivas/expansivas |
| AC-17 · Estático/LAN | Build en raíz y subdirectorio con BASE_PATH configurada; HTTP Python, recursos de Internet bloqueados, edición y worker de exportación operativos |
| AC-18 · Visual | Capturas reales de Diseño/Patrón/Aplicar y exportación; 1366×768, 1440×900 y benchmark 1920×1080; sin desborde horizontal ni errores de consola |
| AC-19 · Historial | Dibujo, medidas, generador y aplicaciones con undo/redo; arrastres y sliders agrupados; conversión/booleanas usan el mismo historial |
| AC-20 · Controles reales | Revisión de herramientas, inspector, familias, capas, archivos, exportación y aplicación; controles inaplicables se ocultan o explican límites |

## Auditoría matemática

- Las matrices de edición usan inversas incluso en reflexiones/rotaciones.
- Grupos construidos como órbitas compatibles con la red, sin deformar bases oblicuas a rectángulos.
- Dominio Dirichlet con área correcta para los 17 grupos y redes extremas; superceldas rectangulares sólo cuando hay vectores de traslación justificables.
- Penrose/radial permanecen finitos; frisos no reciben una segunda periodicidad ficticia.
- Expanded SVG calcula intersecciones; contornos se construyen antes de transformar para conservar escala no uniforme. DXF subdivide después de transformar a coordenadas físicas.
- Se corrigieron en la auditoría: subdivisión Penrose, límites de celda expandida, contornos afines, viewport SVG, uniones bevel y bounds submilimétricos.

## Auditoría de arquitectura

- Documento TypeScript serializable independiente de React/Paper, fuente única e instancias reutilizables.
- IDs independientes al duplicar; snapshots de aplicaciones congeladas no se editan accidentalmente.
- Escena derivada, caché SVG para grandes repeticiones, exportación en worker cancelable y autosave transaccional.
- Módulos y decisiones documentados en ARCHITECTURE.md, GEOMETRY.md y PROJECT_FORMAT.md.

## Auditoría de experiencia

- Herramientas vectoriales reales; el patrón cambia durante el trazado y la manipulación de tangentes.
- Inspector seleccionado antes de controles de patrón; modos y paneles progresivos; ejemplos restaurables y ayuda visible.
- Permite crear, transformar, visualizar, aplicar y exportar sin preparar archivos externos obligatorios.
- Ocho ejemplos son documentos editables, no imágenes. No hay autenticación ni funciones comerciales.

## Auditoría operativa

- `dist/` contiene HTML/CSS/JS/assets locales y avisos de licencias. No necesita Node, Python, GPU ni API para procesar geometría en producción.
- Servidor de desarrollo LAN y monitor permanecen para revisión del usuario; son herramientas separadas del build.
- Historial Git con commits por avances y remoto de código autorizado en `pablopeu/pattern`. Documentación y monitor leen el estado real.
- El timer usa el reset de telemetría, no una estimación fija desde el inicio. Se comprobaron sus decisiones con mocks; no se simula ni se afirma haber consumido un ciclo real completo.

## Límites comprobados

- La importación SVG cubre geometría compatible, no texto, imágenes, filtros, gradientes, máscaras importadas ni SVG anidados. Los elementos no admitidos se eliminan con aviso o se rechazan. La opacidad de grupo se aproxima por objeto con advertencia explícita.
- Curvas procedurales se muestrean de forma determinística; DXF aproxima Bézier con tolerancia. JSON conserva el original paramétrico.
- Desactivar «convertir trazos a contornos» exporta líneas centrales recortadas; no equivale al área material del stroke. El contorneado exacto dentro de la tolerancia es predeterminado.
- Se limita complejidad para evitar bloqueo/memoria excesiva. Rendimiento medido y picos documentados en TESTING.md; no se garantizan 30 FPS en toda composición arbitraria.
- IndexedDB es por navegador/origen. Otra PC accede a la aplicación, pero intercambia proyectos mediante JSON.
- El timer solicita continuar en el daemon local; necesita que la máquina y Codex permanezcan disponibles. No se puede comprobar desde esta máquina la conexión física del navegador de otra PC; sí se verifica escucha HTTP en interfaces LAN.

## Resultado de la corrida de cierre v1

`npm run check`: TypeScript y **57 pruebas correctas**. `npm run test:e2e`: **19 correctas**. `npm run test:monitor`: **4 correctas**. Dos pruebas adicionales del build estático correctas en raíz/subdirectorio. Build, instalación reproducible y validadores independientes correctos. Se conserva la aplicación servida por LAN para feedback posterior.


## PRD v2 · Auditoría de aceptación

Se conserva la matriz v1 anterior. La evolución reutiliza el motor, el historial, el renderer SVG y la persistencia; no crea otro formato geométrico ni materializa las copias.

| Criterio | Evidencia |
|---|---|
| AC-21 · Inicio Libre | Proyecto nuevo none/none, identidad única, una representación SVG; p1 sigue periódico |
| AC-22 · Cambio no destructivo | Fuente, IDs, estilo, transformaciones y generador permanecen exactos al cambiar familias; perfiles independientes |
| AC-23 · Continuar dibujo | Cuatro trazos con Lápiz Libre→p4m→p6m→Libre, fuente persistente y estilo conservado |
| AC-24 · Reflexión | Nueva línea desde una copia pm seleccionada; inversa correcta durante pointermove y al finalizar |
| AC-25 · Rotación | Mismo flujo real en p4 y p6; nodos en coordenadas canónicas esperadas |
| AC-26 · Cruzar celdas | Desplazamiento de 65 mm con celda de 60 mm; una fuente nueva y una acción de undo |
| AC-27 · Trazo abierto | Pluma multipunto conserva anclas y captura al cambiar grupo/modo; cambio programático con pointer capturado conserva el gesto |
| AC-28 · Sin deriva | 100 ciclos incompatibles y regreso exacto a la configuración inicial en prueba unitaria |
| AC-29 · Miniaturas reales | Dibujos generados por buildScene/svgPath, actualización tras editar y tanda cancelable; preferencias no interrumpen una tanda útil |
| AC-30 · Hover puro | Canvas cambia temporalmente; JSON/metadata/IndexedDB quedan iguales. Foco de teclado no confirma |
| AC-31 · Historial | Confirmación por Enter/Espacio/toque; undo de grupo y fuente separados, redo y reparación del conjunto activo eliminado |
| AC-32 · Herramientas | Línea, Lápiz, Pluma y Nodos conservan contexto; estilo persistente al recorrer grupos |
| AC-33 · Editar copias | Regresión de nodos desde pm/p4 y creación desde pm/p4/p6; selección geométrica independiente del orden SVG |
| AC-34 · Origen | Arrastre cambia sólo configuración matemática; fuentes exactas, orientación separada y perfiles guardados |
| AC-35 · Guías | Operaciones/red comparten origen/orientación; dominio Dirichlet conserva área correcta. Friso muestra una dirección; Libre y Penrose sin celda ficticia |
| AC-36 · Composición | Heredado p4m→p6m, D8 propio y Libre visibles; selección/edición de los tres, orden/visibilidad y exportación común conservadora |
| AC-37 · Migrar | Ocho documentos reales v1, snapshot congelado, presets 1/2, mismos datos y grupos efectivos |
| AC-38 · Exportar | Libre directo sin use, composición expandida y aplicación congelada inmutable; SVG/DXF/PNG/JPEG y agujeros de v1 conservados |
| AC-39 · Medir | Benchmark reproducible de motor, frames de grupo, miniaturas, parámetros y nodos; resultados en TESTING.md |
| AC-40 · Flujo continuo | Galería disponible con objetos seleccionados; recorrido completo en Diseño, cambio a Patrón sin reiniciar herramienta |
| AC-41 · Estático | Producción en raíz y /pattern/, recursos externos bloqueados, dibujo y worker de exportación |
| AC-42 · Regresión | Se mantienen los 57 tests unitarios y 19 flujos E2E de v1 |

Las celdas comunes sólo se certifican para períodos rectangulares compatibles; una composición oblicua no certificada admite región finita. El preview de galería es transitorio y la exportación usa siempre el documento confirmado. Las miniaturas anteriores siguen visibles mientras se regenera la tanda; un límite de complejidad conserva la última miniatura válida.


### Resultado de cierre v2

TypeScript y **80 unitarias**, **31 E2E**, **4 tests del monitor**, build y dos verificaciones estáticas correctos. Validadores independientes de SVG, raster y DXF correctos. Se completaron las auditorías visual, matemática, persistencia, exportación y regresión; servicios LAN conservados para revisión. Las limitaciones de complejidad/importación de v1 y la certificación conservadora de celdas comunes permanecen documentadas.


## PRD v2.1 · Cierre de aceptación

| Requisito | Evidencia verificada |
|---|---|
| Fondo matemático completo | 17 wallpaper, siete frisos y Cn/Dn en unitarias y recorrido SVG real; ejes/centros con isometría testigo, medias traslaciones, p3m1/p31m y glides |
| Overlay utilizable | Botón independiente de la grilla, opacidad persistida, grosor no escalable, pointer-events none, culling/deduplicación y caché acotado; modos detallados excluyen la estructura completa |
| Casos no cristalográficos | Libre oculta estructura; friso sin red vertical; radial sin traslaciones; Penrose conserva exactamente su construcción finita, incluso con una configuración de tesela guardada e inactiva |
| Dibujo en zonas vacías | Tinta rasterizada bajo el cursor antes/después de pointerup en dos posiciones distantes: p6m, p4g, pg, p2mg y Dn. Se excluyen helpers de selección del raster de comprobación |
| Captura coherente | Matriz canónica independiente de la geometría previa, desempate estable, inversa fija, fuente única y prioridades explícitas; se conserva la regresión de Bézier, herramientas y cambios de grupo abiertos |
| Teselas básicas e irregulares | Cuadrado, rectángulo, paralelogramo, triángulo equilátero y hexágono regular; bordes Bézier emparejados por transformaciones exactas, área/cobertura y vecinos sin solapamiento |
| Edición de bordes | Nodos/tangentes y parámetros, una acción por gesto, límites constructivos explícitos, undo/redo y recuperación; fuentes/generadores del motivo permanecen intactos |
| Cruzar bordes reales | Cinco E2E verifican tinta fuera de la tesela inicial, fuente única y undo/redo. La continuidad por adyacencia precede al recorte; no depende de un contorno de selección |
| Editar desde otras copias | Nodo de motivo editado desde una copia reflejada dentro de otra tesela, con el mismo ID fuente; regresiones de instancias rotadas y reflejadas conservadas |
| Persistencia | Esquema 3, migraciones 1→2→3, fuentes/IDs/unidades/aplicaciones preservados, presets 1/2/3 y snapshots efectivos con su tesela propia; sin instancias serializadas |
| Exportación | SVG editable/expandido, DXF y raster existentes; overlay excluido, contornos optativos y deduplicados. Comparación raster de mosaicos curvos contra escena grande para cuatro familias; paralelogramo conserva su red oblicua |
| Interoperabilidad | CairoSVG renderiza el SVG editable de hexágonos curvos con tinta real a 787×630; PNG coincide en tamaño. ezdxf lee 58 polilíneas 2D recortadas en mm. Exportación aplicada v1 también validada |
| Rendimiento | Benchmark aislado con 100 fuentes: desplazamiento 33,19 ms sin overlay y 33,33 ms con overlay, incluyendo protocolo/frame; cálculo de p6m 1,6 ms mediana. Detalles y límites en TESTING.md |
| Logo e interfaz | icono.png original integrado como asset; capturas a 1440×900 y 1366×768 sin desbordes/errores. Misma interfaz, sin nuevas cuentas/dependencias remotas |
| Producción estática | Cuatro comprobaciones: edición/exportación v2 y flujo v2.1 con logo/tesela curva/worker, en raíz y /pattern/, con solicitudes externas bloqueadas |
| Regresión | 140 unitarias y 50 E2E correctas, incluyendo los 80 tests/31 flujos de v2; TypeScript, build y 4 tests del monitor correctos |

Límites: los vértices de las construcciones son estructurales; los controles de borde se limitan a corredores seguros. Los triángulos requieren simetría central por borde. La simetría elegida describe el motivo local antes de su recorte/adyacencia, sin prometer un grupo global arbitrario. Se conserva el límite de complejidad y no se ofrece un clasificador universal de polígonos. Penrose no se convierte a una red periódica.
