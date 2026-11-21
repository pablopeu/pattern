# Hat / Spectre mathematical cores

Copyright (c)2023 Craig S. Kaplan. BSD-3-Clause, full terms in LICENSE.

Sources consulted21/11/2026:

- https://github.com/isohedral/hatviz commit4bb9d01999e4e84accc2a78d0fa279ef20b47263
  (`geometry.js`, mathematical initial metatiles and substitution code from `hat.js`).
- https://cs.uwaterloo.ca/~csk/spectre/spectreviz.tar.gz
  (`spectreviz/spectre.js`). The archive readme carries the same BSD license.

SHA256 of the original files/archive is recorded in upstream.json. This is an
adapted headless subset: P5 UI/rendering/export methods removed; Math functions
bound locally, implicit globals declared, container classes reduced to data,
ES module entry points added. Substitution rules and base coordinates retained.
No P5 runtime, third-party pictures, animations or sample media are included.

The typed adapter in src/aperiodic converts row-major matrices to SVG convention.
Spectre uses the actual alternating cubic edges, not the straight Tile(1,1).
A global change of frame on odd substitutions restores its canonical handedness.
