"use client";

import { useEffect, useState } from "react";
import ArmarOnce, { type Salida } from "@/components/ArmarOnce.tsx";
import PartidoEnVivo from "@/components/PartidoEnVivo.tsx";
import Inicio from "@/components/Inicio.tsx";
import {
  avanzarFecha, cargar, guardar, partidaNueva, partidoDe, plantelDe,
  type CierrePartido, type Partida,
} from "@/lib/temporada.ts";

type Fase = "inicio" | "armar" | "partido";

export default function Page() {
  const [partida, setPartida] = useState<Partida | null>(null);
  const [fase, setFase] = useState<Fase>("inicio");
  const [salida, setSalida] = useState<Salida | null>(null);

  // el estado vive en localStorage: se lee recién en el cliente
  useEffect(() => { setPartida(cargar()); }, []);
  useEffect(() => { if (partida) guardar(partida); }, [partida]);

  if (!partida) {
    return (
      <div className="app items-center justify-center">
        <span className="apellido text-[16px]" style={{ color: "var(--tenue)" }}>
          Cargando
        </span>
      </div>
    );
  }

  const partido = partidoDe(partida);
  const plantel = plantelDe(partida);

  const terminar = (cierre: CierrePartido) => {
    if (!partido) return;
    setPartida((p) => (p ? avanzarFecha(p, partido, cierre) : p));
    setSalida(null);
    setFase("inicio");
  };

  if (fase === "armar" && partido) {
    return (
      <ArmarOnce
        key={partida.fechaActual}
        partido={partido}
        plantel={plantel}
        onVolver={() => setFase("inicio")}
        onJugar={(s) => { setSalida(s); setFase("partido"); }} />
    );
  }

  if (fase === "partido" && partido && salida) {
    return (
      <PartidoEnVivo
        key={partida.fechaActual}
        partido={partido}
        salida={salida}
        onTerminar={terminar} />
    );
  }

  return (
    <Inicio
      partida={partida}
      partido={partido}
      onDirigir={() => setFase("armar")}
      onReiniciar={() => { setPartida(partidaNueva()); setFase("inicio"); }} />
  );
}
