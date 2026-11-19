# Pattern Studio 2D

Estudio vectorial estático para dibujar un motivo, construir patrones paramétricos, aplicar simetrías y recortarlos sobre perímetros arbitrarios. Toda la geometría se procesa en el navegador. No requiere cuentas, APIs ni backend.

## Acceso a esta instalación

- Estudio en vivo: **http://<IP_LOCAL>:4173**
- Avances, commits, cupo y feedback: **http://<IP_LOCAL>:4174**

También está disponible la interfaz de red `<IP_LOCAL>`. Las direcciones corresponden a esta máquina; pueden cambiar con DHCP. Se mantiene el servidor de desarrollo para que las revisiones aparezcan al guardar código.

El panel de avances es una herramienta de desarrollo independiente. No se distribuye como requisito del producto ni expone archivos de sesiones, credenciales o proyectos del navegador.

## Instalar y ejecutar

Requisitos de desarrollo: Node.js 22.12 o posterior, npm; Python 3 para las herramientas LAN. Se usa únicamente npm y el lockfile incluido.

```bash
npm ci
npm run dev
```

Abrir `http://localhost:4173` o `http://IP-DE-ESTA-MAQUINA:4173` desde otra PC. El servidor Debian no necesita escritorio ni GPU. El navegador cliente realiza el trabajo geométrico.

Para mantener y administrar los servicios locales sin una terminal abierta:

```bash
npm run local:start
npm run local:status
npm run local:stop
```

`local:start` reutiliza los procesos propios activos y rechaza puertos ocupados por otros servicios. Los PIDs y logs quedan en `.runtime/`. Para iniciar el monitor por primera vez fuera de la sesión Codex original, usar `python3 scripts/local-services.py start --thread UUID-DEL-HILO`.

## Flujo de trabajo

1. Un proyecto nuevo comienza en **Libre**: cada fuente aparece una vez. Dibujá con línea, pluma Bézier, lápiz, rectángulo, elipse o polígono. Enter termina la pluma, Shift+Enter o clic en el primer nodo la cierra y Esc la cancela.
2. La **Simetría viva** permanece accesible al seleccionar objetos: Libre, 17 grupos del plano, siete frisos y Cn/Dn. Cada opción muestra el dibujo actual y un icono matemático. Hover o foco permiten explorar; clic, Enter o Espacio confirman una sola acción reversible.
3. Seguí dibujando sobre las copias. Se usa la inversa de la instancia seleccionada, de la copia bajo el puntero o de la referencia más cercana, en ese orden. La captura queda fija durante todo el trazo, incluso al cruzar celdas o cambiar el grupo con la Pluma abierta. Alt permite alternar candidatos; la instancia seleccionada ofrece «Otra instancia».
4. Diseño y Patrón son vistas de énfasis: conservan herramienta, selección y fuente. Podés usar Fuente pura, vista dividida, una celda/período o repetición extendida. El origen y la orientación se arrastran con Selección o Nodos. «Adaptar a celda» cambia una colocación separada y nunca reescribe los nodos.
5. Los conjuntos de patrones pueden ser propios, heredar la simetría principal o permanecer libres. Su lista permite seleccionar, ocultar y ordenar la composición. Los grupos conservan sus configuraciones al ir y volver. Los generadores paramétricos mantienen la fuente; «Convertir generador a paths» materializa su resultado explícitamente.
6. En **Aplicar**, creá o importá un perímetro cerrado, aplicá el conjunto y ajustá su colocación. Una copia congelada conserva su simetría efectiva aunque cambie la principal.
7. Guardá JSON portable o exportá SVG, PNG, JPEG y DXF. El exportador usa la simetría confirmada y permite elegir conjunto activo o composición visible. Sólo ofrece una celda común cuando su periodicidad está verificada.

La pestaña Capas permite nombrar, seleccionar, ocultar, bloquear y ordenar objetos. El inspector ofrece medidas, trazo, relleno, opacidad, nodos, transformaciones y booleanas. Las operaciones sobre regiones pueden producir paths compuestos con agujeros.

Hay ocho ejemplos editables en Archivo. Abrir ejemplos o crear proyectos conserva los anteriores en **Biblioteca de este navegador**. Los presets de patrones se exportan e importan en JSON.

## Guardado y privacidad local

El autosave transaccional usa IndexedDB y guarda cada proyecto por su ID. La biblioteca pertenece al navegador y al origen HTTP (host y puerto). Otra PC puede revisar la aplicación y sus ejemplos, pero no ve automáticamente los proyectos privados de tu navegador. Para intercambiarlos, guardá y abrí JSON.

El guardado explícito descarga un archivo completo y también intenta completar la escritura local. Si el navegador rechaza IndexedDB, la aplicación informa el error y el JSON sigue disponible. Un perímetro a medio dibujar no reemplaza el último autosave válido.

## Compilar y desplegar

```bash
npm run build
npm run serve:dist
```

Abrir `http://localhost:4180`. `dist/` contiene únicamente archivos estáticos y avisos de licencias. Copiar su contenido por FTP o a un servidor HTTP convencional. No subir `node_modules/`, `.runtime/`, `.git/` ni las sesiones de Codex.

La ruta relativa predeterminada permite raíz y subdirectorios. Para fijar una base concreta:

```bash
BASE_PATH=/pattern/ npm run build
```

Copiar `dist/` al subdirectorio `/pattern/`. No se necesitan reglas de reescritura: la aplicación usa un único documento HTML. HTTP por LAN funciona; no depende de service workers, contexto HTTPS, CDN, fuentes externas ni conexión a Internet. Hace falta servir los archivos por HTTP; no se promete abrir el worker mediante `file://`.

## Verificación

```bash
npm run check
npm run test:monitor
npx playwright install chromium
npm run test:e2e
npm run benchmark
```

El benchmark necesita el servidor de desarrollo. Las pruebas estáticas y la validación independiente de archivos se explican en [TESTING.md](TESTING.md). Resultados medidos y aceptación: [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md).

## Monitor de trabajo Codex

```bash
npm run monitor
python3 scripts/work_monitor.py --status
```

Lee únicamente los eventos `rate_limits` del hilo local identificado por `CODEX_THREAD_ID`, `--thread` o el ID recordado en `.runtime/thread-id`. Publica porcentajes, timestamps de observación y reset, historial Git local y documentación.

Con 10% o menos disponible en una ventana vigente, pide cerrar el incremento y guarda un timer. Después del reset real +60 segundos solicita reanudar **el mismo hilo** mediante `codex queue --resume`. Si limita la ventana semanal, espera ese reset posterior. No cambia límites ni inventa un cupo nuevo al vencer el reloj. El agente verifica la telemetría al continuar. La reanudación necesita que la máquina y el daemon local de Codex sigan disponibles; cualquier fallo queda registrado en `.runtime/monitor-events.jsonl`.

El feedback del panel se guarda en `.runtime/feedback.jsonl` y se revisa entre incrementos. Para intervenir de inmediato, usar esta conversación. El archivo `.runtime/STOP` desactiva el ciclo del monitor; `.runtime/PROJECT_COMPLETE` indica que el PRD fue verificado y cancela reanudaciones pendientes. Los procesos de revisión permanecen en LAN. Remoto de código autorizado: [pablopeu/pattern](https://github.com/pablopeu/pattern), rama `main`.

## Documentación técnica

- [ARCHITECTURE.md](ARCHITECTURE.md): módulos, flujo de datos y renderizado.
- [GEOMETRY.md](GEOMETRY.md): grupos, redes, precisión y límites matemáticos.
- [PROJECT_FORMAT.md](PROJECT_FORMAT.md): formato, recuperación y migraciones.
- [TESTING.md](TESTING.md): pruebas, benchmark y validadores externos.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): dependencias y referencias inspeccionadas.
- [docs/PROGRESS.md](docs/PROGRESS.md): registro de avances y correcciones.

## Límites explícitos

Los frisos repiten en una dirección; las rosetas y Penrose son construcciones finitas. Una red oblicua arbitraria no se presenta como baldosa rectangular seamless. Los grupos triangulares sí admiten una supercelda rectangular de alto `sqrt(3)·ancho`.

Los generadores Wave/Guilloché/Spirograph/Rosette producen paths muestreados determinísticos; sus archivos contienen exactamente esa geometría vectorial. DXF aproxima las Bézier con tolerancia configurable y conserva mm; no conserva rellenos ni edición paramétrica.

La importación SVG admite paths, formas, grupos y referencias locales compatibles. Elimina scripts, recursos externos, imágenes, texto, filtros, gradientes y otras capacidades no admitidas, informando su eliminación. La opacidad de grupo se aplica por objeto y se advierte la posible diferencia en superposiciones. Las exportaciones SVG expandidas convierten trazos a contornos por defecto para preservar su recorte y apariencia; al desactivarlo se exportan líneas centrales recortadas.

Se limitan las escenas a 20.000 transformaciones y las expansiones a 150.000 trazados; las imágenes raster se limitan a 64 millones de píxeles. Los objetivos interactivos son mediciones de referencia, no garantías para cualquier complejidad.
