import { aprieta, type Alineacion, type ContextoPartido, type Jugador } from "./tipos.ts";

/**
 * Chance de que lo echen antes del final, para mostrarla en pantalla.
 * Tiene que coincidir con lo que hace `relatarTramo`, si no la interfaz miente.
 */
export function riesgoDeRoja(
  j: Jugador, tieneAmarilla: boolean, minuto: number,
  a: Alineacion, ctx: ContextoPartido,
): number {
  if (!tieneAmarilla) return 0;
  let p = 0.055;
  if (aprieta(a.actitud)) p += 0.025;
  if (a.actitud === "defensivo") p += 0.015;
  if (j.condicion < 55) p += 0.02;
  if (ctx.esClasico) p += 0.02;
  const restante = Math.max(0, 90 - minuto) / 90;
  return Math.min(0.95, p * restante);
}
