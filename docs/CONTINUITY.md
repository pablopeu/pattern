# Continuidad · PRD v2.1 cerrado

## Estado
PRD v2.1 implementado y verificado sobre v2. El logo visible usa icono.png original, según el pedido adicional del usuario. Remoto autorizado: https://github.com/pablopeu/pattern, rama main.

## Historial del incremento
- c11008d: overlay matemático y captura desde regiones vacías.
- 1343761: teselas editables/adyacencia, exportación, logo y verificaciones integradas.
- El commit de documentación posterior registra este cierre sin cambios funcionales.

## Evidencia de cierre
- TypeScript estricto y 140 unitarias correctas.
- 50 E2E correctos; conserva los 31 de v2, incluidos los 19 de v1.
- 4 tests del monitor y build correctos.
- 4 pruebas estáticas correctas en raíz y /pattern/, con Internet bloqueado: flujo previo y logo/tesela curva/worker v2.1.
- CairoSVG/Pillow/ezdxf: exportación aplicada previa y hexágono Bézier, PNG/Cairo 787x630 y 58 polilíneas DXF 2D en mm.
- Auditoría visual a 1440x900 y 1366x768: logo cargado, overlay tenue, tesela curva editable, sin desbordes ni errores de consola.
- Benchmark aislado: pan sin/con overlay 33.19/33.33 ms de mediana, incluyendo protocolo/frame; cálculo p6m 1.6 ms. Datos y límites en TESTING.md.
- HTTP LAN 200 para app 4173 y monitor 4174. Sin feedback pendiente al cierre.

## Decisiones importantes
- Esquema 3 y presets 3 con lectura v1/v2. Pattern.tiling opcional y versionado, separado de fuente/generador y simetría local.
- Cinco construcciones verificadas; bordes opuestos acoplados, triángulos con simetría central por borde, vértices fijos y corredores seguros. No clasificador universal de polígonos.
- El motivo se continúa por adyacencia antes del recorte; una sola fuente y captura inversa fija permiten cruzar bordes sin perder tinta.
- Contornos deduplicados y optativos al exportar. Overlay siempre de edición. La simetría del motivo es local a la tesela; no se promete cualquier grupo global.
- Penrose mantiene construcción aperiódica finita y suspende las teselas periódicas guardadas.

## Operación
No hay trabajo requerido pendiente. Conservar app http://<IP_LOCAL>:4173 y feedback/monitor http://<IP_LOCAL>:4174. El marcador .runtime/PROJECT_COMPLETE cancela reanudaciones innecesarias; retirarlo ante nuevo trabajo autorizado y revisar feedback/Git/cupo antes de continuar.

El monitor sigue el uso real; con <=10% y trabajo pendiente, verificar/documentar/commit y finalizar turno. El timer solicita reanudar el mismo hilo después del reset real +60s. No duplicar servicios ni modificar proyectos privados de navegadores. La comprobación física desde otra PC corresponde al usuario; la escucha LAN sí está verificada.
