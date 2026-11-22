# Aceptación · QA eficiente

Estado: **QA verificado; cierre Git preparado con FULL PASS.**
PRD de trabajo local: `docs/prd/prd_QA_eficiente.txt`; original conservado.
Operación: [QA.md](QA.md).

## Evidencia real disponible

-31 pruebas del supervisor aprobadas: procesos reales PASS/FAIL, comando inexistente,
  timeout y descendiente, cancelación, exclusión mutua, caché íntegra/alterada/ausente,
  contenido sin commit, tests/fixtures/config/lock/entorno, imports y contratos,
  reporter malformado, gate parcial, cambio de entradas durante ejecución,
  modelos no verificables/herencia incorrecta, secretos/temporales/IP, hook rechazado,
  push rechazado en remoto bare local y dependencia de despliegue.
- FAST:28 infraestructura/FTP+19 E2E,81s PASS.
  Evidencia: `.runtime/qa/2026-11-22T06-50-07-542Z-e24f2233/report.json`.
- INTEGRATION:28 infraestructura/FTP+19 E2E+8 estáticas,113s PASS.
  Evidencia: `.runtime/qa/2026-11-22T06-56-14-358Z-6646e9dc/report.json`.
- CLI0.169.0 acepta la configuración estricta del proyecto. Rol `qa_admin` confirmado
  por `session_meta.source.subagent.thread_spawn.agent_role`; `turn_context` confirma
  `gpt-6-luna`, `low`, sandbox `read-only`, aprobación `never`. La respuesta volvió
  al padre. No se cambió el modelo principal del usuario.
  Evidencia local: `.runtime/qa/agent-capability.json`.
- Servicios originales conservados: app4173 y monitor4174. Sin PROJECT_COMPLETE.

## Matriz

| AC | Estado/evidencia |
| --- | --- |
|01–03 · salida, logs y exit codes|Verificados por ejecución real y pruebas de procesos/reporters|
|04 · FAST por impacto|Verificado: grafo transitivo, asociaciones E2E, contratos compartidos y fallback amplio|
|05 · INTEGRATION|PASS real, incluyendo build y8 estáticas|
|06 · FULL conserva regresiones|PASS:34 infraestructura,1152 unitarias,210 E2E verificadas,16 estáticas y validadores independientes|
|07 · diagnóstico localizado|Verificado en pruebas de fallo/reporters; cinco extractos y evidencia completa|
|08–09 · reutilización válida|Archivo corregido21 casos nuevos+189 reutilizados; gate idéntico reutilizado en290ms sin lanzar baterías|
|10 · Luna opcional|Runner determinístico; PASS y errores ya clasificados no lanzan LLM|
|11–12 · modelo efectivo|Verificado en metadatos reales y prueba de herencia incorrecta|
|13–14 · fallback/escalamiento|Sin modelo verificable queda UNVERIFIED; fallos críticos vuelven al principal|
|15–16 · Git y gates|Staging explícito, gate vigente; hooks y push rechazado probados en repositorios temporales|
|17 · informes compactos|FULL211 bytes de resumen; logs y diagnósticos íntegros guardados|
|18 · regresiones/aserciones|Motor y E2E intactos; validadores históricos usan sus estudios archivados y JSON7|
|19 · LAN|PIDs originales conservados, estáticas aisladas en puertos efímeros|
|20 · medición|Log histórico25462B frente a resumen FULL211B; detalle y límites abajo|

## Alcance de los números

El log histórico completo de210 E2E ocupa25462 bytes. FAST produjo140 bytes de
resumen, pero selecciona19 E2E: no se presenta esa diferencia como ahorro de cómputo
para baterías idénticas. Al cerrar se comparará también la salida del FULL nuevo.
Los tokens visibles estimados usan caracteres/4 como heurística; no se conocen por
ese cálculo el costo, los tokens de razonamiento ni la cuota del producto.

La prueba administrativa es una comprobación de capacidad, no un ahorro demostrado:
el CLI informó124716 tokens de entrada,106624 cacheados y580 de salida para el turno
padre. No se suman ni atribuyen métricas del hijo que el registro no exponga.
La ejecución normal del runner hace0 llamadas a LLM; la intervención del agente que
lo lanza se distingue de los procesos internos. No se infieren ahorros monetarios.

Los generadores independientes usan un directorio nuevo por corrida. Se conserva
el verificador geométrico/raster original; la regresión de composición usa sus cuatro
estudios históricos en lugar de depender de las tarjetas públicas renovadas. Se
exige JSON7, el formato nativo actual, y se rechazan pruebas hiperbólicas vacías.


Primera corrida FULL del runner:1152 unitarias correctas y208/210 E2E,667s.
Dos casos de galería leían `img.complete` antes de finalizar la descarga. Se
conservó la aserción y se esperó su condición mediante poll;4/4 casos dirigidos
correctos. El runner ahora conserva conteos aunque el comando falle y aísla los
flags heredados de estáticas/baseURL. Nueva FULL en curso con hasta4 workers locales
(2 en CI); el cambio de estado/configuración justifica esta repetición. No se
presenta el primer resultado fallido como aprobado ni se cachea su E2E incompleta.


## Cierre real

- FULL PASS:34 infraestructura (31 supervisor+3 FTP),1152 unitarias, inventario
  íntegro de210 E2E,8 estáticas en raíz y8 en subcarpeta. TypeScript, builds de
  ambas bases y21 pasos de generación/verificación independiente correctos.
- Recuperación del archivo corregido:21 casos ejecutados y189 reutilizados con
  fuentes/contexto/inventario/evidencia idénticos. El gate completo pasó en256s.
- Último ajuste: rechazar explícitamente pruebas de corridas canceladas, timeout,
  STALE o supervisor incompleto. FULL final PASS en133695ms, reutilizando26 archivos
  E2E aprobados y validando el resto de categorías. Logs:
  `.runtime/qa/2026-11-22T07-35-27-323Z-57c63105/report.json`.
- Repetición para entradas idénticas: PASS con caché verificada en290ms, sin
  ejecutar otra batería. Reporte:
  `.runtime/qa/2026-11-22T07-38-55-439Z-fab664dd/report.json`.
-211 bytes de resumen FULL frente a25462 del log histórico (mismos210 casos E2E;
  el gate nuevo incorpora además otras categorías). Reducción de texto visible
  aproximada99,17%. No se infiere de ella un porcentaje de tokens facturados,
  razonamiento, CPU o cuota. Las duraciones de las corridas previas tampoco aíslan
  el efecto de concurrencia porque se corrigieron esperas entre ellas.
- Métricas y evidencia completas en `.runtime/qa/metrics-{full,cache}.json`.
  El puente de contexto para los reportes anteriores quedó acreditado por hashes
  del plan/reporter inspeccionados en `.runtime/qa/legacy-context.json`. Los
  reportes nuevos incluyen su contexto de ejecución directamente.

Todos los criterios de este PRD cuentan con implementación y evidencia local.
El workflow remoto quedó configurado; su ejecución posterior al push no se
considera verificada por estas pruebas locales. No se consulta Actions/FTP.
