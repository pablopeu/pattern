# Aceptación · PRD v4.0 (experiencia)

Inicio autorizado: v3.1 publicada en `main` (miniaturas y fallback genérico,
9cf7f30) y PRD v4.0 subido por Pablo. Dos ajustes de rumbo solicitados durante
el desarrollo, ambos incorporados: área de trabajo oscura en tema oscuro con
trazos y rellenos default claros, y barrido completo de restos de español en
la versión inglesa.

| AC | Evidencia |
|---|---|
|01 Idioma del navegador|`detectLanguage` (es*→es, en*→en, resto en) en src/tests/experience.test.ts; bootstrap pre-React en index.html evita destellos|
|02 Selección manual ES/EN|Menú de experiencia (Idioma/Tema/Interfaz) en la cabecera; E2E «cambios manuales inmediatos» cambia idioma y persiste tras recargar|
|03 Interfaz traducida|Catálogos: 84 claves de mensajes tipadas (en.ts obligado por tipo), 777 frases UI (en-phrases.ts) y 186 mensajes técnicos (en-messages.ts, incluye defaults de geometría y mensajes del motor); tests/i18n.spec.ts barre 6 vistas en inglés con heurística española y lista de excepciones acotada (Español/English/Poincaré/nombres propios)|
|04 Persistencia|localStorage `pattern.experience.v1`; parseo defensivo ante valores inválidos (unit)|
|05 Tema del sistema|`resolveTheme('auto')` consulta prefers-color-scheme; `data-theme` en el documento; unit + E2E|
|06 Selección manual de tema|Menú Tema: auto/claro/oscuro; E2E de las 8 combinaciones idioma×tema×modo|
|07 Componentes respetan tema|245 literales de color migrados a tokens semánticos con overrides `:root[data-theme=dark]`; lienzo oscuro #1b211c con trazo #e7eee1 y relleno #a9cfe0 para geometría nueva, grilla atenuada y textos con luminancia; exports y miniaturas usan el fondo efectivo|
|08 Documento intacto|`themedBackground` sólo oscurece cuando el fondo del estudio es el default claro; fondos elegidos se respetan siempre (E2E específico); cambio de tema no genera undo ni dirty|
|09 Simple inicial|`experienceDefaults.uiMode='simple'`; E2E «modo simple: por defecto» verifica primera visita sin storage|
|10 Avanzado completo|Modo avanzado sin recortes: todas las herramientas, familias de teselas, galería completa y pestaña de opciones; suites de regresión preexistente corren con seed avanzado|
|11 Cambio sin tocar documento|E2E «integridad»: alternar idioma/tema/modo sobre un proyecto complejo no modifica el documento ni su histórico ( fingerprints y undo)|
|12 Simple operativo|Herramientas esenciales visibles en simple (dibujo, simetrías curadas, teselas periódicas, capas, guardar/exportar/compartir); sin mutación declarativa (src/app/ui-mode.ts)|
|13 Escape a avanzado|Botones explícitos: «Más herramientas», «Explorar más simetrías», «Más familias de teselas» y pestaña options en estilo; E2E verifica cada escape|
|14 Independencia de proyectos|Preferencias viven sólo en localStorage; el JSON de proyecto (schemaVersion 7) no cambia; unit de validación|
|15 Enlaces compartidos|El visor de publicaciones arranca con el mismo bootstrap: respeta idioma/tema/modo del visitante, nunca fuerza los del autor; E2E de compartición existente|
|16 Pruebas|qa:fast PASS (unit 25/25, E2E 132/132, 256 s); FULL de cierre en la entrega de este documento|
|17 Tamaños|Suites de scroll/viewport v23 en verde tras compactar Preferencias (fila de experiencia en línea); márgenes reales verificados a 1366/1440/1920/390|
|18 Sin duplicar editor|Una sola UI: ui-mode.ts es política de visibilidad declarativa sobre los mismos componentes; motor y editor intactos|
|19 Sin dependencias nuevas|Cero paquetes npm agregados; tokens CSS y catálogos propios|
|20 Documentado y publicado|Este documento, STATUS.md, CONTINUITY.md y PROGRESS.md; commit y push a `main` autorizados|

## §14 Revisión final

- Empezar a dibujar: simple abre con Dibujo libre y CTA «Explorar ejemplos» en
  el lienzo vacío; sin diálogos previos.
- Generar una repetición: chips de simetría curada (p1, friso, p3/p4/p6, p4m)
  aplican grupos reales con miniatura; la galería completa queda a un escape.
- Opciones explorables: «Más herramientas»/«Explorar más» nombran qué se gana.
- Galería findable: categoría amigable en simple + CTA del lienzo vacío.
- Sobrecarga visual: simple filtra rail, familias, galería y pestañas; avanzado
  conserva el inventario completo.
- Oscuro legible: lienzo oscuro con trazos claros (pedido de Pablo), tokens
  revisados, grilla y hints con contraste verificado.
- Inglés natural: barrido permanente automatizado + dos pasadas manuales tras
  el feedback (tiles, flotantes de simetría, conjunto, patrón, nuevo, etc.).
- Protección del trabajo: cambiar modo/idioma/tema no toca documento ni undo
  (AC-11); los documentos complejos jamás se reescriben al abrir.
- Traducción parcial: la cobertura está forzada por test (cada `tr` literal
  debe existir en en-phrases); mensajes del motor pasan por `translateMessage`.
- Sin fugas de avanzado en simple: E2E de curaduría verifica ausencia de
  herramientas/familias/pestañas avanzadas.
- Arquitectura respetada: presentación separada del modelo; motor sin cambios.

Decisiones documentadas: los nombres propios de estudio/documento («Estudio sin
título», «Patrón 01») no se auto-traducen porque son datos del documento, no UI.
