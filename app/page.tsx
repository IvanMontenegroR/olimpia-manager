"use client";

import { useState } from "react";
import ArmarOnce, { type Salida } from "@/components/ArmarOnce.tsx";
import PartidoEnVivo from "@/components/PartidoEnVivo.tsx";
import { partidosDeOlimpia } from "@/lib/juego.ts";

const PARTIDOS = partidosDeOlimpia();

export default function Page() {
  const [fecha, setFecha] = useState(0);
  const [salida, setSalida] = useState<Salida | null>(null);

  const partido = PARTIDOS[fecha];

  if (!partido) {
    return (
      <div className="app items-center justify-center px-8 text-center">
        <div className="apellido text-[22px]">Terminó el Clausura</div>
      </div>
    );
  }

  return salida
    ? <PartidoEnVivo
        key={fecha}
        partido={partido}
        salida={salida}
        onTerminar={() => { setSalida(null); setFecha((f) => f + 1); }} />
    : <ArmarOnce key={fecha} partido={partido} onJugar={setSalida} />;
}
