# Poincaré Paint mathematical core

Unmodified `src/core/iso.ts`, `geometry.ts`, `tiling.ts` from
https://github.com/pisan-labs/poincare-paint, commit
38abc004bb57133c894b7abeb1e8b07a255d1b77.

Copyright (c)2026 Yusuf Pisan. MIT terms preserved in LICENSE and the distributed
software notices. SHA256 values in upstream.json. No UI, stroke editor, media,
assets, raster code or storage logic copied. Modules have no DOM dependency.

The adapter in src/hyperbolic builds bounded regular-polygon patches, selects
stable polygon frames and adds certified adaptive projection of cubic contours.
This core alone does not provide a user-facing representation in Pattern Studio.
