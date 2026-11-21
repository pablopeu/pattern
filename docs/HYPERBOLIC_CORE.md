# Núcleo Poincaré · avance parcial de Fase4

Implementación pura en src/hyperbolic, sin React/DOM. Todavía no hay selección
de representación hiperbólica en la interfaz ni contrato nativo/exportador para
ella. Este incremento NO completa AC12/Fase4. Los diagnósticos no son ejemplos
públicos de la galería ni exportaciones de una función terminada.

## Modelo y límites

Polígonos regulares {p,q}, enteros3–12, (p−2)(q−2)>4. Curvatura−1;
ángulo interior2π/q y áreaπ(p−2−2p/q). Isometrías SU(1,1), reflexiones en lados,
BFS con deduplicación del centro a1e−8, geodésicas circulares ortogonales al
borde o diámetros. Radios/cotas son coordenadas adimensionales del disco.
El borde representa infinito: nunca se genera una teselación infinita completa.

Hasta4096 polígonos, profundidad8, radio de búsqueda≤0,995; límites de
profundidad/presupuesto y candidatos numéricamente inválidos se reportan.
La selección usa distancia mínima del **polígono geodésico**, no sólo su centro:
una tesela de centro periférico puede alcanzar el área visible. Adyacencias se
reconstruyen por extremos compartidos, incluso en la última capa. Fase4 aún
necesita cámara hiperbólica, tamaño mínimo proyectado y presupuestos globales
para el contenido. La proximidad al borde puede alcanzar la resolución numérica;
las cotas máximas no prometen que cada combinación llegue al radio solicitado.

Cada polígono tiene un marco directo canónico: traslación a su centro y fase
módulo2π/p. Evita que cambiar recorrido/profundidad rote un motivo asimétrico.
Esto no reclama la simetría completa del grupo para cualquier dibujo adaptado.
Fuente normalizada mediante todo su polígono de control dentro de0,85 del
inradio euclidiano, sin modificarla ni recortarla silenciosamente.

Las geodésicas se escriben como arcos SVG reales. El núcleo de referencia
aproxima con segmento los casos casi diametrales (radio>1e5); el modelo es exacto,
su cálculo/renderización es numérico. No atribuir la cota de curvas al trazado
interno de geodésicas ni a operaciones booleanas futuras.

## Cota de adaptación de curvas

Para una Bézier cúbica C=(A,B,C,D), sea δ el máximo de las distancias de B y C
a los controles de la interpolación lineal A→D (fracciones1/3 y2/3).
Con r=máximo módulo de sus controles<1 y f(z)=(αz+β)/(β̄z+ᾱ),
u=|α|−|β|r>0, Δ=||α|²−|β|²|:

- L=Δ/u² acota |f′| en el casco convexo de controles.
- M=2|β|Δ/u³ acota |f″|.
- Error uniforme a la cuerda proyectada≤Lδ+M|D−A|²/8.

También sirve con conjugación/reflexiones. Subdivisión de Casteljau hasta cumplir
la tolerancia; falla explícitamente si no alcanza la profundidad/presupuesto.
No usa solamente el punto medio, que puede ocultar lazos o curvas en S.
La tolerancia física se divide por el radio físico del disco. No se aproximan
los trazos con ancho constante después del mapeo: falta convertirlos a contornos
antes de la transformación no lineal y sumar sus errores al presupuesto total.
La fuente plana, sus estilos y metadatos deben conservarse intactos.

## Evidencia reproducible

`npm run check`:704 pruebas y TypeScript,27 nuevas: seis pares representativos,
ángulos/lados/área, ciclos de vértice, adyacencias recíprocas, marco estable,
inversas/reflexiones/distancia, límites, normalización y error contra2001 muestras
por curva/isometría (incluidos S/lazo/periferia). Hashes upstream verificados.

Con LAN4173 activo:

```bash
node scripts/validate-v30-hyperbolic.mjs
.runtime/validation-env/bin/python scripts/validate_v30_hyperbolic.py
```

La segunda orden requiere CairoSVG y Pillow en un entorno local. Los artefactos
quedan en .runtime/hyperbolic-proof, sin publicarse. Seis pares {3,7},{7,3},
{4,5},{5,4},{8,3},{12,12},70–337 celdas; contorno original relleno de un pez,
cota≤0,01mm en disco200mm,45578–95878 píxeles de motivo con tinta. CairoSVG
interpreta arcos SVG y los compara con96 muestras/lado obtenidas por interpolación
compleja Möbius independiente: error medio máximo0,029/255 a907²px. Fuera del
disco queda transparente. Son diagnósticos de rellenos; no prueban aún estilos,
exportación completa, continuidad de bordes de motivos ni el flujo UI.

## Continuación requerida

Separar representación derivada de generador. Contrato nativo con migración pura
y rechazo de lector anterior; modo geométrico frente a artístico explícitos,
fuente plana editable/regreso/actualización; sin edición directa sobre el disco.
Añadir cámara/isometría/LOD, adaptación de contornos y trazos completos, interfaces
sin scroll en cuatro resoluciones, ejemplos editables, SVG/raster/DXF y mediciones
físicas independientes. Sólo entonces auditar AC12–13/Fase4.
