# QA de Patterns

El runner ejecuta las herramientas reales y deja su salida íntegra en `.runtime/qa/`.
El agente recibe un resumen; no necesita observar cada test. Los comandos anteriores
(`check`, `test:e2e`, `build`, `test:deploy`) siguen disponibles.

## Comandos

```bash
npm run qa:fast
npm run qa:integration
npm run qa:full
npm run qa:status
npm run qa:failures
npm run qa:cancel
```

FAST selecciona unitarias por imports transitivos y E2E por asociaciones explícitas
con editor, simetrías, teselas, Fill, composición, aperiódicas, Girih, proyecciones,
persistencia, exportación y UI. Esfera y animación tienen entradas reservadas; no
se afirma que esas funciones ya estén implementadas. Un contrato compartido o un
impacto desconocido amplía la cobertura. El informe explica la selección.

Por defecto se consideran cambios respecto de HEAD, incluido trabajo sin commit.
Para un rango confirmado: `npm run qa:fast -- --base <SHA>`.
Para una selección dirigida explícita: `--files src/fill/service.ts,tests/snap.spec.ts`.
FULL siempre conserva todas las unitarias y E2E configuradas, independientemente de
esa selección. No se deben omitir archivos del incremento para obtener un gate menor.

INTEGRATION agrega build y smoke estático de producción. Si cambia el exportador,
agrega los parsers independientes. FULL exige TypeScript, unitarias, E2E completas,
pruebas del supervisor y FTP, monitor, verificadores independientes de las familias
existentes y build/estáticas en raíz y `/pattern/`. Persistencia, migraciones y
protección del trabajo forman parte de la regresión existente.

Dependencias para la validación independiente:

```bash
python3 -m venv .runtime/validation-env
.runtime/validation-env/bin/pip install -r scripts/qa/requirements.txt
```

El runner reutiliza ese entorno si existe. También admite `QA_PYTHON` para elegir
otro intérprete y `QA_WORKERS` para limitar Playwright (hasta4 locales y2 en CI).

## Evidencia y procesos

Cada ejecución tiene ID, manifiesto de entradas, PID supervisor, fechas, estado,
comandos, códigos de salida, conteos, duración, logs, JSON, traces y capturas de fallo.
El reporte está en `.runtime/qa/<ID>/report.json`; `summary.txt` es el resumen legible.
`failures.json` conserva todos los fallos. La presentación muestra como máximo cinco
extractos acotados. Flakiness, retries y skips quedan registrados; un resultado flaky
no se presenta como PASS.

Un lock impide suites simultáneas sobre fixtures o artefactos compartidos. Un timeout
o cancelación termina el grupo de procesos que inició el supervisor. Vite existente
en4173 se reutiliza y no se detiene; el monitor4174 tampoco se modifica. Sin servidor,
el runner inicia uno temporal y lo cierra al terminar. Las pruebas estáticas usan
puertos locales efímeros aislados. Un lock de un supervisor muerto se recupera con
`npm run qa:cancel -- --recover`, después de comprobar el estado de los procesos.

El resumen sólo informa PASS cuando terminaron todos los pasos exigidos. Un reporter
inexistente/malformado falla aunque el comando devuelva0. Si cambian las entradas
mientras corre la batería, se marca STALE y no sirve para publicar.

## Reutilización

La huella usa contenido de fuentes, tests, fixtures, assets, configuración, lock,
versión del runner/herramientas, paquetes Python, perfil y entorno relevante. No se
usa HEAD como sustituto del árbol real. La documentación narrativa y los PRD quedan
fuera de las entradas de pruebas; los ejemplos JSON y las imágenes sí se incluyen.

Se reutiliza un gate completo aprobado únicamente si su huella y todos los hashes
de evidencia siguen siendo válidos. Un fallo, timeout, cancelación o gate incompleto
no se guarda como aprobado. `--fresh` solicita ejecución nueva.

TypeScript, unitarias, E2E, infraestructura y monitor también pueden reutilizar una verificación individual
**completa y aprobada**, aunque falle después otro verificador. El reporte lo marca
con `cachedFrom`; no convierte el gate fallido en PASS. Cambiar un script de validación
independiente no repite E2E ajenas; cambiar sus fuentes, fixtures, reporter o configuración
sí invalida la prueba correspondiente. FULL descubre primero el inventario real de casos. Puede reunir archivos E2E
completos y aprobados de ejecuciones anteriores si coinciden fuentes, helpers,
fixtures, configuración, herramientas, contexto de navegador e IDs de casos.
No reutiliza el archivo con fallos. El reporte distingue `reusedFiles` y
`executedFiles` y conserva la cadena de hashes de evidencia; si falta una pieza,
el archivo se ejecuta. No se convierte una batería fallida en PASS por ocultar casos.

Los generadores independientes no se reutilizan:
sus artefactos temporales se regeneran y se validan secuencialmente.

## Agente administrativo

`.codex/agents/qa-admin.toml` configura `qa_admin` con `gpt-6-luna`, esfuerzo `low`.
La configuración sólo afecta este proyecto; el modelo principal del usuario se conserva.
Se verificó el rol/modelo/esfuerzo en `session_meta` y `turn_context` del CLI0.169.0,
con sandbox de sólo lectura y retorno al padre. Una declaración del modelo no es prueba.

```bash
node scripts/qa-admin.mjs status
node scripts/qa-admin.mjs analyze .runtime/qa/<ID>/report.json
```

PASS o fallos ya clasificables por reglas no lanzan otro modelo. Sólo un diagnóstico
ambiguo justifica una interpretación acotada. Si no se puede verificar el modelo real,
se devuelve UNVERIFIED y se conserva el camino determinístico. El agente administrativo
no edita código/tests, no aprueba despliegues, no hace commits y no lanza otros agentes.
Los fallos geométricos, de persistencia, concurrencia, seguridad o repetidos vuelven
al principal. La prueba de capacidad está identificada como tal; no demuestra un ahorro
monetario ni una equivalencia con el cupo del producto.

Configuración contrastada con el [manual oficial de subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Cierre y CI

```bash
npm run work:close -- --files-from .runtime/archivos-del-incremento.txt \
  --gate integration --message "chore: completar incremento verificado" --push
```

La lista nombra archivos explícitos, uno por línea. El cierre comprueba conflictos,
index ajeno, secretos conocidos, IP privadas, artefactos grandes, whitespace, rama,
remoto autorizado y correspondencia con QA vigente. No usa `git add .`, no fuerza push
ni reescribe historial. Los PRD futuros y demás trabajo ajeno se conservan. Para fases
y releases usar `--gate full`. `--dry-run` verifica y prepara un resumen sin commit/push.
Un hook o push rechazado queda como FAIL; el commit local se conserva si el rechazo
fue remoto. Evidencia: `.runtime/work-close*.json`.

GitHub Actions ejecuta FULL sin observación del agente en el workflow paralelo
`QA gate`; `Deploy FTP` publica main con los checks rápidos (`test:deploy`, `check`,
`build`) y **no espera** el gate completo (~15 min de E2E en el runner). Las
credenciales FTP sólo se entregan al job de despliegue. Logs/traces/reportes quedan
como artefactos de CI durante7 días. Un push aceptado no significa que CI o FTP hayan
terminado; Pablo recibe fallos por email y Codex no inspecciona el deploy tras el push.

## Aceptación

La ejecución real y mediciones finales se registran en `QA_ACCEPTANCE.md` al cerrar.
No se anuncian conteos ni ahorros calculados a partir de una corrida aún activa.
