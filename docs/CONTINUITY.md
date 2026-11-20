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

## Nueva entrega · Hosting FTP autorizado

Pablo autorizó producción FTP automática con cada push. PROJECT_COMPLETE se
retiró para esta tarea; v2.3 sigue auditado. Workflow deploy-ftp.yml preparado
con Repository secrets FTP_HOST/FTP_USERNAME/FTP_PASSWORD/FTP_FOLDER. Destino
public_html/<FTP_FOLDER>/ (barra final automática), build relativo, sólo dist/,
FTP21 y sincronización serializada sin vaciar la carpeta.3 pruebas de destino,
203 unitarias/TypeScript, build y actionlint correctos. Próximo paso inmediato:
commit/push y seguir la ejecución real hasta confirmar despliegue o documentar
un bloqueo externo concreto. No duplicar app4173 ni monitor4174.
