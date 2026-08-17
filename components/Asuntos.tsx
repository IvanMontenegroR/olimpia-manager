"use client";

import { useState } from "react";
import {
  AFORO, miles, nivelConAclimatacion, nivelSi, ocupacionDe,
  plantelDe, salioBienLaApuesta,
  type Asunto, type Partida,
} from "@/lib/temporada.ts";
import type { Efecto } from "@/engine/situaciones.ts";
import Efectos, { Chip, chipsDe, type EfectoVisible } from "./Efectos.tsx";
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
    const o = opciones.find((x) => x.id === id);
    // sin nada que sortear se resuelve y listo
    if (!o?.apuesta && !o?.rango) return onResolver(asunto.id, id);
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
                  : esta && listo && o.rango
                    ? `Salió ${o.rango.valor} de nivel.`
                    : esta ? "" : o.detalle}
              </span>

              {/* Antes de elegir, la apuesta. Después, la misma barra con la
                  bolilla cayendo adentro. El rango es la variante en la que no
                  se sortea sí o no sino cuánto. */}
              {(o.apuesta || o.rango) && (
                esta ? (
                  <Sorteo
                    chance={o.apuesta?.exito ?? 0.5}
                    riesgo={null}
                    exito={salioBien}
                    bien="SALE BIEN" mal="SALE MAL"
                    rango={o.rango}
                    semilla={asunto.id.length * 7 + o.id.length}
                    onTermina={() => setListo(true)} />
                ) : o.rango ? (
                  <span className="mt-1.5 block">
                    <span className="block h-1.5 overflow-hidden rounded-full"
                          style={{ background: "linear-gradient(90deg, var(--ladrillo), #d9a832 52%, var(--cesped))" }} />
                    <span className="num mt-0.5 flex justify-between text-[9px] font-bold"
                          style={{ color: "var(--apagado)" }}>
                      <span>{o.rango.min}</span>
                      <span>puede caer en cualquier lado</span>
                      <span>{o.rango.max}</span>
                    </span>
                  </span>
                ) : (
                  <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full"
                        style={{ background: "var(--linea)" }}>
                    <span style={{ width: `${o.apuesta!.exito * 100}%`, background: "var(--cesped)" }} />
                    <span style={{ width: `${(1 - o.apuesta!.exito) * 100}%`, background: "var(--ladrillo)" }} />
                  </span>
                )
              )}

              {/*
                * Los dos desenlaces con sus números, no solo el bueno.
                *
                * Antes se veían los chips del "sale bien" y del otro lado
                * apenas una frase. O sea que apostabas sabiendo exactamente
                * cuánto ganabas y nada de cuánto perdías, y ahí la barra roja
                * no significaba nada.
                *
                * Al resolverse queda solo el desenlace que salió: ya no hay
                * nada que comparar.
                */}
              {o.efecto && !descartada && (
                esta && listo ? (
                  <Efectos e={!salioBien && o.efecto.siSaleMal ? o.efecto.siSaleMal : o.efecto} />
                ) : o.apuesta && o.efecto.siSaleMal ? (
                  /*
                   * Los dos desenlaces uno al lado del otro y no uno debajo
                   * del otro. Sin las frases quedaron dos renglones de chips
                   * cortos, y apilados hacían que una decisión de tres
                   * opciones no entrara en la pantalla del teléfono. Al lado
                   * también se comparan mejor, que es para lo que están.
                   */
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Rama color="var(--cesped)" titulo="Bien" efecto={o.efecto} />
                    <Rama color="var(--ladrillo)" titulo="Mal" efecto={o.efecto.siSaleMal} />
                  </span>
                ) : (
                  <Efectos e={o.efecto} />
                )
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
            background: enTirada?.rango ? "var(--blanco)"
              : salioBien ? "var(--cesped)" : "var(--ladrillo)",
            color: enTirada?.rango ? "var(--negro)"
              : salioBien ? "#0a120d" : "var(--blanco)",
            transition: "opacity 280ms ease-out",
          }}>
          Seguir
        </button>
      )}
    </div>
  );
}

interface OpcionUI {
  id: string; etiqueta: string; detalle: string; efecto?: EfectoVisible;
  apuesta?: { exito: number; bien: string; mal: string };
  rango?: { min: number; max: number; valor: number; unidad: string };
}

/*
 * Todo lo que se muestra sale del mismo lugar: la lista cruda de opciones y
 * después una sola pasada de `paraMostrar`, que es la que mide el nivel. Antes
 * las cuatro clases de asunto armaban sus chips por su cuenta y cada una podía
 * prometer en la escala que quisiera.
 */
/** Uno de los dos desenlaces de una apuesta, con lo que se gana o se pierde. */
/**
 * Un desenlace: qué pasa si sale bien y qué pasa si sale mal.
 *
 * Antes cada rama traía "Sale bien: se pone la camiseta y el grupo lo termina
 * aceptando". Es lindo de leer una vez y estorba las veinte siguientes: lo que
 * se mira para decidir son los números. Pero quitar la frase dejó dos rayitas
 * de color sin nombre, y una rayita verde no dice "si sale bien". Ahora cada
 * lado se anuncia con la palabra, en su color.
 *
 * Los dos desenlaces en una sola fila, cada uno con su rótulo del color que le
 * toca. Pasó por dos tarjetas lado a lado con fondo y borde, y después por dos
 * renglones con el rótulo en una columna fija: las dos versiones gastaban
 * mucho alto para decir dos cosas cortas. Esto es lo mínimo que se entiende.
 *
 * El que no tiene nada dice "no pasa nada", que además es la información: si
 * aguanta el partido no pasa nada, lo tenés y listo. Un hueco no dice eso,
 * parece que se rompió la pantalla.
 */
function Rama({ color, titulo, efecto }: {
  color: string; titulo: string; efecto: EfectoVisible;
}) {
  const chips = chipsDe(efecto);
  return (
    <span className="flex items-center gap-1">
      <span className="shrink-0 whitespace-nowrap text-[8px] font-extrabold uppercase tracking-[0.06em]"
            style={{ color }}>
        {titulo}
      </span>
      {chips.length
        ? chips.map((c, i) => <Chip key={i} {...c} />)
        : <span className="whitespace-nowrap text-[9px]" style={{ color: "var(--apagado)" }}>
            no pasa nada
          </span>}
    </span>
  );
}

function opcionesDe(a: Asunto, p: Partida): OpcionUI[] {
  return crudas(a, p).map((o) => ({ ...o, efecto: paraMostrar(o.efecto, p) }));
}

function crudas(a: Asunto, p: Partida): OpcionUI[] {
  if (a.tipo === "marketing") {
    /*
     * Lo que deja el partido con cada precio. El texto decía "entra la mitad
     * de plata" y "la mejor caja del año" sin un solo número, así que la
     * decisión económica se tomaba a ciegas.
     */
    const caja = (precio: number) =>
      Math.round(AFORO * ocupacionDe({ ...p, precioEntrada: precio }) * precio * 0.14);
    return [
      { id: "barato", etiqueta: "Popular a 35 mil",
        detalle: "Se llena y el equipo lo siente",
        efecto: { hinchada: 6, dineroUsd: caja(35) } },
      { id: "normal", etiqueta: "Precio habitual, 70 mil",
        detalle: "El estadio a tres cuartos",
        efecto: { hinchada: -1, dineroUsd: caja(70) } },
      { id: "caro", etiqueta: "Aprovechar, 150 mil",
        detalle: "Se juega con medio Defensores",
        efecto: { hinchada: -9, dineroUsd: caja(150) } },
    ];
  }
  if (a.tipo === "viaje") {
    const altura = !!a.datos?.altura;
    /*
     * Lo que se gana viajando antes, en nivel. La aclimatación es un número
     * interno que el jugador no ve en ninguna parte, así que la decisión era
     * "pagá 150 mil por algo": se veía el costo y no el beneficio.
     */
    /*
     * Con cuánto nivel llega el equipo con cada plan, en absoluto.
     *
     * Antes se mostraba la diferencia contra viajar la víspera, así que esa
     * opción quedaba en cero y era la única sin números: una frase suelta al
     * lado de dos que decían "+1.3 nivel · −60k". Y es la que uno elige
     * cuando no quiere gastar, o sea la que más merece que le digan qué le
     * cuesta. En absoluto las tres se comparan de un vistazo.
     */
    const llega = (acl: number) => nivelConAclimatacion(p, acl);
    return [
      { id: "vispera", etiqueta: "Viajar la víspera",
        detalle: altura
          ? "Se llega la noche anterior y la altura se siente entera"
          : "Lo más barato, pero se llega con el viaje encima",
        efecto: { nivelFinal: llega(0) } },
      { id: "dosdias", etiqueta: "Viajar dos días antes",
        detalle: altura
          ? "Media adaptación: la altura pega bastante menos"
          : "El plantel llega descansado",
        efecto: { dineroUsd: -60_000, nivelFinal: llega(0.55) } },
      { id: "semana", etiqueta: "Concentrar en destino",
        detalle: altura
          ? "Adaptación completa, pero una semana lejos de casa pesa adentro"
          : "Llegan enteros, aunque se hace largo",
        efecto: { dineroUsd: -150_000, ambiente: -3, nivelFinal: llega(1) } },
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
          // el domingo tiene que jugar otro, y eso es lo que más pesa
          seVa: oferta?.jugadorId,
        } },
      { id: "rechazar", etiqueta: "Rechazar",
        detalle: oferta?.quiereIrse
          ? `${j?.apellido ?? "El jugador"} quería irse: se queda dolido y rinde menos`
          : `${j?.apellido ?? "El jugador"} no pidió salir, así que no le cae mal`,
        efecto: {
          // al grupo solo le suma cuando el jugador también se quería quedar
          ambiente: oferta?.quiereIrse ? 0 : 2,
          moralDe: { id: oferta?.jugadorId ?? "", delta: oferta?.quiereIrse ? -10 : 3 },
          moralTexto: j?.apellido,
        } },
    ];
  }
  return (a.situacion?.opciones ?? []).map((o) => ({
    ...o,
    efecto: paraMostrar(a.efectos?.[o.id] as EfectoVisible | undefined, p),
  }));
}

/**
 * El efecto crudo pasado a lo que la pantalla puede prometer.
 *
 * Hace dos cosas. Le pone nombre al que se pierde la próxima, que en la tabla
 * es un id. Y, sobre todo, tira el ánimo de los que no están en el once: el
 * vestuario que se ve en la card principal es el promedio de los once que
 * salen a la cancha, así que levantarle el ánimo a uno de la reserva no mueve
 * ese número ni un poco. Prometer "+1 vestuario" por eso era prometer algo que
 * el jugador no iba a ver pasar.
 */
function paraMostrar(e: EfectoVisible | undefined, p: Partida): EfectoVisible | undefined {
  if (!e) return e;
  const apellido = (id?: string) =>
    id ? plantelDe(p).find((j) => j.id === id)?.apellido : undefined;
  return {
    ...e,
    /* El nivel no se estima: se aplica el efecto sobre una copia y se mide. El
       viaje es la excepción y va por su cuenta en `nivelFinal`, porque ahí lo
       que importa no es cuánto cambia sino con cuánto llegás. */
    nivel: e.nivelFinal !== undefined ? 0 : nivelSi(p, e as Efecto, e.seVa),
    suspendeTexto: apellido(e.suspendeA),
    siSaleMal: paraMostrar(e.siSaleMal, p),
  };
}
