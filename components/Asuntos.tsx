"use client";

import { useState } from "react";
import {
  miles, plantelDe, salioBienLaApuesta, type Asunto, type Partida,
} from "@/lib/temporada.ts";
import Efectos, { type EfectoVisible } from "./Efectos.tsx";
import { DibujoEscena, ESCENAS, type TipoEscena } from "./Escena.tsx";
import Sorteo from "./Sorteo.tsx";

/**
 * De qué escena es cada asunto que no viene de una situación escrita. Las
 * situaciones traen la suya; estas cuatro son fijas.
 */
const ESCENA_POR_TIPO: Record<Asunto["tipo"], TipoEscena> = {
  evento: "vestuario",
  oferta: "mercado",
  marketing: "tribuna",
  prensa: "prensa",
  viaje: "ruta",
};

/**
 * Lo que hay que resolver antes de que el día siga.
 *
 * Cuando la opción es una apuesta, la bolilla cae acá adentro, en la barra de
 * la card que tocaste, igual que en los momentos del partido. Antes se abría
 * una pantalla completa aparte y perdías de vista lo que habías elegido.
 */
export default function Asuntos({
  asunto, partida, onResolver,
}: {
  asunto: Asunto;
  partida: Partida;
  onResolver: (asuntoId: string, opcionId: string) => void;
}) {
  // La situación escrita trae su propia escena; el resto usa la de su tipo.
  const tipoEscena: TipoEscena = asunto.situacion?.escena ?? ESCENA_POR_TIPO[asunto.tipo];
  const escena = ESCENAS[tipoEscena];
  const color = escena.acento;
  const opciones = opcionesDe(asunto, partida);

  /** La que tocaste, mientras cae la bolilla. */
  const [tirando, setTirando] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const enTirada = opciones.find((o) => o.id === tirando);
  const apuesta = enTirada?.apuesta;
  const salioBien = apuesta
    ? salioBienLaApuesta(asunto.id, enTirada!.id, partida.dia, apuesta.exito)
    : true;

  const tocar = (id: string) => {
    if (tirando) return;
    // sin apuesta no hay nada que sortear: se resuelve y listo
    if (!opciones.find((o) => o.id === id)?.apuesta) return onResolver(asunto.id, id);
    setTirando(id);
  };

  return (
    <div key={asunto.id}
         className="relieve-alto relative flex h-full flex-col justify-center overflow-hidden rounded-xl p-4"
         style={{ background: escena.fondo }}>
      <DibujoEscena tipo={tipoEscena} color={color} />

      <span className="relative text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
        {escena.rotulo}
      </span>
      <h2 className="apellido relative mt-1 text-[22px] leading-tight">{asunto.titulo}</h2>
      <p className="relative mt-1.5 text-[13px] leading-snug" style={{ color: "var(--tenue)" }}>
        {asunto.detalle}
      </p>

      <div className="relative mt-4 flex flex-col gap-1.5">
        {opciones.map((o) => {
          const esta = tirando === o.id;
          /* Las descartadas se apagan pero no se van ni se mueven: la pantalla
             no se rearma y seguís viendo lo que dejaste pasar. */
          const descartada = !!tirando && !esta;
          return (
            <button key={o.id} onClick={() => tocar(o.id)} disabled={!!tirando}
              className="w-full rounded-lg px-3.5 py-3 text-left"
              style={{
                opacity: descartada ? 0.3 : 1,
                background: "color-mix(in srgb, var(--carbon-alto) 82%, transparent)",
                backdropFilter: "blur(2px)",
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07),
                            0 0 0 ${esta ? 2 : 1}px color-mix(in srgb, ${color} ${esta ? 90 : 38}%, transparent)`,
                transition: "opacity 240ms ease-out, box-shadow 240ms ease-out",
              }}>
              <span className="flex items-baseline justify-between gap-2">
                <span className="apellido block text-[14px] leading-tight">{o.etiqueta}</span>
                {o.apuesta && (
                  <span className="num shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold"
                        style={{ background: `color-mix(in srgb, ${color} 26%, transparent)`, color }}>
                    {Math.round(o.apuesta.exito * 100)}%
                  </span>
                )}
              </span>

              {/* Este renglón es el que después cuenta cómo salió. */}
              <span className="block text-[11px] leading-snug"
                    style={{
                      color: esta && listo
                        ? (salioBien ? "var(--cesped)" : "var(--ladrillo)")
                        : "var(--tenue)",
                      fontWeight: esta && listo ? 700 : 400,
                      transition: "color 240ms ease-out",
                    }}>
                {esta && listo && apuesta
                  ? (salioBien ? apuesta.bien : apuesta.mal)
                  : o.detalle}
              </span>

              {/* Antes de elegir, la apuesta. Después, la misma barra con la
                  bolilla cayendo adentro. */}
              {o.apuesta && (
                esta ? (
                  <Sorteo
                    chance={o.apuesta.exito}
                    riesgo={null}
                    exito={salioBien}
                    bien="SALE BIEN" mal="SALE MAL"
                    semilla={asunto.id.length * 7 + o.id.length}
                    onTermina={() => setListo(true)} />
                ) : (
                  <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full"
                        style={{ background: "var(--linea)" }}>
                    <span style={{ width: `${o.apuesta.exito * 100}%`, background: "var(--cesped)" }} />
                    <span style={{ width: `${(1 - o.apuesta.exito) * 100}%`, background: "var(--ladrillo)" }} />
                  </span>
                )
              )}

              {o.apuesta && !esta && (
                <span className="mt-1 block text-[10px] leading-snug" style={{ color: "var(--apagado)" }}>
                  Sale bien: {o.apuesta.bien}. Sale mal: {o.apuesta.mal}.
                </span>
              )}
              {/* Al resolverse se muestran los números del desenlace que salió,
                  no los del que esperabas. */}
              {o.efecto && !descartada && (
                <Efectos e={esta && listo && !salioBien && o.efecto.siSaleMal
                  ? o.efecto.siSaleMal : o.efecto} />
              )}
            </button>
          );
        })}
      </div>

      {/* Aparece recién cuando la bolilla frenó, sin mover nada de arriba. */}
      {tirando && (
        <button onClick={() => onResolver(asunto.id, tirando)} disabled={!listo}
          className="relative mt-3 w-full rounded-lg py-3 text-[12px] font-extrabold uppercase tracking-[0.14em]"
          style={{
            opacity: listo ? 1 : 0,
            background: salioBien ? "var(--cesped)" : "var(--ladrillo)",
            color: salioBien ? "#0a120d" : "var(--blanco)",
            transition: "opacity 280ms ease-out",
          }}>
          Seguir
        </button>
      )}
    </div>
  );
}

function opcionesDe(a: Asunto, p: Partida): {
  id: string; etiqueta: string; detalle: string; efecto?: EfectoVisible;
  apuesta?: { exito: number; bien: string; mal: string };
}[] {
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
    // del plantel de verdad, no del JSON: la oferta puede ser por uno que
    // fichaste, y entonces la pantalla decía "Perdés a el jugador"
    const j = plantelDe(p).find((x) => x.id === oferta?.jugadorId);
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
