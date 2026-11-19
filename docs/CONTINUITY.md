# Continuidad de trabajo

Objetivo: implementar íntegramente `prd_v1.txt`, con commits locales, documentación y revisión por LAN.

## Estado
Fundación en curso. Leer avances y Git para el estado exacto. Monitor `.runtime/usage.json`; feedback `.runtime/feedback.jsonl`.

## Servicios
- App: `npm run dev` en 0.0.0.0:4173.
- Monitor: `python3 scripts/work_monitor.py` en 0.0.0.0:4174; requiere CODEX_THREAD_ID del hilo original o --thread.
- No exponer credenciales ni registros de sesiones al navegador. Sólo resumen de cupo.
- El monitor guarda timer al 90% usado y pide continuar en el mismo hilo tras reset + 60 segundos. Respeta también ventana semanal si limita.

## Próximos pasos
Implementar motor y editor integrado, probar, avanzar según PRD. Antes de detenerse, reemplazar esta sección por pendientes concretos y verificaciones.
