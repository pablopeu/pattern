# PRD v2.1 · Implementación y decisiones

Baseline `c6f6cb5`: 80 unitarias y 31 E2E correctas. El generador tessellation existente sólo distribuye motivos escalonados/rotados; se conserva como generador legado y no certifica encastre de polígonos.

## Overlay y captura

Estructura independiente de la cuadrícula. `symmetry/structure.ts` calcula centros/ejes desde T(B·n)·G, incluyendo medias traslaciones; deduplica y recorta al viewport. Cada marca guarda una isometría testigo. Dominio Dirichlet repetido por el grupo, celda primitiva diferenciada, frisos sin repetición vertical, radial sin red. SVG con vector-effect y opacidad propia, sin eventos ni exportación implícita. Esquema 3 migra 2→3 sin alterar entidades.

Captura canónica usa una referencia genérica de órbita independiente del contenido. Busca las celdas próximas al puntero incluso cuando la escena está vacía o el culling de las fuentes existentes no las incluye. Prioridades de selección/hit explícito se conservan. La inversa sigue fija durante el gesto.

## Teselas: construcción prevista para el incremento siguiente

Modelo opcional de tesela en Pattern, separado de generator/sourceGeometry/symmetry. Forma, dimensiones, marco de colocación, perfiles normalizados de borde y visibilidad de contorno; no almacenar instancias derivadas. Mantener defaults de lectura para documentos/presets anteriores y migración de snapshots congelados.

- Cuadrado, rectángulo, paralelogramo: 2 bordes maestros; opuestos por traslación y recorrido inverso. Red u=(w,0), v=(shear,h).
- Triángulo equilátero: 3 bordes con simetría central propia alrededor del punto medio. Editar primera mitad y derivar la segunda por media vuelta + recorrido inverso. Red u=(w,0), v=(w/2,sqrt(3)w/2); dos orientaciones por celda, relacionadas por H(x)=u+v-x. La restricción de borde es necesaria para que la misma curva coincida con la del triángulo vecino.
- Hexágono regular: 3 bordes maestros y opuestos derivados por traslación con recorrido inverso. Red de centros con u=(3r/2,sqrt(3)r/2), v=(0,sqrt(3)r).

Fijar vértices estructurales; permitir nodos y tangentes Bézier dentro de corredores de borde seguros. Verificar borde emparejado, área, ausencia de autointersección y cobertura/solapamiento con Paper.js. Rechazar cambios que pierdan encastre, con explicación. No clasificador universal.

Motivo canónico y contorno de tesela deben seguir siendo entidades distintas. La relación debe declararse en UI; las transformaciones de tesela se componen con la simetría local del motivo. Renderizar cada motivo recortado a su tesela y repetir mediante las colocaciones matemáticas de la partición. Extender captura a esa composición conservando C inversa fija; no elegir copias fuera de su clip.

Reutilizar el exportador: preparar geometría vectorial del motivo recortado a la tesela en una etapa temporal, derivar copias sólo para la región solicitada y luego aplicar el recorte final de región. Exportar contornos únicamente con una opción explícita. Certificar celdas a partir de la red real de teselas, no del grupo local del motivo. Mantener linked/frozen.

## Cierre pendiente

Integración de teselas, pruebas de encastre/cobertura/render/persistencia/exportación, regresión completa, benchmark overlay on/off, auditoría visual y docs finales. No declarar v2.1 completo hasta terminar todo el PRD.
