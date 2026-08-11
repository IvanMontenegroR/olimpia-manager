"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Un número que se mueve hacia su valor nuevo en vez de saltar de golpe, y que
 * pega un salto cuando cambia. Es lo que hace que el dinero y los medidores se
 * sientan como algo que pasó y no como un dato que apareció.
 */
export default function Numero({
  valor, formato, className, style, duracion = 620,
}: {
  valor: number;
  formato?: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
  duracion?: number;
}) {
  const [mostrado, setMostrado] = useState(valor);
  const [saltando, setSaltando] = useState(false);
  const desde = useRef(valor);
  const inicio = useRef(0);

  useEffect(() => {
    if (valor === desde.current) return;
    const origen = desde.current;
    const delta = valor - origen;
    setSaltando(true);
    inicio.current = performance.now();
    let vivo = true;

    const paso = (t: number) => {
      if (!vivo) return;
      const avance = Math.min(1, (t - inicio.current) / duracion);
      // desacelera al final
      const suave = 1 - Math.pow(1 - avance, 3);
      setMostrado(origen + delta * suave);
      if (avance < 1) requestAnimationFrame(paso);
      else { desde.current = valor; setTimeout(() => setSaltando(false), 200); }
    };
    requestAnimationFrame(paso);
    return () => { vivo = false; };
  }, [valor, duracion]);

  return (
    <span className={`${className ?? ""} ${saltando ? "salta" : ""}`}
          style={{ display: "inline-block", ...style }}>
      {formato ? formato(mostrado) : Math.round(mostrado)}
    </span>
  );
}
