# CHANGELOG

Todos los cambios notables del proyecto Ingeniería de Procesos se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

---

## [3.0.0] — 2026-10-06

### Quitado

- **El Gantt general.** Dibujaba los hallazgos de toda la planta en una tabla y
  contestaba «qué se encontró», que no es la pregunta de nadie. Esa función la
  hace Comportamiento, que contesta «qué me toca a mí».

  Con él se va la exportación a Excel. La de PDF se conserva.

### Agregado

- **«Lo que levanté y sigue abierto»**, nueva sección en Comportamiento
  (SPEC-024). Los hallazgos de las auditorías que uno mismo hizo, **y el botón
  para cerrarlos**.

  El Gantt general era el único lugar donde se podía cerrar un hallazgo.
  Quitarlo sin poner esto habría dejado el seguimiento como una lista que solo
  crece.

### Cambiado

- **Cerrar un hallazgo le toca a quien lo levantó, o a un administrador. Al
  auditado no.** Cerrar es dar la corrección por buena, y quien la hizo no puede
  ser quien la aprueba. El auditado lo ve en su pantalla y sabe qué le falta,
  pero no lo marca él.

- **El auditado es obligatorio cuando la máquina no tiene supervisores
  asignados.** Comportamiento busca los hallazgos por auditado o por supervisor;
  sin ninguno de los dos, el hallazgo nacía sin dueño, no aparecía en la pantalla
  de nadie y nadie podía cerrarlo.

- La pantalla de histórico se llama ahora «Histórico de auditorías», sin el
  cronograma.

---

## [2.17.0] — 2026-10-06

### Corregido

- **Faltaba PEG3 en el plano de nave.** Queda junto a PEG2, con el mismo tamaño
  y el mismo paso que las otras dos pegadoras, en el lugar donde antes se
  dibujaba REV8.

### Quitado

- **El rótulo «Pasillo Principal Central» y su banda sombreada.** El texto
  quedaba tapado por las pegadoras, que se apoyan en esa misma franja, y con
  tres máquinas encima solo iba a verse peor. El pasillo se sigue leyendo por el
  espacio entre las filas.

---

## [2.16.0] — 2026-10-06

### Corregido

- **Las revisadoras son cinco: REV1, REV2, REV3, REV4 y REV6.** Comprobado en
  piso el 6 de octubre de 2026. La numeración salta: REV5, REV7 y REV8 no
  existen.

  Se retiran REV5 y REV7 de la lista de respaldo. Entraron el 2 de octubre por
  una respuesta dada de memoria, sin verificar en planta.

- **El plano de nave dibujaba REV8, que no existe, y le faltaba REV4, que sí.**
  La fila de revisadoras se repartió para que quepan las cinco sin cambiar su
  extensión, con REV4 en su lugar físico entre REV3 y REV6.

  El plano llevaba razón en lo de REV5 y REV7: su nota decía que estaban
  retiradas y se tomó por desactualizada. Lo único que tenía mal era REV8.

- El pie del plano arrastraba restos de una cita (`[cite: 1]`) y mencionaba REF4
  dos veces, una de ellas por error.

- **Se restauraron `index.html` y `CHANGELOG.md`.** Las subidas `1a4bde4` y
  `74aa411` del 6 de octubre pusieron aquí los archivos de la app de
  Mantenimiento: el `index.html` de arranque de Vite —62 líneas— quedó
  reemplazado por la app de Mantenimiento completa, de 8 857. Recuperados del
  commit `8e28e1e`.

  Es la segunda vez que pasa; la primera fue con los `SPECS.md` el 2 de octubre.
  Los dos repositorios tienen archivos con el mismo nombre y distinto contenido.

### Nota

El catálogo lo manda Mantenimiento (SPEC-020), así que lo que esta app muestra
sale de allá. Esto corrige la lista de respaldo —la que se usa cuando no hay
catálogo guardado— y el plano, que sigue escrito aquí.

---

## [2.15.0] — 2026-10-04

### Corregido

- **Los desplegables se veían vacíos en modo oscuro** (SPEC-023). El CSS base
  declaraba `color-scheme: light dark`, heredado de la plantilla de Vite. Con el
  sistema en modo oscuro, el navegador pintaba el texto de los `select`,
  `option` e `input` en **blanco**, sobre el fondo blanco que les pone la app.

  Se veía la caja vacía y, al desplegarla, solo la opción resaltada. Afectaba a
  todos los controles de la app, no solo al modal de órdenes de trabajo.

  La app no tiene tema oscuro —todas sus pantallas pintan colores fijos—, así
  que ahora lo declara: `color-scheme: light`, y se retiró el bloque de tema
  oscuro de la plantilla.

### Cambiado

- **Cuando el aviso de una OT no sale, la app dice por qué.** Antes solo decía
  que no se pudo mandar, que no alcanza para saber dónde está el problema.
  Ahora distingue tres causas, que se arreglan en lugares distintos:

  | Mensaje | Qué significa |
  |---|---|
  | Mantenimiento todavía no publica a quién avisar | Nadie ha abierto esa app desde el cambio, o su padrón no cargó |
  | el servicio de avisos respondió `<código>` | El Worker recibió la llamada y la rechazó |
  | no se pudo contactar el servicio de avisos | La llamada no llegó: red, o el Worker rechazando el origen. Lo segundo es poco probable: las dos apps se publican por ruta dentro del mismo sitio, y para el navegador el origen es el host, no la ruta |

  El motivo aparece en la misma tarjeta y también en la consola.

---

## [2.14.0] — 2026-10-04

### Corregido

- **Los hallazgos de puntos reincidentes se perdían en silencio** (SPEC-022).

  Al contestar NO en un punto que ya había fallado antes en esa máquina, el
  código abría un modal para preguntar si era una desviación nueva o la misma
  sin resolver. **Ese modal nunca se dibujó**: existía el estado y el manejador,
  pero nada los usaba.

  El punto contaba como NO y bajaba el cumplimiento, pero el hallazgo no se
  creaba. No llegaba al Gantt, al tablero, al ranking ni a ningún lado, y no
  había aviso de que se hubiera perdido.

  Pasaba justo en los puntos que más importan: los que reinciden. Un punto que
  fallaba por primera vez se registraba bien; uno con historia se perdía.

  El síntoma era un aviso de TypeScript —`handleConfirmarReincidencia` declarada
  y nunca usada— que se venía arrastrando como variable muerta de una
  refactorización.

### Cambiado

- **Un punto marcado «sigue abierta» también ofrece revisar las OT** (SPEC-021).
  No levanta hallazgo nuevo, pero es algo sin resolver en esa máquina, y llevar
  varias auditorías así es cuando más conviene preguntarle a Mantenimiento si
  alguien lo está viendo.

---

## [2.13.0] — 2026-10-02

### Agregado

- **Levantar una OT de Mantenimiento al cerrar un check de condiciones**
  (SPEC-021). Si la auditoría dejó hallazgos sobre una máquina, la app pregunta
  si quieres revisar las órdenes abiertas, te las muestra, y si ninguna cubre lo
  que encontraste puedes levantar una nueva sin salir.

  El momento en que alguien va a hacer algo con un hallazgo de condiciones es
  cuando todavía está frente a la máquina. Antes había que acordarse, salir y
  abrir la otra app, y en la práctica el hallazgo se quedaba en el reporte.

  **Solo levanta.** Asignar técnico, actividades, refacciones y cierre siguen
  siendo de la app de Mantenimiento.

  La OT queda marcada como originada en auditoría, con la fecha, el auditor y el
  hallazgo. Es lo que permite saber después cuántas OT nacen de auditorías y
  cuántas se cierran.

- `src/services/ot.ts`. Lee las OT abiertas de una máquina y levanta nuevas.

  No consulta `manto_db/ots`: las reglas de Mantenimiento no tienen `.indexOn`,
  así que una consulta filtrada descargaría el nodo completo —de 123 a 613 KB
  por revisión— y Realtime Database cobra por bytes bajados. Lee el índice que
  publica Mantenimiento, unos 525 bytes, y solo de la máquina que se auditó.

  El folio se aparta con una transacción en el servidor, así que no choca con
  una alta simultánea desde Mantenimiento. Si el servidor no confirma, no se
  levanta nada: un folio inventado desde aquí chocaría con una orden real.

### Cambiado

- El catálogo trae dos campos más desde Mantenimiento: `nombreManto` y `naves`.
  El `equipo` de una OT guarda el **nombre** de la máquina, no la clave, y para
  tres no coinciden (Omega/OME1, Depuradora/DEP1, Depuradora acondicionado/DEP2).

  La caché cambió de llave (`catalogoManto.v2`), así que la guardada se descarta
  y se baja de nuevo. Mientras no estén esos campos el paso de OT no se ofrece:
  en la primera apertura después de actualizar no aparece, y entra en la
  siguiente.

---

## [2.12.0] — 2026-10-02

### Cambiado

- **El catálogo de máquinas y zonas ya no vive aquí** (SPEC-020). Su dueño es la
  app de Mantenimiento; esta app lo lee.

  Era el mismo problema que tenía la lista de personal antes de centralizarla en
  RRHH: dos copias de lo mismo, actualizadas a distinto ritmo. Al compararlas,
  solo **21 de 33** registros coincidían. Faltaban PEG3, REV5 y REV7, que sí se
  auditan; sobraba REV8, que no existe en planta; y tres máquinas tenían un
  nombre distinto en cada app.

  **La app arranca con el catálogo guardado en el dispositivo** y pregunta a
  Mantenimiento en segundo plano si cambió. Lo que se baje entra en la siguiente
  apertura, para no cambiarle las listas debajo a quien esté capturando.

  Si la lectura falla, se sigue con lo último guardado y, si nunca se guardó
  nada, con la lista escrita en el código. Un corte de red deja la app como
  estaba antes de este cambio.

### Agregado

- `src/services/catalogo.ts`. Lee el catálogo de Mantenimiento con caché y
  respaldo. Antes de bajar las fichas consulta `manto_db/catalogoVer`, un número
  de unos quince bytes, y solo descarga las listas completas cuando cambió:
  Realtime Database cobra por bytes bajados, y sin esto cada apertura costaría
  8 KB para descubrir que el catálogo es el mismo de ayer.

### Corregido

- **REV8 sale del catálogo**: no existe en planta.
- **PEG3, REV5 y REV7 entran**: se auditan y faltaban.
- Omega, Depuradora y Depuradora acondicionado quedan como **OME1**, **DEP1** y
  **DEP2**, que es como ya estaban aquí. En Mantenimiento conservan su nombre
  porque las OT guardan la máquina por nombre y renombrarlas dejaría huérfanas
  las órdenes ya levantadas.

### Pendiente

- **ZEI1** existe aquí y no en Mantenimiento. Hasta que se dé de alta allá, el
  catálogo que llega trae 34 registros en lugar de 35.
- El **plano de nave** sigue escrito en el código y contradice al catálogo: dice
  que REV5 y REV7 se retiraron y que REV8 existe. No rompe nada —un elemento sin
  máquina se pinta como «Sin auditorías»— pero el dibujo necesita corregirse.

---

## [2.11.0] — 2026-10-02

### Agregado

- **Tarjeta «Comportamiento»** en el inicio (SPEC-019). Las demás pantallas
  miran la planta; esta mira a una persona y contesta «¿y yo cómo voy?».

  - **Como auditor**: de sus máquinas asignadas, a cuáles ya les hizo su
    revisión —de proceso y de 5S por separado— y a cuáles le falta.
  - **Como auditado**: las auditorías que le hicieron, con su cumplimiento,
    sus hallazgos y quién lo auditó.
  - **Su Gantt**: los hallazgos abiertos de sus propias auditorías, con
    seguridad primero y lo más vencido después.

  Un **corte por fecha** evita que «ya la revisó» sea cierto para siempre, y el
  **ADMIN puede ver a cualquiera**: la jefatura no tiene máquinas asignadas, así
  que sin eso la pantalla le saldría vacía.

- **Campo `nominaAuditor`** en las auditorías nuevas. Para saber quién hizo una
  solo existía el nombre escrito a mano, que es editable. Los documentos
  anteriores se siguen reconociendo por nombre, y la pantalla lo declara.

### Cambiado

- **La matriz de supervisores por máquina se movió a `utils/comportamiento.ts`.**
  Estaba dentro de `App.tsx` mezclada con la búsqueda en el padrón y solo sabía
  responder «¿quién atiende esta máquina?»; esta pantalla necesita lo contrario.
  Sigue siendo una lista fija en código —la deuda técnica 2— pero ya está en un
  solo lugar y es probable.

  Archivo nuevo `src/utils/comportamiento.ts`, verificado con 40 casos de la
  lógica y 13 de la pantalla.

### Pendiente de decidir

- Si esta pantalla resulta suficiente, **se retira el Gantt general**. Primero
  hay que usarla.

---

## [2.10.0] — 2026-10-02

### Cambiado

- **El periodo pasa de una lista a tres controles** (SPEC-018): **Año**, **Mes**
  y el botón **Últimos 3 meses**. Los 19 meses en una sola lista obligaban a
  recorrerla entera, y cada mes que Calidad cargue la hacía más larga.

  Ahora ninguna lista pasa de trece renglones, y no crecen con los años: un año
  nuevo agrega una opción al primer control, no doce al único.

  El mes depende del año y está bloqueado hasta elegirlo, porque «julio» a secas
  sería ambiguo. Cambiar de año limpia el mes. Solo el año abarca enero a
  diciembre. El atajo de tres meses va aparte porque cruza el año, y mientras
  está activo bloquea los dos selectores.

  Sin filtro, la pantalla ahora dice qué está viendo —19 meses, de enero 2025 a
  julio 2026— en vez de quedarse muda.

- **«Dónde se concentran los rechazos» pasa a «Prioridades a revisar».** El
  nombre anterior describía el dato; el nuevo describe para qué sirve.

### Retirado

- **La tarjeta «Explican el 80%»** del resumen. El dato no se perdió: sigue
  pintando en rojo a esas máquinas y el inicio lo resume. Como tarjeta competía
  con los dos números que de verdad se leen sin aportar una tercera cosa.

  Verificado con 15 casos de la pantalla montada.

---

## [2.9.0] — 2026-10-01

### Agregado

- **Filtro de periodo en la pantalla de rechazos** (SPEC-017): todo el
  histórico, los últimos 3 meses con datos, o cualquiera de los 19 meses.

  Todo se recalcula con el periodo —metros, defectos, participación y qué
  máquinas explican el 80%—, porque **el perfil de una máquina cambia según el
  mes**: en RT7 el histórico dice lagrimeo primero y julio dice raya. Un
  promedio de veinte meses nunca lo habría mostrado.

  Para lograrlo se copió de Control el detalle **mes por mes** en lugar de solo
  los totales. Pesa 10 KB, viaja en el código y no cuesta una lectura. Los
  totales del histórico salen idénticos a los de antes.

  «Últimos 3 meses» son los últimos **con datos**, no los del calendario: si
  Calidad lleva meses sin cargar merma, contar meses vacíos daría un periodo
  vacío y parecería una falla.

### Corregido

- **Las tarjetas mezclaban `border` con `borderTop`.** React avisaba de que eso
  puede dejar el estilo a medias al redibujar. Los cuatro lados van ahora por
  separado.

### Avisos que la pantalla ahora da

- **El último mes cargado es julio de 2026**: tres meses sin merma nueva de
  Calidad. Sin decirlo, un agosto vacío parecería un error del filtro.
- **1 072 metros tienen un año mal capturado** —RT6 · RAYA · «2006-06»—. Cuentan
  en el total porque Calidad también los cuenta, pero no caen en ningún mes.
  Conviene corregirlo del lado de Control.

  Verificado con 31 casos de la lógica y 8 de la pantalla.

---

## [2.8.0] — 2026-10-01

### Cambiado

- **La pantalla de rechazos pasa a tarjetas de cartera** (SPEC-016). Era una
  lista de 33 renglones con un filtro arriba; ahora es **un bloque por proceso**
  —ordenados por lo que cuesta cada uno— y dentro, las máquinas apiladas como
  tarjetas: cerradas solo asoma su lomo con nombre y metros, y al tocar una se
  trae al frente con su participación en la planta y sus principales defectos,
  cada uno con su barra.

  El filtro de familia desaparece: los bloques son la agrupación. Solo una
  tarjeta al frente a la vez. Las 33 máquinas y áreas siguen ahí, incluidas las
  que no rechazan.

### Corregido

- **El botón de exportar PDF imprimía el módulo completo** (SPEC-015). Llamaba a
  `window.print()`, así que salían el encabezado de la app, el resumen y los
  filtros, y el cronograma se repartía en cuatro hojas.

  Ahora arma un documento solo con los datos del Gantt y lo imprime: tabla en
  horizontal, encabezado repetido en cada hoja, sin renglones partidos, y con
  los filtros que estaban puestos anotados arriba. Usa un marco oculto en vez de
  una ventana nueva, que el navegador bloquearía.

  Verificado con 10 casos de las pantallas montadas.

---

## [2.7.1] — 2026-10-01

### Corregido

- **Al cerrar un hallazgo, su renglón desaparecía del tablero en el acto**
  (SPEC-014). Era consecuencia de la SPEC-011 —el tablero solo muestra lo
  abierto— pero dejaba sin confirmación de que se guardó y sin manera de
  deshacer un clic mal dado, en la única pantalla donde ese hallazgo estaba.

  Ahora lo que se cierra **se queda a la vista durante la visita**: marcado
  ✓ CERRADO en verde, atenuado, al final de la tabla y con «Toca para
  deshacer». Al salir del tablero ese recuerdo se borra, así que al volver
  vuelve a mostrarse solo lo abierto y la SPEC-011 sigue intacta.

- **Una escritura fallida de estatus ya no se queda callada.** Antes el error
  solo iba a la consola: el renglón se quedaba igual y la pantalla se veía
  idéntica a no haber hecho nada. Ahora avisa, y no marca nada como cerrado.

  Verificado con 6 casos de la lógica y 6 del flujo montado, incluido el de la
  escritura que falla.

---

## [2.7.0] — 2026-09-30

### Cambiado

- **«Módulo de Calidad» pasa a «Módulo de Condiciones»** en la tarjeta de
  Condiciones y 5S. El nombre anterior se confundía con la app de Calidad, que
  es otra cosa.

- **La pantalla de cobertura se convierte en «Dónde se concentran los
  rechazos»** (SPEC-013, retira la SPEC-008). Se retiró la lógica de días sin
  auditar: con una semana de uso, un tablero donde 33 de 33 salían en rojo no
  orientaba. Queda lo que sí orienta:

  | Columna | Qué muestra |
  |---|---|
  | Metros rechazados | Lo que cuesta esa máquina, y su % de la planta |
  | **Principales defectos** | Los cuatro que más pesan, con su % **de esa máquina** |

  En rojo los defectos que pesan 30% o más, porque ahí el problema ya tiene
  nombre: RT6 es 42.9% raya, PEG2 es 43.3% adhesivo, FL4 es 17.6% tonos.

  Ordenado por metros rechazados. Las 33 filas del catálogo siguen ahí; las que
  no rechazan caen al final y dicen «Sin rechazos registrados», que no es lo
  mismo que un dato faltante.

### Retirado

Con la SPEC-008 se fueron el objetivo de 15 días, los contadores de atrasadas y
nunca auditadas, el selector de orden y el cuadrante de cumplimiento. **La app
deja de leer el documento `configuracion/cobertura`** —una escucha menos— aunque
el documento sigue en Firestore por si se retoma.

`src/utils/cobertura.ts` **se conserva sin usarse**, y la SPEC-008 se conserva
completa en SPECS.md: explican un razonamiento que sigue siendo válido aunque la
pantalla ya no lo use.

---

## [2.6.1] — 2026-09-30

Salieron de mirar las primeras 16 auditorías reales.

### Corregido

- **El subtítulo de la cobertura contradecía el orden activo.** Decía siempre
  «Ordenado por abandono», incluso con el selector en «Costo»: la tabla hacía
  una cosa y el encabezado decía otra. Ahora sigue al selector.

- **El ranking enterraba la seguridad.** Un punto de seguridad fallando 3 de 4
  veces quedaba en gris pequeño dentro de «Sin historia suficiente»,
  indistinguible de uno al 0%. La regla del umbral es correcta para ordenar
  —con cuatro revisiones el porcentaje es ruido— pero la SPEC-010 dice que la
  seguridad va primero en cualquier pantalla donde compita con otra cosa.

  Ahora los puntos de seguridad **que ya fallaron** salen en una banda roja
  arriba de la tabla, con su porcentaje y su conteo, y los demás puntos de
  seguridad llevan distintivo en el ranking. No se mueven al ranking: siguen sin
  historia para ordenarse, pero dejan de estar escondidos.

- **El ranking podía sumar dos preguntas distintas como si fueran una.**
  Agrupaba solo por número de punto, y los números son por plantilla: el punto 7
  de Pegado y el 7 de Flexografía no son la misma pregunta. En cuanto se
  editara una plantilla, el ranking las habría mezclado sin avisar.

  Ahora agrupa por **número y texto**. Dos preguntas distintas ya no se mezclan,
  y una misma pregunta reescrita aparece partida en dos renglones, que es un
  error a la vista en vez de uno silencioso. Los acentos, las mayúsculas y los
  espacios de más no separan nada.

  Verificado con 15 casos de la lógica y 4 de las pantallas.

---

## [2.6.0] — 2026-09-29

Con esto quedan **implementadas las seis specs** del cambio de enfoque.

### Agregado

- **Ranking de puntos que más fallan** (SPEC-007). Pantalla nueva. Agrupa las
  respuestas por punto del checklist en vez de por auditoría, que es lo que
  permite mejorar el procedimiento y no solo señalar la auditoría que salió mal.

  - **Dos tableros que nunca se mezclan**: 5S es comparable en toda la planta;
    proceso obliga a elegir familia, porque su checklist es distinto en cada una
    y el «punto 4» de Pegado no es la misma pregunta que el de Flexografía.
  - Los puntos con menos de **5 revisiones** se listan aparte y no compiten por
    el primer lugar: uno respondido una vez y fallado daría 100%.
  - Cada renglón se abre con el desglose **por máquina y por turno**, y la app
    dice qué significa: si falla **parejo**, se corrige el procedimiento; si
    falla **en un solo lado**, se atiende ahí.
  - **No publica nombres de personas.** Un tablero por nombre cambia el
    incentivo y degrada el dato.

- **La cobertura se cruza con los metros rechazados** (SPEC-012). Dos columnas
  nuevas —metros rechazados y la lectura del cuadrante— y, por omisión, el orden
  lo manda el costo: primero lo atrasado, y dentro de lo atrasado, lo que más
  rechaza. El orden por puro abandono queda a un clic.

  - Los números salen del histórico de Control de Procesos, 2025 y 2026. En rojo
    las **cuatro máquinas que explican el 80%** de la merma: RT7, RT6, FL1, FL4.
  - El cuadrante cruza costo con cumplimiento. El caso que importa es
    **«el checklist no pregunta lo que importa»**: una máquina que cumple bien
    la auditoría y aun así rechaza mucho. Eso es un hallazgo sobre el checklist.
  - **No se multiplican días por metros**: ese número escondería de cuál de los
    dos viene la urgencia.
  - Los porcentajes suman **98.8%** a propósito. El 1.2% restante son 15 059
    metros de identificadores que el catálogo de esta app no tiene (`LAM`,
    `PEG3`, `XEIKON`, `PEG1 ` con espacio…). Se dejan en el denominador para que
    RT7 diga 36.6% aquí y 36.6% en la pantalla de Calidad, y no dos números
    distintos.

  Archivos nuevos `src/utils/ranking.ts` y `src/utils/merma.ts`, verificados con
  56 casos de la lógica pura y 9 de las pantallas.

### Pendiente

- **El resumen de merma es una copia, no una consulta**, porque las dos apps
  están en proyectos de Firebase distintos y la cuota es por proyecto. Para que
  se actualice solo, Control tiene que publicar ese resumen en un documento del
  proyecto de la suite. Ese cambio es del repositorio de Control;
  `MERMA_PUBLICADA` es el hueco donde entra.

---

## [2.5.0] — 2026-09-29

### Agregado

- **El tablero muestra solo lo que sigue abierto** (SPEC-011). El Gantt dibujaba
  cada hallazgo de cada auditoría, incluidos los cerrados: con uso real, cientos
  de barras. Ahora quedan los abiertos, ordenados con la seguridad al frente y
  lo más vencido después. Arriba, un resumen de abiertos, vencidos, de seguridad
  y reincidentes.

  **Nada se borró ni se archivó.** Lo cerrado sigue en su auditoría y en el
  historial de su punto; de ahí lo lee la reincidencia, así que tiene que seguir
  siendo consultable.

- **Reincidencia de verdad** (SPEC-009). Antes se detectaba buscando la palabra
  «reincidente» dentro del texto escrito a mano, y fallaba en los dos sentidos.
  Ahora la llave es `(maquinaId, puntoId)`: un hallazgo reincide cuando ese
  punto ya falló en esa máquina **y aquel se cerró**. Si el anterior sigue
  abierto no es reincidencia, es que nunca se resolvió.

  Junto a la etiqueta va lo que importa: la fecha en que ya falló, la acción que
  se intentó, el responsable y cuántos días aguantó cerrado. El botón abre el
  historial completo del punto en esa máquina.

- **Los hallazgos de seguridad se separan** (SPEC-010). Se clasifican por el
  punto que los originó: los tres de la sección 4 del checklist de 5S más
  «guardas, cubiertas y protecciones» de la sección 3. Aparecen con distintivo
  rojo y van primero en el tablero.

  Los hallazgos levantados fuera del checklist no tienen punto de dónde
  deducirlo, así que ahora se pregunta con una casilla al capturarlos.

- Campo **`cerradoEn`**: cuándo se marcó terminado de verdad. `fechaCierre` es
  la fecha comprometida al levantarlo, y sin la real no se puede saber cuánto
  aguantó un hallazgo antes de volver.

  Archivo nuevo `src/utils/hallazgos.ts`, verificado con 39 casos de la lógica
  pura y 6 de las pantallas.

### Corregido

- **La tabla de cobertura no se alineaba con sus encabezados.** `#root` trae un
  `text-align: center` heredado de la plantilla de Vite y las celdas lo
  heredaban. Se corrigió en la tabla y **no en `#root`**, que habría cambiado la
  apariencia de toda la app.

---

## [2.4.0] — 2026-09-29

### Agregado

- **Cobertura de auditoría** (SPEC-008). Pantalla nueva, con su tarjeta en el
  inicio: las 33 máquinas y áreas ordenadas por **días desde la última
  auditoría**, con columnas separadas para validación de proceso y para 5S,
  porque una máquina puede estar al día en una y llevar meses sin la otra.

  - **Ordenada por abandono, no alfabética.** Las que nunca se han auditado van
    primero, y entre ellas, antes las que no tienen ninguno de los dos tipos.
  - **«Nunca» es el caso más grave, no un dato faltante**, y se ve distinto de
    «No aplica», que es lo que muestran las áreas auxiliares en la columna de
    proceso porque no llevan ese tipo de auditoría.
  - En rojo lo que alcanzó o pasó el objetivo de **15 días**; con el cursor
    encima del número aparece la fecha exacta.
  - El objetivo se guarda en `configuracion/cobertura` y lo cambia `ADMIN` desde
    la misma pantalla. Es **un documento**, no una colección: una sola escucha.
  - Se calcula sobre **todas** las auditorías, no sobre las del usuario. Un
    supervisor que sólo viera las suyas encontraría media planta «sin auditar»
    cuando la revisó alguien más, y ese hueco falso es lo contrario de lo que la
    pantalla existe para mostrar.

  Archivo nuevo `src/utils/cobertura.ts`, verificado con 28 casos de la lógica
  pura y 7 de la pantalla montada.

### Corregido

- **Las auditorías de proceso de 22 de las 26 máquinas se leían como 5S.**
  `resolverTipoAuditoria` deducía el tipo en lugar de creerle al documento, y
  una de sus condiciones marcaba como 5S cualquier auditoría con respuestas en
  una máquina que no fuera Pegado —la única con plantilla de proceso por
  omisión—. La regla venía de reparar documentos viejos, pero también reescribía
  en silencio los nuevos, bien guardados.

  Salió al construir la SPEC-008: su columna «sin validar proceso» habría dicho
  «Nunca» para siempre en esas 22 máquinas.

  Ahora se respeta el `tipoAuditoria` guardado cuando es entendible, y la
  deducción queda sólo como respaldo para documentos sin el campo. No existe
  ninguno: la colección se vació el mismo día. Verificado con 12 casos.

  **Toca código compartido** —el histórico, el Gantt y los filtros usan esa
  función—, por eso se dejó el respaldo en lugar de borrar la regla anterior.

---

## [2.3.1] — 2026-09-29

### Documentado

Sólo specs. **No se tocó una línea de código**: es el diseño del cambio de
enfoque, escrito para revisarse antes de implementar.

- **SPEC-007 — Ranking de puntos que más fallan.** Agrupa las `respuestas` por
  punto del checklist en vez de por auditoría. Los dos tipos de auditoría no se
  mezclan: 5S es comparable en toda la planta, proceso sólo dentro de su familia
  de máquina.
- **SPEC-008 — Cobertura: qué no se ha auditado.** Invierte la mirada de la app:
  máquinas y zonas ordenadas por días sin auditar. Es la única de las seis que
  sirve desde la primera auditoría.
- **SPEC-009 — Reincidencia por punto y máquina.** Sustituye la detección actual,
  que busca la palabra «reincidente» dentro del texto escrito a mano, por la
  llave `(maquinaId, puntoId)`.
- **SPEC-010 — Los hallazgos de seguridad.** Se apoya en que la sección 4 del
  checklist de 5S ya es seguridad, así que no hace falta campo de severidad.
- **SPEC-011 — El tablero acotado, y dónde vive lo cerrado.** El Gantt pasa a
  mostrar sólo lo abierto. Nada se borra ni se archiva: lo cerrado debe seguir
  siendo consultable o la SPEC-009 deja de funcionar.
- **SPEC-012 — El foco compartido con Control de Procesos.** Cruza la cobertura
  con los metros rechazados que esa app ya calcula. Se comparte un resumen, no
  la base: son proyectos distintos y la cuota del plan gratuito es por proyecto.

### Decidido

Ingeniería de Procesos resolvió el mismo día los tres valores que bloqueaban la
implementación. Los tres quedan configurables desde la app, no fijos en código:

- **Frecuencia objetivo de auditoría: 15 días**, tanto 5S como proceso
  (SPEC-008). Son dos revisiones al mes por máquina y por tipo; conviene
  contrastarlo contra la capacidad real de auditoría en los primeros meses.
- **Mínimo para entrar al ranking: 5 revisiones** (SPEC-007).
- **Cuentan como seguridad** los tres puntos de la sección 4 del checklist de
  5S, más «guardas, cubiertas y protecciones» de la sección 3 (SPEC-010).

Sigue pendiente el contenido de la matriz defecto ↔ variable, que define una
junta de calidad y sólo bloquea una parte de la SPEC-012.

### Datos

- Se borró la colección `evaluaciones_proceso` completa. Eran auditorías de
  prueba. Las plantillas (`plantillas_checklists` y `plantillas_5s`) se
  conservaron.

---

## [2.3.0] — 2026-09-21

### Corregido
- **SPEC-006:** al llegar desde el portal ya no se ve la pantalla de contraseña
  de paso. Si hay sesión aparece la marca IMPREDIMEX; si no, la contraseña al
  instante.

### Cambiado
- La pantalla «Cargando…» pasa a ser la misma marca blanca de las demás apps.

---

## [2.2.0] — 2026-09-20

### Cambiado
- **SPEC-005:** encabezado estándar de la suite, el mismo de Recursos Humanos,
  EPP y Calidad. Fijo arriba, opaco y de borde a borde; marca en Jost a la
  izquierda, botones a la derecha; nombre y puesto centrados en pantalla ancha.
- **El nombre de la app pasa de «Control de Proceso» a «Ingeniería de
  Procesos»**, como la llaman el portal y el título de la página. El anterior se
  confundía con Calidad, que se llama «Control de Procesos».
- **La flecha de regreso va a la izquierda de la marca**, y solo fuera del
  inicio.
- **El botón del histórico pasa a círculo con borde**, conservando su número.
  El relleno azul queda solo para la nómina.

### Agregado
- **Panel al tocar la nómina**, con nombre, puesto, conexión, nómina y papel.
  En el teléfono es el único lugar donde el nombre completo cabe sin cortarse.
- **Botón de portal** y **punto de conexión** sobre la nómina.

### Corregido
- **El encabezado se veía lavado en iOS.** Tenía transparencia y desenfoque de
  fondo; ahora es blanco opaco.

### Notas
- Cerrar sesión se mudó al panel y conserva su confirmación (SPEC-002).
- La base ya traía dos errores de TypeScript (una función sin usar y la
  declaración de tipos de `index.css`). No bloquean la publicación, porque ésta
  corre solo `vite build`, y este cambio no agrega ninguno.

---

## [2.1.0] — 2026-09-04

### Agregado
- **SPEC-004:** El papel del usuario dentro de la app se lee del campo `roles` del
  colaborador en la suite. Se agrega `rol` a `UserProfile`.

### Cambiado
- El administrador deja de estar fijo en el código. La condición
  `nomina === '2435'` se sustituye por `rol === 'ADMIN'`. Nombrar administradores
  ya no requiere publicar la aplicación.

### Seguridad
- Última nómina que quedaba escrita en el código para conceder privilegios.
  Los permisos ahora viven íntegramente en Firestore.

---

## [2.0.0] — 2026-09-03

Primera integración con la suite Impredimex. La app deja de ser autónoma en materia
de identidad: el login y la lista de personal pasan a leerse del proyecto compartido
`impredimex-suite`. Los datos propios de la app (evaluaciones, plantillas 5S y
checklists) no se movieron.

### Agregado
- **SPEC-001:** Autenticación contra Firebase Auth del proyecto suite. El usuario
  escribe su nómina y una clave de 6 dígitos; la app compone el identificador
  `<nómina>@impredimex.local` internamente. La sesión la administra Firebase y
  sobrevive al recargar la página.
- **SPEC-003:** La lista de personal se lee de la colección `colaboradores` de la
  suite, filtrada por quienes tienen `procesos` en su campo `apps` y están activos.
- Nuevo archivo `src/services/suite.ts` con la conexión al proyecto compartido.
  La app ahora inicializa dos proyectos de Firebase: el propio para sus datos y el
  de la suite, con nombre `'suite'`, para identidad y personal.
- Pantalla de carga mientras Firebase restaura una sesión existente.
- Mensajes de error en español para los fallos de autenticación.
- Este CHANGELOG y el documento SPECS.md, que antes no existían.

### Cambiado
- **Ruptura:** la clave de acceso pasa de 4 a 6 dígitos, por el mínimo que impone
  Firebase Auth. Todos los usuarios necesitan una clave nueva.
- **Ruptura:** el campo de nómina deja de ser un desplegable y pasa a ser un campo
  de texto. La lista de personal ya no puede mostrarse antes de iniciar sesión,
  porque las reglas de Firestore exigen sesión activa para leerla. Como efecto
  secundario, la app ya no revela quiénes son los supervisores a quien la abra.
- **SPEC-002:** El cierre de sesión ahora invoca `signOut` en lugar de borrar el
  navegador local.

### Eliminado
- La constante con las 10 personas y sus PIN de 4 dígitos escritas en `App.tsx`.
  Esos PIN eran visibles para cualquiera en el repositorio público y quedaron
  invalidados.
- El guardado de sesión en `localStorage` bajo la llave `impredimex_user_session`.
- El parche que corregía el nombre de la nómina 2435 al restaurar la sesión; el
  nombre ahora viene correcto desde la suite.

### Seguridad
- Ninguna credencial permanece en el repositorio. Las claves las guarda Firebase
  Auth cifradas.
- El acceso deja de ser implícito: tener cuenta ya no basta, hace falta el permiso
  explícito `procesos` en el campo `apps` del colaborador.
- **Pendiente:** los PIN anteriores siguen siendo recuperables del historial de
  commits. Quedaron invalidados al cambiar el sistema de acceso, pero no deben
  reutilizarse como claves nuevas.

---

## [1.x] — anterior a 2026-09-03

Versiones previas a la adopción de este CHANGELOG. El historial está en los commits
del repositorio. Incluyen los módulos de evaluaciones de proceso, plantillas 5S,
checklists, Gantt de hallazgos y layout 3D de planta.
