# Referencias y procedencia · v3.0

Revisión inicial20/11/2026. Las referencias orientan el diseño; no implican que
se haya integrado su código ni que todos sus requisitos estén implementados.

| Referencia primaria | Evidencia consultada | Decisión |
|---|---|---|
|[Programming with Escher](https://mapio.github.io/programming-with-escher/)|Notebook declara GPLv3; operadores de geometría funcional|Implementación actual independiente; Pablo autoriza reutilizar referencias open source conservando avisos. No se copiaron ilustraciones|
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


Metadatos matemáticos del catálogo IH (topología, grupo inducido y wallpaper)
transcritos como datos en src/isohedral/catalog.json desde la tabla de
Kaplan/Schattschneider citada arriba. No se copiaron imágenes SVG del artículo.
Se normaliza `dl` a `d1` en IH65/IH70, notación dihédrica de orden1. Las
miniaturas se generan desde las construcciones y curvas reales de este motor.

## Fase3 · Sustituciones Hat / Spectre

Consultados los recursos primarios [Hat](https://cs.uwaterloo.ca/~csk/hat/) y
[Spectre](https://cs.uwaterloo.ca/~csk/spectre/), sus herramientas BSD3 y reglas
matemáticas. Se adapta sólo el núcleo headless de hatviz (commit
4bb9d01999e4e84accc2a78d0fa279ef20b47263) y spectreviz (archive SHA256 en
src/vendor/aperiodic/upstream.json). Licencia completa conservada. La interfaz
propia no depende de P5. Spectre conserva curvas alternadas; Tile(1,1) recto
no se presenta como el Spectre estrictamente quiral. Una inversión global del
marco en generaciones impares conserva la mano canónica de todas sus teselas.


## Fase3 · Girih y bandas

Se consultaron [IkarosKappler/girih](https://github.com/IkarosKappler/girih),
commite2e55ca6d7609ab8b43544143cccfcb4529ddcc3 (GPL2), el catálogo de
[Tilings Encyclopedia](https://tilings.math.uni-bielefeld.de/glossary/girih/) y
[Kaplan2005](https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf).
El código nuevo es independiente: polígonos desde ángulos/lados, intersecciones
analíticas, emparejamiento de rayos54°, ensamblado validado y paridad global.
No se copian las aproximaciones de decoración, texturas ni código GPL del repo.
Girih aparece en el modal Referencias; no se incorpora una biblioteca nueva.
Los dos ejemplos son construcciones matemáticas propias con vectores editables,
no reproducciones de mosaicos históricos ni imágenes del artículo.
