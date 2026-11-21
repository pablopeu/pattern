# Referencias y procedencia · v3.0

Revisión inicial20/11/2026. Las referencias orientan el diseño; no implican que
se haya integrado su código ni que todos sus requisitos estén implementados.

| Referencia primaria | Evidencia consultada | Decisión |
|---|---|---|
|[Programming with Escher](https://mapio.github.io/programming-with-escher/)|Notebook declara GPLv3; operadores de geometría funcional|Sólo conceptos; implementación independiente. No copiar código ni peces del notebook|
|[Henderson, Functional Geometry](https://eprints.soton.ac.uk/257577/1/funcgeo2.pdf)|Enlace académico desde el notebook; acceso403 en esta revisión|No afirmar lectura del PDF; fórmulas afines propias y pruebas independientes|
|[looeee/hyperbolic-tiling](https://github.com/looeee/hyperbolic-tiling)|README y listado raíz; sin LICENSE raíz confirmada|Referencia de alcance; no reutilizar código/assets sin evidencia adicional|
|[Poincaré Paint LICENSE](https://github.com/pisan-labs/poincare-paint/blob/main/LICENSE)|MIT, Copyright2026 Yusuf Pisan|Compatible con atribución si se reutiliza; todavía no integrado|
|[Kaplan/Schattschneider, Isohedral Tiles](https://isohedral.ca/isohedral-tiles-tilings-and-notations/)|Artículo y clasificación93 tipos|Guía de clasificación; datos/algoritmos se verifican en Fase2|
|[Spectre](https://cs.uwaterloo.ca/~csk/spectre/)|Autores publican fuente de herramienta BSD3 y medios CC-BY4 por separado|Revisar cada archivo antes de integrar en Fase3; ninguna incorporación aún|
|[Museo Escher: peces y aves](https://www.escherinhetpaleis.nl/en/about-escher/escher-today/experimenting-fishes-birds)|Contexto artístico del proyecto|Ejemplos vectoriales originales, sin escanear/calcar ilustraciones|

Los ocho ejemplos existentes se conservan para compatibilidad. Nuevos ejemplos
originales registrarán autores/procedencia, clasificación matemática y parámetros
reproducibles. Las reproducciones fieles requieren evidencia de derechos conforme
al PRD15.3; su ausencia no bloquea los ejemplos de inspiración original.

No se añadieron dependencias ni recursos gráficos de terceros en Fase0.

## Fase2 · Motor de referencia compatible

[TactileJS](https://github.com/isohedral/tactile-js) y su
[licencia BSD-3-Clause](https://github.com/isohedral/tactile-js/blob/fd58ec372a4398e3dfc22663d120da186790834e/LICENSE)
revisados. Se incorpora únicamente `lib/tactile.js` sin modificaciones, commit
fd58ec372a4398e3dfc22663d120da186790834e, Git blob
3d3df7097d91116c1f49041a3b02505c28fab1e8. Licencia y procedencia junto al
módulo en src/vendor/tactile; declaraciones TypeScript y adaptador propios.
Copyright2018 Craig S. Kaplan, atribución distribuida en THIRD_PARTY_NOTICES.
No se incluyen demos, ilustraciones, P5.js ni QuickSettings. No hay dependencia
npm nueva. El hash de la fuente se verifica en pruebas y Prettier la excluye.

La biblioteca cubre81 tipos geométricos. El
[artículo primario de Kaplan/Schattschneider](https://isohedral.ca/isohedral-tiles-tilings-and-notations/)
explica que12 tipos adicionales necesitan marcas interiores porque sus bordes
rectos fuerzan demasiada simetría. Se mantienen explícitamente pendientes:
IH19,35,48,60,63,65,70,75,80,87,89,92. No se presentan como aliases de otros tipos.
Las tablas/fórmulas afines tienen tests propios de matrices, área, cobertura,
ciclos alrededor de vértices y contornos Bézier; usar esta biblioteca no sustituye
la validación ni la futura integración UX/exportación del estudio.
