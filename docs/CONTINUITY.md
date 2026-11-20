# Entrega local para revisión · Fill, panel derecho y presentación

**No hacer push hasta que Pablo apruebe esta vista previa LAN.** El workflow
FTP publica con cada push, incluso si sólo cambia documentación. Esta petición
posterior limita la autorización anterior para esta entrega. App 4173 y
monitor 4174 continúan activos, sin duplicados.

Incremento actual por feedback de Pablo: reproducido Fill invisible en Penrose
(el modelo guardaba el relleno debajo de las caras opacas del generador).
sceneLayers separa fondos de geometría generada y perímetros, dejando Fill entre
ambos; se reutiliza también en Fuente pura. Sin cambios de esquema ni mutación
de fuentes/generador; vista/exportación comparten el orden corregido.

setTool es una acción explícita: activar Fill reabre controles aunque la
herramienta ya estuviera activa, también por F o búsqueda. Barra persistente a
la derecha con Colores/Trazo/Perfil/Fill/Paleta/Presets/Objeto/Opciones y botón
inferior de plegar/desplegar. Objeto requiere selección; cada acceso abre su
sección y el toggle recuerda la tab. En móvil los paneles siguen alternándose.
203 unitarias/TypeScript correctos. Primera corrida 99 E2E: 96 correctos;
corregido solapamiento de cierre izquierdo con rail en 390px (max-width deja
espacio al rail); prueba móvil cierra el panel antes de pintar el lienzo cubierto.
El pixel cercano a una curva era dominado por antialias a 1×: el probe rasteriza
a 4× con los mismos puntos y umbrales RGB (sin relajar la comprobación de tinta).
Los siete casos de corrección pasaron juntos, incluidos los tres fallos previos,
Penrose/exportación/perímetro y nuevos accesos de ambos tamaños. Logs
fill-final-check.log, fill-full-e2e.log y fill-corrections-e2e.log. Pendiente una
corrida integrada final sobre la revisión completa y el ZIP actualizado por Pablo.

Footer implementado con el texto pedido en una línea y enlaces de FutureForge
(Instagram/X/Facebook/WhatsApp/Telegram/PEU.NET), usando estilos e iconos propios
de Pattern Studio. No se copió código externo sin licencia: se reutiliza Lucide
ya instalado. En móvil, sólo la franja del pie admite desplazamiento horizontal.
En altura de 800px o menos se compactan los espacios del generador para mantener
sus controles sin scroll pese a la altura ocupada por el nuevo footer.

favicon_io.zip es el archivo fuente aportado por Pablo; se conserva intacto y
sin incluir en Git. Se copiaron los seis iconos a public/icons y se adaptó
public/site.webmanifest (nombre, colores, start_url/scope y rutas relativas).
index.html declara ICO, PNG16/32, Apple180 y manifest Android192/512; el logo
icono.png sigue intacto. Footer e iconos guardados en commit local 84d7415.

Pablo agregó caratula.jpg para tarjetas sociales: copia íntegra en public/,
JPEG1176×775, texto alternativo de Penrose, metadatos descriptivos/autor/robots,
Open Graph website/es_AR y Twitter summary_large_image con @peu_ar.
URL pública https://peu.net/pattern/ verificada por HTTP contra el HTML de
Pattern Studio publicado. Canonical/og:url e imagen absoluta usan ese origen;
no se publican IPs LAN. Los metadatos están en HTML estático, sin depender de JS.
La carátula y los metadatos aún no están publicados: requieren aprobar el push.
Build final correcto; probe Chromium con JS deshabilitado sobre dist/ en raíz
y /pattern/: canonical, Open Graph y Twitter únicos/coherentes, JPEG HTTP200,
dimensiones reales y bytes idénticos al original. Logs social-meta-build.log y
social-meta-qa.log, script de comprobación en .runtime/verify-social-meta.mjs.
Los 203 tests y 13 E2E corresponden al incremento de footer/iconos; para este
agregado estático se verificó build/HTML/imagen sin repetir la suite completa.

Verificación: 203 unitarias/TypeScript, build y 13 E2E de disposición correctos.
Probes reales a 1366×768,1440×900,1920×1080 y 390×844: pie al borde inferior,
sin overflow de página y enlaces accesibles con Tab. Se verificó Enter en un
enlace sin navegar a sitios externos ni modificar el dibujo. Assets/manifest
con HTTP200 y PNG decodificables en producción raíz y /pattern/. Capturas
.runtime/footer-{ancho}.png y .runtime/footer-preview.png. Logs footer-*.log.
Servidor temporal de QA detenido; servicios LAN se mantienen.

Pendiente únicamente revisión del usuario y su autorización para publicar este
incremento. No ejecutar push ni reanudar publicación por un timer viejo.

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
