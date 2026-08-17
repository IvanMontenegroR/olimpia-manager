/**
 * Prueba de humo: corre temporadas enteras por la lógica pura y grita si algo
 * explota. No mide balance, mide que el juego no se rompa: el crash que se ve
 * como "application error" en producción suele ser un `!` que era `undefined`
 * varias fechas después, imposible de encontrar jugando a mano.
 *
 *   npx tsx scripts/humo.ts [temporadas]
 */

import {
  TOTAL_FECHAS, avanzarUnDia, cerrarPartido, fichar, ficharEstrella, hayPartidoHoy,
  partidaNueva, partidoDe, plantelDe, rechazarEstrella, resolverAsunto, tablaDe,
  type CierrePartido, type Partida,
} from "../lib/temporada.ts";
import { salidaAutomatica } from "../lib/juego.ts";
import { generarMomento, resolverMomento, chanceDe, type TipoMomento } from "../engine/momentos.ts";
import { Rng } from "../engine/rng.ts";
import type { Alineacion } from "../engine/tipos.ts";

const TIPOS: TipoMomento[] = [
  "penal_favor", "penal_contra", "tiro_libre", "jugador_caliente",
  "mano_a_mano", "penal_ultima", "rival_con_diez",
  "festejo", "arquero_al_area", "cerrar_o_seguir",
];

const temporadas = Number(process.argv[2] ?? 40);
const fallas: string[] = [];

for (let s = 0; s < temporadas; s++) {
  const rng = new Rng(`humo-${s}`);
  /*
   * Cada vuelta es una temporada DISTINTA, no la misma con otras decisiones.
   * Antes todo el azar colgaba del día del calendario, así que las cuarenta
   * corridas veían los mismos eventos el mismo día: lo único que cambiaba era
   * qué opción elegía el bot. Con la semilla propia esto pasó a probar
   * cuarenta temporadas de verdad.
   */
  let p: Partida = partidaNueva(`humo-${s}`);
  let dias = 0;

  try {
    while (dias < 220 && !p.despedido) {
      dias++;

      // lo que espera decisión se resuelve al azar, como haría un jugador
      if (p.pendientes.length) {
        const a = p.pendientes[0];
        /*
         * Cada tipo tiene sus opciones propias y no salen de `efectos`. Antes
         * acá se mandaba "" para todos, así que vender un jugador, viajar y
         * poner precio a la entrada nunca se probaban: se caían siempre en el
         * else de cada rama.
         */
        const ops = a.tipo === "oferta" ? ["vender", "rechazar"]
          : a.tipo === "marketing" ? ["barato", "normal", "caro"]
          : a.tipo === "viaje" ? ["sobrelahora", "dosdias", "semana"]
          : Object.keys(a.efectos ?? {});
        p = resolverAsunto(p, a.id, ops.length ? rng.elegir(ops) : "");
        continue;
      }

      // fichar del mercado, que es la otra forma de mover el plantel
      if (p.fichajes.length && rng.chance(0.12)) {
        const f = rng.elegir(p.fichajes);
        const traido = fichar(p, f.id);
        if (traido) { p = traido; continue; }
      }
      if (p.hito) { p = { ...p, hito: null }; continue; }
        if (p.estrella) {
        p = rng.chance(0.3) ? ficharEstrella(p) : rechazarEstrella(p);
        continue;
      }

      if (hayPartidoHoy(p)) {
        p = jugar(p, rng, s);
        continue;
      }

      const r = avanzarUnDia(p);
      p = r.partida;

      /*
       * Cada tanto se simula que cerrás y volvés: guardar y cargar. Acá saltó
       * que `cargar` tiraba el estado de todo jugador fichado, porque filtraba
       * contra el plantel del JSON, donde esos no están.
       */
      if (dias % 17 === 0) p = comoSiRecargara(p);
    }

    // las pantallas que leen la temporada terminada
    tablaDe(p);
  } catch (e) {
    const m = e instanceof Error ? `${e.message}\n    ${e.stack?.split("\n")[1]?.trim()}` : String(e);
    fallas.push(`temporada ${s}, día ${p.dia} (fecha ${p.fechaActual}): ${m}`);
  }
}

/**
 * Lo mismo que hace `cargar` al volver a abrir el juego, sin localStorage:
 * pasa por JSON y se completa contra una partida nueva.
 */
function comoSiRecargara(p: Partida): Partida {
  const guardada = JSON.parse(JSON.stringify(p)) as Partida;
  const base = partidaNueva("humo-base");
  const n: Partida = { ...base, ...guardada };
  n.plantel = { ...base.plantel };
  for (const j of n.incorporados ?? []) {
    n.plantel[j.id] ??= {
      condicion: j.condicion, amarillas: 0, suspendidoFechas: 0, lesionadoHasta: null,
      golesTorneo: 0, minutos: 0, animo: j.animo, crecimiento: 0,
    };
  }
  for (const [id, e] of Object.entries(guardada.plantel ?? {})) {
    if (!n.plantel[id]) continue;
    n.plantel[id] = { ...n.plantel[id], ...e };
  }
  return n;
}

/** Juega el partido de hoy pasando por todos los momentos posibles. */
function jugar(p: Partida, rng: Rng, semilla: number): Partida {
  const partido = partidoDe(p)!;
  const salida = salidaAutomatica(partido, plantelDe(p), {
    minutos: p.minutosSub18,
    partidosRestantes: Math.max(0, TOTAL_FECHAS - p.fechaActual + 1),
  });
  const jugadores = salida.once;
  if (jugadores.length < 11) return { ...p, dia: p.dia };

  const a: Alineacion = {
    once: jugadores,
    suplentes: salida.suplentes,
    actitud: rng.elegir(["defensivo", "equilibrado", "ofensivo"] as const),
    puestos: salida.puestos,
  };

  // todos los momentos, con todas sus opciones: acá aparecen los `!` vacíos
  for (const tipo of TIPOS) {
    const conAmarilla = rng.elegir(jugadores).id;
    const m = generarMomento(tipo, 1 + Math.floor(rng.entre(1, 89)), a, partido.ctx,
                             rng, conAmarilla);
    if (!m) continue;
    for (const o of m.opciones) {
      chanceDe(m, o.id, a, partido.ctx);
      resolverMomento(m, o.id, a, partido.ctx, rng);
    }
  }

  const c: CierrePartido = {
    golesOlimpia: Math.floor(rng.entre(0, 4)),
    golesRival: Math.floor(rng.entre(0, 4)),
    minutos: new Map(jugadores.map((j) => [j.id, 90])),
    amarillas: rng.chance(0.4) ? [rng.elegir(jugadores).id] : [],
    rojas: rng.chance(0.08) ? [rng.elegir(jugadores).id] : [],
    lesionados: rng.chance(0.12)
      ? [{ id: rng.elegir(jugadores).id, dias: Math.floor(rng.entre(7, 40)) }] : [],
    goleadores: [rng.elegir(jugadores).id],
    hinchadaExtra: rng.chance(0.2) ? 9 : 0,
  };
  return cerrarPartido(p, partido, c);
}

if (fallas.length) {
  console.log(`\n  ${fallas.length} de ${temporadas} temporadas se rompieron\n`);
  const vistas = new Set<string>();
  for (const f of fallas) {
    const clave = f.split(": ").slice(1).join(": ");
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    console.log("  " + f + "\n");
  }
  process.exit(1);
}
console.log(`\n  ${temporadas} temporadas completas sin romperse\n`);
