# Fuentes vectoriales de referencia · catálogo de procedencia

Investigación del PRD de galería (22/11/2026). Los archivos originales se conservan en
`.runtime/original-assets/escher-sources/` (excluido de Git y de la publicación).
Nada se presenta como autorizado si su licencia no lo permite; las limitaciones se
registran aquí.

| Fuente | Obra | Autor | URL | Formato | Tipo de geometría | Estado | Licencia | Uso en Pattern | Verificaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | Lagarto de Escher, carta vectorial | Sean Michael Ragan | https://www.seanmichaelragan.com/html/%5B2008-04-18%5D_MC_Escher_lizard_vector_art.shtml | SVG | Contorno poligonal + detalles, diagrama de construcción | Integrado como referencia del estudio | Dominio público (declarado por el autor) | Estudio «Lagartos de Escher» (trazado de reox, APPROXIMATED) | Rotaciones 120° medidas; contacto de bordes verificado; encastre aproximado del trazado a mano |
| B | Mosaico de lagartos | reox | https://www.reox.at/blog/posts/create_escher_lizard_tesselation/ | SVG | 3 siluetas trazadas + clones con rotaciones ±60°/±120° | Integrado | Dominio público (el autor deriva del archivo de Ragan) | Silueta canónica del estudio de lagartos, editable por nodos | Área de la celda = hexágono de lado 40; centro triple único; retícula 72 mm 30°/+60° |
| C | Henderson Fish | Einar W. Høst | https://github.com/einarwh/escher-workshop | SVG / Elm | 31 curvas cúbicas explícitas | Comparado, no duplicado | MIT | Sin estudio nuevo: el pez GPL3 de mapio ya está vendoreado | Curvas contrastadas contra el pez existente; no aporta variante mejor |
| D | Peces vectoriales | Evin Revello | https://github.com/evinr/Graphic_Design | SVG (Inkscape) | Peces detallados con jerarquía Inkscape | Consultada, no integrada | Sin licencia declarada en el repositorio | No se redistribuye (limitación registrada) | SVG inspeccionado; render casi vacío por estilos de capa |
| E | Night and Day (estilo Escher) | donchico · Openclipart | https://openclipart.org/detail/249414 | SVG | 243 trazos de aves en composición continua | Integrado | Dominio público | Estudio «Night and Day · aves de dos motivos» (APPROXIMATED) | Celda rómbica 209,2×180,4 medida; ave oscura rellena + plumas, ave clara trazada y pueblo; 25 instancias sobre red p1 |
| F | Seamless Lizards Tessellation ×3 | GDJ · Openclipart | https://openclipart.org/detail/295026 (y 295027, 295028) | SVG | 730 trazos, una geometría con tres paletas | Integrado | Dominio público | Estudio «Peces con ojos · mosaico GDJ» (APPROXIMATED); una sola tarjeta para las tres variantes cromáticas | Silueta de 70 segmentos y 36 detalles extraídos; red rómbica en paso de 60° |
| G | Tessellating Fish | Openclipart | https://openclipart.org/detail/167216 | SVG | 665 trazos en 190 grupos; escena submarina con degradados y burbujas | Analizada, no integrada | Dominio público | Sin estudio nuevo: es una escena rasterizada con degradados, no una fuente de silueta limpia; la figura de pez ya aporta en la tarjeta F | Extracción intentada: 44 formas únicas mezcladas con fondos, algas y burbujas; se verificó que no supera la calidad de F |
| H | Escher Lizard Spiral Set | HenryM · Openclipart | https://openclipart.org/detail/357838 | SVG | 3213 trazos, espiral por semejanza | Integrado | Dominio público | Estudio «Lagartos en espiral · reconstrucción» (APPROXIMATED) | 12 motivos por vuelta medidos (paso 30°), factor 0,7457 por vuelta; fuente Bézier única reutilizada por la receta de semejanza; reglas de escala documentadas |
| I | Tortured Lizard | HenryM · Openclipart | https://openclipart.org/detail/340157 | SVG | 94 trazos en 106 grupos, multicolor | Integrado | Dominio público | Estudio «Lagarto torturado · mosaico de referencia» (APPROXIMATED) | Celda de piezas cerradas de la capa Cut extraída; colores Tango conservados y ordenados por borde; red p1 con fila a 60° |
| J | Escher sobre poliedros | Paulo Henrique Siqueira | https://paulohscwb.github.io/tessellation/escher/ | Web / raster | Escenas 3D con texturas de imagen | No integrada | — | Ninguna: no hay geometría vectorial reutilizable | Repositorio inspeccionado: sólo imágenes y páginas |
| K | Perfiles Bézier parametrizados | Jared Forsyth | https://github.com/jaredly/tessellations | `.path` (M/C) | Perfiles de arista unitarios | Integrado | MIT | Estudios «Encaje Bézier · rombo» y «Panel Bézier · hexágono» (EXACT) | Encastre validado por `tilingIssue` del motor y por E2E |

## Notas de licencia

- La obra artística subyacente de M. C. Escher puede tener restricciones distintas de
  las del archivo vectorial. Los estudios de lagarto se presentan como
  reconstrucciones de los trazados públicos de Ragan y reox (declarados en dominio
  público por sus autores), no como reproducciones autorizadas de la obra original.
- GDJ, donchico, HenryM y Openclipart publican en dominio público (CC0).
- El repositorio de Evin Revello no declara licencia: el archivo se consultó localmente
  y no se redistribuye.
- Høst y Forsyth son MIT; se conservan sus avisos.
