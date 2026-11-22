# Aceptación · PRD v3.1 (publicaciones)

Inicio autorizado: v3.0 cerrada y verificada (FULL 34/1168/216/16, Fase7) y
publicada en `main` antes de la primera línea de v3.1.

| AC | Evidencia |
|---|---|
|01 Dependencia|v3.0 en main con FULL PASS previo a este PRD (CONTINUITY)|
|02 ID Base62 16|`share_random_id` con `random_bytes` y rechazo ≥248; pruebá `test:share:php`|
|03 Sin colisiones|Verificación de existencia + escritura atómica (rename); nunca sobrescribe|
|04 JSON+GZIP|`shareDocument` + `gzencode(9)`; recuperación exige hash idéntico|
|05 Sin SQL|Todo en filesystem distribuido por prefijos|
|06 Sin login|GET público por ID; E2E abre en contexto aislado|
|07 No sobrescribe locales|Apertura como copia con nueva identidad; diálogo destructivo existente|
|08 Editabilidad|Documento nativo íntegro; E2E verifica patrón reconstruido|
|09 OG sin JS|`s/index.php` emite OG/Twitter server-side (integración PHP)|
|10 Miniatura|Cliente 1200×630 JPEG ≤100 KiB por presupuesto de calidad; GD re-codifica o degrada a tarjeta genérica|
|11 Redes|WhatsApp/Telegram/Facebook/X con la URL correcta (E2E); Instagram honesto: copiar/enlace y descargar miniatura|
|12 Instagram|Igual que AC-11: sin API inexistente|
|13 Botón Compartir|Cabecera junto a Exportar; oculto el texto en anchos chicos pero accesible por aria-label|
|14 Sugerencia por defecto|Aparece tras guardado explícito de archivo (E2E)|
|15 Preferencia|«No volver a preguntarme» persiste en localStorage (E2E tras recargar)|
|16 Autosave no sugiere|Sólo `saveNamed` dispara la sugerencia; E2E lo verifica|
|17 Historial intacto|Publicar no toca `s.change` de geometría|
|18 Error sin pérdida|Mensajes claros; el estudio local y autosave no se modifican|
|19 Rechazos|400/413/415/422/429/503 probados contra PHP real|
|20 Archivos privados|Fuera del docroot o `.htaccess` de denegación + acceso sólo por PHP|
|21 Rate/cuotas sin BD|Contadores por archivo con flock; pruebas de ventana y cuota|
|22 FTP no borra publicaciones|El deploy sólo toca `dist/`; el almacenamiento no está en Git ni en dist|
|23 Offline|El editor y el guardado local no dependen del backend|
|24 Migración|Servidor guarda el documento versionado; `parseProject` migra al abrir|
|25 Retiro|Secreto por dispositivo + `admin.php delete` por CLI|
|26 Regresiones|Gate FULL al cierre de v3.1|
