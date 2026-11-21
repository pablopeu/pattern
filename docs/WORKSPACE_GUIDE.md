# Cómo se organiza el espacio de trabajo

Guía de la interfaz después del feedback de navegación del21/11/2026.

## Barra izquierda y panel derecho

La izquierda tiene **Simetrías, Teselas, Capas y Preferencias**. Las entradas
Dibujo/Formas se retiraron: repetían accesos que ya están en la barra de herramientas
y en el panel derecho. El hexágono con **+** crea un polígono regular y abre sus
parámetros en **Objeto → Forma**; líneas, lápiz, Bézier y figuras se eligen directamente.
Color/grosor están en Trazo; color de relleno en Fill; propiedades de una figura en Objeto.

Aplicación tampoco tiene otra entrada izquierda. **Aplicar**, arriba, abre directamente
sus controles de perímetro y colocación. En móvil se cierra antes el panel derecho.

## Los dos controles de simetría

**Cambiar simetría en** decide a quién afectan los cambios:

- **Este conjunto:** modifica sólo el conjunto activo. Si usaba la compartida,
  al editarlo pasa a tener una propia, conservando la configuración de partida.
- **Compartida:** modifica la configuración común. Sólo la siguen los
  conjuntos que eligieron usarla; los de simetría propia permanecen independientes.

**Repetición de este conjunto** decide de dónde toma su simetría:

- **Propia:** parámetros independientes para ese conjunto.
- **Compartida:** sigue la configuración común del proyecto.
- **Sin repetir:** dibujo libre, sin las copias del grupo.

No son dos selectores del mismo dato. Uno elige qué vas a editar; el otro decide
si ese conjunto tiene configuración propia, usa la compartida o no se repite.

## Explorador, recientes y favoritos

El explorador conserva las miniaturas y sus estrellas. También hay una estrella
junto al botón del explorador: marca o desmarca la simetría actual sin abrir el
catálogo. Los favoritos aparecen al marcar el primero. Recientes y favoritos
se conservan en este navegador; no agregan trazos ni cambian el proyecto.

## Orientación, origen y cierres

**Grupo y red → Orientación y origen** reúne los tres deslizadores. **Tamaño de red**
agrupa ancho/alto/ángulo de celda; abrir un grupo cierra el otro para que los controles
quepan sin scroll. La orientación tiene ajuste fino dependiente del orden de rotación:
en P3, provisionalmente±6°, según el ejemplo recibido. La entrada numérica permite
otros ángulos y conserva los valores de los estudios existentes. Origen X/Y tienen
un recorrido fino de una anchura de celda hacia cada lado, además del campo numérico.

Al desplazar o girar una red sin tesela física, el motivo y el marco se transportan
juntos. Esto corrige el caso de dos Bézier cerradas en copias diferentes que se
separaban al cambiar el origen o la orientación. Se mantienen nodos, tangentes,
uniones y rellenos vinculados; guardar/abrir y deshacer conservan el resultado.
El marco de una tesela física y cambiar el tamaño de una red son operaciones distintas.

## Teselas

Las familias están a la vista: **Encastre, Aperiódicas y Girih**, con iconos.
En Encastre podés activar teselas geométricas o abrir directamente el catálogo IH.
Antes de activarlas no aparece la pestaña Forma aislada; después, Forma/Colocación/
Bordes/Tangentes tienen sus controles. Crear un estudio tras editar bordes vuelve
correctamente al inicio de Teselas, sin dejar el panel vacío.

## Objetos, conjuntos y candado

**Capas → Objetos** enumera las geometrías fuente: trazos, figuras y rellenos. Por
eso un dibujo puede ocupar varias filas. El ojo controla visibilidad. El candado
mantiene el objeto visible y evita seleccionarlo, editarlo o borrarlo por accidente;
al bloquearlo se quita de la selección. El propio candado permite desbloquearlo.

**Conjuntos** enumera contenedores de geometría. Cada conjunto puede contener
muchas áreas cerradas, líneas y rellenos. Dibujar otra área no crea otro conjunto:
se agrega al activo. **Nuevo conjunto** crea uno explícitamente. **Conjunto activo**
indica dónde se agregan los próximos trazos y qué configuración estás editando.
La etiqueta de cada fila muestra también cuántos trazos contiene.

## Diseño, Patrón y Aplicar

- **Diseño:** edición del motivo; permite la vista dividida con una celda a la izquierda.
- **Patrón:** vista única del patrón completo. También permite editar; comparte
  el mismo documento y herramientas con Diseño. No es otro archivo ni otra copia.
- **Aplicar:** coloca y recorta el patrón dentro de un perímetro cerrado, sin deformarlo.

Diseño y Patrón siguen siendo vistas de énfasis del mismo trabajo. Los títulos de
los botones explican esa diferencia; Aplicar tiene un propósito distinto.
