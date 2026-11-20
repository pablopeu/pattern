# Celda fija en split y Patrón → Una celda · Verificado

La cámara de una celda periódica mantiene su centro. Bloqueados Espacio+arrastre,
botón central, herramienta Desplazar y rueda sin modificadores. Zoom con botones/
Ctrl+rueda y Restablecer vista conservan el centro, también en Patrón → Una celda.
El patrón repetido mantiene pan; escenas sin celda periódica/Fuente pura conservan
navegación libre. Cámara de sesión: sin cambios de fuente, esquema ni geometría.
206 unitarias/TypeScript, build,4 E2E dirigidas,111/111 integradas (203.8s,
exit0) y6 estáticas correctos. Evidencia .runtime/cell-fixed-{check,build,targeted,
full}* y cell-fixed-static-summary.log. README actualizado. Servicios4173/4174
conservados; commit/push autorizado sin consultar Actions/FTP.

**Nuevo pedido pendiente:** Pablo solicita buscar referencias de Escher y patrones
interesantes en la web, recrearlos como ejemplos editables de mayor calidad.
Al terminar el incremento de cámara, comprobar cupo antes de iniciar ejemplos.
No registrar PROJECT_COMPLETE mientras este pedido esté pendiente.

---

# Celda: recorte de selección y nodos · Verificado

Pablo reprodujo un garabato iniciado fuera de la celda que reaparecía suelto en
la referencia. La repetición ya se recortaba; faltaba recortar el contorno de
selección. Selección/nodos/tangentes y preview de Fill ahora comparten el clip de
la celda en coordenadas mundiales, antes de transformar la instancia seleccionada.
Aplica a split/Una celda y conserva fuente completa, simetría y exportaciones.
Fuente pura y escenas sin celda periódica conservan su edición completa.

Prueba real reproduce el fallo antes del arreglo (234 píxeles de selección fuera
del borde superior) y pasa después sin tinta afuera. Comprueba dibujo libre,
nodos, Una celda, geometría idéntica y undo/redo. 206 unidades/TypeScript, build,
2 E2E dirigidas,109/109 E2E integradas (197.4s, exit0) y6 estáticas
raíz/subcarpeta correctos. Logs .runtime/cell-clip-{check,build,targeted,full}*,
cell-clip-full-result.json y cell-clip-static-summary.log. README incluye captura
real docs/images/cell-reference-freehand.png, inspeccionada. Sin pendientes de
este pedido. Servicios4173/4174 activos; commit/push autorizados sin revisar FTP.

---

# Footer: textos destacados a13px · Verificado

Patterns, «¿Te gustan los cuchillos?» y PEU.NET pasan de12 a13px. Resto del pie,
incluido Seguime en:, conserva12px/peso500; destacados conservan negrita700.
Build/TypeScript y vista real1440/390 correctos: altura38px, seis enlaces,
una línea y sin overflow de página. Evidencia .runtime/footer-size-{build.log,qa.json}
y capturas footer-size-*.png; README/captura actualizados. Sólo CSS; no se repiten
suites geométricas. Servicios4173/4174 activos. Push autorizado sin revisar FTP.

---

# Footer negro y negritas selectivas · Verificado

Pedido de Pablo y aclaración incorporada: Patterns, «¿Te gustan los cuchillos?»
y PEU.NET en peso700. «Seguime en:» y descripción en peso500. Texto/enlaces
negro puro, tamaño12px; iconos con trazo2. Contraste real19,79:1 sobre el fondo
claro. Conserva una línea/38px y scroll horizontal propio en móvil.
Build/TypeScript correctos; estilos y revisión visual real1440/390, seis enlaces,
negritas exactas y ausencia de overflow de página comprobados. Capturas incluyen
el footer móvil desplazado hasta PEU.NET. Evidencia .runtime/footer-bold-qa.json,
footer-bold-build.log y footer-bold-*.png. README y captura de inicio actualizados.
Ajuste de presentación: no se repiten suites geométricas. Servicios4173/4174 vivos.
Push autorizado sin inspeccionar Actions/FTP; cierre en .runtime/LAST_PUSH.json.

---

# Footer con mayor contraste · Verificado

Pedido de Pablo: texto del pie más oscuro. Se usa --ink (#24382b) sobre
--panel (#f7f9f2), con peso500; contraste real11,81:1. Conserva38px de alto,
una línea, seis enlaces y desplazamiento propio en móvil.
Build/TypeScript correctos; revisión real en1440/390 sin overflow de página,
con estilos computados y capturas inspeccionadas. Evidencia
.runtime/footer-contrast-build.log, footer-contrast-qa.json y capturas
footer-contrast-{1440,390}.png. README/captura de inicio actualizados.
Cambio sólo CSS; no se repiten suites geométricas por este ajuste visual.
Servicios4173/4174 conservados. Push autorizado; no consultar Actions/FTP.
Registro de publicación en .runtime/LAST_PUSH.json al finalizar.

---

# Cámara, guardado y cabecera · Entrega verificada

Pedidos sucesivos de Pablo incorporados al mismo incremento. Cabecera Patterns,
subtítulo «Patrones Geométricos», tamaños mayores y sin separador junto al logo.
Nombre movido a Archivo. Guardar pide nombre; blanco/sin título propone
Estudio-AA-MM-DD-HH-MM en hora local, sin extensión en el campo. Cancelar no
modifica el documento; descarga conserva schema4 y fuentes.

Trazo usa PenLine y slider0–2mm; entrada numérica conserva hasta50mm para proyectos
anteriores. Zoom100 equivale al200 anterior (7,559055118px/mm), sin alterar medidas
ni exportación. Vista dividida: celda activa editable a izquierda, centrada/ajustada
al entrar y al cambiar configuración; repetición de conjuntos visibles a derecha.
Zoom compartido en botones/rueda/ajustar/restablecer, escala conservada al resize.
Una celda sale de split; Fuente pura en Preferencias → Vista avanzada conserva
edición de originales completos/Penrose. Sin celda periódica se muestra motivo
completo; no se inventa una celda para Penrose.

206 unitarias/TypeScript, build y4 E2E dirigidas correctos (arranque1440/390,
centro/zoom/rueda/resize/rango y guardar/cancelar/nombre/descarga/recuperación).
108/108 E2E integradas correctas en 190.5s, exit0:
.runtime/cell-header-full.log y cell-header-full-result.json. Seis estáticas del
build final correctas, raíz y /pattern/, sin Internet; resumen
cell-header-static-summary.log. Pruebas heredadas adaptadas a nombre en Archivo
y rango0–2mm conservan aserciones de persistencia, biblioteca y undo por gesto.
Probe real de dibujo desde la celda: una fuente canónica, repetición visible y
undo compartido; captura split-draw.png. Capturas nuevas reales en README,
inspeccionadas junto a cabecera en1440/1024/768/390. Sin pendientes conocidos.
Servicios4173/4174 activos, sin duplicados. Al publicar el cierre se registra
.runtime/LAST_PUSH.json y PROJECT_COMPLETE; feedback independiente sigue activo.

**Preferencia vigente: push autorizado a main al finalizar; no comprobar Actions
ni FTP después del push. Pablo recibe errores de GitHub por email.** Esto reemplaza
las instrucciones históricas de comprobar workflow que siguen más abajo.

---

# Incremento P3 y grilla negra · Verificado, push autorizado

Nuevo pedido de Pablo, también enviado por monitor con id
c1a1f5d808be4cb194ced69217f9048b (duplicado atendido una sola vez).
P3 primero y Libre último; restantes simetrías conservan orden. Estudio nuevo
por newStudy (UI) usa P3/estructura visible50%; motor newProject sigue neutro
para importaciones/fixtures. Recuperación mantiene configuración existente.
Dibujo libre al iniciar; activarlo explícitamente abre Trazo, sin desplegar el
panel al cargar. Cámara100% centrada en origen al crear estudio/Restablecer vista;
conserva captura y escala al dibujar y al cambiar ancho. Panel izquierdo inicial
plegado en móvil; controles flotantes envuelven filas para mantener acceso.

Aclaración de Pablo: se refería a Grilla, el cuadrado antes del ojo. Mostrar/
ocultar puntos cada5mm, independiente de Snap. Se conserva con título claro y
estado accesible. Puntos negro puro/radio0,25mm, completos dentro de la celda
SVG: el punto anterior en esquina quedaba recortado. Celda desplazada−2,5mm y
centro2,5mm conservan posiciones globales múltiplos de5mm y alineación con Snap.
Prueba raster real a100% confirma tinta visible en1440/390.

206 unitarias/TypeScript, build y5 E2E dirigidas correctos. Pruebas de estudio
nuevo en1440/390 confirman P3, herramienta, opacidad, escala física, centro,
Nuevo tras zoom y recuperación. Regresiones Libre usan fixture neutro explícito;
no se rebajan assertions de geometría. Selección de objetos/origen en fixtures
antiguos se activa explícitamente porque ahora el arranque es dibujo libre.
Cierre:206 unitarias/TypeScript, build,106/106 E2E integradas y6 estáticas
raíz/subcarpeta correctas. Corrida integrada completa con exit code0,198,5s:
.runtime/p3-full-final.log y p3-full-final-result.json. Logs finales
p3-final-{check,build,static-summary}.log; casos dirigidos p3-grid-final-targeted.
Captura docs/images/new-study-p3.png real, escritorio y móvil inspeccionados.
Publicado e2ca8bef6181be4339cc4d15c92169efa20384fd en main. Deploy FTP44796746721
terminó con success (206 unitarias/TypeScript,3 tests de despliegue,build y FTP).
https://github.com/pablopeu/pattern/actions/runs/44796746721
Hosting https://peu.net/pattern/ sirve el mismo bundle que dist/ verificado;
evidencia .runtime/p3-published.html. No quedan criterios pendientes conocidos.
El registro documental de cierre se publica también; comprobar su workflow y
conservar resultado externo final en .runtime/LAST_DEPLOY.json.
Servicios4173/4174 conservados. Publicar en GH al finalizar, por pedido explícito.

---

# Cierre de incremento · Archivo/Exportar y publicación autorizada

Pablo autorizó explícitamente «al terminar push a gh»: publicar todos los commits
locales pendientes en main y comprobar el workflow FTP. Se levanta la espera de
aprobación que figura en entregas históricas de abajo. Servicios4173/4174 activos.

Archivo cierra el panel derecho antes de su apertura nativa (mouse/teclado).
Enter/Espacio del summary no llegan a atajos del lienzo. Exportar usa una única
acción de cierre/apertura, tanto en botón como en Ctrl+K. También respeta cierre
explícito si el panel estaba fijado. No se reabre automáticamente al salir.

204 unitarias/TypeScript, build y4 E2E dirigidas correctos:1440/768/390, panel
fijado, clic/Enter, menú Archivo accionable sin intercepción, Exportar/Escape,
proyecto y selección conservados. Logs menu-panel-{check,build,e2e}.log.
Cupo91% usado al cierre: terminar documentación/commit/push autorizado y verificar
FTP; no iniciar otro incremento.

Publicado main8614d951533696df410bae569f3b63f242e87688, incluidos los ocho commits
pendientes. Deploy FTP44773564280 completó con success (push): instalación,
3 pruebas de despliegue,204 unitarias/TypeScript, build y transferencia correctos.
https://github.com/pablopeu/pattern/actions/runs/44773564280
HTML público https://peu.net/pattern/ sirve el mismo bundle que el build local,
carátula OG e iconos revisión f6108aa8c880. Evidencia .runtime/published-final.html.
El commit documental de cierre también se publica y su ejecución FTP se comprueba
antes de finalizar; resultado final se conserva en .runtime/LAST_DEPLOY.json.
Servicios LAN siguen activos. Incremento terminado, sin otros trabajos pendientes.

---

# Revisión LAN · Fill y color sin saltos entre pestañas

**Sin push hasta aprobación de Pablo; cada push despliega por FTP.**
Incremento actual por feedback: Fill incluye selector HEX/color y opacidad;
Trazo incluye su color. Se quita Colores de tabs/accesos superiores y se mantiene
un acceso de dos muestras al pie de la barra derecha para editar ambos juntos.
Encabezado contextual (Rellenar región/Trazo/etc.) y Aplicar a sustituyen lenguaje
genérico de estilos. Regla de relleno sólo en Opciones avanzadas, con explicación.

El antiguo banner de estadísticas queda oculto; sólo se muestran progreso y
cancelación si una operación tarda al menos700ms. Otra región aparece únicamente
si existen varias candidatas. Diagnóstico/data-fill-applied conservado oculto
para automatización, sin tapar el dibujo. Query también informa busy para poder
cancelar una búsqueda local lenta. No cambia geometría, persistencia ni reglas.

204 unitarias/TypeScript, build y8 E2E dirigidas correctos en cuatro tamaños.
101/101 E2E integradas y6 estáticas (raíz/subcarpeta) correctas. Evidencia
fill-flow-{check,build,layout,full-e2e,static-summary,preview}.log.
Playwright dejó status=passed y failedTests=[] (fill-flow-last-run.json);
el wrapper npx terminó con143 tras emitir el reporte completo, sin tests fallidos.
Probes de producción también verifican imagen real y assets. QA temporal cerrada.
Captura docs/images/penrose-fill.png actualizada desde producción local real.
Servicios4173/4174 conservados; originales caratula.jpg/favicon_io.zip intactos.

---

# Entrega local para revisión · Fill, panel derecho e iconos actualizados

**No hacer push hasta que Pablo apruebe esta vista previa LAN.** Cada push
publica por FTP, incluso si sólo cambia documentación. Esta condición posterior
limita la autorización anterior. GitHub conserva 4bd8938; servicios 4173 y 4174
activos, sin duplicados. Pendiente únicamente revisión de Pablo para publicar.

## Cambios actuales

- Fill en Penrose: el modelo guardaba el color debajo de caras opacas. Separamos
  fondos del generador y perímetros en sceneLayers, con Fill entre ambos. Fuente
  pura comparte el orden; se conserva en SVG editable/expandido y al recargar.
- Reactivar Fill por clic, F o comandos abre controles aunque la herramienta ya
  esté activa. Barra derecha persistente con ocho accesos, Objeto condicionado
  a selección y toggle inferior que conserva tab. Overlays móviles dejan libres
  ambos rails y sus controles. Ajustar al patrón encuadra Penrose como finito.
- Fill denso: al superar el presupuesto global, analiza la región clickeada;
  un contorno cerrado se recolorea directamente. Para varios trazos, una cara
  fuente sólo propone la ventana: se valida con todas las curvas/capas/instancias
  que la cruzan. No se aceptan caras que excedan la ventana; agujeros, Béziers e
  índices originales preservados. Seguridad sin elevar presupuestos. Vínculos
  automáticos y recálculo manual usan el mismo criterio local si es necesario.
- Nuevo favicon_io.zip: seis archivos reemplazados byte a byte; revisión
  f6108aa8c880 en URLs de ICO/PNG/Apple/manifest/Android para evitar caché antigua.
  Nombre/colores y rutas relativas del manifest preservados. icono.png intacto.
- Footer de autor en una línea con seis enlaces de FutureForge, estética propia
  y Lucide; desplazamiento horizontal sólo del footer en móvil. Logo preservado.
- Metadatos SEO/canonical/Open Graph/Twitter estáticos con caratula.jpg original
  1176×775. https://peu.net/pattern/ comprobado contra la app publicada; imagen
  absoluta apunta allí y estará disponible después de aprobar el push.
- README mantiene explicaciones/imágenes primero e instalación/trabajo al final;
  nueva captura real docs/images/penrose-fill.png. Archivos fuente caratula.jpg y
  favicon_io.zip intactos y sin seguimiento; las copias públicas sí van a Git.

## Verificación real

- 204 unitarias y TypeScript estricto; build final correcto:
  .runtime/fill-local-final-{check,build}.log.
- 101/101 E2E en una corrida integrada de3,1min:
  .runtime/fill-local-full-e2e.log. Incluye regresiones anteriores, cuatro tamaños,
  tinta real, fuente/undo/recarga, perímetro SVG, Fill denso y accesos de paneles.
- Después se añadió el fallback al recálculo manual y se repitieron 204 unitarias,
  build y los2 E2E densos, incluido su botón real. Log fill-local-recalculate-e2e.
  Se conserva el ID y la familia de límites; no sólo el solapamiento geométrico.
- 6 E2E estáticas sobre el build final, raíz y /pattern/, sin Internet:
  fill-local-static-{root,sub}.log. Servidor temporal de QA detenido al terminar.
- Probes de iconos/manifest HTTP200, revisión, dimensiones/decodificación y bytes
  correctos en raíz/subcarpeta; ejemplo Penrose real de340 caras con tinta al
  primer clic en producción local: preview-icons-qa.log, verify-preview.mjs.
- Capturas .runtime/right-rail-{1440,390}.png y penrose-production.png.
  Logs/scripts de ejecución sólo en .runtime; sin direcciones LAN en Git.

## Git y seguimiento

Footer/iconos iniciales 84d7415, metadatos7db5cb7; correcciones Fill/paneles
474fa8c y2afe5b4, recálculo denso52c58eb. Todos exclusivamente locales.
El cierre de iconos y documentación se guarda también local, sin publicar.
.runtime/PROJECT_COMPLETE registra entrega verificada pendiente de revisión,
no una publicación. Feedback del monitor sigue activo. Ante un nuevo pedido,
retirar el marcador al iniciar trabajo real, como indica AGENTS.md.

---

# Continuidad · PRD v2.3 verificado

## Estado y alcance

Implementado prd_v2.3.txt como evolución no destructiva de v2.2. Se conservan
las regresiones v1/v2/v2.1/v2.2, icono.png y schemaVersion 4. Main local con
push autorizado a https://github.com/pablopeu/pattern. Sin criterios pendientes
conocidos: matriz en docs/ACCEPTANCE_V23.md e inventario en UX_V23_INVENTORY.md.

## Distribución final

- Rail con categorías Dibujo/Formas/Simetrías/Teselas/Capas/Aplicación/Preferencias
  y herramientas frecuentes directas. Un contexto por vez, plegado completo,
  tabs recordadas por categoría durante la sesión, sin agregar undo al navegar.
- Derecha: Colores/Trazo/Perfil/Fill/Paleta/Presets/Objeto/Opciones. Objeto separa
  Forma/Transformar/Nodos/Acciones y conserva handlers geométricos originales.
  Polígono identificado con parámetros, relleno/trazo y preview inmediatos.
- Selector compacto con activo/recientes/favoritos y catálogo modal de 27 opciones,
  filtros, miniaturas vivas y paginación adaptable. Red y colocación separadas.
- Teselas Forma/Colocación/Bordes/Tangentes; generador por páginas de 4 parámetros;
  aplicación Perímetro/Transformar/Vínculo. Un scroll de respaldo por superficie.
- Ctrl+K conecta a handlers reales; modales nativos con foco/inert/Escape. Resize
  alterna overlays para no tapar ambos lados. Capturar punto antes del autocierre
  conserva dibujo/Fill. Lápiz respeta el destino de estilo que eligió el usuario.

## Verificación final real

- 203 unitarias + TypeScript estricto: .runtime/v23-final-check.log.
- 94/94 E2E en corrida final de 4,3 min:75 anteriores +19 nuevos. Log
  .runtime/v23-full-regression-final.log. Cuatro resoluciones solicitadas,
  tinta/modelo/undo reales, catálogo/foco/teclado y todas las tabs sin scroll.
- 9 pruebas Python del monitor; sin mensajes de prueba al hilo real.
-Builds raíz/subdirectorio correctos;3+3 estáticas con orígenes externos
  bloqueados: .runtime/v23-static-root.log y v23-static-subdir.log.
-Exportación independiente completa nuevamente correcta: CairoSVG/Pillow/ezdxf,
  regresiones previas y seis escenarios v2.2. Log v23-export-independent.log.
-Benchmarks adaptados y ejecutados; referencias locales, no garantías de FPS.
-Cinco capturas reales inspeccionadas y cuatro JSON descargables validados
  en README; node scripts/capture-readme.mjs reproduce estos artefactos.

## Servicios y feedback

Mantener app 4173 y monitor 4174 vivos; no duplicarlos. npm run local:status
verifica sus PIDs. Los dos feedback históricos siguen revisados y atendidos;
no hubo nuevos durante este incremento. La entrega independiente sigue
activa incluso con PROJECT_COMPLETE.

PROJECT_COMPLETE registra este cierre y cancela timers de reanudación de un
PRD ya terminado. Ante una nueva solicitud real de cambios: retirar el marcador,
leer AGENTS.md/continuidad/progreso/feedback/Git y comprobar cupo real. No borrar
el marcador como prueba ni reiniciar trabajo por una reanudación vieja sin
pendientes. Con10% o menos en ventana vigente, verificar/documentar/commit y
finalizar; el monitor solicita continuar tras reset real +60s.

## Convenciones persistentes

Git local y push main autorizados. Documentación pública sólo con <IP_LOCAL>;
no publicar IP concretas ni datos de .runtime. README: explicaciones/imágenes
primero, instalación y trabajo al final. No editar módulos activos ni generar
notices durante E2E; no ejecutar suites con el mismo outputDir simultáneamente.
El scroll de respaldo es admisible para ventanas menores/zoom/listas extensas;
no se promete ausencia absoluta en cualquier contenido o resolución.

Auditoría final: cabecera móvil en dos filas con bounds completos de Archivo,
Buscar comandos y Exportar comprobados. El nombre del proyecto también está
en Preferencias. Capturas de las cuatro resoluciones inspeccionadas. Corrida
posterior 94/94 correcta en 4,3 min, estado de salida 0 registrado en
.runtime/v23-full-regression-final.status.json. Ambos builds y3+3 estáticas
repetidos correctamente. Se registra PROJECT_COMPLETE al publicar este cierre.

## Hosting FTP automático confirmado

Pablo autorizó producción FTP automática con cada push. Workflow
.github/workflows/deploy-ftp.yml activo para push (sin filtros de rama/archivo)
y workflow_dispatch. Usa los cuatro Repository secrets FTP_HOST, FTP_USERNAME,
FTP_PASSWORD y FTP_FOLDER, sin extraer sus valores a esta máquina.

Destino public_html/<FTP_FOLDER>/ con barra final automática; también acepta
el prefijo public_html sin duplicarlo. BASE_PATH=./, sólo dist/, FTP puerto 21.
Transferencias serializadas, sin cancelar la que está en curso ni vaciar la
carpeta completa. Checkout/setup-node/FTP action fijados por SHA.

Verificado localmente: actionlint 1.7.12, 3 pruebas de configuración del destino,
203 unitarias/TypeScript y build. Verificado realmente en GitHub: instalación
npm ci, todas esas pruebas/build, preparación de secretos y subida FTP correctas.
Primera ejecución: https://github.com/pablopeu/pattern/actions/runs/44744523772, commit df4e712.
La publicación del cierre documental dispara otra ejecución automáticamente;
su resultado final se registra en el marcador local de cierre.

V2.3 conserva toda su auditoría anterior. Se mantienen app 4173 y monitor 4174,
y la entrega independiente de feedback. Ante cambios nuevos, retirar
PROJECT_COMPLETE y comprobar uso real antes de continuar.
