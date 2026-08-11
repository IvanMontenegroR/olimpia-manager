"use client";

import { miles, type Asunto, type Partida } from "@/lib/temporada.ts";
import { PLANTEL } from "@/lib/juego.ts";
import Efectos, { type EfectoVisible } from "./Efectos.tsx";

const COLOR: Record<Asunto["tipo"], string> = {
  entrenamiento: "#3fa76a",
  evento: "#d9a832",
  oferta: "#d9a832",
  marketing: "#4a7fb5",
  prensa: "#d9a832",
  viaje: "#4a7fb5",
};

/** Lo que hay que resolver antes de que el día siga. */
export default function Asuntos({
  asunto, partida, onResolver,
}: {
  asunto: Asunto;
  partida: Partida;
  onResolver: (asuntoId: string, opcionId: string) => void;
}) {
  const color = COLOR[asunto.tipo];
  const opciones = opcionesDe(asunto, partida);

  return (
    <div className="relieve-alto flex h-full flex-col justify-center rounded-xl p-4"
         style={{
           background: `linear-gradient(165deg,
             color-mix(in srgb, ${color} 22%, var(--carbon-alto)),
             color-mix(in srgb, ${color} 7%, var(--carbon)))`,
         }}>
      <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
        {asunto.tipo === "entrenamiento" ? "Semana de trabajo"
          : asunto.tipo === "oferta" ? "Mercado"
          : asunto.tipo === "marketing" ? "Comercial"
          : asunto.tipo === "viaje" ? "Logística"
          : "Vestuario y prensa"}
      </span>
      <h2 className="apellido mt-1 text-[22px] leading-tight">{asunto.titulo}</h2>
      <p className="mt-1.5 text-[13px] leading-snug" style={{ color: "var(--tenue)" }}>
        {asunto.detalle}
      </p>

      <div className="mt-4 flex flex-col gap-1.5">
        {opciones.map((o) => (
          <button key={o.id} onClick={() => onResolver(asunto.id, o.id)}
            className="w-full rounded-lg px-3.5 py-3 text-left"
            style={{
              background: "var(--carbon-alto)",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07),
                          0 0 0 1px color-mix(in srgb, ${color} 38%, transparent)`,
            }}>
            <span className="apellido block text-[14px] leading-tight">{o.etiqueta}</span>
            <span className="block text-[11px]" style={{ color: "var(--tenue)" }}>{o.detalle}</span>
            {o.efecto && <Efectos e={o.efecto} />}
          </button>
        ))}
      </div>
    </div>
  );
}

function opcionesDe(a: Asunto, p: Partida):
  { id: string; etiqueta: string; detalle: string; efecto?: EfectoVisible }[] {
  if (a.tipo === "entrenamiento") {
    return [
      { id: "recuperacion", etiqueta: "Recuperación",
        detalle: "Recupera 60% más rápido cada día" },
      { id: "tactico", etiqueta: "Táctico",
        detalle: "Recupera 15% menos por día" },
      { id: "individual", etiqueta: "Individual",
        detalle: "El juvenil con más margen sube de Nivel; el plantel recupera 10% menos" },
    ];
  }
  if (a.tipo === "marketing") {
    return [
      { id: "barato", etiqueta: "Popular a 35 mil",
        detalle: "Se llena y el equipo lo siente, pero entra la mitad de plata",
        efecto: { hinchada: 6 } },
      { id: "normal", etiqueta: "Precio habitual, 70 mil",
        detalle: "Buena recaudación con el estadio a tres cuartos",
        efecto: { hinchada: -1 } },
      { id: "caro", etiqueta: "Aprovechar, 150 mil",
        detalle: "La mejor caja del año, pero se juega con medio Defensores",
        efecto: { hinchada: -9 } },
    ];
  }
  if (a.tipo === "viaje") {
    const altura = !!a.datos?.altura;
    return [
      { id: "vispera", etiqueta: "Viajar la víspera",
        detalle: altura
          ? "Se llega la noche anterior y la altura se siente entera"
          : "Lo más barato, pero se llega con el viaje encima" },
      { id: "dosdias", etiqueta: "Viajar dos días antes",
        detalle: altura
          ? "Media adaptación: la altura pega bastante menos"
          : "El plantel llega descansado",
        efecto: { dineroUsd: -60_000 } },
      { id: "semana", etiqueta: "Concentrar en destino",
        detalle: altura
          ? "Adaptación completa, pero una semana lejos de casa pesa adentro"
          : "Llegan enteros, aunque se hace largo",
        efecto: { dineroUsd: -150_000, ambiente: -3 } },
    ];
  }

  if (a.tipo === "oferta") {
    const oferta = p.ofertas.find((o) => o.id === (a.datos?.ofertaId as string));
    const j = PLANTEL.find((x) => x.id === oferta?.jugadorId);
    return [
      { id: "vender", etiqueta: `Vender por ${oferta ? miles(oferta.montoUsd) : ""}`,
        detalle: `Perdés a ${j?.apellido ?? "el jugador"}`,
        efecto: {
          dineroUsd: oferta?.montoUsd,
          hinchada: (j?.nivel ?? 0) >= 68 ? -9 : -3,
          ambiente: -3,
        } },
      { id: "rechazar", etiqueta: "Rechazar",
        detalle: oferta?.quiereIrse
          ? `${j?.apellido ?? "El jugador"} quería irse: se queda dolido y rinde menos`
          : `${j?.apellido ?? "El jugador"} no pidió salir, así que no le cae mal`,
        efecto: {
          ambiente: 2,
          moralDe: { id: "", delta: oferta?.quiereIrse ? -10 : 3 },
          moralTexto: j?.apellido,
        } },
    ];
  }
  return (a.situacion?.opciones ?? []).map((o) => ({
    ...o,
    efecto: a.efectos?.[o.id] as EfectoVisible | undefined,
  }));
}
