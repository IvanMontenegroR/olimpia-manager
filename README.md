# Olimpia Manager

Juego de gestión de Club Olimpia, Clausura 2026. Un Football Manager radicalmente
simplificado: **cada jugador tiene una sola stat**.

La profundidad no viene de los atributos, viene de la gestión del calendario.

## La idea

Si un jugador es solo un número, elegir el once sería trivial: ponés los once más
altos y se acabó el juego. La solución es que el Nivel sea fijo pero lo que rinde en
cancha no lo sea:

```
Nivel efectivo = Nivel × Condición × Posición × Forma × Contexto
```

Con un plantel de 33, veintidós fechas de Liga y la Copa Sudamericana entre semana,
**nunca podés poner tu mejor once**.

## ¿Funciona?

El simulador corre 500 temporadas completas con dos DT automáticos: uno que pone
siempre a los mismos once y otro que rota.

```bash
npm run balance 500
```

|  | Once fijo | Rotación |
|---|---|---|
| Puntos en el Clausura | 31.8 | **45.4** |
| Sale campeón | 0.8% | **27.4%** |
| Lesiones por temporada | 11.9 | 4.3 |
| Condición media de los titulares | 46.9% | 84.1% |
| Titulares de referencia en cancha (de 11) | 8.8 | **6.2** |

Rotar vale 14 puntos. Y rotando bien, solo 6.2 de tus once mejores juegan cada
partido: el once ideal es un lugar al que casi nunca llegás.

## Correr

```bash
npm install
npm run dev
```

Mobile-first. La app ocupa exactamente el viewport y no scrollea.

## Estructura

| | |
|---|---|
| `engine/` | Motor en TypeScript puro, sin React. Corre headless con Node. |
| `engine/motor.ts` | Nivel efectivo, fatiga, lesiones y Poisson. Todos los números a balancear viven en `P`. |
| `engine/relato.ts` | Relato del partido por tramos, con plantillas estáticas. |
| `engine/temporada.ts` | Bucle de temporada completo. |
| `data/` | Plantel, fixture, rivales y modificadores en JSON. Se edita sin deploy. |
| `scripts/balance.ts` | Simulador de balanceo. |
| `DECISIONES.md` | Decisiones de diseño, correcciones de datos y resultados del balanceo. |

## Datos

Plantel, fixture y cuadro de la Sudamericana reales, verificados contra prensa
paraguaya y la APF. Las correcciones y los problemas encontrados en las fuentes
están documentados en [DECISIONES.md](DECISIONES.md).

Sin llamadas a modelos de IA en runtime.

### Escudos

Los escudos de `public/escudos/` provienen de Wikimedia Commons. Son marcas
registradas de sus clubes y se usan acá con fines identificatorios dentro de un
proyecto personal sin fines comerciales. Los clubes sin archivo de escudo caen a
un monograma generado con sus colores.

## Estado

MVP en construcción. Anda: armar el once, jugar el partido con relato, cambios y
cambio de actitud. Falta: arrastrar la condición entre fechas, persistencia, tabla
de posiciones y la Sudamericana en la interfaz.
