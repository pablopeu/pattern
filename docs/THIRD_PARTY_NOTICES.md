# Dependencias y referencias

Los avisos completos de las dependencias distribuidas se generan desde los paquetes instalados y se incluyen en [public/THIRD_PARTY_NOTICES.txt](../public/THIRD_PARTY_NOTICES.txt). `npm run notices` los actualiza y `npm run build` los copia a `dist/`.

## Dependencias de ejecución

| Paquete | Uso | Licencia declarada |
|---|---|---|
| React / React DOM / scheduler | Interfaz | MIT |
| Paper.js | Paths, Bézier, booleanas, recorte y flattening | MIT |
| clipper-lib | Construcción robusta de contornos de trazo | BSL-1.0 |
| idb | IndexedDB transaccional | ISC |
| Zod | Validación y contratos de persistencia | MIT |
| Lucide React | Iconos vectoriales | ISC |

Las versiones exactas y transitivas están fijadas en `package-lock.json`. TypeScript, Vite, Vitest y Playwright son herramientas de desarrollo, no servicios requeridos en producción. No hay CDN ni fuentes remotas.

## Referencias inspeccionadas el 19/11/2026

- [Patturn Studio](https://patturn.studio/): organización de paneles, Freeform/Rectangular/Circular, Warp Grid y dirección visual. Se inspeccionó su página pública; no se copiaron assets, branding ni código propietario.
- [Eschersketch](https://github.com/levskaya/eschersketch): `symmetryGenerator.js`, herramientas de dibujo y licencia MIT. Se contrastaron generadores de grupos y orientación de espejos.
- [guilbep/patterns](https://github.com/guilbep/patterns): simetrías, distinción p3m1/p31m y Penrose, licencia MIT. El repositorio actual tiene un alcance distinto de la descripción breve del PRD; se inspeccionó el código disponible, no se asumió que la descripción equivaliera a una biblioteca.
- [SVG Pattern Generator](https://github.com/ratpi-studio/svg-pattern-generator): arquitectura de generadores, curvas guilloché/trocoidales y controles contextuales; licencia MIT.
- [vladstudio/patterns](https://github.com/vladstudio/patterns): empaquetado mediante cápsulas, PRNG y determinismo; licencia MIT. No se incorpora el packer porque la distribución sin solapamiento no es requisito central del PRD.
- [Paper.js PathItem](https://paperjs.org/reference/pathitem/) y [Project](https://paperjs.org/reference/project/): booleanas, `intersect(trace:false)`, importación y proyectos temporales.
- Inkscape [Tiling tool](https://wiki.inkscape.org/wiki/Tiling_tool) y [OnCanvasSymmetryTool](https://wiki.inkscape.org/wiki/OnCanvasSymmetryTool): clones enlazados y edición desde instancias.
- [SVG del W3C](https://www.w3.org/TR/SVG/), MDN [pattern](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/pattern) y [clipPath](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/clipPath): coordenadas, repetición y recorte.

El motor del proyecto tiene implementación propia de los contratos y transformaciones matemáticas descritos. Las operaciones geométricas robustas reutilizan Paper.js y Clipper. Hasta v2.3 no se incorporó código de aplicaciones de referencia; las incorporaciones v3.0 se detallan al final. La subdivisión Penrose y Mulberry32 implementan algoritmos matemáticos conocidos; su salida y versión están documentadas y comprobadas mediante pruebas.

## Referencias conceptuales de v2

- [iOrnament: funciones](https://science-to-touch.com/en/features.html) y [demos](https://science-to-touch.com/en/demos.html): dibujo continuo con copias actualizadas y composición de capas. No se copian interfaz, assets ni código.
- [Bridges 2025, artículo 5](https://archive.bridgesmathart.org/2025/bridges2025-5.html): relación entre dibujo, operaciones de simetría y exploración visual.
- [The Mathematical Intelligencer, DOI 10.1007/s00283-025-10492-0](https://link.springer.com/article/10.1007/s00283-025-10492-0): referencia conceptual; la ficha publica el artículo en marzo de 2026 aunque el identificador incluya 2025. No se incorpora motor hiperbólico.
- [The Symmetries of Things, editorial Routledge](https://www.routledge.com/The-Symmetries-of-Things/Goodman-Strauss-Conway-Burgiel/p/book/9781568812205): vocabulario de simetría, grupos y dominios fundamentales.

V2 conserva las mismas dependencias de ejecución y licencias; no incorpora bibliotecas nuevas ni recursos remotos en producción.


## Recursos del incremento v2.1

`icono.png` fue aportado por el usuario y se integra sin modificar el bitmap. No procede de iOrnament ni de otra referencia investigada. Las construcciones de teselas y el overlay son código propio sobre las matrices y dependencias ya existentes; no se añaden paquetes ni servicios externos.


## Recursos v3.0 y referencias visibles

- TactileJS, Craig S. Kaplan: `lib/tactile.js` sin modificaciones, commit
  fd58ec372a4398e3dfc22663d120da186790834e, BSD-3-Clause. Motor isoédrico
  en src/vendor/tactile; licencia original y atribución incluidas en los avisos
  distribuidos. El adaptador TypeScript, validación y pruebas son propios.
- Composición funcional y cuatro ejemplos de peces/aves: implementación y
  vectores originales. Programming with Escher se consultó como referencia
  conceptual; no se incorporó código ni ilustraciones de ese notebook.
- Los repositorios de hiperbólicas y otras familias se agregan al registro
  cuando son consultados. Consultar no significa que todo su código esté integrado.

**Referencias**, junto a la ayuda de atajos, abre un modal con scroll y enlaces
a los repositorios consultados, bibliotecas y referencias visuales/matemáticas.
La lista visible se mantiene en src/ui/ReferencesDialog.tsx. El enlace de avisos
completos funciona también en despliegues estáticos dentro de una subcarpeta.

Pablo autorizó usar referencias open source, incluidas copyleft, y pidió mantener
las atribuciones sin dedicar trabajo a una investigación extensa de licencias.
Al integrar código se conservan su licencia y avisos originales.


Los12 tipos IH marcados se construyen con código y datos propios mediante
reflexiones, red primitiva y estabilizadores interiores. Su clasificación se
contrasta con Kaplan/Schattschneider; no son aliases de los81 tipos de Tactile
ni contienen imágenes de la tabla. El catálogo visible enlaza las referencias.
