# Continuidad de trabajo · PRD v2

## Objetivo activo
Implementar íntegramente `prd_v2.txt` sobre v1, preservando motor, archivos y regresión. Servir por LAN, documentar avances y hacer commits. Remoto autorizado `pablopeu/pattern`, main.

## Baseline confirmado
- HEAD inicial `2aa0987`, sólo `prd_v2.txt` nuevo fuera de Git.
- TypeScript + 57 unitarias, 19 E2E, 4 tests de monitor y build correctos antes de modificar código.
- App 4173 y monitor 4174 activos. Retirado `.runtime/PROJECT_COMPLETE`; monitor retomado.

## Trabajo previsto
1. Esquema 2, Libre explícito, migración real de v1 y presets; resolver efectivo único.
2. Conservar configuraciones por grupo, origen/orientación y colocación independiente.
3. Creación desde instancias con inversa fija; dibujo continuo y cambios de grupo con trazo abierto.
4. Galería dinámica programada, hover transitorio e historial correcto.
5. Composición de patrones propios/heredados/libres, exportación efectiva y snapshots congelados.
6. AC-21…AC-42, regresión v1, benchmark, revisión visual, documentación y build estático.

## Operación
Consultar `python3 scripts/work_monitor.py --status` entre incrementos. Con <=10% vigente, cerrar incremento, documentar, commit y finalizar turno; el timer retoma este mismo hilo tras reset real +60s. No duplicar procesos. Revisar `.runtime/feedback.jsonl`.
