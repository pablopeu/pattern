# Adaptación por cámaras reflejadas · diseño pendiente

Este documento describe el siguiente criterio pendiente de Fase4. No es todavía
una función implementada. La adaptación pública actual inscribe el motivo dentro
de cada celda y declara correspondencia de bordes NO garantizada.

## Objetivo y alcance

Ofrecer un modo adicional que repita una fuente rectangular dentro de las2p
cámaras fundamentales de cada polígono {p,q}. Las cámaras vecinas se obtienen
por reflexión y comparten una representación canónica de sus bordes. El motivo
se adapta y adquiere simetrías adicionales; no conserva en general su simetría
plana ni derivadas a través del borde. La construcción del teselado permanece
geométrica; la adaptación del motivo sigue siendo APPROXIMATED. Distinguir C0
(posición/intervalos coincidentes) de una garantía C1 que no se ofrece.

Una ventana rectangular/celda rectangular puede contener un patrón de teselas
encastrables. No intentar sustituir directamente cualquier polígono IH no
convexo por un polígono hiperbólico usando una única matriz afín de seis coeficientes.

## Dominio fuente y mapa

Preparar pinturas con la ruta plana existente y normalizar su rectángulo de
recorte a [0,1]², conservando contornos y trazos antes de cualquier deformación.
Para una cámara, O es centro del polígono, E punto medio geodésico de una arista,
V uno de sus extremos. En coordenadas Klein usar K(z)=2z/(1+|z|²), y M=V/2.

La fuente tiene cuatro esquinas: (0,0)→O, (1,0)→E, (1,1)→V, (0,1)→M.
La diagonal x+y=1 divide el cuadrado en dos triángulos no degenerados:

```
T0(x,y) = xE + yM                              (x+y≤1)
T1(x,y) = (V−M)x + (V−E)y + E+M−V             (x+y≥1)
P(k) = k/(1+sqrt(1−|k|²))
F = isometría_de_celda ∘ P ∘ T
```

Los dos mapas afines coinciden en la diagonal. El cuadrado se convierte en la
cámara triangular sin colapsar media fuente. Iterar ambas cámaras O/E/Vi y
O/E/Vi+1 por arista; aplicar las isometrías existentes de cada celda.

## Precisión

Para r=max|T(hull)|<1 y s=sqrt(1−r²), P admite L≤1/s y M≤6/s³. Componer
con las cotas Möbius existentes y la norma de la parte lineal de T:
Ltotal=Lf·LP·||T||; Mtotal=(Mf·LP²+Lf·MP)·||T||².
Si el hull está a un solo lado de la diagonal, aplicar Lδ+M|D−A|²/8.
Si cruza la diagonal, la función es continua y Lipschitz pero su derivada puede
saltar: usar la cota conservadora L(δ+|D−A|/2), que converge al subdividir.
Acotar el radio con vértices del rectángulo de controles partido por la diagonal;
si no se verifica dominio de Klein, subdividir antes de aceptar. No extrapolar
una cota de segundo orden a través del quiebre.

## Bordes compartidos y SVG

Identificar bordes por tipos O/E/V y extremos globales canónicos. Usar caché de
puntos en esquinas/parametrización y caché de curvas de borde por ID de borde y
contorno/path/cúbica de la fuente. Reutilizar las mismas polilíneas en ambos
vecinos; dos cálculos adaptativos independientes pueden elegir subdivisiones
distintas aunque describan la misma geodésica. Contabilizar segmentos emitidos
también al reutilizar caché; mantener presupuesto global y fallo atómico.

Las coordenadas de fuente sobre x=1 corresponden a E→V; y=0 a O→E; x=0 e y=1
son las dos mitades O→M→V. Las esquinas deben usar los puntos globales canónicos,
incluido el E compartido por ambos polígonos. Registrar desajustes numéricos por
separado de la cota de curvas y no redondear geometría para ocultar errores.

Agrupar subpaths del mismo contorno/color/opacidad en una sola pintura SVG a
través de cámaras/celdas, manteniendo rellenos debajo de trazos. Evitar costuras
de antialias/transparencia al pintar polígonos vecinos por separado. Coloración
intencional por celda puede cambiar colores entre vecinos; no confundirla con
continuidad geométrica de bordes.

## Verificaciones requeridas antes de declarar el criterio completo

- Dominio sin pliegues, extremos/áreas de los dos triángulos y muestras densas a
  ambos lados de la diagonal; radio/dominio/tolerancia/budgets validados.
- Ciclos alrededor de vértice y vecinos con el mismo borde/polilínea real, no
  sólo IDs. Lazos y curvas que cruzan la diagonal. Fuente intacta.
- SVG/raster independientes, incluida opacidad parcial uniforme sin costuras,
  pintura que cruza el borde E/V y huecos. Exportación física real.
- Worker/cancelación/LOD/recursos:2p cámaras multiplican el costo. Mostrar límites
  y ofrecer ajuste; no truncar contenido silenciosamente por exceso global.
- UI/nativo con adaptación actual predeterminada, capacidad rechazada por lector
  anterior, ejemplos reproducibles, móvil y empaquetado en subcarpeta.

## Referencias matemáticas consultadas

Los grupos triangulares por reflexión y su teselación se contrastaron con la
Definición11/Teorema14 de [Tschanz, The Steklov Problem on Triangle-Tiling Graphs
in the Hyperbolic Plane (2023)](https://link.springer.com/article/10.1007/s12220-023-01208-x).

También se consultó el resumen de autores de [Ouyang et al., Visualization of
Escher-like hyperbolic tessellations (2026)](https://scholars.cityu.edu.hk/en/publications/visualization-of-escher-like-hyperbolic-tessellations/)
como referencia conceptual de adaptación de plantillas. Las particiones, cotas
y estrategia de caché propuestas arriba son diseño local pendiente de pruebas;
no se incorporaron plantillas, figuras ni código de ese artículo.


Nota de implementación: preferir identidad topológica a redondeo de coordenadas.
Un borde E puede identificarse por el par de celdas vecinas; unir vértices V con
DSU al recorrer esas adyacencias y elegir representantes canónicos. Las O usan
IDs de celda. Transformar una sola vez esos puntos a la cámara y compartirlos;
registrar la discrepancia numérica observada. Evitar fusionar vértices distintos
cerca del borde por cuantizar coordenadas globales con una tolerancia fija.
