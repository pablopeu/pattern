# Continuidad de trabajo · PRD v2

## Objetivo activo
Implementar íntegramente `prd_v2.txt` sobre v1, preservando motor, archivos y regresión. Servir por LAN, documentar avances y hacer commits. Remoto autorizado `pablopeu/pattern`, main.

## Baseline confirmado
- HEAD inicial `2aa0987`, sólo `prd_v2.txt` nuevo fuera de Git.
- TypeScript + 57 unitarias, 19 E2E, 4 tests de monitor y build correctos antes de modificar código.
- App 4173 y monitor 4174 activos. Retirado `.runtime/PROJECT_COMPLETE`; monitor retomado.

## Estado del incremento v2
- Modelo Libre, esquema 2/migración, resolver común, perfiles, origen/orientación y colocación implementados.
- Captura inversa fija y Pluma abierta; continuidad Diseño/Patrón; galería real diferida, hover transitorio; composición propia/heredada/libre y exportador efectivo implementados.
- Última corrida integrada: 80 unitarias + 29 E2E correctos; 19 de v1 conservados. Monitor 4/4, build y validadores independientes pasan. Estático raíz/subdirectorio sin recursos externos pasó antes de las últimas mejoras de guías/cancelación.

## Próximos pasos para cerrar
1. Ejecutar las pruebas adicionales nuevas en tests/v2.spec.ts: teclado/toque, estilo, edición de tres conjuntos y undo de conjunto activo. La suite completa anterior pasó; estas ampliaciones todavía deben validarse.
2. Auditoría visual real a 1366 y 1440, ejemplo Jardín con miniaturas, composición; revisar capturas.
3. Benchmark aislado (primera medición fue simultánea con E2E: grupo 86 ms, tanda 1864 ms, motor .8 ms); registrar versión final en TESTING.md.
4. Build final y estático raíz + `/pattern/`, actualizar docs/ACCEPTANCE.md AC-21…42, commit/push autorizado.
5. Auditar antes de marcar PROJECT_COMPLETE; conservar ambos servicios. Reabrir si llega feedback.

## Operación
Consultar `python3 scripts/work_monitor.py --status` entre incrementos. Con <=10% vigente, cerrar incremento, documentar, commit y finalizar turno; el timer retoma este mismo hilo tras reset real +60s. No duplicar procesos. Revisar `.runtime/feedback.jsonl`.
