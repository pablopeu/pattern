# Continuidad activa · PRD v2.1

Implementar íntegramente `prd_v2.1.txt`: overlay matemático visible, captura en regiones vacías y teselas geométricas editables con encastre verificado. Mantener LAN, historial Git y push main autorizado.

Baseline: commit `c6f6cb5`, v2 cerrada con 80 unitarias/31 E2E. Marcador PROJECT_COMPLETE retirado al comenzar este encargo.

Baseline v2 confirmado: 80 unitarias y 31 E2E. Auditoría en curso. Ventana anterior expirada; telemetría actual confirma reset y 1% usado; al umbral cerrar incremento y dejar que el monitor retome tras el reset real. No declarar completo este PRD mientras falte cualquiera de sus tres funcionalidades y verificaciones.

## Pedido adicional del usuario
Al cerrar v2.1, reemplazar el logo visible actual por `icono.png` (archivo raíz presente). Integrarlo como asset, verificar escritorio/LAN y estático/subdirectorio. No perder este pedido.

## Incremento actual
- Overlay y captura: esquema 3, grupo completo de isometrías testigo, preferencias y botón independiente. Checkpoint `c11008d` subido.
- Teselas integradas (fuente/generador separados, motivo local, borde emparejado, recorte y continuidad al cruzar, contornos deduplicados). Archivos src/tiling/*, ui/TilePanel.tsx y engine/capture/export adaptados.
- Último check: 138 unitarias correctas. Los 18 E2E v2.1 pasan con píxeles reales, sin helpers de selección en el raster. Los 31 de v2 deben repetirse sobre este incremento completo.
- Logo pedido por el usuario ya integrado con import ../../icono.png; conservar el PNG original. Falta revisión visual final y build estático.
- Pendiente: benchmark-structure.mjs aislado, auditoría visual/operativa y documentación final, regresión/build/estático/validadores, commit/push. Mantener PRD activo sin PROJECT_COMPLETE hasta terminar esos checks.

## Referencia del cierre anterior

# Continuidad de trabajo · PRD v2

## Estado actual
PRD v2 implementado y verificado. Se conservaron el motor y la regresión v1. Los cambios están en main; remoto autorizado `https://github.com/pablopeu/pattern`.

## Verificación de cierre
- TypeScript estricto y 80 unitarias correctas (57 de v1 conservadas).
- 31 E2E correctos (19 de v1 conservados), incluidos teclado/toque, estilo, tres conjuntos editables, Pluma abierta, pointer capturado y undo del conjunto activo.
- Build final correcto. Producción comprobada en raíz y `/pattern/` por HTTP, con recursos externos bloqueados; worker de exportación operativo.
- Monitor 4/4. Validadores independientes CairoSVG, Pillow y ezdxf correctos.
- Galería real inspeccionada a 1440×900 y 1366×768: miniaturas y primera fila completas, sin desbordes ni errores de consola.
- Benchmark final aislado: motor .6 ms, parámetros 16.7 ms, cambio de grupo con dos frames 68.6 ms, tanda de miniaturas 1558.2 ms. Nodos 50 ms con protocolo Playwright; picos y límites registrados en TESTING.md.
- Matriz AC-21…AC-42 y límites en docs/ACCEPTANCE.md. Formato 2 y ejemplos/migraciones en PROJECT_FORMAT.md.

## Resultado funcional
Libre explícito; perfiles por grupo; origen/orientación; adaptación por colocación separada; captura inversa fija; continuidad Diseño/Patrón; galería programada con hover transitorio y pausa durante gestos; composición propia/heredada/libre; exportación confirmada y snapshots efectivos. Ocho fixtures v1 reales conservan fuentes, IDs, geometría, generadores, regiones y aplicaciones.

## Operación y siguientes intervenciones
- App LAN `http://<IP_LOCAL>:4173`, monitor/feedback `http://<IP_LOCAL>:4174`. Conservar ambos procesos.
- No hay trabajo requerido pendiente de este PRD. La siguiente intervención puede partir del feedback del usuario o de otro encargo.
- `.runtime/PROJECT_COMPLETE` evita reanudaciones innecesarias. Ante cambios autorizados posteriores, retirarlo y revisar `.runtime/feedback.jsonl`.
- Consultar el cupo real con `python3 scripts/work_monitor.py --status`. Si queda <=10% con trabajo pendiente, verificar/documentar/commit y finalizar el turno; el monitor retoma el mismo hilo después del reset real +60s.
- No duplicar servicios, no alterar proyectos privados de navegadores. La revisión física desde la otra PC depende del usuario; las respuestas HTTP LAN están comprobadas.
