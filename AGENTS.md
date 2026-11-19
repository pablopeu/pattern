# Pattern Studio 2D

Implementar `prd_v2.txt` como evolución no destructiva de v1; conservar su regresión. Trabajar con Git local. El usuario autorizó el push del historial a `https://github.com/pablopeu/pattern` en la rama `main`. La revisión de la aplicación se mantiene en LAN.

- Comprobar `python3 scripts/work_monitor.py --status` al comenzar y entre entregas. Si queda menos del 10% en una ventana vigente, cerrar el incremento: verificar, documentar, commit y finalizar el turno para esperar el reset. El monitor solicita la reanudación en esta misma conversación después del reset real.
- Consultar `docs/CONTINUITY.md`, `docs/PROGRESS.md` y feedback pendiente en `.runtime/feedback.jsonl` antes de continuar. No duplicar servicios activos.
- Mantener vista LAN en puerto 4173 y monitor en 4174. El usuario revisa desde otra PC; mantener los servicios en funcionamiento.
- Commits pequeños por avances coherentes; actualizar documentación con verificaciones reales y pendientes explícitos. No declarar completo el PRD sin auditar sus criterios.
- No copiar código de referencias sin licencia compatible. Motor independiente de React, fuente canónica y transformaciones de instancias.
- Usar npm y package-lock.json; TypeScript estricto. Pruebas de geometría, persistencia y E2E reales.

- Si el usuario solicita cambios después de un cierre verificado, retirar `.runtime/PROJECT_COMPLETE`: el monitor continúa vivo y retoma la vigilancia. No borrar este marcador como parte de una prueba.
