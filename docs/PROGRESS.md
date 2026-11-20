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
- Verificación de cierre del incremento Fill: **60 E2E distintos correctos** (57 general +3 restantes dirigidos), **175 unitarias** y build correctos. Se preservaron los50 anteriores junto a10 nuevos de v2.2. Se registra checkpoint; PRD v2.2 continúa pendiente de los puntos de auditoría indicados en CONTINUITY.

## Feedback LAN · Panel de apariencia exclusivamente derecho

- Atendido feedback recibido 20/11 01:29 UTC: colores/trazos no deben repetirse al pie del inspector izquierdo. Se retiraron de allí todos los controles de estilo; queda un acceso explícito que abre el panel vertical derecho con la selección como destino.
- Se conservan el estilo vigente, pin, autocierre al interactuar con lienzo y escala documental. El indicador compacto mantiene muestras/unidad/patrón visibles también por debajo de900px.
- **175 unitarias correctas**, dos E2E dirigidos correctos: flujo de feedback con ubicación real a la derecha/autocierre/768px, y regresión de lápiz/estilo al recorrer grupos (adaptada para usar panel derecho). Capturas v22-right-only-1440.png y v22-right-only-closed-768.png.
- El usuario autorizó explícitamente continuar durante los últimos minutos de la ventana previa al reset. Se respeta esa indicación y no se duplica el monitor.
