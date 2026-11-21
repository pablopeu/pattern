# Disco artístico · núcleo derivado

Este núcleo de Fase4 produce una deformación radial de una fuente plana finita.
No construye una teselación hiperbólica ni declara preservar simetría, ángulos,
áreas, longitudes o correspondencia de bordes. Su informe usa ARTISTIC y
hyperbolicTessellation=false. La interfaz ofrece esta modalidad junto a Poincaré y guarda su registro nativo
version1/kind artistic-disk dentro de JSON7.

## Fuente y mapa

prepareFlatPaintSource comparte la escena/recorte del exportador plano con
Poincaré. preparePaintSource conserva los IDs y los roles de pintura, huecos,
reglas/opacidades, contorneado previo al recorte y límites256/512 pinturas,
4096/24000 cúbicas. La normalización artística centra el rectángulo de controles
y lo escala para que su diagonal mida2. No utiliza unos p/q ficticios.

Para un punto normalizado v, centro c, compresión s y rotación R:

```
u = s·(v−c)
F(v) = R·u / sqrt(1+|u|²)
```

Es suave, inyectivo y conserva orientación; su imagen está dentro del disco
abierto. El radio es |u|/sqrt(1+|u|²), creciente y menor que1. Antes de deshacer
la rotación, el inverso es u=w/sqrt(1−|w|²). La compresión admite0,1–64, centro
de norma≤2, rotación finita. El radio físico y tolerancia están separados.

## Cota del paso numérico

Para g(u)=u/sqrt(1+|u|²), el jacobiano tiene autovalores (1+r²)^−1/2 y
(1+r²)^−3/2. Su norma está acotada por (1+r²)^−1/2. La segunda derivada bilineal
para vectores unitarios a/b es:

```
D²g[a,b] = −[a(u·b)+b(u·a)+u(a·b)]/(1+r²)^(3/2)
            +3u(u·a)(u·b)/(1+r²)^(5/2)
```

Cada grupo tiene norma≤3/(1+r²); por tanto6/(1+r²) es una cota conservadora.
Si r0 es la distancia de c al rectángulo de controles, multiplicada por s,
entonces L=s/sqrt(1+r0²), M=6s²/(1+r0²) acotan derivadas en todo el hull.
La rotación conserva esas normas. Para una cúbica A/B/C/D, δ es la máxima
separación de B/C respecto de los controles de interpolación lineal A→D.
La distancia entre curva mapeada y cuerda de extremos mapeados es como máximo:

```
L·δ + M·|D−A|²/8
```

adaptiveMapCubic subdivide por de Casteljau hasta cumplir esa cota. Detecta
lazos/S que una prueba de punto medio puede omitir. Rechaza exceso de profundidad,
segmentos o valores no finitos sin devolver geometría parcial. Presupuesto
compartido entre todos los contornos:250000 segmentos por defecto/máximo1000000.
El radio físico convierte la tolerancia de milímetros a unidades de disco.

La certificación corresponde sólo al mapeo de las cúbicas preparadas, bajo este
modelo numérico. Paper, sus primitivas/booleanas y el contorneado siguen siendo
pasos de preparación no certificados. El informe los separa de la cota y
mantiene sólo una estimación para el error del contorneador; no certifica todo
el proceso. El SVG conserva milímetros, fuente y validez artística en metadatos.

## Trabajo en worker y pruebas

runGeometryWorker comparte el ciclo de vida/cancelación, sin asumir un tipo de
geometría. Cada job tiene worker propio: termina al resolver, fallar o abortar.
Las fábricas conservan el patrón estático new Worker/new URL que Vite empaqueta.
Poincaré conserva su API anterior, modelo, normalización y cota Möbius.

964 unidades/TypeScript correctos;12 nuevas prueban inverso independiente,
compresión0,1/1/8/64,1001 muestras densas por curva en S/lazos/diámetros,
agujeros/colores/opacidades/orden, fuente intacta, escala física, límites e
identificadores escapados. Las5 E2E Poincaré siguen correctas tras compartir
preparación/subdivisión/worker. Pruebas reales reproducibles:

```bash
node scripts/validate-v30-artistic-disk.mjs
.runtime/validation-env/bin/python scripts/validate_v30_artistic_disk.py
node scripts/validate-v30-hyperbolic-worker.mjs
node scripts/validate-v30-hyperbolic-flat-source.mjs
```

Diagnóstico artístico:108 pinturas/101669 segmentos, cota≤0,005mm. Worker con53
ticks de respuesta observados, cancelación previa/activa, recuperación y fuente
intacta. CairoSVG independiente frente a Chromium: error medio0,1696/255 sobre
blanco; seis probes analíticos independientes verifican hueco transparente,
cuerpo azul, borde oscuro, perfil fino/grueso y exterior del recorte sin pintura.
El trazo abierto no se rellena aunque tenga un color de fill asignado.

Poincaré conserva85 celdas/worker y prueba física29 celdas con los mismos píxeles
azul/negro/transparente y cota0,0049976022mm de antes del cambio. Capturas/JSON/
SVG/raster diagnósticos quedan en .runtime, excluidos del repo. Pendientes UI,
contrato artístico/ejemplos públicos, bordes pareados canónicos y color por clase;
no declarar Fase4 ni el PRD completos.


## Modalidad artística integrada

El selector Modalidad del diálogo compartido alterna Poincaré/Disco artístico.
Cada kind tiene esquema estricto y parámetros propios; fuente/recorte/medidas
se conservan al alternar. El radio del centro se ajusta al límite de cada modo
con margen numérico, para evitar que el redondeo produzca0,9000000000000001.
Regresar al editor conserva nodos, generador y configuraciones. Entrar/recargar
regenera la fuente actual; edición directa del disco deshabilitada por diseño.

La modalidad artística ofrece compresión, cámara, precisión y medidas; los p/q,
profundidad y estructura geodésica quedan en la modalidad geométrica. Guardado y
exportación comparten controles, validación, cancelación y protección frente a
resultados/opciones obsoletos. PNG/JPEG usan DPI físicos y el mismo rasterizador.
El lector geométrico JSON7 anterior REAL rechaza kind artistic-disk; no pierde
la configuración ni la interpreta silenciosamente como dibujo plano.

Dos ejemplos originales: peces con9 instancias/117 pinturas/40850 segmentos,
y anillos con36 instancias/108 pinturas/40669 segmentos. Ambos bajo250000.
El ejemplo de peces declara presupuesto12000 cúbicas de fuente (límite24000),
porque sus contornos de trazo detallados superan el predeterminado4096. No se
amplía el presupuesto general ni se simplifican sus controles canónicos.
Fuentes, JSON7 y miniaturas generados por el worker; captura real de la UI.

Pruebas de interfaz específicas: desktop/móvil, cambio entre modalidades,
fuente intacta, guardado/reapertura, PNG/JPEG con hueco/color/perfil reales,
SVG físico, edición mediante la herramienta Línea en el editor seguida de
regeneración con su nuevo ID de fuente, y cancelación/reintento de un job real.
La galería suma25 ejemplos en total. Continúan pendientes bordes pareados
canónicos, color por clase y criterios restantes de Fase4; fases5–7 pendientes.
