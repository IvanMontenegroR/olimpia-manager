"use client";

import { useMemo, useState } from "react";
import {
  asignarPuestos, colorCondicion, CUPO_EXTRANJEROS, esSub18,
  nivelEf, nombreCorto, type PartidoUI,
} from "@/lib/juego.ts";
import { LINEA_DE, type Actitud, type Jugador, type Linea, type Posicion } from "@/engine/tipos.ts";
import Escudo from "./Escudo.tsx";
import CanchaArmado from "./CanchaArmado.tsx";
import Dorsal from "./Dorsal.tsx";
import { ACTITUD } from "./PartidoEnVivo.tsx";

const FILTROS = ["TODOS", "ARQ", "DEF", "MED", "DEL"] as const;
type Filtro = (typeof FILTROS)[number];
const ORDEN: Record<Linea, number> = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 };
const orden = (p: Posicion) => ORDEN[LINEA_DE[p]];

export interface Salida {
  once: Jugador[];
  suplentes: Jugador[];
  actitud: Actitud;
  presionAlta: boolean;
  puestos: Map<string, Posicion>;
}

export default function ArmarOnce({
  partido, plantel, onJugar, onVolver,
}: {
  partido: PartidoUI;
  plantel: Jugador[];
  onJugar: (s: Salida) => void;
  onVolver: () => void;
}) {
  const { ctx } = partido;
  const aptos = useMemo(
    () => plantel.filter((j) => !j.suspendido && !j.lesionado_hasta), [plantel]);
  const [sel, setSel] = useState<Set<string>>(() => new Set(autoOnce(ctx, aptos)));
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [actitud, setActitud] = useState<Actitud>(ctx.esLocal ? "ofensivo" : "equilibrado");
  const [presionAlta, setPresion] = useState(ctx.esLocal);
  /** Jugador tocado, esperando con quién intercambiarse. */
  const [marcado, setMarcado] = useState<string | null>(null);

  const once = useMemo(
    () => aptos.filter((j) => sel.has(j.id)).sort((a, b) => orden(a.posicion) - orden(b.posicion)),
    [sel, aptos]);

  const asign = useMemo(() => asignarPuestos(once, ctx), [once, ctx]);
  const extranjeros = once.filter((j) => j.extranjero).length;
  const sub18 = once.filter(esSub18).length;
  const arqueros = once.filter((j) => j.posicion === "ARQ").length;

  const nivelOnce = asign
    ? Math.round(once.reduce((s, j) => s + nivelEf(j, asign.puestos.get(j.id)!, ctx), 0) / 11)
    : 0;

  const problema =
    once.length !== 11
      ? `Faltan ${11 - once.length} · tocá a alguien del banco` :
    arqueros !== 1 ? "Necesitás un arquero" :
    extranjeros > CUPO_EXTRANJEROS ? `${extranjeros} extranjeros, el cupo es ${CUPO_EXTRANJEROS}` :
    null;

  const banco = useMemo(() => {
    const fuera = aptos.filter((j) => !sel.has(j.id));
    const base = filtro === "TODOS" ? fuera : fuera.filter((j) => LINEA_DE[j.posicion] === filtro);
    // Sin filtro conviene ver primero a los mejores: si ordenara por puesto,
    // los tres arqueros suplentes se comerían el arranque del banco.
    return [...base].sort((a, b) =>
      filtro === "TODOS"
        ? nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx)
        : orden(a.posicion) - orden(b.posicion) ||
          nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx));
  }, [filtro, sel, ctx, aptos]);

  /**
   * Tocar en la cancha y después en el banco intercambia. Si todavía falta
   * gente, tocar a uno del banco lo mete directamente: antes la única
   * operación posible era el intercambio y con diez quedabas trabado.
   */
  const tocar = (j: Jugador) => {
    const enCancha = sel.has(j.id);

    // falta gente y este está afuera: entra y listo
    if (!enCancha && sel.size < 11) {
      setSel((prev) => new Set(prev).add(j.id));
      setMarcado(null);
      return;
    }

    // está en cancha y el once está incompleto: sale
    if (enCancha && sel.size < 11 && marcado === j.id) {
      setSel((prev) => { const n = new Set(prev); n.delete(j.id); return n; });
      setMarcado(null);
      return;
    }

    if (!marcado) { setMarcado(j.id); return; }
    if (marcado === j.id) {
      // segundo toque sobre el mismo: lo saca de la cancha
      if (enCancha) setSel((prev) => { const n = new Set(prev); n.delete(j.id); return n; });
      setMarcado(null);
      return;
    }

    const otro = aptos.find((x) => x.id === marcado);
    if (!otro) { setMarcado(j.id); return; }
    const otroEnCancha = sel.has(otro.id);
    if (enCancha === otroEnCancha) { setMarcado(j.id); return; } // los dos del mismo lado

    setSel((prev) => {
      const n = new Set(prev);
      const sale = enCancha ? j : otro;
      const entra = enCancha ? otro : j;
      n.delete(sale.id);
      n.add(entra.id);
      return n;
    });
    setMarcado(null);
  };

  const jugar = () => {
    if (problema || !asign) return;
    const libres = aptos.filter((j) => !sel.has(j.id));
    const porNivel = (a: Jugador, b: Jugador) =>
      nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx);
    const arquero = libres.filter((j) => j.posicion === "ARQ").sort(porNivel)[0];
    const suplentes = [
      ...(arquero ? [arquero] : []),
      ...libres.filter((j) => j.posicion !== "ARQ").sort(porNivel).slice(0, 6),
    ];
    onJugar({ once, suplentes, actitud, presionAlta, puestos: asign.puestos });
  };

  return (
    <div className="app">
      {/* ---------- cabecera ---------- */}
      <header className="px-4 pb-2 pt-2.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]"
             style={{ color: "var(--tenue)" }}>
          <button onClick={onVolver} className="rounded px-1.5 py-0.5 text-[11px]"
                  style={{ background: "var(--carbon)" }}>←</button>
          <span>{partido.etiqueta}</span>
          <span>{ctx.esLocal ? "Local" : "Visitante"}</span>
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={28} />
          <span className="text-[12px] font-semibold" style={{ color: "var(--apagado)" }}>vs</span>
          <h1 className="apellido truncate text-[22px] leading-none">
            {nombreCorto(partido.rivalId, partido.rivalNombre)}
          </h1>
          {ctx.esClasico && (
            <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              Clásico
            </span>
          )}
        </div>
      </header>

      {/* ---------- estado del once ---------- */}
      <div className="flex items-stretch border-y" style={{ borderColor: "var(--linea)" }}>
        <Dato etiqueta="Once" valor={`${once.length}/11`} alerta={once.length !== 11} />
        <Dato etiqueta="Sistema" valor={asign?.molde ?? "—"} />
        <Dato etiqueta="Extranj." valor={`${extranjeros}/${CUPO_EXTRANJEROS}`}
              alerta={extranjeros > CUPO_EXTRANJEROS} />
        <Dato etiqueta="Sub-18" valor={String(sub18)} alerta={sub18 === 0} />
        <Dato etiqueta="Nivel" valor={nivelOnce ? String(nivelOnce) : "—"} fuerte />
      </div>

      {/* ---------- cancha ---------- */}
      <div className="flex min-h-0 flex-1 flex-col py-2">
        <CanchaArmado once={once} puestos={asign?.puestos ?? new Map()} ctx={ctx}
                      seleccionado={marcado} onTocar={tocar} />
      </div>

      {asign && (asign.adaptados.length > 0 || asign.fueraDePuesto.length > 0) && (
        <div className="px-4 pb-1 text-[10px]" style={{ color: "var(--tenue)" }}>
          {asign.adaptados.map((j) => (
            <span key={j.id} className="mr-2">
              {j.apellido} de {asign.puestos.get(j.id)}{" "}
              <span style={{ color: "var(--medio)" }}>×0.90</span>
            </span>
          ))}
          {asign.fueraDePuesto.map((j) => (
            <span key={j.id} className="mr-2">
              {j.apellido} de {asign.puestos.get(j.id)}{" "}
              <span style={{ color: "var(--critico)" }}>×0.75</span>
            </span>
          ))}
        </div>
      )}

      {/* ---------- banco ---------- */}
      <div className="border-t pt-1.5" style={{ borderColor: "var(--linea)" }}>
        <div className="flex items-center gap-1 px-3 pb-1.5">
          <span className="mr-1 shrink-0 text-[9px] uppercase tracking-[0.14em]"
                style={{ color: "var(--apagado)" }}>
            Banco
          </span>
          {FILTROS.map((p) => (
            <button key={p} onClick={() => setFiltro(p)}
              className="flex-1 rounded py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: filtro === p ? "var(--blanco)" : "var(--carbon)",
                color: filtro === p ? "var(--negro)" : "var(--tenue)",
              }}>
              {p === "TODOS" ? "Todos" : p}
            </button>
          ))}
        </div>

        <div className="scroll-x flex gap-1.5 px-3 pb-2">
          {banco.map((j) => {
            const elegido = marcado === j.id;
            return (
              <button key={j.id} onClick={() => tocar(j)}
                className="flex shrink-0 flex-col items-center rounded-lg px-2 py-1.5"
                style={{
                  width: 66,
                  background: elegido ? "var(--medio)" : "var(--carbon)",
                  color: elegido ? "var(--negro)" : "var(--blanco)",
                }}>
                <Dorsal numero={j.numero} tam={26} />
                <span className="apellido mt-1 max-w-full truncate text-[9px] leading-tight">
                  {j.apellido}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[9px] leading-none">
                  <span style={{ color: elegido ? "var(--negro)" : "var(--apagado)" }}>
                    {j.posicion}
                  </span>
                  <span className="num">{nivelEf(j, j.posicion, ctx)}</span>
                  <span className="inline-block h-1 w-1 rounded-full"
                        style={{ background: colorCondicion(j.condicion) }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- decisiones ---------- */}
      <div className="border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
           style={{ borderColor: "var(--linea)" }}>
        <div className="mb-1.5 flex gap-1.5">
          {(["defensivo", "equilibrado", "ofensivo"] as Actitud[]).map((a) => {
            const A = ACTITUD[a];
            return (
              <button key={a} onClick={() => setActitud(a)}
                className="flex-1 rounded py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: actitud === a
                    ? A.color
                    : `color-mix(in srgb, ${A.color} 14%, var(--carbon))`,
                  color: actitud === a ? A.sobre : A.color,
                }}>
                {A.nombre}
              </button>
            );
          })}
          <button onClick={() => setPresion((p) => !p)}
            className="rounded px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: presionAlta ? "var(--blanco)" : "var(--carbon)",
              color: presionAlta ? "var(--negro)" : "var(--tenue)",
            }}>
            Presión
          </button>
        </div>

        <button onClick={jugar} disabled={!!problema}
          className="w-full rounded-lg py-3 text-[14px] font-extrabold uppercase tracking-[0.14em]"
          style={{
            background: problema ? "var(--carbon)" : "var(--blanco)",
            color: problema ? "var(--apagado)" : "var(--negro)",
          }}>
          {problema ?? "Jugar el partido"}
        </button>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor, alerta, fuerte }: {
  etiqueta: string; valor: string; alerta?: boolean; fuerte?: boolean;
}) {
  return (
    <div className="flex-1 border-r px-2 py-1 last:border-r-0" style={{ borderColor: "var(--linea)" }}>
      <div className="text-[8px] uppercase tracking-[0.12em]" style={{ color: "var(--apagado)" }}>
        {etiqueta}
      </div>
      <div className={fuerte ? "num text-[16px] leading-tight" : "text-[12px] font-bold leading-tight"}
           style={{ color: alerta ? "var(--medio)" : "var(--blanco)" }}>
        {valor}
      </div>
    </div>
  );
}

/** Once inicial sugerido: el mejor posible respetando cupo y Sub-18. */
function autoOnce(ctx: PartidoUI["ctx"], plantel: Jugador[]): string[] {
  // Se llena el 4-3-3 slot por slot con el mejor de cada uno, en vez de por
  // línea: así no termina un lateral derecho jugando de izquierdo teniendo un
  // izquierdo natural en el banco.
  const slots: Posicion[] =
    ["ARQ", "LD", "DFC", "DFC", "LI", "MCD", "MC", "MC", "ED", "DC", "EI"];
  const elegidos: Jugador[] = [];
  const usado = new Set<string>();
  let ext = 0;

  const meter = (j: Jugador) => {
    elegidos.push(j);
    usado.add(j.id);
    if (j.extranjero) ext++;
  };

  // El Sub-18 entra primero y consume el slot que mejor le calza, no uno
  // cualquiera: si no se descuenta un slot, el molde queda de doce y el último
  // puesto se pierde al recortar.
  const sub = plantel.filter(esSub18)
    .sort((a, b) => nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx))[0];
  if (sub) {
    meter(sub);
    const suyo = slots.indexOf(sub.posicion);
    slots.splice(suyo >= 0 ? suyo : slots.length - 1, 1);
  }

  // Cada vuelta es un slot: contar por puesto natural saltea slots y deja el
  // once en diez, que es lo que trababa la pantalla.
  for (const puesto of slots) {
    const cand = plantel
      .filter((j) => !usado.has(j.id))
      .sort((a, b) => nivelEf(b, puesto, ctx) - nivelEf(a, puesto, ctx));
    const j = cand.find((c) => !c.extranjero || ext < CUPO_EXTRANJEROS);
    if (j) meter(j);
  }

  // Red de seguridad por si el cupo de extranjeros dejó algún hueco.
  for (const j of [...plantel].sort((a, b) => b.nivel - a.nivel)) {
    if (elegidos.length >= 11) break;
    if (usado.has(j.id)) continue;
    if (j.extranjero && ext >= CUPO_EXTRANJEROS) continue;
    meter(j);
  }
  return elegidos.slice(0, 11).map((j) => j.id);
}
