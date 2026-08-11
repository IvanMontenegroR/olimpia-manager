"use client";

import { miles, type Asunto, type Partida } from "@/lib/temporada.ts";
import { PLANTEL } from "@/lib/juego.ts";

const COLOR: Record<Asunto["tipo"], string> = {
  entrenamiento: "#3fa76a",
  evento: "#d9a832",
  oferta: "#d9a832",
  marketing: "#4a7fb5",
  prensa: "#d9a832",
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
          </button>
        ))}
      </div>
    </div>
  );
}

function opcionesDe(a: Asunto, p: Partida): { id: string; etiqueta: string; detalle: string }[] {
  if (a.tipo === "entrenamiento") {
    return [
      { id: "recuperacion", etiqueta: "Recuperación",
        detalle: "El plantel recupera condición mucho más rápido" },
      { id: "tactico", etiqueta: "Táctico",
        detalle: "Se trabaja el partido, se recupera menos" },
      { id: "individual", etiqueta: "Individual",
        detalle: "Trabajo con los juveniles, a costa del descanso" },
    ];
  }
  if (a.tipo === "marketing") {
    return [
      { id: "barato", etiqueta: "Popular a 35 mil",
        detalle: "Se llena el estadio, entra menos plata" },
      { id: "normal", etiqueta: "Precio habitual, 60 mil", detalle: "Lo de siempre" },
      { id: "caro", etiqueta: "Aprovechar, 100 mil",
        detalle: "Más recaudación, la gente se queja" },
    ];
  }
  if (a.tipo === "oferta") {
    const oferta = p.ofertas.find((o) => o.id === (a.datos?.ofertaId as string));
    const j = PLANTEL.find((x) => x.id === oferta?.jugadorId);
    return [
      { id: "vender", etiqueta: `Vender por ${oferta ? miles(oferta.montoUsd) : ""}`,
        detalle: `Entra la plata y perdés a ${j?.apellido ?? "el jugador"}` },
      { id: "rechazar", etiqueta: "Rechazar",
        detalle: "Se queda, pero no le va a caer bien" },
    ];
  }
  return a.situacion?.opciones ?? [];
}
