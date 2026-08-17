/**
 * ¿La copa se juega entera contra el cuadro sorteado?
 *
 * Es el camino más largo del juego y el que más formas tiene de trabarse: tres
 * fases previas encadenadas, seis fechas de grupo, cuatro llaves finales y una
 * tanda de penales en cualquiera de ellas. Cualquier eslabón que no avance deja
 * la partida girando sin partido de copa, y eso no tira ninguna excepción: se
 * ve recién cuando llegás a noviembre y la copa nunca terminó.
 *
 *   npx tsx scripts/copa.ts
 */

import {
  TOTAL_FECHAS, avanzarUnDia, cerrarPartido, hayPartidoHoy, onceTitular,
  partidaNueva, partidoDe, plantelDe, tandaAutomatica, temporadaSiguiente,
  type Partida,
} from "../lib/temporada.ts";
import { dondeEsta, esPlaceholder } from "../lib/sorteo.ts";
import { simularPartido } from "../engine/motor.ts";
import { Rng } from "../engine/rng.ts";

const fallas: string[] = [];
const probar = (que: string, ok: boolean) => {
  if (!ok) { console.log(`  MAL  ${que}`); fallas.push(que); }
  return ok;
};

/** Juega el año entero y devuelve qué pasó con la copa. */
function jugarElAno(p0: Partida) {
  let p: Partida = { ...p0, pretemporada: false };
  const partidosDeCopa: string[] = [];
  let vueltas = 0;
  while (vueltas++ < 1600) {
    if (p.hito) p = { ...p, hito: null };
    if (p.caeElGrupo) p = { ...p, caeElGrupo: null };
    if (p.tanda) { p = tandaAutomatica(p); continue; }
    if (p.torneo === "clausura" && p.fechaActual > TOTAL_FECHAS) break;
    if (p.despedido) break;

    if (hayPartidoHoy(p)) {
      const m = partidoDe(p)!;
      if (m.ctx.competencia !== "apertura" && m.ctx.competencia !== "clausura") {
        partidosDeCopa.push(`${m.etiqueta} vs ${m.rivalNombre}`);
      }
      const s = onceTitular(p, m, plantelDe(p));
      const r = simularPartido(
        { once: s.once, suplentes: s.suplentes, actitud: "equilibrado", puestos: s.puestos },
        m.ctx, new Rng(`c-${p.ano}-${p.dia}-${m.etiqueta}`));
      p = cerrarPartido(p, m, {
        golesOlimpia: r.golesOlimpia, golesRival: r.golesRival,
        minutos: new Map(s.once.map((j) => [j.id, 90])),
        amarillas: [], rojas: [], lesionados: [], goleadores: [],
        onceFinal: s.once.map((j) => j.id),
      });
    } else {
      p = avanzarUnDia(p).partida;
    }
    p = { ...p, pendientes: [] };
  }
  return { p, partidosDeCopa, vueltas };
}

/* Se juegan varias temporadas para que aparezcan los distintos puntos de entrada. */
console.log(`\n  ${"año".padEnd(6)}${"copa".padEnd(14)}${"entra en".padEnd(12)}` +
  `${"partidos".padStart(9)}  cómo terminó`);

let p = partidaNueva("copa");
/* La primera es 2026, con el sistema viejo; de 2027 en adelante manda el cuadro. */
p = jugarElAno(p).p;

const etapas = new Set<string>();
for (let i = 0; i < 4; i++) {
  p = temporadaSiguiente(p);
  const arranca = p.copa.etapa ?? "—";
  const torneo = p.copa.torneo ?? "sin copa";
  etapas.add(arranca);

  const r = jugarElAno(p);
  p = r.p;

  console.log(`  ${String(p.ano).padEnd(6)}${torneo.padEnd(14)}${arranca.padEnd(12)}` +
    `${String(r.partidosDeCopa.length).padStart(9)}  ${p.copa.etapa}`);

  probar(`${p.ano}: el año no se colgó`, r.vueltas < 1600);
  probar(`${p.ano}: la copa terminó en un estado final`,
    p.copa.etapa === "campeon" || p.copa.etapa === "eliminado");

  if (torneo !== "sin copa" && arranca !== "eliminado") {
    probar(`${p.ano}: se jugó al menos un partido de copa`, r.partidosDeCopa.length > 0);
    /* Nadie puede jugar más partidos de los que tiene el camino más largo:
       3 previas de ida y vuelta + 6 de grupo + 3 llaves + la final = 16. */
    probar(`${p.ano}: no se jugaron más de 16 partidos de copa`,
      r.partidosDeCopa.length <= 16);
  }
  if (r.partidosDeCopa.length) {
    console.log(`         ${r.partidosDeCopa.slice(0, 3).join(" · ")}` +
      (r.partidosDeCopa.length > 3 ? ` · …(${r.partidosDeCopa.length})` : ""));
  }
}

// ------------------------------------------- que el cuadro quede consistente
console.log(`\n  === el cuadro después de jugarlo ===\n`);
if (p.copas) {
  for (const t of ["libertadores", "sudamericana"] as const) {
    const c = p.copas[t];
    const d = dondeEsta(c, "olimpia");
    const carteles = c.grupos.flatMap((g) => g.equipos).filter(esPlaceholder).length;
    console.log(`  ${t.padEnd(14)} Olimpia ${d.grupo ? `en el Grupo ${d.grupo.letra}` :
      d.llave ? `en ${d.llave.id}` : "afuera"} · quedan ${carteles} carteles sin dueño`);
    probar(`${t}: los grupos siguen teniendo 4`,
      c.grupos.every((g) => g.equipos.length === 4));
    probar(`${t}: Olimpia no está en dos lugares a la vez`,
      !(d.grupo && d.llave));
  }
}
console.log(`\n  Arrancó en: ${[...etapas].join(", ")}`);

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} fallan\n`);
  process.exitCode = 1;
} else {
  console.log("  La copa se juega entera contra el cuadro.\n");
}
