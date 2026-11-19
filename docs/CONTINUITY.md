# Continuidad de trabajo

Objetivo: completar `prd_v1.txt` con commits locales, documentación y feedback LAN.

## Estado 2026-11-19
Primera aplicación integrada funcionando en http://<IP_LOCAL>:4173. Monitor http://<IP_LOCAL>:4174.
`npm run build` y 29 pruebas unitarias pasan. Todavía no se ha terminado el PRD.

## Próximo trabajo concreto
1. Ejecutar Playwright (se está instalando Chromium), revisar screenshots y corregir flujos reales.
2. Probar dibujo antes de pointerup, edición de copias reflejadas/rotadas, paths/nodos, importación SVG física y segura, guardar/reabrir.
3. Auditar recorte expandido con agujeros y trazos; exportación worker y DXF/raster con validadores independientes. Corregir escala de trazos en transformaciones y recorte de celda expandida.
4. Completar biblioteca recuperable/presets importables, guías y vista de continuidad, benchmark 100 fuentes/300 celdas, pruebas de despliegue raíz/subdirectorio/offline.
5. Revisar toda la interfaz, eliminar o completar cualquier control insuficiente, documentar matemáticas/arquitectura/formato/operación/licencias.

## Servicios
Procesos persistentes iniciados con Popen/start_new_session; PIDs y logs en `.runtime/`.
No duplicar. App Vite 0.0.0.0:4173; monitor Python 0.0.0.0:4174.
El monitor lee exclusivamente telemetría del hilo original para el cupo, guarda estado/timer local y pide continuación en este mismo hilo tras reset +60s. Al 90% usado, terminar incremento, probar, documentar, commit y finalizar turno.
Consultar `python3 scripts/work_monitor.py --status` y `.runtime/feedback.jsonl` entre incrementos.
El panel de avances no es un requisito de backend de la aplicación: dist/ es estático e independiente.
