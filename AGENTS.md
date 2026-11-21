# Pattern Studio 2D

Implementar `prd_v3.0.txt` como evolución no destructiva del estado actual; conservar las regresiones v1/v2/v2.1/v2.2/v2.3 y el feedback posterior y el logo icono.png. Trabajar con Git local. El usuario autorizó el push del historial a `https://github.com/pablopeu/pattern` en la rama `main`. La revisión de la aplicación se mantiene en LAN. Pablo autorizó también producción por FTP mediante GitHub Actions en cada push; conservar ambos servicios LAN.

- Comprobar `python3 scripts/work_monitor.py --status` al comenzar y entre entregas. Si queda 10% o menos en la ventana primaria de 5 horas, cerrar el incremento: verificar, documentar, commit y finalizar el turno para esperar el reset. El monitor solicita la reanudación en esta misma conversación después del reset real.
- Consultar `docs/CONTINUITY.md`, `docs/PROGRESS.md` y feedback pendiente en `.runtime/feedback.jsonl` antes de continuar. No duplicar servicios activos.
- Mantener vista LAN en puerto 4173 y monitor en 4174. El usuario revisa desde otra PC; mantener los servicios en funcionamiento.
- Commits pequeños por avances coherentes; actualizar documentación con verificaciones reales y pendientes explícitos. No declarar completo el PRD sin auditar sus criterios.
- Reutilizar código de referencias conservando sus avisos y atribuciones. Motor independiente de React, fuente canónica y transformaciones de instancias.
- Usar npm y package-lock.json; TypeScript estricto. Pruebas de geometría, persistencia y E2E reales.

- Si el usuario solicita cambios después de un cierre verificado, retirar `.runtime/PROJECT_COMPLETE`: el monitor continúa vivo y retoma la vigilancia. No borrar este marcador como parte de una prueba.

- Documentación pública: usar `<IP_LOCAL>` en URLs LAN; no publicar direcciones concretas de esta máquina, tampoco en commits o historial. Los datos de ejecución quedan en `.runtime/`, excluido de Git.
- README: primero explicaciones y ejemplos con imágenes; al final instalación, despliegue y detalles de trabajo. Mantener ejemplos verificables y capturas de la aplicación real.

- Pablo revisó en LAN y autorizó explícitamente «al terminar push a gh». Se puede publicar en main el historial local pendiente (Fill/paneles/footer/iconos/metadatos); No revisar el workflow ni el FTP después del push: Pablo recibe fallos por email de GitHub. Mantener servicios LAN.

- Predeterminados pedidos por Pablo: estudios nuevos en P3, zoom100% centrado,
  estructura visible50% y Dibujo libre al iniciar. P3 primero/Libre último, resto
  del orden igual. Usar newStudy para UI; conservar newProject neutro para motor,
  fixtures e importaciones. Recuperación no sobreescribe configuraciones guardadas.
  Grilla: puntos negros5mm alineados con Snap, control de visibilidad independiente.

- Aclaración vigente de Pablo: el cupo secundario/semanal sólo dispara un aviso;
  Pablo decide si usa un banked reset. No pausa automáticamente ni retrasa el
  timer al reset semanal. Reanudación basada en el reset real primario+60s.
  Próxima tarea: prd_v3.0.txt, incluidos los ejemplos, desde Fase0 sin implementar
  antes del reset primario solicitado.

- Pablo autorizó reutilizar código open source, incluidas referencias copyleft,
  sin una investigación extensa de licencias. Mantener los avisos originales y
  actualizar THIRD_PARTY_NOTICES.md con lo efectivamente incorporado.
  Botón Referencias junto a Ayuda: modal con scroll de todos los repositorios
  consultados. Ampliar su lista al consultar nuevas fuentes durante el PRD.
