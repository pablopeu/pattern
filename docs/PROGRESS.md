# Avances

## 2026-11-19 · Inicio

- Inspección: repositorio nuevo, sólo PRD v1, sin commits previos ni archivos de implementación.
- Elegido stack React + TypeScript estricto + Vite, Paper.js para operaciones geométricas, SVG para instancias, IndexedDB local y pruebas Vitest/Playwright.
- Preparación del monitor de cupo con telemetría local real y reanudación de la misma conversación.
- Aplicación accesible en LAN (puerto 4173); panel de actividad independiente (4174). Sin publicación ni repositorios remotos.
- Pendiente: implementar y verificar todos los criterios del PRD. Este registro no implica funcionalidades terminadas.

## 2026-11-19 · Motor y primera versión integrada

- Modelo TypeScript independiente de React: geometría canónica, transformaciones, generadores, patrones, regiones y aplicaciones vinculadas/congeladas.
- Motor afín con inversas; 17 grupos periódicos, 7 frisos, Cn/Dn y restricciones de red. Penrose finito distinguido de un patrón periódico.
- Editor SVG con instancias reutilizables, herramientas vectoriales, trazado en vivo, selección, nodos/tangentes, pan/zoom y vista dividida. Capas, operaciones booleanas y conversión explícita de paramétricas a paths.
- Generadores determinísticos y ocho ejemplos editables. Paneles contextuales y parámetros numéricos.
- Autosave IndexedDB, archivo JSON versionado validado, importación SVG sanitizada con escala física explícita cuando falta.
- Exportador en worker con cancelación: SVG, raster, DXF y recorte geométrico mediante Paper.js. Falta validar sus flujos completos en navegador.
- Verificado: `npm run build` correcto y 29 pruebas Vitest correctas. Se corrigió una subdivisión Penrose detectada por las pruebas de áreas.
- Disponible por LAN: estudio :4173 y panel de avances/cupo :4174.
- Pendiente inmediato: Playwright y revisión visual; auditoría de importación, recorte expandido, continuidad, edición desde instancias y persistencia. Implementar faltantes del PRD detectados en esa auditoría.

## 2026-11-19 · Validación funcional y correcciones

- Navegador Chromium real: renderizado y capturas desktop, dibujo antes de soltar, edición de nodo desde copia reflejada, medidas 100×50 mm y round-trip JSON, sanitización y transformaciones SVG, cuatro formatos de descarga y SVG aplicado expandido sin máscara.
- Corregido guardado explícito: completa la transacción local antes de descargar el JSON, evitando recuperar un autosave anterior al recargar inmediatamente.
- Biblioteca de proyectos local: conserva archivos anteriores al crear proyectos o abrir ejemplos. Importación y exportación de presets con validación.
- Historial agrupa los movimientos continuos de sliders en una acción. La vista dividida permite seleccionar la fuente.
- Recorte expandido de todas las celdas, incluidas redes oblicuas; conversión de strokes antes de aplicar transformaciones afines, conservando escala no uniforme.
- 37 pruebas unitarias pasan: añadidas áreas de regiones fundamentales, agujeros, Bézier recortadas, DXF, copias congeladas y culling con motivos fuera del origen.
- Añadidas guías de región fundamental (Dirichlet), ejes, centros y vista de inspección de uniones con verificación algebraica de la red.
- Monitor: pruebas de umbral, reset real, ventana semanal y detección de reanudación fallida.
- En curso: benchmark exigido, pruebas E2E ampliadas, despliegue estático/offline y documentación final. El PRD todavía no se considera completado.

## 2026-11-19 · Rendimiento, interoperabilidad y despliegue

- Benchmark reproducible: 100 objetos fuente, Warp Grid, simetría p4m, región irregular y 336 celdas de red (2.688 operaciones). Motor mediana ~0,6 ms, p95 ~1,2 ms.
- Detectado cuello de botella de renderizado (~72 ms/cuadro); corregido con una celda SVG nativa reutilizada para escenas grandes. Parámetros: mediana ~17 ms, p95 ~21 ms; arrastre de nodos mediana ~33 ms, con picos que quedan documentados. Las mediciones no son garantías para geometrías arbitrarias.
- Exportación de región fundamental real y celdas SVG con `<pattern>`. Metadatos de simetría y unidades incluidos.
- PNG/JPEG con dimensiones y metadatos de 200 DPI confirmados por Pillow. SVG expandido renderizado por CairoSVG y DXF abierto por ezdxf: 36 polilíneas 2D, unidades mm.
- Build estático probado en raíz y subdirectorio `/pattern/` por HTTP, bloqueando recursos de Internet. Editor y worker de exportación funcionan sin backend.
- 53 pruebas unitarias correctas. E2E ampliadas a pluma, edición desde instancias rotadas, biblioteca/presets, rechazo de regiones abiertas, mosaicos rasterizados p1/p4g/p6m y aplicaciones congeladas con undo/redo.
- Mejorada validación semántica: matrices singulares, paramétricas incompletas, compound paths e identificadores duplicados se rechazan antes de sustituir el documento.
- Pendientes de cierre: corrida completa de pruebas tras los últimos cambios, auditoría visual final, documentación operativa y matriz de aceptación.

## 2026-11-19 · Auditoría matemática y de interacción

- Corregida la importación SVG para resolver explícitamente `preserveAspectRatio`, viewBox, unidades físicas y viewport sin viewBox. Paper.js no resuelve por sí solo todas esas combinaciones; ahora conserva las matrices y el escalado de los trazos.
- Conservados grupos SVG, opacidades, extremos y uniones. Las referencias locales se validan antes de expandirlas; ciclos, anidaciones/expansiones excesivas y SVG anidados no compatibles se rechazan con explicación.
- Añadido contorneado real de uniones bevel, extremos butt/square/round y tolerancia ajustada a la escala física.
- Corregida la duplicación de patrones y grupos: generan IDs independientes para no editar accidentalmente la fuente original.
- Inspector geométrico prioritario y contextual; los controles de simetría no se presentan para Penrose. Frisos identificados explícitamente como periódicos en una dirección.
- Validadas regiones submilimétricas y autointersectadas con área de paridad; se eliminó un mínimo de 1 mm en los bounds. Un perímetro sin área no sustituye el autosave válido.
- Última suite E2E completa: 17 casos correctos. Vitest ampliado a 56 casos; monitor Python: 4 casos correctos. En curso corrida final posterior a las últimas validaciones.
- Documentación operativa y técnica incorporada en los seis archivos requeridos. Falta registrar auditoría final y commit de cierre tras verificar de nuevo el build y el despliegue afectados.

## 2026-11-19 · Integración final verificada

- TypeScript estricto, 57 pruebas unitarias y 19 flujos E2E completos pasan. Se añadieron cancelación de rasterización sin descarga tardía y polígono paramétrico como perímetro sin alterar el motivo.
- Los componentes de una región se unen respetando sus fill-rules: los agujeros pertenecen a compound paths o a una Diferencia, sin inventar huecos al superponer formas independientes.
- Persistencia de resultados Paper.js con 12 decimales; JSON conserva sus datos sin una nueva cuantización al guardar/abrir.
- Archivo fuente formateado para revisión y mantenimiento, con comando reproducible `npm run format`.
- `npm ci` comprobado en una instalación aislada del lockfile, conservando el servidor de revisión activo.
- Build de producción correcto, chunks separados y dependencias locales. Se mantiene dist/ generado en esta máquina.

## 2026-11-19 · Cierre del PRD

- Corrida final: **57 unitarias, 19 E2E y 4 del monitor correctas**. TypeScript y build correctos.
- Build final probado en raíz y `/pattern/` con base explícita, por HTTP y bloqueando recursos de Internet. El worker funciona en ambos despliegues.
- Validadores independientes volvieron a pasar: CairoSVG, PNG/JPEG 1522×1301 a 200 DPI, DXF 36 polilíneas 2D en mm.
- Escucha LAN comprobada: HTTP 200 en estudio :4173 y monitor :4174. No es posible comprobar desde aquí la conexión física de la otra PC.
- Auditoría AC-01…AC-20 y límites en `docs/ACCEPTANCE.md`; instalación, ejecución, pruebas y despliegue en README.md y TESTING.md.
- No hubo feedback pendiente al cierre. Se conservan ambos servicios para revisión del usuario y Git exclusivamente local.
- Se marca el encargo verificado para evitar una reanudación innecesaria al reset. El monitor vuelve a vigilar si se retira el marcador para cambios posteriores autorizados.

## 2026-11-19 · Remoto GitHub autorizado

- El usuario solicitó commit y push a `https://github.com/pablopeu/pattern`.
- Repositorio remoto comprobado vacío y rama de destino `main`; se conserva el historial local completo.
- Actualizadas las instrucciones y la documentación para reflejar la autorización del remoto. Sin cambios funcionales en la aplicación.

## PRD v2 · Baseline y auditoría inicial

- Especificación v2 leída completa; se reutilizan modelo canónico, matrices, grupos, renderer SVG, historial y exportación.
- Baseline ejecutado: TypeScript, 57 unitarias, 19 E2E, 4 del monitor y build correctos.
- Confirmado: p1 actual es periódico, no Libre; la creación captura coordenadas globales; el cambio de modo reinicia herramienta; las simetrías se ocultan al seleccionar; sólo se representa un patrón activo.
- Se inicia evolución a esquema 2, resolver efectivo común, captura inversa estable, galería programada y composición ligera mediante patterns[].
- Referencias públicas iOrnament/Bridges/Springer inspeccionadas conceptualmente. El artículo Springer figura publicado en marzo de 2026, aunque su DOI incluye 2025. No se incorpora geometría hiperbólica ni código/recursos propietarios.


## PRD v2 · Incremento funcional integrado

- Libre explícito, estado `FREE_NONPERIODIC`, proyecto inicial vacío y simetría efectiva centralizada. Los ocho ejemplos mantienen sus grupos originales.
- Esquema 2 y migración real 1→2, incluyendo snapshots congelados y presets. Fixtures capturados desde el commit v1 `2aa0987`; IDs/fuentes/generadores/unidades y regiones conservados.
- Configuración por grupo, origen/orientación, colocación independiente y adaptación reversible sin reescribir fuentes.
- Captura determinística por instancia y matriz inversa fija, cruces de celdas, trazo multipunto abierto y cambios de grupo con puntero capturado. Herramienta/selección continúan entre Diseño y Patrón.
- Galería de 27 opciones con dibujo real, icono matemático, encuadre físico común, hover/foco transitorio, confirmación única y generación diferida/cancelable. Corregida cancelación por cambios de preferencias sin cambio geométrico.
- Composición visible/ordenada mediante patterns[] propios/heredados/libres; exportación compuesta con IDs locales independientes. Aplicaciones congeladas guardan la simetría efectiva propia.
- Corrida integrada: **80 unitarias y 29 E2E correctas** (incluye los 19 de v1), TypeScript y build correctos; 4 tests del monitor y validadores CairoSVG/Pillow/ezdxf correctos. Estático en raíz y `/pattern/` funciona con Internet bloqueado.
- Pendiente antes del cierre de v2: terminar auditoría visual a 1366/1440, pruebas adicionales de toque/teclado/estilo y recuperación del conjunto activo, repetir benchmark aislado y build tras últimas correcciones, consolidar matriz AC-21…AC-42. No se declara completo todavía.


## PRD v2 · Cierre verificado

- Última corrida posterior a todos los cambios: **80 unitarias y 31 E2E correctas**, TypeScript y build correctos. Se mantienen íntegros los 57 tests unitarios y 19 flujos de v1.
- Build final servido en raíz y `/pattern/`: dos pruebas correctas con recursos externos bloqueados, dibujo y exportación desde worker.
- Corregida la galería para suspender tareas durante gestos, cachear URLs SVG e iconos y terminar tandas pese a cambios de preferencias. Mejora del p95 de nodo de 303.9 a 77.3 ms; las mediciones incluyen protocolo y no se convierten en una garantía universal de FPS.
- Primera fila de miniaturas visible y controles compactados a 1366×768; capturas también a 1440×900. Sin errores de consola ni desbordes.
- Nuevas pruebas de teclado, Espacio, toque, conservación del estilo de Lápiz, edición independiente de los tres conjuntos y selección válida tras undo.
- Formato nativo v2, fragmentos v1/v2 y fixtures completos, arquitectura de matrices/captura/preview, referencias y matriz AC-21…AC-42 documentados.
- Benchmark aislado y limitaciones en TESTING.md. Escucha LAN 4173/4174 comprobada con HTTP 200; sin feedback pendiente.
- Checkpoint funcional `b3113cd` ya subido. El cierre y la documentación se incorporan al mismo historial main autorizado. PRD v2 terminado; servicios de revisión se conservan.


## PRD v2.1 · Overlay y captura integrados

- Leído el nuevo PRD completo y retirado PROJECT_COMPLETE. Baseline v2: 80 unitarias/31 E2E correctas. Telemetría actual confirma reset; la muestra anterior al 88% estaba expirada.
- Overlay matemático de viewport con isometrías testigo, ejes/centros deduplicados, centros de medias traslaciones, dominio fundamental repetido y celda primitiva diferenciada. Frisos sin red vertical; radial sin periodicidad ficticia. Botón independiente de grilla, opacidad persistida y ausencia en exportaciones.
- Captura canónica independiente de las fuentes y del culling previo; mantiene prioridades explícitas y una inversa fija por gesto.
- Esquema 3 con migración 2→3 sólo de preferencias; entidades v1/v2 conservadas.
- **115 unitarias y 37 E2E correctas**, conservando la regresión v2. Cinco pruebas rasterizan el SVG real y verifican tinta bajo el cursor antes/después de soltar en dos posiciones vacías distantes: p6m, p4g, pg, friso p2mg y Dn.
- Teselas editables todavía en desarrollo: el generador legado no prueba encastre. Decisiones y pendientes en docs/V21_IMPLEMENTATION.md. No se declara v2.1 completo.


## PRD v2.1 · Teselas conectadas al editor

- Cinco construcciones: cuadrado, rectángulo, paralelogramo, triángulo equilátero (bordes con simetría central) y hexágono regular. Perfiles normalizados de nodos/tangentes, parejas exactas y corredores conservadores.
- Validación Paper.js independiente de área, autointersección, solapamiento vecino y cobertura de una región; casos regulares y Bézier.
- Modelo opcional versionado de tesela separado de fuente/generador/simetría local. Render vectorial recortado a la tesela y repetición según su red propia. Captura y selección usan la composición de matrices y respetan el clip de cada copia.
- Panel de familia/dimensiones/origen/orientación/contorno y edición de nodos/tangentes, con una acción por gesto. Motivo interior preservado.
- Cinco E2E de teselas pasaron: tinta real en dos copias distantes, borde emparejado, arrastre/undo/redo, persistencia y fuentes intactas. Unitarias ampliadas a **137 correctas**, incluyendo exportación y snapshots/presets.
- Pendiente: comparación raster de exportaciones, prueba de nodo de motivo desde copia reflejada dentro de tesela, deduplicación de contornos exportados, auditoría visual y benchmark overlay on/off; regresión final y logo icono.png solicitado.


## PRD v2.1 · Continuidad entre bordes y logo

- El motivo recortado incorpora las isometrías de adyacencia para que un trazo continúe realmente fuera de la tesela inicial, sin dividir ni modificar su única fuente. La exportación usa el mismo template derivado.
- Las pruebas de tinta eliminan los contornos de selección del SVG rasterizado, evitando confundir ayudas de edición con contenido real. **18 E2E v2.1 correctos**, incluidos cruces de borde y undo/redo en las cinco familias, copia reflejada y comparación de mosaicos exportados.
- Contornos de teselas deduplicados por curva y sentido, exportados sólo mediante opción explícita; DXF usa líneas centrales de borde.
- Logo visible reemplazado por `icono.png` provisto por el usuario, como asset local de Vite; pendiente inspección visual final junto con build raíz/subdirectorio.
- Cierre aún en verificación: benchmark overlay, regresión completa, documentación final y pruebas estáticas.


## PRD v2.1 · Integración verificada para cierre

- **140 unitarias**, **50 E2E**, **4 del monitor** correctas; TypeScript y build correctos. Se conserva la regresión v1/v2 completa.
- Cuatro pruebas de producción correctas: flujo anterior y flujo v2.1 con logo local/hexágono curvo/exportación desde worker, en raíz y /pattern/, bloqueando Internet.
- Validación externa ampliada: CairoSVG y PNG de hexágono curvo con tinta real a 787×630; DXF con 58 polilíneas 2D recortadas en mm. Caso aplicado v1 también correcto.
- Benchmark aislado y auditoría visual final registrados en TESTING.md; controles de guías detalladas desactivan la estructura completa para evitar estados contradictorios.
- Logo icono.png comprobado cargado y legible a 1366/1440; bitmap original conservado y asset incluido en ambos builds estáticos.
- Matriz completa v2.1 y restricciones constructivas documentadas en docs/ACCEPTANCE.md. No quedan funcionalidades requeridas pendientes; resta registrar el cierre en Git y conservar servicios LAN.


## PRD v2.1 · Cierre en main

- Incremento funcional y logo confirmados en GitHub mediante 1343761, precedido por c11008d. Historial completo preservado y sin cambios de dependencias.
- Estado de continuidad reescrito con evidencia final, decisiones geométricas y operación del monitor. PRD v2.1 terminado y sin trabajo requerido pendiente.
- Se conserva la aplicación en 4173 y el monitor/feedback en 4174. Se detiene sólo el servidor HTTP temporal de QA en 4180; artefactos locales permanecen disponibles.
- Se marca PROJECT_COMPLETE después del push del cierre para evitar otra reanudación automática sin tarea pendiente. Cualquier feedback posterior autorizado reabre el ciclo.

## PRD v2.2 · Estilos compartidos y contornos de trazo

- Esquema 4: estilo vigente, presets de valor, paletas/recentes/favoritos; dash/perfil por geometría. Migración 3→4 incluye fuentes, perímetros y snapshots; presets de patrón 1–4 compatibles. La regresión v1 compara exactamente los campos anteriores y verifica sólo los tres defaults añadidos.
- Panel derecho independiente, pin persistido, Escape/autocierre; indicador permanente con color, unidad, línea y estado mixto. Selección no sobrescribe vigente; política visible para sincronizar sólo los atributos editados. Controles compartidos con inspector izquierdo, HEX/alfa, paletas, presets CRUD y editor visual del perfil con mouse/teclado.
- Grosor/opacity por slider y arrastre del perfil: una acción de historial por gesto. Abrir/cerrar panel conserva mm/píxel y origen documental; diseño inspeccionado a 1440/1100/768 sin overflow horizontal. Logo icono.png conservado.
- Motor común de contornos derivado del anterior: guiones por longitud de eje, fase/arrays impares, ancho variable Hermite monótono, subdivisión adaptativa, tapas/uniones/inglete y unión Clipper para autointersecciones. SVG nativo para dash uniforme; variable vectorial; recortes respetan fase. Eje fuente intacto; DXF expande perfiles y separa guiones.
- Evidencia: **151 unitarias** de estilos/trazo + regresión; **5 E2E v2.2** con tinta raster real, mixed selection, presets/recarga, cámaras/responsive y undo de gestos; los 50 E2E previos pasaron entre la corrida general y repetición aislada. Corrida general tuvo dos interferencias de QA (hot reload y carpeta de artefactos compartida) y detectó un defecto real de uniones redondas en guiones variables, corregido y verificado. No ejecutar suites Playwright concurrentes con la misma carpeta ni editar módulos activos mientras corren. Build y 4 pruebas del monitor correctos.
- Pendiente obligatorio: conectar Fill planar, preview/confirmación/candidatos, referencias/vínculos, órbitas y teselas; exportaciones/validación externa, regresión final y documentación. PRD v2.2 **en curso**.

## PRD v2.2 · Fill planar integrado (incremento, PRD aún abierto)

- Grafo vectorial de medias aristas: intersecciones y subdivisiones Bézier exactas, caras acotadas, agujeros con orientación compatible con nonzero/evenodd, rectas coincidentes, tangencias y autointersecciones. Cierre numérico 1e-6 mm; tolerancia ampliada explícita (0–5 mm) junta endpoints/T-junctions sólo en geometría derivada.
- Balde F: previsualización, confirmación por mouse/Enter/botón, candidatos alternativos/Tab, cancelación real terminando worker; caras y consulta espacial cacheadas. Cola de hover acotada a una consulta activa y última posición. Límites: 1200 curvas/entradas, 20000 intersecciones, 40000 medias aristas y 2000 caras. Guías/overlays ajenos al grafo.
- Objeto cerrado recibe color en su fuente respetando huecos/instancia/bloqueos. Cara nueva es una sola entidad; prueba de simetría para fuente canónica cuando hay un solo conjunto y placement, órbita concreta verificada en casos restantes. Tesela ofrece candidato de interior material y se repite en sus matrices reales.
- Referencias versionadas de geometría/curvas/instancias/contexto. Recálculo vinculado en worker al commit del gesto; parches se incorporan a estados de historial de la misma revisión geométrica. Fijo conserva contorno; eliminación/topología/configuración incompatible conserva último válido y marca stale. Edición manual de región desactiva vínculo. Presets importados conservan rellenos como valores fijos.
- Scene y exportación soportan órbitas independientes, orden de capas compartido y materialización de fondos de teselas. Eje editable original preservado; aplicaciones congeladas no reciben recálculo desde fuentes vivas.
- Verificado: **175 unitarias**, TypeScript/build correctos; **5 E2E Fill** con tinta real, agujero, celdas distintas, tesela persistida, actualización vinculada y mouse/autocierre (también forman parte de la regresión completa en curso). Cinco E2E de estilos ya verificados. Capturas de panel desktop/768 y relleno periódico inspeccionadas.
- Cierre de ciclo por cupo próximo al umbral. **Pendiente de PRD**: auditoría avanzada de Fill/órbitas/teselas, exportaciones externas v2.2, pruebas estáticas raíz/subdirectorio, benchmark y matriz visual final. Ver continuidad para riesgos concretos pendientes. No crear PROJECT_COMPLETE.
- Monitor real alcanzó90% usado y confirmó timer para22:48:28 Argentina. Corrida general interrumpida con exit143 tras57 casos correctos; se verifican aparte los tres restantes antes del commit. No hubo fallos de aserciones en los57 completados.
- Verificación de cierre del incremento Fill: **60 E2E distintos correctos** (57 general +3 restantes dirigidos), **175 unitarias** y build correctos. Se preservaron los 50 anteriores junto a10 nuevos de v2.2. Se registra checkpoint; PRD v2.2 continúa pendiente de los puntos de auditoría indicados en CONTINUITY.

## Feedback LAN · Panel de apariencia exclusivamente derecho

- Atendido feedback recibido 20/11 01:29 UTC: colores/trazos no deben repetirse al pie del inspector izquierdo. Se retiraron de allí todos los controles de estilo; queda un acceso explícito que abre el panel vertical derecho con la selección como destino.
- Se conservan el estilo vigente, pin, autocierre al interactuar con lienzo y escala documental. El indicador compacto mantiene muestras/unidad/patrón visibles también por debajo de900 px.
- **175 unitarias correctas**, dos E2E dirigidos correctos: flujo de feedback con ubicación real a la derecha/autocierre/768 px, y regresión de lápiz/estilo al recorrer grupos (adaptada para usar panel derecho). Capturas v22-right-only-1440.png y v22-right-only-closed-768.png.
- El usuario autorizó explícitamente continuar durante los últimos minutos de la ventana previa al reset. Se respeta esa indicación y no se duplica el monitor.

## PRD v2.2 · Límites geométricos y recuperación de preview

- Preview de contorno variable con fallback explícito: si excede límites se muestra eje provisional naranja, motivo del fallo y acceso a corregir su estilo. No se desmontan lienzo ni galería. SVG/export siguen usando el cálculo estricto, sin exportar ese eje provisional.
- Presupuesto acumulado de 24000 muestras, 100000 polígonos, 400000 vértices, 4096 curvas y2048 segmentos pintados; coordenadas locales acotadas y tolerancia positiva finita. Caché de preview acotada por tamaño/cantidad. Rectas no necesitan ocho subdivisiones artificiales por guion; mantienen refinamiento adaptativo de anchura.
- createFaceFill rechaza keys, referencias, paths y contexto que excedan los límites del archivo antes de añadir la entidad. Se evita guardar un documento inválido tras una operación excesiva.
- **178 unitarias y build correctos**. E2E real de secuencia excesiva: aviso visible, galería/lienzo vivos, corrección desde panel derecho sin errores de página. Unitarias verifican fallo explícito de export, presupuesto acumulado y rechazo de relleno excesivo.
- Reset real confirmado por telemetría del ciclo nuevo, inicialmente1% usado; monitor persistente retomó working. Continúa auditoría del PRD.

## PRD v2.2 · Recoloreo, órbitas y recálculo explícito

- Recolorear una cara ya derivada reutiliza su objeto desde cualquier copia; candidatos de cara idénticos se omiten. Comparación geométrica admite recorrido invertido, necesario en reflexiones y en órbitas concretas con placements reflejados. Selección de Fill guarda la matriz real pulsada.
- Miniaturas representan regiones de órbita y fondos de teselas en orden de capas; preparación externa del generador no duplica fuentes Fill ni las deforma otra vez. Caché toma fill-rule y visibilidad material; un límite totalmente transparente invalida el vínculo sin borrar el último contorno.
- Acción «Recalcular y vincular región»: worker cancelable, referencias/familias de límites y coincidencia geométrica para exigir una única cara equivalente (no cursor aproximado). Contorno conservado ante topología incompatible; estilos/ID preservados. Se integra como una acción undo/redo y descarta resultados tardíos tras cancelar o cambiar geometría. Errores del worker de vínculos marcan stale conservando contorno.
- Corregida comparación de contexto de todos los inputs capturados, incluidos conjuntos presentes que no delimitan la cara seleccionada.
- **187 unitarias correctas**. Los **13 E2E de Fill** pasaron entre corrida y repetición de reflexión tras corregir orientación: Bézier exacta, huecos nonzero, abertura/tolerancia explícita sin cambiar fuentes, caras entre instancias/celdas, reflejo/rotación y selección, recoloreo sin duplicado, fondo en miniatura, recálculo+undo/redo, cancelación tardía y primer toque/confirmación táctil reales. Build de cierre en verificación. Continúa auditoría de teselas curvas, export externa y producción estática.
- Build de cierre de este incremento correcto; se registra commit y push en main.

## PRD v2.2 · Teselas curvas, marcos afines y panel superpuesto

- Vínculos de cara comparan configuración geométrica: showOutline es preferencia visual y no invalida una región. Cambios de perfil de borde siguen la red de tesela existente si la cara sigue siendo inequívoca. Se revalida toda la órbita concreta tras editar límites; si alguna copia deja de ser cara, se conserva el último contorno y se marca stale.
- La actualización conserva el marco afín editable de la región usando la transformación inversa correspondiente. Los fondos fijos se recortan al material nuevo sin alterar su fuente; los vinculados cubren el interior actualizado.
- A768 px el indicador se muestra dentro de la cabecera del panel superpuesto y vuelve a la barra cuando se cierra. No queda tapado ni pierde capacidad de abrir/cerrar el panel.
- **191 unitarias correctas**. Cuatro E2E dirigidos pasaron entre corrida y repetición: cara entre distintas teselas con perfil modificado, fondo fijo/vinculado con tinta real, indicador superpuesto accionable, y Pluma/Escape desde un input sin cambio de coordenadas. Se corrigió una expectativa de QA: cambiar el vigente sin selección no altera retroactivamente el trazo iniciado; se comprobó que el siguiente sí utiliza el grosor nuevo.
- Pendiente: auditar precisión física acumulada (contorno/afinidades/templates), validación externa SVG/DXF/raster, builds estáticos raíz/subdirectorio y regresión final.

## PRD v2.2 · Precisión física y exportación independiente

- Contorno usa tangentes/normales Bézier exactas por lado de cada unión y refinamiento adaptativo de los bordes, no sólo del eje. Tapas cuadradas/rectas en extremos curvos, puntos cuadrados orientados por la tangente y líneas degeneradas conservan su semántica. Variación de ancho discontinua en la costura de un path cerrado se trata con tapas de extremo.
- Presupuesto de tolerancia en coordenadas físicas: cota singular afín (overflow-safe), tolerancia de templates compartidos ajustada por placements externos, cuantización Clipper adaptativa y presupuestos separados para refinamiento/arcos. Precisión imposible rechazada explícitamente (no clamps que fingen tolerancia). Rango validado antes de flatten; cachés acotadas también por tamaño.
- Los dashes de longitud cero se expanden a contornos SVG: Chrome/CairoSVG difieren sobre su extremo terminal nativo. Intervalos conservan el punto inicial y excluyen nuevos segmentos que comienzan exactamente al final del eje, con epsilon numérico controlado.
- **200 unitarias y build correctos**. Pruebas contra normales densas de la curva original verifican contorno con afinidad anisótropa, expansión ×1000 y template ×10 dentro de tolerancia física. Tapas exactas y casos de rechazo tienen pruebas geométricas.
- Se agregaron scripts reproducibles para6 escenarios de export v2.2: guiones/perfiles/alfa/puntos, template escalado, cara planar con agujero nonzero, composición/órbita restringida, hexágono curvo relleno con motivo y aplicación congelada tras vaciar la fuente viva.
- CairoSVG/Pillow/ezdxf aprobaron los6. Se comprueba cada punto/espacio del punteado, colores, huecos, DPI, crop, unidades mm, contornos 2D y ausencia de overlays/fallbacks. Comparación SVG editable vs expandido: MAE máxima0,067/255; comparación Chrome vs CairoSVG: máxima0,887/255. Reporte .runtime/exports/v22/validation-report.json. Smoke E2E de estilo/perfil/límites pasó antes del último ajuste geométrico; regresión final aún pendiente.

## Privacidad de direcciones LAN

- Por pedido del usuario, documentación pública con `<IP_LOCAL>` en lugar de direcciones concretas. Las IP se consultan sólo en la máquina local; los servicios siguen en los puertos 4173 y 4174.
- Se limpiaron los dos valores encontrados en todo el historial publicado de main mediante un clon aislado y push con force-with-lease. Verificados 403 blobs históricos de texto sin direcciones privadas; árbol HEAD idéntico antes/después de reescribir. Main local sincronizado con GitHub sin tocar el índice ni los cambios de aplicación en curso. prd_v2.3.txt permanece sin incluir en este incremento de privacidad.

## Feedback continuo desde el monitor LAN

- El feedback nuevo se envía a esta misma conversación mediante codex queue --resume, tanto durante trabajo activo como esperando reset o con PROJECT_COMPLETE presente. La entrega tiene un hilo independiente del control de cupo; el POST HTTP lo despierta inmediatamente.
- IDs persistentes, registro de encolados/revisados y exclusión mutua evitan reenvíos normales tras polling/reinicio. Los errores se reintentan después de30s; un warning de resume no repite un mensaje que el CLI ya aceptó. No se confunde «en conversación» con «leído». Un corte del proceso justo entre aceptación externa y escritura local puede requerir revisar eventos.
- Dashboard distingue entrega pendiente, en conversación y revisado. Los dos feedback históricos ya leídos se marcaron revisados sin reenviarlos.
- **9 pruebas Python correctas**: cuotas reales, ventana semanal, warning de resume, entrega en trabajo/espera/completado, reintentos persistentes, concurrencia y POST HTTP real con cola simulada. Monitor reiniciado una sola vez; HTTP4174 correcto y app 4173 conserva su PID anterior.

## Fill directo y alcance real de la tinta

- Atendido feedback: clic o primer toque aplica relleno persistente; se eliminó «Confirmar relleno». La cola captura punto/estilo, tolera hover pendiente y cambios de tamaño por autocierre del panel, y descarta operaciones si cambian los límites. Cancelación y deshacer siguen disponibles; repetir el mismo color no agrega pasos vacíos en el historial.
- Se corrigió el orden de autocierre: calcular coordenadas del clic antes de permitir el cambio de ancho del lienzo. Dieciséis E2E de Fill correctos, verificando tinta real, modelo guardado, primer toque, clics rápidos, retirada del puntero, huecos, órbitas, recálculo, teselas curvas y undo/redo.
- Culling y selección consideran perfil/ancho/afinidades: se puede seleccionar el cuerpo ancho fuera del eje sin seleccionar fuera de una punta fina. Epsilon inclusivo conserva límites exactamente sobre el viewport. Tres pruebas geométricas nuevas; total **203 unitarias correctas** y TypeScript estricto correcto.
- Build de producción correcto para raíz y base /pattern/. **6 pruebas estáticas correctas**, tres por ruta, bloqueando orígenes externos; incluyen Fill de un clic, perfiles/preset y descargas JSON/SVG mediante worker.
- Validación independiente completa nuevamente: archivos v1/v2.1 y 6 escenarios v2.2 aprobados por CairoSVG/Pillow/ezdxf. Informe .runtime/exports/v22/validation-report.json.
- Benchmark Fill real en worker:25 caras en rejillas rectas y curvas, construcción59,0/76,6 ms y consultas p95=0,2 ms, un solo build por 60 consultas; límite de1.200 entradas informado en100,1 ms. rAF máximo16,8 ms en estas escenas. Desplazamiento con 100 fuentes y overlay apagado/encendido:medianas33,36/33,44 ms; incluye protocolo y un frame, no equivale a FPS.
- La regresión completa de75 flujos de navegador está en curso en .runtime/v22-full-regression.log; el cierre global del PRD sigue pendiente de su resultado y de finalizar la matriz de aceptación/documentación.

## Cierre auditado · PRD v2.2

- **203 unitarias, 75/75 E2E en una corrida de 6,7 min, 9 pruebas del monitor y6 estáticas correctas**. Se conservan íntegramente los 50 flujos v1/v2/v2.1. Builds raíz y /pattern/ correctos; CairoSVG/Pillow/ezdxf aprueban las regresiones y los seis escenarios v2.2.
- Matriz de los 22 criterios obligatorios completada en docs/ACCEPTANCE.md. Arquitectura, geometría, formato de proyecto y pruebas actualizados a estilos/perfiles/Fill/esquema 4. No quedan criterios v2.2 pendientes conocidos.
- README: explicaciones y ejemplos primero, tres capturas inspeccionadas con proyectos JSON descargables; instalación/despliegue/seguimiento al final. scripts/capture-readme.mjs reproduce imágenes y valida el round-trip de los JSON desde un navegador aislado.
- Privacidad: documentación y todo el historial publicado de main con placeholders de IP. Se vuelve a comprobar el historial público tras el push de cierre. Servicios app 4173 y monitor 4174 mantenidos; el feedback permanece vigilado incluso con PROJECT_COMPLETE.
- prd_v2.3.txt aportado en el árbol de trabajo se conserva sin incorporar a este alcance. No se implementó ni se declara completado.


## PRD v2.3 · Auditoría y primera navegación contextual

- Nueva autorización explícita de Pablo: continuar prd_v2.3.txt con monitor.
  Retirado PROJECT_COMPLETE; servicios LAN existentes conservados.
- Inventario inicial en docs/UX_V23_INVENTORY.md: funciones de archivo,
  dibujo/edición, simetrías, generadores, teselas, composición/capas,
  aplicación, vista, estilos/Fill y exportación, con ubicación y pendientes.
- Siete categorías con etiquetas visibles; rail de herramientas compacto;
  paneles dejan de apilar todas las categorías. Tabs por categoría en sesión
  y plegado sin desmontar; navegación sin cambios geométricos ni undo.
- Formas identifica Polígono paramétrico con acción, preview y edición de
  parámetros; comparte handler con el acceso del rail y toma estilo vigente.
- Cinco E2E nuevos aprobados en 1366×768,1440×900,1920×1080 y 390×844. Prueban
  documento intacto al navegar, accesos visibles, pestañas/plegado y polígono.
- Regresión de tinta detectó cierre prematuro en capture del panel derecho:
  se elimina para capturar primero el punto en todos los trazos. Repetición
  de tinta/guiones y Fill rápido:2/2 correctos. 203 unitarias/TypeScript y
  build correctos; verificación final del incremento registrada en continuidad.
- Captura real .runtime/v23-shapes-1366.png inspeccionada sin desbordamiento
  horizontal. PRD sigue pendiente: galería ampliada, propiedades/estilos por
  tabs, controles compactos, comandos, auditoría completa y regresiones.

- Cierre de ventana:90% usado real; monitor programó reanudación después del
  reset06:47:54 UTC +60s. Verificación final posterior al ajuste de Canvas:
  203 unitarias/TypeScript, build y5 E2E nuevos correctos. Se cierra el
  incremento y se conservan los servicios para revisión LAN.

## PRD v2.3 · Catálogo ampliado de simetrías

- Reset real observado:0% usado en ventana nueva. Servicios LAN conservados.
- Selector compacto con grupo activo, recientes de sesión y favoritos locales;
  catálogo nativo modal con miniaturas dinámicas, familias, estrellas y paginación
  adaptable para pantalla estrecha. Todas las27 opciones disponibles sin scroll
  de galerías anidadas. Hover no confirma; clic usa changeSymmetryChoice y undo.
- Modal con fondo inerte, foco acotado, Escape y retorno al botón de apertura.
- 203 unitarias/TypeScript y2 E2E dirigidos correctos (1366×768 y 390×844):
  recorren27 opciones, hover sin modificar proyecto, radial/sectores, favoritos,
  cierre/restauración de foco y undo. Logs .runtime/v23-gallery-*.log.

## PRD v2.3 · Propiedades, estilos compactos y comandos

- Geometría extraída a ObjectProperties en el panel derecho: Forma, Transformar,
  Nodos y Acciones conservan edición, Bézier, booleanas, grupos y transformaciones.
  Polígono muestra lados/tamaño/rotación/tipo de relleno/trazo/preview sin scroll.
- Apariencia por tabs Colores/Trazo/Perfil/Fill/Paleta/Presets/Objeto/Opciones.
  Puntos de perfil y paletas extensas tienen selección/paginación explícita.
  Lápiz abre trazo; Fill abre sus opciones; nodos y selección muestran propiedades.
- Buscador Ctrl+K con nombres/acentos, flechas, Enter/Escape, conectado a handlers
  existentes (herramientas, categorías, grupos, polígono, grosor, SVG y archivo).
- 203 unitarias/TypeScript, build y12 E2E nuevos correctos. Cuatro resoluciones
  verifican los controles principales de todas las tabs derechas sin scroll,
  documento intacto al navegar y edición real. Log v23-properties-*.log.
- Pendiente aún: compactar teselas/generador/aplicación, exportación accesible,
  adaptar y ejecutar todas las regresiones anteriores y cerrar la auditoría.

## PRD v2.3 · Contextos compactos y diálogos accesibles

- Teselas separa Forma/Colocación/Bordes/Tangentes; generadores muestran hasta
  cuatro parámetros relevantes por página e instancias seleccionables.
  Aplicación separa Perímetro/Transformar/Vínculo. La lista de conjuntos pasa
  al único contenedor de Capas. Simetrías separa red de colocación del motivo.
- Exportación separa Contenido/Tamaño/Precisión y usa diálogo modal nativo;
  importación, biblioteca y ayuda también conservan foco y fondo inerte.
  Archivo cierra al actuar fuera/Escape; el panel izquierdo tiene cierre y Escape.
- 203 unitarias/TypeScript,21 E2E de propiedades/estilos/regresiones dirigidas y
  cuatro recorridos adicionales sin scroll correctos (1366×768,1440×900,
  1920×1080,390×844). Incluyen todas las tabs de teselas, p1, generador warp,
  preferencias, aplicación y exportación/foco. Logs v23-contexts-*.log y
  v23-properties-regressions.log.
- Recorridos previos se adaptan a categorías, tabs y catálogo usando helpers
  de interacción real. Se conservan aserciones de modelo/tinta/persistencia.
  Pendiente ejecutar y corregir la regresión completa sobre estos recorridos.

## PRD v2.3 · Auditoría de regresiones y cobertura secundaria

- Primera corrida completa:85 correctos,6 fallos. Cuatro eran una aserción
  del título que ahora incluye un botón de cierre; uno necesitaba abrir el
  catálogo en el recorrido de26 grupos. El restante detectó una regresión
  real: Lápiz forzaba destino vigente. Se conserva ahora el destino elegido,
  como en v2.2;6 repeticiones dirigidas aprobadas.
- Resize pliega el izquierdo si el derecho ocupa overlay estrecho; no quedan
  dos paneles superpuestos tras reducir la ventana. Centro radial tiene
  nombre explícito. Formas identifica la herramienta libre/paramétrica.
- Tres E2E nuevos correctos: geometría/nodos/reflexión/grupos/booleana+undo,
  CRUD completo de presets/paleta y resize/Escape con selección conservada.
  Scripts de benchmark adaptados a las categorías sin cambiar las métricas.
- 9 pruebas del monitor correctas; no se enviaron feedback de prueba. Pendiente
  corrida completa final de94 E2E y producción estática sobre el resultado.

## PRD v2.3 · Verificación visual final

- Corrida completa de94 E2E aprobada (4,2min), con los 75 recorridos previos.
- Inspección de las cinco capturas reales detectó padding excesivo que cortaba
  texto en selects compactos. Se conserva su altura y se corrige la línea útil.
- Corregir trazo abre directamente Trazo y respeta la intención explícita al
  seleccionar el objeto. Fill muestra un acceso con el color a Colores.
  Los modales restituyen foco también si el disparador era el SVG del lienzo.
- 9 E2E dirigidos posteriores correctos, incluidos textos completos y ausencia
  de scroll en las cuatro resoluciones. Se prepara build raíz/subdirectorio,
  verificación estática y una corrida completa sobre el último ajuste visual.

## Cierre auditado · PRD v2.3

- **203 unitarias/TypeScript,94/94 E2E en corrida final de 4,2 min,9 pruebas del
  monitor y6 estáticas correctas**. Conservados los 75 recorridos anteriores.
  Builds raíz y `/pattern/` correctos; validación CairoSVG/Pillow/ezdxf de
  regresiones previas y los seis escenarios v2.2 correcta.
- Matriz final en ACCEPTANCE_V23.md e inventario A01–E06 con ruta de todas las
  funciones. Categorías y tabs, propiedades derechas, catálogo completo,
  comandos y contextos compactos comprobados en las cuatro resoluciones.
- Se corrigieron recorridos de QA estático (exportar contornos sin salir del
  modal; probes después del ajuste de cámara). Servidor temporal reiniciado
  desacoplado al detectar su cierre de sesión; ambas rutas repetidas3/3.
- README actualizado: explicaciones/navegación/ejemplos primero, cinco capturas
  reales inspeccionadas y cuatro JSON validados; instalación/trabajo al final.
  Arquitectura, formato4 y pruebas documentados. Benchmarks adaptados y ejecutados.
- No se cambian motor, matemáticas, schemaVersion 4, dependencias ni icono.png.
  Sin criterios pendientes conocidos del PRD; se conservan los servicios LAN
  y la vigilancia independiente de feedback. Se registra cierre verificado.

## PRD v2.3 · Cabecera estrecha comprobada visualmente

- La inspección a 390px detectó Archivo/Exportar fuera del ancho visible aunque
  el documento no tenía overflow. La cabecera se distribuye en dos filas con
  logo/acciones arriba y modos debajo; Archivo conserva una etiqueta visible.
- El E2E de navegación ahora comprueba los bounds completos de Archivo,
  Buscar comandos y Exportar en las cuatro resoluciones. Se inspeccionaron
  capturas reales1366×768,1440×900,1920×1080 y 390×844, además de las del README.
- Se repiten compilación, estático y regresión con este último ajuste; las
  afirmaciones de cierre quedan sujetas a esos resultados finales.

### Cierre posterior a la auditoría móvil

- 94/94 E2E correctos en 4,3 min sobre el ajuste final, exit_code 0 registrado
  por el runner independiente.203 unitarias/TypeScript y ambos builds correctos;
  repetición estática3/3 raíz y3/3 subdirectorio con Internet bloqueado.
- Inspección visual de las cuatro resoluciones y bounds de todas las acciones
  principales de cabecera. Nombre del documento accesible en Preferencias
  también en móvil; ninguna función del inventario queda sin ruta.
- Se cierra v2.3 sin criterios pendientes conocidos. README con cinco imágenes
  y cuatro JSON, instrucciones de uso primero e instalación/trabajo al final.
  Servidor temporal de QA detenido; app 4173 y monitor 4174 se conservan vivos.

## Hosting FTP automático · Workflow preparado

- Por pedido de Pablo, publicación de dist/ mediante GitHub Actions con cada
  push y ejecución manual opcional. Cuatro Repository secrets existentes
  comprobados por nombre; sus valores no se extraen ni se guardan localmente.
- FTP_FOLDER se interpreta como subcarpeta de public_html y se normaliza con
  barra final. Se admiten nombre solo o prefijo public_html sin duplicarlo;
  no se aceptan destino vacío/raíz, traversal ni saltos de línea en el output.
- Node 24, npm ci, tres pruebas de despliegue, TypeScript +203 unitarias y build
  antes de subir. Actions fijadas por SHA; permisos de lectura y transferencias
  serializadas, sin limpieza total de la carpeta. README al final documenta
  configuración y uso. App 4173 y monitor 4174 conservados.
- Verificación local:3 tests de despliegue, 203 unitarias/TypeScript, build y
  actionlint 1.7.12 correctos. Pendiente publicar el commit y observar la primera
  ejecución real de FTP en GitHub.

## Hosting FTP · Primera publicación real correcta

- Commit df4e712 publicado en main; el push disparó Deploy FTP automáticamente.
- Ejecución 44744523772 completada con success: checkout/Node 24, npm ci,
 3 pruebas de despliegue, 203 unitarias/TypeScript, build, validación del
 destino y transferencia FTP correctos. Sin pasos manuales ni secretos locales.
- Evidencia: https://github.com/pablopeu/pattern/actions/runs/44744523772.
- README documenta cada push, cuatro secrets, destino public_html/subcarpeta/,
 barra final automática y revisión en Actions. El push documental de cierre
 dispara una segunda sincronización que se comprueba antes de finalizar.

## Footer de autor e iconos · Vista previa LAN, sin publicación

- Por pedido de Pablo, footer basado en el contenido de FutureForge local:
  Patterns — Hecho con pasión por un cuchillero. ¿Te gustan los cuchillos?
  Seguime en:, con seis enlaces originales del autor. Una línea, verdes y
  tipografía del editor; teclado protegido de atajos del lienzo. En móvil,
  desplazamiento horizontal sólo del footer para conservar legibilidad.
- La nueva altura requería compactar espacios de Generador en pantallas bajas;
  se preservan tamaños de campos y se recupera ausencia de scroll en 1366×768.
- favicon_io.zip aplicado: ICO/PNG16/32, Apple180 y Android192/512; manifest con
  nombre/colores de la app y rutas relativas. Archivo ZIP original intacto y
  sin seguimiento; icono.png y el motor no se alteran.
- 203 unitarias/TypeScript, build y 13 E2E de disposición correctos. Inspección
  de las cuatro resoluciones; seis enlaces con apertura segura y Enter operativo.
  Assets/manifest verificados por HTTP en raíz y /pattern/, PNG decodificados
  y scope/start_url correctos. Captura .runtime/footer-preview.png.
- Todo queda en Git local para revisar en LAN. **NO PUSH** hasta aprobación
  explícita: cada push activaría el despliegue FTP. Servicios 4173/4174 conservados.


## Metadatos y carátula · Entrega local para revisión

- Por pedido de Pablo, caratula.jpg copiada sin modificaciones a public/:
  JPEG1176×775 y ~141KiB. Se conserva el archivo fuente original sin seguimiento.
- Descripción, autor, robots/canonical; Open Graph website/es_AR con título,
  descripción, URL, imagen absoluta/tipo/dimensiones/alt; X/Twitter con tarjeta
  summary_large_image, @peu_ar y textos coherentes. Todo en HTML estático.
- URL https://peu.net/pattern/ comprobada por HTTP contra Pattern Studio
  actualmente publicado. La carátula nueva se publicará al aprobar el push.
- Build correcto y probe real Chromium sin JS en raíz y /pattern/: tags únicos,
  coherencia título/descripción, imagen HTTP200 decodificada y dimensiones reales.
  cmp confirma bytes idénticos. Evidencia .runtime/social-meta-{build,qa}.log.
- Footer/iconos preservados en commit local 84d7415; esta entrega continúa
  exclusivamente local. GitHub conserva 4bd8938; **sin push ni despliegue**.
  Servicios LAN 4173/4174 activos, sin duplicados; pendiente revisión de Pablo.


## Fill persistente en Penrose y accesos del panel derecho · Corrección LAN

- Repro real previo: Fill en Penrose se guardaba pero quedaba oculto debajo de
  las caras opacas del generador. sceneLayers dibuja fondos, rellenos y contornos
  en ese orden, sin alterar fuentes ni schemaVersion 4. Fuente pura usa el mismo
  orden. Tinta y perímetros comprobados también en SVG editable/expandido.
- Activar Fill es una acción explícita: un segundo clic, F o búsqueda vuelven a
  abrir controles aunque Fill ya esté activo. En móvil conserva un solo panel.
- Barra derecha persistente con ocho accesos y toggle inferior: abrir sección,
  plegar/desplegar recordando tab, Objeto habilitado con selección. Iconos Lucide,
  nombres accesibles y estado activo. Espacio móvil reservado evita tapar el
  cierre del panel contextual izquierdo.
- 203 unitarias/TypeScript correctos. Primera corrida integrada:96/99; ajuste
  móvil del rail y de la interacción de prueba con panel superpuesto, muestreo
  raster 4× junto a borde curvo con idénticos puntos/umbrales. Revisión posterior:
  7/7 casos relacionados correctos, incluidos los tres fallos iniciales.
- Regresión nueva confirma presión/soltado/salida, undo/redo, Fuente pura,
  recuperación y píxeles reales en ambas representaciones SVG de Penrose.
  Otras cuatro cubren Fill repetido, teclado y accesos en 1440/390.
- README actualizado; capturas en .runtime/fill-penrose-fixed.png y
  right-rail-{1440,390}.png. Se mantiene la revisión LAN, sin push.


## Fill con muchas curvas y actualización de iconos · Verificación en curso

- Nuevo favicon_io.zip aplicado byte a byte en sus seis destinos; revisión
  f6108aa8c880 en favicon/Apple/manifest/Android evita reutilizar caché anterior.
  Nombres, scope/start_url relativos y colores del manifest preservados;
  icono.png y caratula.jpg intactos.
- Revisión integrada anterior:98/99, pendiente móvil corregido al limitar ancho
  del overlay derecho para dejar accesibles categorías izquierdas. Cuatro casos
  UI/Penrose pasan después, con ajuste de encuadre de Penrose finito.
- Por nuevo feedback de Pablo, Fill conserva los presupuestos de seguridad pero
  analiza una región completa alrededor del clic cuando la vista global es densa.
  Un objeto cerrado puede recolorearse sin construir el grafo planar. Para varios
  trazos, un contorno fuente sólo propone la ventana: se valida con TODAS las
  curvas/capas/instancias que la cruzan, preservando agujeros e índices originales.
- Los rellenos vinculados se refrescan con el mismo recorte de análisis al exceder
  presupuesto global. Fuente canónica, Béziers y schemaVersion 4 conservados.
- 204 unitarias/TypeScript y 2/2 E2E nuevos correctos: área de cuatro trazos densos
  repetidos y objeto cerrado de1501 curvas. Se verifica otra celda, fuentes intactas,
  perímetro, tinta raster real, persistencia, agujero y vínculo en unidad geométrica.
  Evidencias fill-local-{check,e2e,build}.log; corrida integrada final en curso.


## Recálculo manual de Fill denso · Verificado

- Recalcular y vincular región también usa el análisis local si el presupuesto
  global se excede. Conserva ID, familia de límites, agujeros y comprobación de
  solapamiento; no acepta una cara por cercanía al punto solamente.
- 204 unitarias/TypeScript correctos. La unidad de geometría densa comprueba
  recálculo con hueco y área exacta; los dos E2E de densidad vuelven a pasar,
  incluyendo el botón real y persistencia. Build final correcto.
- Corrida integrada previa a este ajuste puntual:101/101, incluida navegación
  móvil corregida. Se verificó el ajuste después con unidad y E2E dirigido.
  Logs fill-local-final-{check,build}.log y fill-local-recalculate-e2e.log.
