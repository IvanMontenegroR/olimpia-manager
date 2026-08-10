# Decisiones y correcciones de datos

Complementa el documento de contexto del proyecto. Registra lo que se decidió
después de escribirlo y las correcciones a datos que el documento daba por buenos.

## Decisiones tomadas (10/08/2026)

| Tema | Decisión |
|---|---|
| Fatiga en el MVP | Se agregan partidos entre semana con rival falso (fuerza + km de viaje). Sin bracket, sin lista de inscripción, sin preparación de viaje. Sin esto el MVP no puede probar la mecánica central. |
| Datos | Los busca Claude, los verifica Ivan antes de que pasen a JSON definitivo. |
| Persistencia | localStorage en el MVP. Supabase queda conectado pero sin usar; la migración será un adaptador. |
| Armado del once | 11 jugadores sueltos, sin selector de formación. El sistema deduce la distribución de líneas y muestra explícito quién juega adaptado y con qué multiplicador. |
| Punto de arranque | Fecha 1 del Clausura, contrafáctico. No se cargan los resultados reales ya jugados. |
| Primer entregable | Datos verificados en JSON, antes del motor. |
| Stack | Next.js App Router + TypeScript + Tailwind. Motor en TS puro aislado de React, ejecutable headless con Node para el balanceo. |

## Propuestas de cambio al diseño, pendientes de aprobación

1. **Curva de condición física con piso.** El multiplicador lineal de la sección 4
   colapsa el nivel efectivo (un 78 al 50% con otros modificadores cae a ~29).
   Propuesto: `f_cond = 0.65 + 0.35 * (cond/100)^0.6`, y trasladar el costo real
   de la fatiga al riesgo de lesión en vez de al rendimiento.
2. **Lesiones y suspensiones por amarillas dentro del MVP.** Ya están en el modelo
   de datos y son lo que fuerza a rotar cuando el jugador no quiere.
3. **RNG con semilla** derivada del estado de la partida, para evitar save scumming
   y poder reproducir corridas de balanceo.
4. **Simulador headless de balanceo** (N temporadas, reporte de condición, minutos,
   lesiones y puntos) antes de invertir en UI.
5. **Objetivo de dirigencia + presión de prensa** como stakes mínimos del MVP.

## Correcciones a datos del documento de contexto

| Documento decía | Verificado |
|---|---|
| Olimpia juega en el Manuel Ferreira | Su estadio es el **Osvaldo Domínguez Dibb** (22.000), en remodelación. En 2026 juega de local en el **Defensores del Chaco**. |
| Recoleta | El nombre es **Deportivo Recoleta**. Juega en el Ricardo Gregor, no en su Roque Battilana. |
| Sportivo Ameliano en Asunción | Juega en **Villeta**, estadio La Fortaleza del Pikysyry. |
| Lorenzo Melgarejo, 35 años, dorsal 11, referencia del plantel | **No está en el plantel 2026.** El dorsal 11 es de Sebastián Ferreira. |
| Cupo de extranjeros: verificar | **4 extranjeros en cancha** desde la temporada 2024, sin cupo explícito de plantel. Olimpia tiene 8. |
| (no figuraba) | **Regla Sub-18:** es obligatorio alinear jugadores nacidos desde el 1/1/2007 hasta completar **900 minutos** entre todos a lo largo del torneo. Los minutos solo cuentan si el juvenil juega al menos 90 efectivos por partido, regla agregada tras los casos de cambios "fantasma" del Apertura 2026. |
| (no figuraba) | Olimpia está en **octavos de Copa Sudamericana contra Vasco da Gama**: 13/08 en São Januário (Río) y 20/08 en Defensores del Chaco. El DT es Pablo "Vitamina" Sánchez. |

También en sedes alternativas por obras: **Guaraní** juega en el Emiliano Ghezzi y
**Sportivo Luqueño** en el Luis Salinas de Itauguá.

## Problemas encontrados en las fuentes

- **Wikipedia tiene la segunda vuelta del Clausura 2026 mal cargada.** Las fechas 12
  a 22 son copia literal de las fechas 1 a 11 sin invertir las localías: daba 12 y 10
  partidos de local según el equipo, y Olimpia jugando los dos clásicos de local.
  ABC Color confirma que la segunda rueda es espejo de la primera, así que el fixture
  se reconstruyó invirtiendo local y visitante. Los partidos reconstruidos están
  marcados con `"fuente": "espejo_reconstruido"`.
- El infobox de Wikipedia dice 144 partidos. Son **132** (12 equipos, doble rueda).
- La APF solo programó hasta la fecha 5. Las fechas calendario de la 6 en adelante
  están estimadas repartiendo parejo hasta el 29/11/2026, marcadas con
  `"fecha_estimada": true`. Los emparejamientos sí son los reales.
- Transfermarkt y tribuna.com responden 403. Los valores de mercado hay que cargarlos
  a mano en `data/plantel_para_valores.csv`, que es lo que ya preveía el documento.

## Movimientos del plantel, mitad de 2026

Wikipedia estaba desactualizada. Lista reconstruida contra prensa paraguaya y contra
la nómina de inscripción de Olimpia para la Copa Sudamericana (ABC, 06/08/2026).

**Salidas:** Alejandro Silva, Aníbal Chalá, Rodrigo Pérez (Unión La Calera),
Adrián Alcaraz (Pachuca), Junior Gamarra (préstamo a Trinidense), Lucas Morales.

**Llegadas:** Braian Romero (#31, DEL, Argentina, 35, de Vélez), Esteban Matus
(#17, lateral izquierdo, Chile), Víctor Sebastián Quintana (#18, MED, vuelve de
Luqueño), Pedro Zarza (#23, extremo, vuelve del préstamo en Trinidense).

**Cambio de estatus:** Gastón Olveira se nacionalizó paraguayo y ya no ocupa cupo
de extranjero.

**No llegó:** Allan Wlk. Recoleta lo vendió a Lanús por USD 2 millones pese al
acuerdo previo con Olimpia.

Pendientes de confirmar: si Faustino Barone y Tiago Caballero siguen en el club, y
la nacionalidad de Iván Leguizamón (las fuentes se contradicen entre PAR y ARG).

## Niveles asignados

Sin acceso a Transfermarkt, los niveles se asignaron por criterio futbolístico en la
escala de la sección 6, calibrados para que Olimpia dé 74 de fuerza de equipo.
Son provisorios y están para ser corregidos.

Resultado del balanceo inicial:

- Plantel de 33. Nivel máximo 73 (Derlis González), mediana 63, mínimo 52.
- Once ideal 67.9 de promedio, jugadores 12 a 22 en 62.4. **Salto de 5.5**, que es un
  plantel con profundidad suficiente para que rotar sea una decisión y no una condena.
- El **cupo de extranjeros no muerde**: el mejor once usa 3 de los 4 disponibles. La
  restricción recién aparece al rotar.
- La **regla Sub-18 sí muerde**: cuesta 0.9 de promedio del once y obliga a poner a
  Zarza o a Delmas todas las fechas. Es la restricción más interesante de las dos y
  sale gratis del reglamento real.

## Copa Sudamericana real en lugar de copa inventada

Decisión revisada: el MVP usa la **Copa Sudamericana 2026 real**, no un torneo falso.
Olimpia está en octavos contra Vasco da Gama y el cuadro entero está cargado.

Camino real por el cuadro (Olimpia sale de la llave D, mitad izquierda):
octavos vs **Vasco** (13/08 en São Januário, 20/08 en Defensores) → cuartos vs el
ganador de **Santa Fe vs River** → semis contra quien salga de **Boca-Recoleta** o
**Bolívar-São Paulo** → final el 21/11 en Barranquilla contra la mitad derecha.

Octavos completos: Boca-Recoleta, Bolívar-São Paulo, Santa Fe-River y Vasco-Olimpia
por izquierda; Bragantino-Mineiro, Santos-(sin confirmar), Tigre-Montevideo City
Torque y Cienciano-Botafogo por derecha.

Sin gol de visitante y sin alargue: el global empatado al final de la vuelta va directo
a penales.

El calendario combinado da **29 partidos, 8 con tres días o menos de descanso y 10.665 km
de viaje**. Los cuatro momentos que definen la temporada:

- El clásico con Cerro (F6) cae **dos días después** de la vuelta con Vasco.
- Los cuartos de ida caen **dos días después** de la fecha 10.
- El clásico de vuelta en La Nueva Olla (F17) cae **dos días después** de la semi vuelta.
- La fecha 21 cae **dos días después** de la final de Barranquilla, a 4.000 km.

Los partidos de Olimpia en el Clausura que chocaban con la copa se reprogramaron
(F10, F16 y F17), que es lo que hace la APF en la realidad. Quedan marcados con
`reprogramado_por_copa`.

Dos sedes de altura extrema en el camino posible: **Bogotá a 2.640 m** (Santa Fe,
en cuartos) y **La Paz a 3.640 m** (Bolívar, en semis). Cusco (Cienciano, 3.400 m)
solo aparecería en la final.

Pendiente: el rival de Santos en la llave F no está confirmado. Está en la mitad
derecha, así que solo puede aparecer en la final.

## Resultado del simulador de balanceo

`npx tsx scripts/balance.ts 500` corre 500 temporadas completas (Clausura +
Sudamericana) con dos DT automáticos: uno ingenuo que pone siempre a los mismos
once por Nivel nominal, y uno que rota mirando la condición y el peso del partido.
Es el experimento que decide si la fatiga es una mecánica o un adorno.

| | Once fijo | Rotación |
|---|---|---|
| Puntos en el Clausura | 31.8 | **45.4** |
| Sale campeón del Clausura | 0.8% | **27.4%** |
| Lesiones por temporada | 11.9 | 4.3 |
| Condición media de los titulares | 46.9% | 84.1% |
| Titulares de referencia en cancha (de 11) | 8.8 | **6.2** |
| Partidos con un titular bajo 60% | 22.4 | 6.8 |

Copa Sudamericana con rotación: cae en octavos 44%, en cuartos 35.2%, en semis
11.8%, pierde la final 6.2%, **campeón 2.8%**.

Tres cosas que el simulador confirmó:

1. **Rotar vale 14 puntos y multiplica el título por treinta.** La mecánica central
   funciona.
2. **Rotando bien, solo 6.2 de tus 11 mejores juegan cada partido.** El once ideal
   es un lugar al que casi nunca se llega, que es lo que pide la sección 4.
3. **La liga y la copa se pelean los mismos jugadores.** Cuando el DT pasó a
   priorizar los partidos de copa, el título local cayó de 32.8% a 26.8% y la copa
   subió de 1.5% a 2.5%. Es el mecanismo de la sección 12 funcionando solo, sin
   estar programado explícitamente.

Y una cuarta, emocional: el 18% de las temporadas llegás a semifinal o final de la
Sudamericana y perdés. Eso es el contenido que el documento pide.

Parámetros a los que se llegó, todos en `P` dentro de `engine/motor.ts`: desgaste de
36 puntos por partido completo, recuperación de 4.5 por día, localía de 3 en liga,
13 para Olimpia en copa y 6 para el rival de local en copa.

Pendiente de balanceo fino: ganar la Sudamericana está en 2.8% con el DT automático.
Un humano que gestione mejor debería estar por encima. Si se quiere subir, se toca
el Nivel del plantel o la fuerza de los rivales de copa, jugando.

## Pantalla de partido

Mobile-first, `100dvh`, sin scroll de página. Lo único que scrollea es la lista de
plantel y el relato, dentro de su propia caja.

**Armar el once.** Cabecera del rival, franja de datos (once, sistema deducido,
cupo de extranjeros, Sub-18, Nivel del once), filtro por posición y plantel. Cada
jugador se lee como número grande + apellido + nombre, sin foto: la identidad es
tipográfica. Se muestra el **Nivel efectivo** grande y el nominal chico debajo
cuando difieren. Si alguien queda adaptado o fuera de puesto, aparece nombrado con
su multiplicador. El botón de jugar se bloquea y dice qué falta.

**Partido en vivo.** Marcador, minuto y barra de progreso arriba; relato anclado
abajo, junto a los controles; play/pausa, tres velocidades, tres cambios y un
cambio de actitud. El partido se detiene solo ante una lesión o cuando alguien está
fundido, y en el caso de lesión abre el panel de cambio ya apuntando al lesionado.

**El partido se simula por tramos, no de una.** Cada cambio y cada cambio de
actitud vuelven a simular lo que queda con el equipo que hay en ese momento. Sin
esto los cambios serían decorado: estarías destapando un resultado ya escrito.

Textos del relato: plantillas estáticas escritas a mano en `engine/relato.ts`, con
variantes por puesto, por rasgo y por ambiente. Cero llamadas a modelos en runtime.

Falta conectar: la condición no se arrastra todavía entre fechas, no hay
persistencia en localStorage, y no hay tabla ni Sudamericana en la interfaz. El
motor ya tiene todo eso (`engine/temporada.ts`), falta cablearlo a la UI.

## Estado de los datos

| Archivo | Estado |
|---|---|
| `data/fixture_clausura2026_final.json` | Completo y validado. 132 partidos, localías 11/11, ida y vuelta correcta. |
| `data/equipos_2026.json` | Completo, con fuerza calibrada de los 12 clubes. |
| `data/plantel_olimpia_2026.json` | 33 jugadores completos, con Nivel asignado y rasgos. |
| `data/rivales_internacionales.json` | 15 rivales de la Sudamericana con fuerza, km y altura. |
| `data/sudamericana_2026.json` | Cuadro, reglas y calendario de las fases finales. |
| `data/modificadores.json` | Factores del motor: condición, localía, altura, posición, forma, rasgos. |
