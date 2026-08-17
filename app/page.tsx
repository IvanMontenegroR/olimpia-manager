"use client";

import { useEffect, useState } from "react";
import ArmarOnce, { type Salida } from "@/components/ArmarOnce.tsx";
import Arranque from "@/components/Arranque.tsx";
import { useAtras, useAtrasTrabado } from "@/lib/atras.ts";
import PantallaHito from "@/components/PantallaHito.tsx";
import Penales from "@/components/Penales.tsx";
import PartidoEnVivo from "@/components/PartidoEnVivo.tsx";
import Escritorio from "@/components/Escritorio.tsx";
import {
  avanzarUnDia, cargar, cerrarPartido, fichar, ficharEstrella, guardar, guardarEquipo,
  hayPartidoHoy,
  partidaNueva, partidoDe, plantelDe, rechazarEstrella, resolverAsunto, TOTAL_FECHAS,
  type CierrePartido, type Partida,
} from "@/lib/temporada.ts";

type Fase = "escritorio" | "armar" | "partido";

export default function Page() {
  const [partida, setPartida] = useState<Partida | null>(null);
  const [fase, setFase] = useState<Fase>("escritorio");
  const [salida, setSalida] = useState<Salida | null>(null);

  useEffect(() => { setPartida(cargar()); }, []);
  useEffect(() => { if (partida) guardar(partida); }, [partida]);

  /*
   * Armar el once es una pantalla aparte, así que el atrás del navegador
   * vuelve al escritorio. El partido en vivo NO: de un partido empezado no se
   * sale sin terminarlo, y la tanda y el hito tampoco, porque cerrarlos
   * adelanta el juego y volver atrás no lo desharía.
   */
  useAtras(fase === "armar", () => setFase("escritorio"));
  /*
   * De estas tres no se vuelve. Un partido empezado se termina, y la tanda y
   * la pantalla de campeón se cierran con su botón porque cerrarlas adelanta
   * el juego. Trabarlas es para que el atrás no haga lo otro que podría hacer,
   * que es sacarte de la página.
   */
  useAtrasTrabado(fase === "partido" || !!partida?.tanda || !!partida?.hito);

  if (!partida) {
    return (
      <div className="app items-center justify-center">
        <span className="apellido text-[16px]" style={{ color: "var(--tenue)" }}>Cargando</span>
      </div>
    );
  }

  /*
   * Antes que nada: los dos equipos. Se entra una sola vez, cuando la partida
   * es nueva, y de ahí en adelante `arrancada` queda en true.
   */
  if (!partida.arrancada) {
    return (
      <Arranque partida={partida}
        onListo={(equipos) => setPartida((p) => (p
          ? { ...p, equipos, equipoActivo: equipos[0]?.nombre, arrancada: true } : p))} />
    );
  }

  const partido = partidoDe(partida);

  /*
   * La tanda va antes que el hito: primero mirás cómo se definió y recién
   * después te dicen que saliste campeón o que quedaste afuera.
   */
  if (partida.tanda) {
    return (
      <Penales tanda={partida.tanda}
        onCerrar={() => setPartida((p) => (p ? { ...p, tanda: null } : p))} />
    );
  }

  // Un hito tapa todo hasta que lo cierres: dar la vuelta no puede pasar
  // desapercibido entre dos líneas de la bitácora.
  if (partida.hito) {
    return (
      <PantallaHito hito={partida.hito}
        onCerrar={() => setPartida((p) => (p ? { ...p, hito: null } : p))} />
    );
  }

  if (fase === "armar" && partido) {
    return (
      <ArmarOnce
        key={`${partida.dia}-${partida.fechaActual}`}
        partido={partido}
        plantel={plantelDe(partida)}
        equipos={partida.equipos}
        activo={partida.equipoActivo}
        onElegirEquipo={(nombre) => setPartida((p) =>
          (p ? { ...p, equipoActivo: nombre } : p))}
        estadoSub18={{
          minutos: partida.minutosSub18,
          partidosRestantes: Math.max(1, TOTAL_FECHAS - partida.fechaActual + 1),
        }}
        onGuardarEquipo={(e) => setPartida((p) =>
          (p ? { ...p, equipos: guardarEquipo(p.equipos, e) } : p))}
        modo={hayPartidoHoy(partida) ? "jugar" : "guardar"}
        onVolver={() => setFase("escritorio")}
        onJugar={(s) => { setSalida(s); setFase("partido"); }} />
    );
  }

  if (fase === "partido" && partido && salida) {
    return (
      <PartidoEnVivo
        key={`${partida.dia}-${partida.fechaActual}`}
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
      onGuardarEquipos={(equipos) => setPartida((p) => (p ? { ...p, equipos } : p))}
      onFicharEstrella={() => setPartida((p) => (p ? ficharEstrella(p) : p))}
      onRechazarEstrella={() => setPartida((p) => (p ? rechazarEstrella(p) : p))}
      onMoverReserva={(id, aReserva) => setPartida((p) => (p ? {
        ...p,
        enReserva: aReserva
          ? [...p.enReserva, id]
          : p.enReserva.filter((x) => x !== id),
      } : p))}
      onReiniciar={() => { setPartida(partidaNueva()); setFase("escritorio"); }} />
  );
}
