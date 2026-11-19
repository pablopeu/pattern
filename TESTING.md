# Pruebas y mediciones

## Suite principal

```bash
npm ci
npm run check
npm run test:monitor
npx playwright install chromium
npm run test:e2e
npm run build
```

`check` combina TypeScript estricto y Vitest. Playwright usa Chromium, 1440×900, y reutiliza el servidor de desarrollo en 4173; si no existe lo inicia. Los tests viven en `src/tests/` y `tests/`. Capturas/trazas de fallos quedan en `test-results/`, excluido de Git.

## Cobertura

- Matrices, composiciones, inversas, reflexiones, unidades y rechazo de singularidades.
- Los 17 grupos: orden, cierre, isometrías y preservación de la red; regiones fundamentales con área correcta, incluyendo redes oblicuas extremas. Siete frisos y centros radiales.
- Todos los generadores: salida vectorial determinística, semillas, Penrose y warps.
- JSON completo, validación semántica, historial y round-trip de los ocho ejemplos.
- Booleanas y recorte con agujeros; Bézier abiertas, contornos afines, celdas rectangulares/oblicuas y snapshots congelados.
- Navegador: dibujo antes de pointerup, nodos editados desde copias reflejadas y rotadas, pluma con tangentes, parámetros, vista dividida, guardado/recuperación, biblioteca/presets, aplicaciones y undo/redo.
- SVG hostil: scripts/eventos/recursos externos, conservación de escala y transforms, rechazo de paths abiertos como perímetro.
- Descargas SVG/PNG/JPEG/DXF desde el worker; expansión sin máscaras. Cancelación tanto del worker como de la rasterización, sin descarga tardía.
- Comparación rasterizada de una escena 3×3 contra mosaicos de la celda SVG para p1, p4g y p6m con formas que cruzan bordes. Diferencia media permitida <2 niveles por canal (0–255), admitiendo antialiasing entre renderizados.
- Monitor Python: umbral real, ventana semanal, eventos expirados y advertencia de fallo de reanudación. No se encolan mensajes reales en sus pruebas.

## Despliegue estático

Servir el build con Python, sin Vite ni API:

```bash
npm run build
npm run serve:dist
TEST_STATIC=1 TEST_BASE_URL=http://127.0.0.1:4180/ npm run test:e2e
```

Para validar un subdirectorio, copiar dist a un directorio de pruebas como `static-root/pattern/`, servir `static-root` y ejecutar:

```bash
TEST_STATIC=1 TEST_BASE_URL=http://127.0.0.1:4180/pattern/ npm run test:e2e
```

También se comprueba `BASE_PATH=/pattern/ npm run build`. El test bloquea solicitudes HTTP a orígenes ajenos al servidor local y verifica dibujo más exportación con worker: esto representa una LAN sin acceso a Internet, conservando el acceso local a los archivos estáticos. No equivale a cortar la conexión con el servidor HTTP.

## Benchmark reproducible

```bash
npm run dev
# En otra terminal:
npm run benchmark
```

El script abre un navegador aislado a 1920×1080, construye 100 objetos fuente, p4m, Warp Grid 2×2 y un perímetro irregular. Mide 60 reconstrucciones del motor sobre un área con más de 300 celdas primitivas, luego cambios reales de parámetros y arrastre de nodos. Escribe `.runtime/benchmark.json` y `.runtime/benchmark.png`. No modifica proyectos del navegador del usuario.

Medición de referencia del 19/11/2026 en esta máquina:

| Operación | Mediana | p95 |
|---|---:|---:|
| Motor, 336 celdas / 2.688 operaciones, 100 fuentes | 0,6 ms | 1,2 ms |
| Actualización de parámetro, escena interactiva | 16,6 ms | 21,1 ms |
| Arrastre de nodo con control Playwright + frame presentado | 33,4 ms | 83,0 ms |

El último dato incluye ida/vuelta del protocolo del navegador. Hay picos y no se garantiza 30 FPS para cualquier composición. La optimización de `<pattern>` redujo el caso de parámetros desde una mediana previa de 71,9 ms. La escena del motor supera 300 celdas; la escena interactiva usa el viewport habitual del editor, sin fingir que ambos tamaños son idénticos.

## Validación independiente de archivos

Dependencias opcionales de QA, **no** del producto:

```bash
python3 -m venv .runtime/validation-env
.runtime/validation-env/bin/pip install ezdxf cairosvg Pillow
npm run validate:exports
.runtime/validation-env/bin/python scripts/validate_exports.py
```

El primer script usa el exportador real para escribir artefactos en `.runtime/exports/`. CairoSVG renderiza el SVG con un motor distinto; Pillow inspecciona píxeles/densidad de PNG y JPEG; ezdxf analiza entidades, unidades y ausencia de coordenadas Z.

Resultados confirmados: SVG aplicado expandido sin clipPath; PNG/JPEG de 1522×1301 px a 200 DPI (PNG pHYs ≈199,9996 por discretización a píxeles/metro); render Cairo con iguales dimensiones; DXF con 36 LWPOLYLINE 2D, unidad mm.

## Revisión visual y límites

Se capturan Diseño, Patrón y Aplicar a 1440×900 y Diseño a 1366×768; también se inspeccionan aplicación irregular, exportación y benchmark 1920×1080. Se comprueban desbordes y errores de consola. Son capturas de inspección real, no snapshots aprobados automáticamente de una referencia externa.

Los resultados finales, fallos corregidos y relación con AC-01…AC-20 están en `docs/ACCEPTANCE.md` y `docs/PROGRESS.md`. No se interpreta un build correcto como evidencia suficiente de geometría o interacción.
