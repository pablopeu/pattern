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
los trazos con ancho constante después del mapeo: src/hyperbolic/source.ts ya los convierte a contornos
antes de la transformación no lineal. El reporte separa la cota certificada de
proyección de la tolerancia solicitada al contorneador existente (estimación,
no garantía certificada de todo el flujo).
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

## Adaptador de fuente plana

prepareDiskSource consume un recorte finito preparado de hasta256 geometrías,
no una red infinita/proyecto completo. Respeta transformaciones, visibilidad,
reglas de relleno/huecos, opacidades, dash, perfiles de ancho, caps y joins.
Rellenos primero y todos los contornos de líneas encima; una Bézier abierta
no recibe cierre de relleno implícito. Geometrías fuente no se modifican.
Hasta4096 curvas por defecto/24000 máximo; proyección con presupuesto de
segmentos global compartido por todas las curvas, error explícito al excederlo.

711 pruebas/TypeScript;7 pruebas adicionales de fuente, conservación, estilos,
medidas físicas y límites. Diagnóstico independiente:

```bash
node scripts/validate-v30-hyperbolic-source.mjs
.runtime/validation-env/bin/python scripts/validate_v30_hyperbolic_source.py
```

CairoSVG comprueba transparencia del hueco, cuerpo azul y contorno variable
magenta bajo identidad, traslación periférica y reflexión; fuente intacta, sin
relleno rojo de la línea abierta. Proyección≤0,005mm en disco200mm. Certificación
sólo del paso cúbica→polilínea; no afirmar precisión certificada de primitivas
convertidas por Paper ni del contorneado. Faltan preparación desde escena,
recortes/Fill vinculados, presupuesto compartido entre celdas, UI/nativo/export.

## Cámara y detalle del núcleo

717 pruebas/TypeScript y build correctos. Cámara como isometría SU(1,1),
centro de norma≤0,9 y orientación en radianes. La celda inicial se obtiene
plegando el centro de vista al triángulo fundamental: no se consume el
presupuesto recorriendo desde el origen anterior. Marcos/IDs de mundo se
conservan; display contiene marco/centro/vértices transformados.

visibleHyperbolicCells omite proyecciones de motivos cuyo círculo hiperbólico
circunscrito tiene diámetro euclidiano menor al umbral. Es una cota conservadora:
no se infiere tamaño de sólo una arista. No acelera todavía el BFS geométrico,
que sigue limitado por profundidad/celdas/radio. El consumidor debe transformar
con cell.display.frame cuando hay cámara; cell.frame conserva el marco fuente.

Seis pruebas de cámara/LOD y dos diagnósticos adicionales de cámara periférica
{3,7}/{7,3}:70/343 celdas, arcos CairoSVG vs interpolación independiente con
error medio≤0,027/255. Todos los modelos originales siguen correctos.

## Compositor derivado acotado

deriveDisk prepara la fuente una vez, genera el parche visible y proyecta con
un presupuesto de segmentos compartido entre TODAS las celdas (250000 por
defecto, máximo1000000). Un exceso falla sin entregar resultado parcial ni
modificar la fuente. Reporta modelo EXACT/curvatura−1 por separado del motivo
APPROXIMATED, bordes no garantizados, cota de proyección, estimación de contornos,
truncamiento geométrico y omisiones LOD. No afirma un patrón seamless del motivo.

diskPreviewSVG produce un diagnóstico con medidas físicas, metadatos XML
escapados, agujeros y recorte al disco. No está conectado al exportador del
producto ni reemplaza la conservación del proyecto nativo. Prueba reproducible:

```bash
node scripts/validate-v30-hyperbolic-source.mjs
node scripts/validate-v30-hyperbolic-pipeline.mjs
.runtime/validation-env/bin/python scripts/validate_v30_hyperbolic_source.py
```

905 pruebas/TypeScript:4 de compositor y184 adicionales auditan los92 pares
admitidos (3≤p,q≤12): ciclo completo deq polígonos en vértice/adyacencias raíz
y cámara en centro de norma0,9, sin errores numéricos reportados. Dos discos
de85 celdas con fuente compuesta, hueco y perfil variable:43273/43206 segmentos
dentro del presupuesto150000. CairoSVG confirma huecos, colores y ancho variable
por ambos lados bajo cámara centrada/desplazada; mapeo≤0,005mm. No se confunde
esta cota con precisión total del contorneador.

Faltan selección/preparación desde escena, recortes/Fill vinculados, contrato
nativo/migraciones, interfaz/worker/cancelación, modo artístico, ejemplos públicos
y exportaciones finales SVG/raster/DXF. Este núcleo no completa Fase4.

## Worker cancelable

deriveDiskInWorker ejecuta cada trabajo en un worker propio, terminado al
resolver, fallar o abortar. AbortSignal evita iniciar trabajos ya cancelados y
detiene trabajos activos; permite reemplazar fuente/vista sin bloquear la UI.
Todavía no está conectado a controles de la aplicación ni persistencia nativa.
`node scripts/validate-v30-hyperbolic-worker.mjs` verifica en Chromium real85
celdas,21 ticks de respuesta durante el cálculo observado, fuente intacta,
cancelación previa/activa, error de modelo inválido y nuevo trabajo posterior.
905 pruebas/TypeScript correctos. Error {p,q} se valida antes de preparar fuente.

## Fuente finita tomada de la escena plana

`prepareFlatDiskSource` utiliza la ruta explícitamente plana del exportador,
con un conjunto confirmado y selección de ventana (incluido origen X/Y), celda
rectangular, celda de red o dominio fundamental. Expande las copias que cruzan
el recorte, resuelve Fill vinculados y materializa el interior de teselas físicas.
No edita el documento ni convierte una región finita en un teselado seamless.

El contorneado se hace sobre el trazo original antes de recortarlo: conserva
fase de guiones, perfil de presión, terminaciones y uniones. `ClippedPaint`
transporta ID de fuente y rol relleno/trazo incluso a través de la materialización
interna de teselas. La normalización para el disco conserva agujeros, reglas y
opacidades; todos los rellenos quedan debajo de las líneas. No vuelve a
contornear regiones que ya representan líneas.

Presupuestos explícitos:256 regiones de pintura por defecto (máximo512),4096
cúbicas por defecto (máximo24000), además de los límites previos de escena y
exportación. La salida se rechaza entera si excede un presupuesto o está vacía.
No se promete que estos límites aceleren por sí solos toda operación booleana.
`derivePreparedDisk` verifica que la fuente se preparó para los mismos p/q.

La cota certificada corresponde únicamente al mapeo de las cúbicas resultantes.
`hasUncertifiedClippingStep` distingue las operaciones numéricas de Paper de esa
cota; `hasUncertifiedOutlineStep` y la estimación del contorneado se conservan
aunque los trazos ahora sean regiones rellenas. El informe de preparación
incluye ventana real, tolerancia solicitada, IDs, advertencias y precisión no
certificada. No declarar una precisión total certificada del proceso.

`deriveProjectDiskInWorker` prepara la escena y proyecta dentro del mismo worker
desechable: el hilo de UI no hace la expansión/recorte de la fuente. Conserva
cancelación previa/activa y recuperación posterior. Verificaciones reproducibles:

```bash
node scripts/validate-v30-hyperbolic-worker.mjs
node scripts/validate-v30-hyperbolic-flat-source.mjs
```

946 pruebas/TypeScript correctos;8 nuevas cubren huecos/opacidades, recorte con
origen, guiones/presión, fuentes fuera de celda, procedencia de líneas en teselas,
Fill real entre dos Bézier unidas en copias P3, presupuestos y p/q incompatibles.
Chromium verifica85 celdas del worker de proyecto, fuente intacta y procedencia;
la prueba de SVG/raster genera29 celdas y comprueba píxeles reales de hueco
transparente, relleno azul y línea oscura, con cota de proyección≤0,005mm.
Artefactos reproducibles en `.runtime/flat-source-proof.{svg,png}`.

Todavía faltan contrato nativo, interfaz pública, modalidad artística, ejemplos
de galería y exportaciones integradas; este incremento no completa Fase4.


## Vista geométrica integrada y contrato nativo

La visualización tiene su propio registro version1/kind poincare, separado de
Generator y de su versión. JSON7 migra desde6 sin agregar visualización ni
cambiar geometrías/generadores. Guarda fuente/celda/ventana, p/q, cámara, detalle,
medidas y precisión; el resultado no se guarda como fuente sustituta. Un ID
fuente inexistente, versión/tipo desconocido, p/q no hiperbólicos o presupuesto
inválido se rechazan. Eliminar el conjunto fuente retira su visualización.

La vista modal es no editable. Se regenera al entrar/recargar; Actualizar aplica
los parámetros nuevos, aborta el worker anterior y prepara la fuente actual.
Volver a la fuente sólo desactiva la visualización y conserva sus parámetros.
Cálculo y rasterización tienen cancelación, sin publicar resultados tardíos.
Opciones sin actualizar deshabilitan descarga/guardado; los datos inválidos no
reemplazan la configuración válida. El guardado usa el diálogo existente y la
misma persistencia local/portátil del estudio.

SVG conserva diámetro2R mm y metadatos de preparación/proyección; PNG/JPEG usan
el rasterizador físico con DPI/pHYs/JFIF, límite64M píxeles y cancelación. PNG
transparente, JPEG blanco. Exportar del editor conserva su alcance plano; la
vista derivada ofrece sus propias descargas y no ofrece DXF. Modelo exacto
frente a adaptación aproximada/bordes no garantizados visibles en UI y metadatos.

Dos ejemplos originales con fuentes Bézier/detalles editables: peces {7,3},
100 celdas/170477 segmentos; aves {5,4},100 celdas/119989 segmentos; presupuesto
250000 y proyección0,03mm. Miniaturas generadas por el mismo worker que la vista,
no imágenes externas. Capture-poincare-examples y capture-poincare-studio generan
JSON/miniaturas/capturas reproducibles. Motivos existentes se movieron a motifs.ts
para compartir sus fuentes sin dependencias circulares ni copiar otro dibujo.

952 unidades/TypeScript y5 E2E específicas correctas (escritorio/móvil, datos
inválidos, vuelta a fuente, guardado/reapertura, SVG/PNG/JPEG físicos, cancelación
y galería). validate-v30-older-reader.mjs abre el build real anterior JSON6 y
comprueba que rechaza un documento JSON7; no simula el lector ni permite una
caída silenciosa a plano. Requiere conservar ese build en una carpeta local.

Continúan pendientes proyección artística, correspondencia canónica de bordes
pareados, coloración por clase y auditoría restante de Fase4. La vista geométrica
integrada por sí sola no completa el PRD. Fases5–7 pendientes.
