# Avances

## 2026-11-19 · Inicio

- Inspección: repositorio nuevo, sólo PRD v1, sin commits previos ni archivos de implementación.
- Elegido stack React + TypeScript estricto + Vite, Paper.js para operaciones geométricas, SVG para instancias, IndexedDB local y pruebas Vitest/Playwright.
- Preparación del monitor de cupo con telemetría local real y reanudación de la misma conversación.
- Aplicación accesible en LAN (puerto 4173); panel de actividad independiente (4174). Sin publicación ni repositorios remotos.
- Pendiente: implementar y verificar todos los criterios del PRD. Este registro no implica funcionalidades terminadas.

## 2026-11-19 · Motor y primera versión integrada

- Modelo TypeScript independiente de React: geometría canónica, transformaciones, generadores, patrones, regiones y aplicaciones vinculadas/congeladas.
- Motor afín con inversas; 17 grupos periódicos, 7 frisos, Cn/Dn y restricciones de red. Penrose finito distinguido de un patrón periódico.
- Editor SVG con instancias reutilizables, herramientas vectoriales, trazado en vivo, selección, nodos/tangentes, pan/zoom y vista dividida. Capas, operaciones booleanas y conversión explícita de paramétricas a paths.
- Generadores determinísticos y ocho ejemplos editables. Paneles contextuales y parámetros numéricos.
- Autosave IndexedDB, archivo JSON versionado validado, importación SVG sanitizada con escala física explícita cuando falta.
- Exportador en worker con cancelación: SVG, raster, DXF y recorte geométrico mediante Paper.js. Falta validar sus flujos completos en navegador.
- Verificado: `npm run build` correcto y 29 pruebas Vitest correctas. Se corrigió una subdivisión Penrose detectada por las pruebas de áreas.
- Disponible por LAN: estudio :4173 y panel de avances/cupo :4174.
- Pendiente inmediato: Playwright y revisión visual; auditoría de importación, recorte expandido, continuidad, edición desde instancias y persistencia. Implementar faltantes del PRD detectados en esa auditoría.

## 2026-11-19 · Validación funcional y correcciones

- Navegador Chromium real: renderizado y capturas desktop, dibujo antes de soltar, edición de nodo desde copia reflejada, medidas 100×50 mm y round-trip JSON, sanitización y transformaciones SVG, cuatro formatos de descarga y SVG aplicado expandido sin máscara.
- Corregido guardado explícito: completa la transacción local antes de descargar el JSON, evitando recuperar un autosave anterior al recargar inmediatamente.
- Biblioteca de proyectos local: conserva archivos anteriores al crear proyectos o abrir ejemplos. Importación y exportación de presets con validación.
- Historial agrupa los movimientos continuos de sliders en una acción. La vista dividida permite seleccionar la fuente.
- Recorte expandido de todas las celdas, incluidas redes oblicuas; conversión de strokes antes de aplicar transformaciones afines, conservando escala no uniforme.
- 37 pruebas unitarias pasan: añadidas áreas de regiones fundamentales, agujeros, Bézier recortadas, DXF, copias congeladas y culling con motivos fuera del origen.
- Añadidas guías de región fundamental (Dirichlet), ejes, centros y vista de inspección de uniones con verificación algebraica de la red.
- Monitor: pruebas de umbral, reset real, ventana semanal y detección de reanudación fallida.
- En curso: benchmark exigido, pruebas E2E ampliadas, despliegue estático/offline y documentación final. El PRD todavía no se considera completado.
