# Geometría y simetrías

## Coordenadas y tolerancias

- Unidad canónica: **milímetro**. X a la derecha, Y hacia abajo (convención SVG).
- SVG: `width/height` en mm; `viewBox` en coordenadas canónicas. DXF invierte Y y declara `$INSUNITS=4`, `$ACADVER=AC1015`.
- Visualización: `mm × zoom → píxeles CSS`; el zoom no modifica el documento. Las conversiones son 1 cm=10 mm, 1 in=25,4 mm, 1 px=25,4/96 mm.
- Cálculo IEEE-754 de doble precisión. `EPS=1e-8` para inversas y equivalencias; pruebas de cierre usan 1e-7 por composición. JSON no redondea coordenadas; los inputs sólo redondean su presentación.
- Las operaciones Clipper generales usan enteros a 100.000 unidades/mm (cuantización de 0,00001 mm). El contorneado de trazos eleva esta escala según la tolerancia física requerida, con límites numéricos explícitos. La tolerancia de exportación predeterminada es 0,05 mm y es configurable. El contorneado reduce su tolerancia local según la máxima escala de la matriz para respetar la tolerancia física.

Matriz SVG `[a,b,c,d,e,f]`:

```
x' = a·x + c·y + e
y' = b·x + d·y + f
```

`multiply(A,B)` aplica primero B y después A. Las matrices singulares se rechazan al abrir documentos. Reflexiones y rotaciones tienen inversas y forman parte del mismo motor afín.

## Wallpaper groups

Los generadores se definen en coordenadas fraccionales `(u,v)` de la red. Se calcula su cierre módulo traslaciones enteras, con deduplicación numérica. Se conjugan mediante `B·g·B⁻¹` para obtener isometrías del documento.

Notación: `R2=(-u,-v)`, `R4=(-v,u)`, `R6=(-v,u+v)`, `R3=R6²`, `Mx=(u,-v)`, `My=(-u,v)`, `S=(v,u)`.

| Grupo | Generadores | Operaciones por celda primitiva |
|---|---|---:|
| p1 | identidad | 1 |
| p2 | R2 | 2 |
| pm | Mx | 2 |
| pg | `(u+1/2,-v)` | 2 |
| cm | S sobre red rómbica primitiva | 2 |
| pmm | Mx, My | 4 |
| pmg | Mx, `(-u+1/2,v+1/2)` | 4 |
| pgg | `(u+1/2,-v)`, `(-u,v+1/2)` | 4 |
| cmm | S, R2 sobre red rómbica primitiva | 4 |
| p4 | R4 | 4 |
| p4m | R4, Mx | 8 |
| p4g | R4, `(u+1/2,-v+1/2)` | 8 |
| p3 | R3 | 3 |
| p3m1 | R3, S | 6 |
| p31m | R3, `(u+v,-v)` | 6 |
| p6 | R6 | 6 |
| p6m | R6, S | 12 |

`cm/cmm` se expresan sobre **celda primitiva**, por eso sus órdenes son 2/4; una celda rectangular convencional contiene dos primitivas. `p3m1` y `p31m` tienen distintas familias de espejos sobre la misma red, comprobadas como grupos diferentes.

## Redes

- p1/p2: `a=(w,0)`, `b=(h cosθ,h sinθ)`; θ entre 15° y 165°.
- Grupos rectangulares: `a=(w,0)`, `b=(0,h)`.
- p4/p4m/p4g: red cuadrada, alto efectivo w.
- p3/p3m1/p31m/p6/p6m: `a=(w,0)`, `b=(w/2,√3·w/2)`.
- cm/cmm: `a=(w/2,h/2)`, `b=(-w/2,h/2)`.

Las redes triangulares tienen supercelda rectangular `a` y `2b-a`, de dimensiones `w × √3w`. cm/cmm usan `a-b` y `a+b` para su rectángulo convencional. Para redes oblicuas arbitrarias no se promete una supercelda rectangular: se exporta el paralelogramo verdadero o una región finita.

La región fundamental se calcula como celda Dirichlet de un punto genérico de la órbita, recortando semiplanos. Una reducción de Gauss de la red permite considerar vecinos cercanos incluso en bases muy oblicuas. Se prueba que su área sea `área(celda primitiva)/orden` para los 17 grupos.

## Frisos y grupos radiales

La nomenclatura de frisos es `p1, p11g, p1m1, p11m, p2, p2mg, p2 mm`. El eje de repetición es X y la traslación es `(w,0)`. Los espejos paralelos/perpendiculares y deslizamientos de media longitud se documentan en las descripciones del selector. No se agrega una traslación artificial en Y.

Cn contiene n rotaciones; Dn añade n reflexiones, con n entre 2 y 64. El centro es editable. Las rosetas son finitas, sin afirmar periodicidad de traslación.

## Generadores y periodicidad

`PERIODIC_SEAMLESS` indica una construcción mediante red/grupo compatible. Para un friso se refiere a una dirección y la interfaz lo aclara. `FINITE_NONPERIODIC` se usa para radial y Penrose. `UNVERIFIED` identifica una red/grupo que no pudo verificarse.

Warp Grid deforma la **fuente antes de tomar su órbita**, por lo que conserva la simetría seleccionada. No ofrece un warp global arbitrario como si preservara espejos o giros. Freeform Arrangement conserva matrices de colocación manual; el jitter de Warp Freeform usa Mulberry32 con semilla explícita. Las semillas y versión del generador forman parte del proyecto.

Penrose genera un parche P3 finito mediante subdivisión de triángulos de Robinson y razón áurea. No se repite como wallpaper ni se exporta como celda seamless. Las curvas trocoidales sólo se cierran si sus extremos coinciden numéricamente; radios inconmensurables no reciben un cierre artificial.

## Regiones y recorte

Los perímetros pueden ser paths Bézier, paramétricas convertibles o compound paths. Los agujeros se conservan mediante fill-rule y orientación del resultado booleano. Las formas independientes de un perímetro se unen respetando el fill-rule de cada una. Los agujeros pertenecen a paths compuestos o se crean con Diferencia; una forma separada dentro de otra no crea un agujero por accidente. Cada aplicación puede referir a un perímetro diferente.

La vista usa clipPath no destructivo. Expanded SVG calcula intersecciones reales y no incluye máscaras ni instancias. Convierte trazos a regiones por defecto; una Bézier abierta sin contorneado se recorta con `intersect(trace:false)`. En ese modo opcional se conserva la línea central, y los caps/anchos no equivalen al contorno material recortado; para contornos exactos usar la opción predeterminada.

Las operaciones booleanas exigen regiones cerradas. Si el resultado es vacío se informa y se conservan las fuentes. Un SVG abierto importado como perímetro se rechaza, nunca se cierra silenciosamente.

## Simetría y captura en v2

Libre corresponde a la operación identidad única y a `FREE_NONPERIODIC`. `FINITE_NONPERIODIC` se reserva para radial y Penrose finito, incluso si este último guarda una configuración Libre. p1 conserva sus dos traslaciones.

Para una red con base B, origen O y orientación R, la nueva base es R·B y las operaciones afines se conjugan por T(O)·R. En radial se conserva el centro propio de rotación/reflexión. El origen desplaza el marco matemático, sin trasladar las fuentes. La región fundamental se obtiene del mismo conjunto de operaciones; su área sigue siendo el área primitiva dividida por el orden del cociente.

La captura emplea la inversa de C=G·P·Q, congelada al primer punto. Cada coordenada de puntero se transforma al espacio canónico antes de crear nodos/tangentes. Un cruce de celda no recalcula C. Las fuentes permanecen absolutas al pasar de una red rectangular a una triangular; el ajuste explícito a celda sólo compone una matriz P adicional.

La celda común de una composición se certifica únicamente para períodos rectangulares compatibles (hasta 1024 múltiplos y tolerancia relativa 1e-7). Otros casos se exportan como región finita; no se afirman inexistencia matemática ni continuidad sin verificar.

## Teselas editables y adyacencia

La cobertura es independiente de la simetría local del motivo. Para cuadrados/rectángulos/paralelogramos se usan dos bordes maestros y sus opuestos trasladados con recorrido inverso. La red tiene u=(w,0), v=(shear,h); square usa h=w y sólo parallelogram usa shear.

El hexágono regular tiene tres pares opuestos por traslación, red u=(3r/2,√3r/2), v=(0,√3r). El triángulo equilátero usa u=(w,0), v=(w/2,√3w/2) y dos orientaciones por celda, relacionadas por H(x)=u+v−x. Cada borde triangular debe coincidir con su media vuelta alrededor del punto medio. Por eso su segunda mitad se deriva de la primera, invirtiendo recorrido y transformando ambas tangentes. No se permite una curva triangular arbitraria que rompa esa condición.

Los vértices se fijan y los controles Bézier quedan en corredores convexos conservadores. `tilingIssue` verifica encastre de la construcción, autointersecciones, área y solapamiento con vecinos. Las pruebas independientes suman áreas de intersecciones con un rectángulo de prueba y verifican cobertura completa para bases rectas y curvas. No se afirma un clasificador universal.

El marco de tesela F compone origen y orientación. La captura completa es C=F·T_red·H_orientación·J_adyacencia·G_local·P·Q; el objeto añade S. Se conserva C⁻¹ durante el gesto. Los fragmentos que cruzan un borde se continúan mediante isometrías de adyacencia antes del recorte a la tesela, conservando una sola fuente. Esto también se usa al exportar. El grupo seleccionado genera el motivo local antes de ese empaquetado; no se promete que toda su simetría sea global para cualquier forma de tesela.

La cobertura de teselas sí certifica sus traslaciones. Las celdas rectangulares se ofrecen para cuadrados/rectángulos y superceldas verificadas de triángulos/hexágonos, en orientaciones de múltiplos de 90°. Los paralelogramos oblicuos conservan su celda de red sin deformarla a un rectángulo. Penrose suspende la familia periódica y conserva su construcción finita.

## Trazo físico y Fill · v2.2

El perfil usa anchos relativos de 0 a 4 a lo largo de la longitud normalizada, con interpolación Hermite monótona para evitar overshoot. Los puntos están estrictamente ordenados e incluyen 0 y 1. Los guiones son longitudes físicas no negativas, hasta 64 valores y período mínimo 0,001 mm; una secuencia impar se repite. Los segmentos de longitud cero requieren extremos round/square. Se conserva fase negativa.

El contorno evalúa tangentes/normales cúbicas por lado de cada unión y refina eje y bordes. La tolerancia local se divide por la cota singular de la matriz total, incluidas colocaciones externas de templates. Cuantización al menos 100.000 y hasta 1.000 millones de unidades/mm; enteros efectivos no superan 1e14. Si la precisión no es representable se rechaza, sin fingir precisión mediante un clamp. Presupuestos: 24.000 muestras,100.000 polígonos,400.000 vértices,4.096 curvas,2.048 segmentos pintados y4.096 subdivisiones de arco. SVG expande los puntos de longitud cero para evitar diferencias nativas entre Chrome y CairoSVG.

Fill utiliza ejes vectoriales materiales, no raster ni overlays. El epsilon de unión numérica es 1e-6 mm; el cierre ampliado 0–5 mm es explícito y sólo altera el cálculo derivado. Presupuestos por disposición: 1.200 curvas/entradas,20.000 intersecciones,40.000 medias aristas y2.000 caras. Las aristas coincidentes se normalizan y los agujeros se orientan para respetar evenodd/nonzero. La selección de cara y su vínculo se basan en referencias topológicas y contexto; un punto aproximado no prueba equivalencia.
