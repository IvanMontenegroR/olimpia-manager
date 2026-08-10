/** RNG determinista con semilla. Sin esto no hay balanceo reproducible
 *  ni forma de evitar que recargar la partida repita el partido hasta ganar. */
export class Rng {
  private s: number;

  constructor(semilla: number | string) {
    this.s = typeof semilla === "number" ? semilla >>> 0 : Rng.hash(semilla);
  }

  static hash(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** mulberry32 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  entre(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  entero(min: number, max: number): number {
    return Math.floor(this.entre(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Poisson por el método de Knuth. lambda chico, alcanza y sobra. */
  poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > L);
    return k - 1;
  }

  /** Normal estándar por Box-Muller, para el ruido de los irregulares. */
  normal(media = 0, desvio = 1): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return media + desvio * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  elegir<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }
}
