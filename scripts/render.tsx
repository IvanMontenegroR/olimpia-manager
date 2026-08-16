/**
 * Prueba de humo del dibujo.
 *
 * scripts/humo.ts cubre la lógica, pero el "application error" de Next es un
 * error de React: la lógica calcula bien y la pantalla se cae al pintarlo. Acá
 * se renderizan de verdad las pantallas que se comen todo el árbol si fallan,
 * con datos que salen del juego y no inventados.
 *
 *   npx tsx scripts/render.tsx
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MomentoOverlay from "@/components/MomentoOverlay.tsx";
import {
  generarMomento, resolverMomento, type TipoMomento,
} from "@/engine/momentos.ts";

void React;
import Asuntos from "@/components/Asuntos.tsx";
import Mercado from "@/components/Mercado.tsx";
import PantallaEstrella from "@/components/PantallaEstrella.tsx";
import PantallaHito from "@/components/PantallaHito.tsx";
import Escritorio from "@/components/Escritorio.tsx";
import { ESTRELLAS } from "@/engine/estrellas.ts";
import { sortearSituacion } from "@/engine/situaciones.ts";
import { sortearOferta } from "@/engine/mercado.ts";
import { salidaAutomatica } from "@/lib/juego.ts";
import { Rng } from "@/engine/rng.ts";
import {
  fichar, ficharEstrella, partidaNueva, partidoDe, plantelDe, sumarDias,
  type Asunto, type Partida,
} from "@/lib/temporada.ts";

const fallas: string[] = [];
const probar = (que: string, hacer: () => void) => {
  try { hacer(); } catch (e) {
    fallas.push(`${que}: ${e instanceof Error ? e.message : String(e)}`);
  }
};

const base = partidaNueva("fijo");
const plantel = plantelDe(base);

// ---------------------------------------------------------------- situaciones
// todas las que existen, con todas sus opciones dibujadas
const vistas = new Set<string>();
for (let i = 0; i < 4000 && vistas.size < 40; i++) {
  const rng = new Rng(`r-${i}`);
  const armada = sortearSituacion({
    plantel,
    ambiente: 30 + (i % 70),
    hinchada: 20 + (i % 80),
    racha: [["G", "E", "P"][i % 3] as "G"],
    posicion: 1 + (i % 8),
    esSemanaDeClasico: i % 2 === 0,
    faltanDias: i % 7,
    vistas: [...vistas],
  }, rng);
  if (!armada || vistas.has(armada.s.id)) continue;
  vistas.add(armada.s.id);
  const a: Asunto = {
    id: `sit-${i}`, tipo: "evento", dia: base.dia,
    titulo: armada.s.titulo, detalle: armada.s.contexto,
    situacion: armada.s, efectos: armada.efectos,
  };
  probar(`situación ${armada.s.id}`, () => {
    renderToStaticMarkup(<Asuntos asunto={a} partida={base} onResolver={() => {}} />);
  });
}
console.log(`  situaciones dibujadas: ${vistas.size}`);

// ---------------------------------------------------------------- los otros asuntos
for (const tipo of ["marketing", "viaje"] as const) {
  probar(`asunto ${tipo}`, () => {
    const a: Asunto = {
      id: `a-${tipo}`, tipo, dia: base.dia, titulo: "x", detalle: "y",
      datos: { altura: true, km: 900, ciudad: "La Paz" },
    };
    renderToStaticMarkup(<Asuntos asunto={a} partida={base} onResolver={() => {}} />);
  });
}

/*
 * La oferta, que es la que se rompía. Se prueba por un jugador del JSON y
 * también por uno que llegó después (una estrella fichada), que es el caso que
 * no existía cuando se escribió la pantalla.
 */
for (let i = 0; i < 60; i++) {
  const conEstrella: Partida = {
    ...base,
    incorporados: [...base.incorporados],
  };
  const e = ESTRELLAS[i % ESTRELLAS.length];
  const traido = {
    ...plantel[0], id: `estrella-${e.id}`, nombre: e.nombre, apellido: e.apellido,
    nivel: e.nivel, edad: e.edad, posicion: e.posicion,
  };
  conEstrella.incorporados.push(traido);
  conEstrella.plantel = {
    ...base.plantel,
    [traido.id]: { condicion: 80, amarillas: 0, suspendidoFechas: 0, lesionadoHasta: null,
                   golesTorneo: 0, minutos: 0, animo: 80, crecimiento: 0 },
  };
  const o = sortearOferta(plantelDe(conEstrella), `of-${i}`);
  if (!o) continue;
  const p2: Partida = {
    ...conEstrella,
    ofertas: [{ id: "of-1", jugadorId: o.jugadorId, club: o.club, montoUsd: o.montoUsd,
                venceEl: sumarDias(conEstrella.dia, 4), quiereIrse: o.quiereIrse }],
  };
  const a: Asunto = {
    id: "ofp-1", tipo: "oferta", dia: p2.dia,
    titulo: "Llegó una oferta", detalle: "x", datos: { ofertaId: "of-1" },
  };
  probar(`oferta por ${o.jugadorId}`, () => {
    renderToStaticMarkup(<Asuntos asunto={a} partida={p2} onResolver={() => {}} />);
  });
}

// ---------------------------------------------------------------- las pantallas
probar("mercado", () => {
  renderToStaticMarkup(<Mercado partida={base} onFichar={() => {}} />);
});

for (const e of ESTRELLAS) {
  const p2: Partida = { ...base, estrella: { id: e.id, venceEl: sumarDias(base.dia, 7) } };
  probar(`estrella ${e.id}`, () => {
    renderToStaticMarkup(
      <PantallaEstrella partida={p2} onFichar={() => {}} onRechazar={() => {}} onVolver={() => {}} />);
  });
}

/*
 * El tablero entero, que es lo que se ve cuando aparece cualquiera de estas
 * cosas. Si se cae acá se lleva puesta toda la app, que es exactamente el
 * "application error" que se veía.
 */
const escritorios: [string, Partida][] = [
  ["recién empezada", base],
  ["con una estrella en la mesa", { ...base, estrella: { id: ESTRELLAS[8].id, venceEl: sumarDias(base.dia, 7) } }],
  ["con un refuerzo del mercado", (() => {
    const conFichaje = fichar(base, base.fichajes[0].id);
    return conFichaje ?? base;
  })()],
  ["con una estrella ya fichada", (() => {
    const rica = { ...base, dineroUsd: 90_000_000,
                   estrella: { id: ESTRELLAS[8].id, venceEl: sumarDias(base.dia, 7) } };
    return ficharEstrella(rica);
  })()],
  ["a mitad de temporada", { ...base, fechaActual: 12, dia: sumarDias(base.dia, 90) }],
  ["terminada", { ...base, fechaActual: 23, dia: sumarDias(base.dia, 150) }],
  ["despedido", { ...base, despedido: "por los resultados", paciencia: 0 }],
];
for (const [que, p2] of escritorios) {
  probar(`escritorio ${que}`, () => {
    renderToStaticMarkup(
      <Escritorio partida={p2} onAvanzar={() => {}} onDirigir={() => {}}
                  onResolver={() => {}} onFichar={() => {}} onReiniciar={() => {}}
                  onGuardarEquipos={() => {}} onMoverReserva={() => {}}
                  onFicharEstrella={() => {}} onRechazarEstrella={() => {}} />,
    );
  });
}

/*
 * Los momentos del partido, antes y después de elegir. Es donde vive la barra
 * que cambia de forma según el momento: dos tramos, la escala del pibe o el
 * arco entero del penal en contra.
 */
{
  const p0 = partidaNueva("fijo");
  const m0 = partidoDe(p0)!;
  const sal = salidaAutomatica(m0, plantelDe(p0), { minutos: 0, partidosRestantes: 22 });
  const ali = { once: sal.once, suplentes: sal.suplentes,
                actitud: "equilibrado" as const, puestos: sal.puestos };
  const tipos: TipoMomento[] = [
    "penal_favor", "penal_ultima", "penal_contra", "tiro_libre", "mano_a_mano",
    "jugador_caliente", "festejo", "arquero_al_area", "cerrar_o_seguir", "rival_con_diez",
  ];
  for (const tipo of tipos) {
    const mom = generarMomento(tipo, 60, ali, m0.ctx, new Rng(`r-${tipo}`), sal.once[4].id, [1, 1]);
    if (!mom) { fallas.push(`momento ${tipo}: no se genera`); continue; }
    for (const o of mom.opciones) {
      const res = resolverMomento(mom, o.id, ali, m0.ctx, new Rng(`rr-${tipo}-${o.id}`));
      for (const [cuando, r] of [["sin elegir", null], ["resuelto", res]] as const) {
        probar(`momento ${tipo}/${o.id} ${cuando}`, () => {
          renderToStaticMarkup(
            <MomentoOverlay momento={mom} resuelto={r} alineacion={ali} ctx={m0.ctx}
                            onElegir={() => {}} onSeguir={() => {}} />,
          );
        });
      }
    }
  }
}

// ----------------------------------------------------------------
if (fallas.length) {
  console.log(`\n  ${fallas.length} pantallas se rompieron al dibujarse\n`);
  const vistos = new Set<string>();
  for (const f of fallas) {
    const clave = f.split(": ").slice(1).join(": ");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    console.log("  " + f);
  }
  process.exit(1);
}
console.log("  todo se dibuja sin romperse\n");
