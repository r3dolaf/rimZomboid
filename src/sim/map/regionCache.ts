import type { Grid } from '../types';

/** Regiones conectadas calculadas por A*; `setTile` las invalida al cambiar el mapa. */
export const regionCache = new WeakMap<Grid, Int32Array>();
