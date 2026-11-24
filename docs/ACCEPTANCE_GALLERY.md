# Aceptación · PRD galería de ejemplos

Incremento posterior a v4.0 (24/11/2026). Cuatro estudios nuevos de referencia
reconstruidos desde geometría medida de fuentes públicas, más el catálogo
depurado a 23 obras. Evidencia: `src/examples/reference-assets.ts` (datos),
`src/examples/reference-builders.ts` (estudios), `src/tests/reference-works.test.ts`
y miniaturas generadas por el pipeline real con `scripts/capture-gallery.mjs`.

| AC | Evidencia |
|---|---|
|01 Fuentes investigadas|A–K auditadas en docs/ESCHER_VECTOR_SOURCES.md; descargas reales en .runtime/original-assets/escher-sources|
|02 Fuentes ya incorporadas|Ragan/reox (lagarto), mapio (pez GPL3), jaredly (perfiles MIT) registrados y no duplicados|
|03 Sin duplicados|GDJ y Ragan comparten motivo pero difieren en figura; una sola tarjeta por geometría (H y I usan la misma base con construcciones distintas)|
|04 Datos vectoriales reales|Coordenadas de los SVG publicados extraídas y convertidas a M/L/C editables; ver reference-assets.ts|
|05 Editables|Cada estudio expone su fuente en sourceGeometry; editar nodos actualiza la repetición (motor compartido)|
|06 Regeneración determinística|Test: misma geometría en dos creaciones; sólo cambian ids|
|07 Encastre declarado|Todos APPROXIMATED (trazos medidos de originales a mano, sin certificar); los EXACT siguen siendo los de jaredly|
|08 Instancias actualizadas|Repetición resuelta por red p1 del motor; una fuente, N matrices|
|09 Detalles interiores|Plumas, pueblo, ojos y aletas importados como objetos independientes sobre la silueta|
|10 Paletas y encuadres|Paletas por obra (crema/índigo, Tango, salvia) y fondos elegidos; encuadre automático verificado en las 4 capturas|
|11 Miniaturas del renderer|public/examples/gallery-*.png generadas por capture-gallery con buildScene/prepareExport reales|
|12 Guardado y reapertura|Test: serialize→parseProject conserva pathData uno a uno|
|13 Exportación SVG|prepareExport usado por capture; curvas y matrices viajan en el SVG (evidencia en los JSON de docs/examples)|
|14 Regresiones conservadas|Catalog test actualizado 19→23; suites históricas intactas; qa:fast 34/1185/230 PASS|
|15 Organización de la galería|Sin barras nuevas; categoría Referencias existente; tarjetas con miniatura, nombre y tipo|
|16 Atribuciones|THIRD_PARTY_NOTICES ampliado; Referencias lista las URLs de Openclipart; metadatos por estudio|
|17 Restricciones de derechos|Obra subyacente de Escher aclarada; Revello sin licencia no se redistribuye; 167216 se analiza sin integrar|
|18 QA según sistema|qa:fast PASS (unit 1185, E2E 230, infra 34) y FULL al cierre del incremento|
|19 Commit y push autorizados|work:close con lista explícita y push a main|
|20 Retomar pendientes|Los dos feedback pendientes de galería (calidad artística) quedan atendidos; sigue prd_v3.0 fase de coloración si Pablo lo pide|

## Notas de reconstrucción

- **Night and Day (249414):** ave oscura de 20 curvas y ave clara trazada, ambas
  medidas en la celda rómbica 209,2×180,4; red p1 con fila a 81,5°. El pueblo
  inferior se conserva como piezas editables.
- **Lagarto torturado (340157):** celda de piezas cerradas de la capa Cut,
  coloreadas por orden de borde con la paleta Tango del original.
- **Peces GDJ (295026):** silueta de 70 segmentos con 36 detalles interiores;
  las tres variantes cromáticas del origen comparten una sola tarjeta.
- **Espiral de lagartos (357838):** reglas medidas (12 motivos por vuelta,
  paso 30°, factor 0,7457 por vuelta) expresadas con la receta de semejanza del
  motor; una fuente reutilizada en todos los niveles.
