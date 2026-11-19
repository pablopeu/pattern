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
- Git exclusivamente local, commits por avances. Documentación y monitor leen el estado real.
- El timer usa el reset de telemetría, no una estimación fija desde el inicio. Se comprobaron sus decisiones con mocks; no se simula ni se afirma haber consumido un ciclo real completo.

## Límites comprobados

- La importación SVG cubre geometría compatible, no texto, imágenes, filtros, gradientes, máscaras importadas ni SVG anidados. Los elementos no admitidos se eliminan con aviso o se rechazan. La opacidad de grupo se aproxima por objeto con advertencia explícita.
- Curvas procedurales se muestrean de forma determinística; DXF aproxima Bézier con tolerancia. JSON conserva el original paramétrico.
- Desactivar «convertir trazos a contornos» exporta líneas centrales recortadas; no equivale al área material del stroke. El contorneado exacto dentro de la tolerancia es predeterminado.
- Se limita complejidad para evitar bloqueo/memoria excesiva. Rendimiento medido y picos documentados en TESTING.md; no se garantizan 30 FPS en toda composición arbitraria.
- IndexedDB es por navegador/origen. Otra PC accede a la aplicación, pero intercambia proyectos mediante JSON.
- El timer solicita continuar en el daemon local; necesita que la máquina y Codex permanezcan disponibles. No se puede comprobar desde esta máquina la conexión física del navegador de otra PC; sí se verifica escucha HTTP en interfaces LAN.

## Resultado de la corrida de cierre

`npm run check`: TypeScript y **57 pruebas correctas**. `npm run test:e2e`: **19 correctas**. `npm run test:monitor`: **4 correctas**. Dos pruebas adicionales del build estático correctas en raíz/subdirectorio. Build, instalación reproducible y validadores independientes correctos. Se conserva la aplicación servida por LAN para feedback posterior.
