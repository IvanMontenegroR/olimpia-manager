"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La definición, dibujada.
 *
 * Los momentos del partido ya tenían probabilidades que dependían del jugador
 * (un definidor suma nueve puntos, un juvenil pierde nueve en la última), pero
 * desde afuera no se veía nada: elegías pateador y aparecía un texto diciendo
 * si entró. Parecía que daba igual a quién ponías.
 *
 * Acá pasa algo: se ve el arco, la pelota sale, el arquero vuela, y recién
 * entonces aparece el resultado. La pelota va adonde va porque ya se sorteó,
 * no al revés.
 */

export type TipoDefinicion = "remate" | "atajada";

export default function Definicion({ tipo, entro, chance, semilla, onTermina }: {
  tipo: TipoDefinicion;
  /** Si la pelota terminó adentro del arco. */
  entro: boolean;
  /** La chance que tenías, 0 a 1, para dibujar la barra. */
  chance: number | null;
  /** Cualquier número estable: decide a qué rincón va sin volver a sortear. */
  semilla: number;
  onTermina: () => void;
}) {
  const [fase, setFase] = useState<"espera" | "vuela" | "listo">("espera");
  // igual que en el sorteo: el padre pasa un arrow inline y cada render del
  // partido reiniciaba el remate
  const avisar = useRef(onTermina);
  avisar.current = onTermina;

  useEffect(() => {
    const a = setTimeout(() => setFase("vuela"), 120);
    const b = setTimeout(() => { setFase("listo"); avisar.current(); }, 1400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  // A qué rincón va. Si entró, adentro de los tres palos; si no, afuera o al
  // cuerpo del arquero.
  const rincon = semilla % 3;
  const destinoX = entro ? [22, 50, 78][rincon] : [6, 50, 94][rincon];
  const destinoY = entro ? [30, 52, 28][rincon] : [10, 62, 12][rincon];
  // el arquero se tira para un lado, acierte o no
  const ladoArquero = (semilla >> 2) % 3;
  const arqueroX = [26, 50, 74][ladoArquero];

  const color = entro
    ? (tipo === "remate" ? "#3fa76a" : "#c0392b")
    : (tipo === "remate" ? "#c0392b" : "#3fa76a");

  return (
    <div className="relative mb-3 w-full overflow-hidden rounded-lg"
         style={{ height: 148, background: "linear-gradient(180deg, #12281c, #0d1a13)" }}>

      {/* el arco visto de frente */}
      <svg viewBox="0 0 100 68" preserveAspectRatio="none"
           className="absolute inset-0 h-full w-full">
        {/* red */}
        <defs>
          <pattern id="red" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M4 0 L0 0 0 4" fill="none" stroke="#ffffff22" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect x="14" y="8" width="72" height="40" fill="url(#red)" />
        <path d="M14 48 V8 H86 V48" fill="none" stroke="#f2efe6" strokeWidth="1.6"
              strokeLinecap="round" />
        {/* línea del área */}
        <line x1="0" y1="60" x2="100" y2="60" stroke="#ffffff33" strokeWidth="0.8" />
      </svg>

      {/* el arquero, volando para su lado */}
      <svg viewBox="0 0 24 30" className="absolute"
           style={{
             left: `${fase === "espera" ? 50 : arqueroX}%`,
             top: "40%",
             width: 26, height: 32, marginLeft: -13,
             transform: fase === "espera" ? "rotate(0deg)"
               : `rotate(${arqueroX < 50 ? -62 : arqueroX > 50 ? 62 : 0}deg)`,
             transition: "left 480ms cubic-bezier(.4,0,.2,1), transform 480ms cubic-bezier(.4,0,.2,1)",
             filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
           }}>
        <circle cx="12" cy="5" r="4" fill="#e8c25a" />
        <path d="M12 9 v11 M12 12 l-8 -4 M12 12 l8 -4 M12 20 l-5 8 M12 20 l5 8"
              stroke="#e8c25a" strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>

      {/* la pelota */}
      <span className="absolute rounded-full"
            style={{
              left: `${fase === "espera" ? 50 : destinoX}%`,
              top: `${fase === "espera" ? 86 : destinoY}%`,
              width: fase === "espera" ? 11 : 15,
              height: fase === "espera" ? 11 : 15,
              marginLeft: -6,
              background: "#f2efe6",
              boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
              transition: "left 620ms cubic-bezier(.25,.6,.3,1), top 620ms cubic-bezier(.25,.6,.3,1), width 620ms, height 620ms",
            }} />

      {/* el cartel del resultado, debajo del arco para no tapar la jugada */}
      {fase === "listo" && (
        <span className="golpea-hito absolute inset-x-0 text-center" style={{ bottom: 18 }}>
          <span className="apellido text-[26px]"
                style={{ color, textShadow: "0 2px 12px rgba(0,0,0,0.95), 0 0 26px rgba(0,0,0,0.8)" }}>
            {tipo === "remate"
              ? (entro ? "¡GOL!" : "AFUERA")
              : (entro ? "GOL DEL RIVAL" : "¡LA ATAJÓ!")}
          </span>
        </span>
      )}

      {/* la chance que tenías, abajo */}
      {chance !== null && (
        <span className="absolute inset-x-0 bottom-0 px-2 pb-1">
          <span className="mb-0.5 flex justify-between text-[8px] uppercase tracking-[0.14em]"
                style={{ color: "#ffffff77" }}>
            <span>tenías {Math.round(chance * 100)}%</span>
          </span>
          <span className="block h-1 overflow-hidden rounded-full" style={{ background: "#00000066" }}>
            <span className="block h-full rounded-full"
                  style={{ width: `${chance * 100}%`, background: "#ffffffaa" }} />
          </span>
        </span>
      )}
    </div>
  );
}
