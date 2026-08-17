/**
 * Cuánto se mueve el nivel de un jugador por dónde lo ponés y cómo llega.
 *
 * El número grande es el de la ficha y no se toca nunca: es el mismo con el
 * que lo fichaste y el mismo que dice su ficha. Antes el banco mostraba el
 * nivel efectivo y la cancha el de ficha, así que arrastrabas a alguien de 66
 * a un casillero y aparecía como 59, y parecía que el jugador cambiaba de
 * valor por moverse de lugar. Ahora el valor queda quieto y lo que se mueve
 * es esto, chiquito y al lado.
 */
export default function Delta({ valor, tam = 8 }: { valor: number; tam?: number }) {
  if (!valor) return null;
  return (
    <span className="num font-bold leading-none"
          style={{ fontSize: tam, color: valor > 0 ? "var(--cesped)" : "var(--ladrillo)" }}>
      {valor > 0 ? `+${valor}` : `−${Math.abs(valor)}`}
    </span>
  );
}
