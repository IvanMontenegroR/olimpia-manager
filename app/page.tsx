"use client";

import { useEffect, useState } from "react";
import ArmarOnce, { type Salida } from "@/components/ArmarOnce.tsx";
import PartidoEnVivo from "@/components/PartidoEnVivo.tsx";
import Escritorio from "@/components/Escritorio.tsx";
import {
  avanzarUnDia, cargar, cerrarPartido, fichar, guardar, partidaNueva,
  partidoDe, plantelDe, resolverAsunto,
  type CierrePartido, type Partida,
} from "@/lib/temporada.ts";

type Fase = "escritorio" | "armar" | "partido";

export default function Page() {
  const [partida, setPartida] = useState<Partida | null>(null);
  const [fase, setFase] = useState<Fase>("escritorio");
  const [salida, setSalida] = useState<Salida | null>(null);

  useEffect(() => { setPartida(cargar()); }, []);
  useEffect(() => { if (partida) guardar(partida); }, [partida]);

  if (!partida) {
    return (
      <div className="app items-center justify-center">
        <span className="apellido text-[16px]" style={{ color: "var(--tenue)" }}>Cargando</span>
      </div>
    );
  }

  const partido = partidoDe(partida);

  if (fase === "armar" && partido) {
    return (
      <ArmarOnce
        key={partida.fechaActual}
        partido={partido}
        plantel={plantelDe(partida)}
        onVolver={() => setFase("escritorio")}
        onJugar={(s) => { setSalida(s); setFase("partido"); }} />
    );
  }

  if (fase === "partido" && partido && salida) {
    return (
      <PartidoEnVivo
        key={partida.fechaActual}
        partido={partido}
        salida={salida}
        onTerminar={(c: CierrePartido) => {
          setPartida((p) => (p ? cerrarPartido(p, partido, c) : p));
          setSalida(null);
          setFase("escritorio");
        }} />
    );
  }

  return (
    <Escritorio
      partida={partida}
      onAvanzar={() => setPartida((p) => (p ? avanzarUnDia(p).partida : p))}
      onDirigir={() => setFase("armar")}
      onResolver={(asuntoId, opcionId) =>
        setPartida((p) => (p ? resolverAsunto(p, asuntoId, opcionId) : p))}
      onFichar={(id) => setPartida((p) => (p ? fichar(p, id) ?? p : p))}
      onReiniciar={() => { setPartida(partidaNueva()); setFase("escritorio"); }} />
  );
}
