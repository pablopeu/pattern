# Estado actual de Patterns

Actualizado:22 de noviembre de2026 (UTC). **PRD v3.0 verificado en todas sus fases (0–7).**
El detalle de criterios está en [ACCEPTANCE_V30.md](ACCEPTANCE_V30.md).

## QA y siguiente prioridad

QA eficiente implementado y verificado: FAST/INTEGRATION/FULL, selección por
impacto, evidencia completa, caché con inventario E2E, cierre Git explícito y
quality→deploy del mismo SHA. FULL:34 infraestructura,1152 unitarias,210 E2E
verificadas y16 estáticas, builds y validadores independientes correctos.
El gate idéntico se reutilizó en290ms. [Operación](QA.md) ·
[criterios y mediciones](QA_ACCEPTANCE.md).

Siguiente: `docs/prd/prd_galeria_ejemplos.txt`. Pablo considera que los15 ejemplos
actuales todavía necesitan mayor calidad artística. El nuevo incremento debe
incorporar geometría editable mejor resuelta, detalles, paletas, encastres y
capturas reales. Después se retoma v3.0 desde sus pendientes; v3.1 espera.

## Entrega actual

- **Estudio de Pablo:** se conserva el original y se entrega
  [test1-corregido.json](../tests/estudios/test1-corregido.json). Se reparó una
  unión antigua y se recalcularon sus dos rellenos. Cambiar ancho60→61 conserva
  las uniones; volver a60 recupera la construcción.
- **Edición:** Shift permite seleccionar varios objetos; Delete/Backspace los
  borra directamente, con Deshacer y respetando candados. La edición de nodos
  distingue un trazado de una selección de objetos completos.
- **Panel derecho:** eliminado el parpadeo de apertura/cierre. Pruebas con cuadros
  pintados reales y confirmación de Pablo en su PC LAN.
- **Galería:**15 estudios renovados, sin la lista antigua de accesos rápidos.
  Se priorizan encastres figurativos y bordes compartidos. Espirales y deformación
  radial se identifican como composiciones artísticas. El modal se adapta y pagina
  para entrar sin scroll, también en pantallas pequeñas y apaisadas.
- **Geometría funcional:** curvas del pez de referencia, fuente editable y412
  instancias en el límite cuadrado. Profundidad0–5, datos GPL3 íntegros y créditos
  en Referencias, JSON y SVG. Miniaturas y archivos se generan con el motor real.
- **Exploración reversible:** familias y recetas recuerdan marco, paleta y
  parámetros, incluso al reabrir el archivo. Se conserva la fuente y el relleno
  canónico de las teselas. Las simetrías recuperan su colocación al volver de
  otro grupo que se haya redimensionado.

## Verificación

Cierre del22 de noviembre:1152 pruebas unitarias/TypeScript correctas,
regresión E2E completa **210/210** (`.runtime/curated-full-confirmed-2.log`),
build de producción correcto y16 estáticas sin Internet(8 raíz+8 subcarpeta
`/pattern/`, incluido build con `BASE_PATH`). La primera corrida completa quedó
209/210 porque arrancó mientras se regeneraban las paletas de los15 ejemplos;
el único fallo(pez IH43) se explicó y no se reprodujo: pasa aislado y en la
repetición completa. Corridas previas:202/210 con fixtures históricos, paleta
base de presets, selector de color y apertura de panel corregidos;25 históricas
dirigidas correctas después.

Un build anterior REAL rechaza la receta nueva sin interpretarla como otra.
Los datos y la licencia del pez coinciden con sus hashes originales. No se
incorpora una imagen del grabado; se reutilizan las curvas acreditadas.

## Lo que falta del PRD

| Fase | Estado |
| --- | --- |
|0–3 · base, IH, figuras, composición, aperiódicas y Girih|Verificadas; regresiones conservadas|
|4 · Poincaré y disco artístico|**Verificada**: modelos geométricos, fuente finita, cámaras con bordes C0, UI, JSON y SVG/PNG/JPEG; coloración por tesela y por clase de orientación (UI, JSON, unitarias y E2E). Auditoría §10/§10.1–10.6 cubierta por hyperbolic*.test, poincare.spec y artistic-disk.test|
|5 · esfera|**Verificada**: 5 sólidos platónicos con caras por planos de soporte, subdivisión geodésica 0–4 sin huecos (prueba de cobertura esférica), textura artística por proyección inversa, orientación/zoom/giro/iluminación/fondo/bordes, PNG 1400px real y persistencia JSON. sphere.test + sphere.spec|
|6 · animación|**Verificada**: 5 presets (giro/oscilación de esfera, rotación de disco, disco artístico, revelado recursivo), frames deterministas, presets cíclicos cerrados, GIF y WebM reales con progreso/cancelación y persistencia JSON. animation.test + animation.spec|
|7 · cierre|**Verificada**: FULL 34/1168/215/16, auditoría AC-01–AC-25 en ACCEPTANCE_V30.md, comandos de paleta, UX 1440/390 sin scroll y ejemplo esférico en galería|

**V3.1 queda después de v3.0.** Su PRD exige esa dependencia y no se implementó
PHP ni publicación de creaciones. El documento nuevo se conserva localmente sin
incluirlo accidentalmente en esta entrega.

## Para revisar

1. Abrir el estudio corregido y cambiar el ancho60→61→60.
2. Explorar la galería, especialmente Geometría funcional, Figurativas y Poincaré.
3. Cambiar colores/parámetros de una composición, alternar familias/recetas y volver.

Aplicación: `http://<IP_LOCAL>:4173`. Monitor y feedback:
`http://<IP_LOCAL>:4174`. Ambos servicios originales siguen activos. El monitor
pausa automáticamente sólo por la ventana primaria de cinco horas; el secundario
avisa y Pablo decide si usa un banked reset. El feedback recibido durante la pausa
queda encolado para la reanudación.

## Git

Publicados previamente:6b71fca (borrado),c3f8bfa (uniones/estudio corregido),
c0d4e40 (parpadeo). El commit que contiene este informe reúne galería, geometría
funcional y exploración reversible; su hash se informa a Pablo al terminar el push.
