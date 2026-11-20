# Plan incremental · PRD v3.0

Base auditada: 8be6668. El PRD original es prd_v3.0.txt; no se reescribe.
La revisión permanece en LAN y cada fase debe integrar motor, UI, JSON,
exportación, ejemplos, pruebas y documentación antes de declararse terminada.

## Fase 0 · Base verificada

Lecturas: AGENTS, PRD completo, README, ARCHITECTURE, GEOMETRY, PROJECT_FORMAT,
TESTING, inventario UX/aceptaciones previas. Inspeccionados model/useStudio,
engine/generators, grupos/config, captura, tiles/validación, Fill, exportador,
esquemas/migraciones/presets y navegación. Fuente única, matrices afines,
Paper.js/Clipper y consumidores de Scene se conservan.

Baseline real del20/11/2026:206 unitarias/TypeScript,111 E2E (203,5s/exit0),12
pruebas de monitor, build y6 estáticas raíz/subcarpeta correctos. Logs locales
.runtime/v30-baseline-*; sin alterar servicios ni proyectos del navegador del autor.

## Mapa de reutilización

| Área | Base existente | Ampliación requerida |
|---|---|---|
| Editor | Lápiz/pluma/nodos/Fill/estilos/undo | Conservar; fuentes de todas las familias euclidianas |
| Simetría | 17 wallpaper,7 frisos,Cn/Dn | No reemplazar ni confundir con otras construcciones |
| Teselas | 5 familias, Bézier emparejadas, validación | Relaciones generales, figurativas e IH1–IH93 |
| Disposición | Generadores determinísticos y colocaciones afines | Árboles de composición/recursión y semejanzas |
| Aperiódicas | Penrose finito real | Hat/Spectre con reglas verificadas |
| Ornamentación | Paths/booleanas/contornos | Girih y alternancia over/under verificados |
| Vista | Plano SVG editable, captura inversa | Vistas no afines derivadas/no editables, retorno visible |
| Archivos | Nativo4/presets4 y migraciones1–3 | Sólo cambios necesarios para nuevos datos reproducibles |
| Exportación | Worker,SVG/PNG/JPEG/DXF, tolerancias | Proyección adaptativa, frames, GIF/video local |
| Ejemplos | 8 proyectos legados | Catálogo visual original, metadatos y validación por familia |
| UX | Categorías, tabs, modales, Ctrl+K | Revelación contextual; sin nuevos rails permanentes |

## Fase 1 · Recursión y semejanzas

1. Módulo puro composition con operadores afines y AST acotado; compilar hojas
   en matrices/IDs estables y niveles. Fuente canónica referenciada, sin clones.
2. Recetas de cuadrantes y anillos hacia el borde; espiral discreta/logarítmica,
   roseta autosimilar y convergencia a punto fijo. Cortes por detalle/presupuesto.
3. Definición opcional de composición en Pattern, separada de geometría/generador/
   simetría. Finita y no periódica por defecto: no certificar un teselado.
4. Integrar Scene, captura y exportaciones con estilo por nivel compartido,
   conservando render/captura de proyectos sin composición.
5. Simetrías → Composición: tarjetas de familias/recetas, parámetros por páginas,
   editar motivo/ver composición y acciones Ctrl+K. Galería visual de ejemplos
   con búsqueda/filtros desde Archivo, preservando los8 accesos/fixtures legados.
6. Dos ejemplos originales: peces decrecientes hacia borde cuadrado y peces/aves
   hacia el centro de una espiral. Detalles interiores/editabilidad y paletas.
7. Persistencia explícita de parámetros/recetas/procedencia. Evaluar incremento
   de formato sólo si evita pérdida silenciosa de nuevos campos en lectores viejos.
8. Unidades matemáticas, JSON/presets/legacy, SVG editable/expandido/raster/DXF,
   E2E de interacción real a cuatro resoluciones, capturas y mediciones.

## Fases siguientes · Pendientes

- Fase2: relaciones de bordes/IH por datos; catálogo honesto hasta verificar93/93.
- Fase3: Hat/Spectre por sustitución; Girih y cruces alternados topológicos.
- Fase4: Poincaré {p,q}, isometrías/geodésicas y adaptación numérica, artística aparte.
- Fase5: construcciones poliédricas/proyección esférica derivada, giro/exportación.
- Fase6: timeline normalizado, loops verificables, encoder local GIF/video cancelable.
- Fase7: auditoría transversal UX/compatibilidad/exportación y matriz AC completa.

## Riesgos y reglas de avance

No copiar notebook GPL ni gráficos de Escher. Referencias/licencias en
REFERENCES_V30.md. No llamar periódico a recursión/espiral, ni hiperbólico exacto
a una deformación circular. Adaptación de contenido y construcción geométrica
se validan por separado. Versiones, límites numéricos, exportaciones y navegación
se prueban antes de considerar cada fase terminada. Los parámetros de vista no
agregan undo geométrico. No editar módulos/build durante suites E2E activas.
