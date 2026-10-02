# SPECS.md — Ingeniería de Procesos (proceso-pwa)

## Especificaciones funcionales del sistema

Este documento es la **fuente de verdad** del comportamiento de la aplicación.
Cualquier cambio futuro debe partir de actualizar primero estas specs y luego
implementar el código.

**Versión:** 1.0
**Fecha:** 3 de septiembre de 2026
**Metodología:** Spec-Driven Development (SDD)

> **Nota de alcance.** Este documento arrancó con las specs de autenticación e
> identidad, que son las que cambiaron al integrarse a la suite Impredimex. A
> partir del 29 de septiembre de 2026 se suman las **SPEC-007 a la SPEC-012**,
> que especifican **cómo se analizan** las auditorías: el cambio de enfoque de
> registrar a decidir. La **captura** de 5S, checklists y evaluaciones, y el
> layout 3D, siguen sin spec: ahí el código continúa siendo la única
> descripción.

---

## Convenciones del documento

Cada spec sigue esta estructura:

- **Actor** — Quién ejecuta el flujo
- **Precondiciones** — Qué debe cumplirse antes de iniciar
- **Flujo principal** — Pasos exactos del comportamiento esperado
- **Postcondiciones** — Estado del sistema al terminar correctamente
- **Reglas de negocio** — Condiciones especiales y restricciones
- **Flujos alternativos** — Casos de error o rutas opcionales

---

# SPEC-001 — Autenticación de usuario

### Actor
Cualquier persona con acceso autorizado a Ingeniería de Procesos.

### Precondiciones
- La persona existe en la colección `colaboradores` del proyecto **impredimex-suite**
- Su campo `estatus` es `ACTIVO`
- Su campo `apps` incluye el valor `procesos`
- Tiene una cuenta en Firebase Auth del proyecto suite, con identificador
  `<noNomina>@impredimex.local`
- Conexión a internet activa

### Flujo principal
1. Sistema muestra la pantalla de acceso con dos campos: número de nómina y clave
2. Usuario escribe su número de nómina
3. Usuario escribe su clave de 6 dígitos
4. Usuario presiona "Ingresar al Sistema"
5. Sistema deshabilita el botón y muestra "Verificando…"
6. Sistema compone el identificador `<nómina>@impredimex.local`
7. Sistema invoca `signInWithEmailAndPassword` contra Firebase Auth del proyecto suite
8. Al confirmarse la sesión, el sistema lee el documento `colaboradores/<nómina>`
9. Sistema valida que `estatus` sea `ACTIVO` y que `apps` incluya `procesos`
10. Sistema carga en memoria la lista de colaboradores activos con acceso a esta app
11. Sistema arma `usuarioActivo` con nómina, nombre y puesto tomados de la suite
12. Sistema navega al launcher de módulos

### Postcondiciones
- La sesión queda abierta y administrada por Firebase Auth
- `usuarioActivo` contiene datos leídos de la suite, no escritos en el código
- `USUARIOS_SISTEMA` contiene la lista vigente de personas con acceso, usada por
  los selectores de supervisor y auditado
- La sesión sobrevive al recargar la página y persiste hasta cerrar sesión
  explícitamente

### Reglas de negocio
- **Las claves no viven en el repositorio.** Las guarda Firebase Auth cifradas.
  Ningún archivo del proyecto contiene claves ni PIN.
- **La lista de personal no vive en el repositorio.** Se lee de la suite en cada
  inicio de sesión.
- **Longitud mínima de clave: 6 caracteres**, impuesta por Firebase Auth.
- **Tener cuenta no da acceso.** El acceso lo otorga el valor `procesos` dentro del
  campo `apps` del colaborador. Una persona puede tener cuenta para la suite y no
  poder entrar a esta app.
- **El identificador es la nómina.** El dominio `@impredimex.local` no existe como
  dominio real; solo forma un identificador único. Firebase no envía correos ni
  verifica el dominio.
- **No hay autoservicio de recuperación de clave.** El administrador la restablece
  desde la consola de Firebase.
- **La nómina no se muestra en un desplegable.** El usuario la escribe. Un
  desplegable revelaría la lista de personal antes de iniciar sesión, y las reglas
  de Firestore exigen sesión activa para leerla.

### Flujos alternativos
- **Nómina o clave incorrecta:** mensaje "Nómina o clave incorrecta"
- **Clave menor a 6 dígitos:** mensaje "La clave es de 6 dígitos", sin llamar a Firebase
- **Cuenta válida sin permiso para esta app:** el sistema cierra la sesión recién
  abierta y muestra "Tu cuenta no tiene acceso a esta aplicación"
- **Colaborador dado de baja:** mismo tratamiento que sin permiso
- **Demasiados intentos fallidos:** Firebase bloquea temporalmente; mensaje
  "Demasiados intentos fallidos. Espera unos minutos"
- **Sin conexión:** mensaje "Sin conexión. Revisa tu red e inténtalo otra vez".
  A diferencia de MantoApp, esta app **no** permite entrar en modo offline, porque
  la validación de identidad ocurre contra el servidor.

---

# SPEC-002 — Cierre de sesión

### Actor
Usuario autenticado.

### Precondiciones
- Sesión activa

### Flujo principal
1. Usuario toca el círculo de su nómina y, en el panel, **Cerrar sesión** (SPEC-005)
2. Sistema pide confirmación
3. Usuario confirma
4. Sistema invoca `signOut` en Firebase Auth del proyecto suite
5. Sistema limpia `USUARIOS_SISTEMA` y `usuarioActivo`
6. Sistema regresa a la pantalla de acceso

### Postcondiciones
- No queda rastro de la sesión en el dispositivo
- La lista de personal en memoria queda vacía
- Recargar la página muestra la pantalla de acceso

### Reglas de negocio
- El cierre de sesión afecta únicamente a esta app. Las demás apps de la suite
  mantienen su propia sesión de forma independiente.

### Flujos alternativos
- **Usuario cancela la confirmación:** no ocurre nada, la sesión sigue abierta

---

# SPEC-003 — Origen de los datos de personal

### Actor
Sistema (no hay interacción directa del usuario).

### Precondiciones
- Sesión activa en el proyecto suite

### Flujo principal
1. Al confirmarse la sesión, el sistema consulta `colaboradores` en la suite
2. Filtra por `apps` que contenga `procesos` y `estatus` igual a `ACTIVO`
3. Ordena el resultado por número de nómina ascendente
4. Guarda la lista en memoria para los selectores de supervisor y auditado

### Postcondiciones
- Los selectores muestran únicamente personas vigentes con acceso a esta app
- La app no conserva ninguna copia propia del personal

### Reglas de negocio
- **Esta app nunca escribe en `colaboradores`.** Solo RRHH modifica el personal.
  Las reglas de Firestore lo impiden a nivel de servidor, no solo por convención.
- **Las evaluaciones guardan copia, no referencia.** Cada evaluación almacena
  `nominaAuditado`, `nominaSupervisor` y `nombreSupervisor` tal como estaban al
  momento de levantarla. Corregir después la lista de personal no altera el
  historial.
- **La lista se refresca al iniciar sesión, no en tiempo real.** Un alta o baja
  hecha por RRHH se refleja en esta app la próxima vez que la persona entre.
- Las asignaciones de supervisor por área y familia de máquina siguen definidas
  por número de nómina dentro del código. Migrarlas a datos es trabajo pendiente,
  registrado como deuda técnica.

### Flujos alternativos
- **Falla la lectura del personal:** mensaje "No se pudo cargar tu perfil. Revisa
  tu conexión". El sistema no entra con una lista vacía.

---

# SPEC-004 — Papel del usuario dentro de la app

### Actor
Sistema, a partir de los datos de la persona autenticada.

### Precondiciones
- Sesión iniciada (SPEC-001)
- El documento del colaborador tiene un campo `roles`

### Flujo principal
1. Al preparar la sesión, el sistema lee `roles.procesos` del colaborador
2. Si el campo no existe, asume `SUPERVISOR`
3. El valor queda en `usuarioActivo.rol` y determina qué historial se muestra

### Postcondiciones
- Un usuario con rol `ADMIN` ve todas las auditorías de todas las personas
- Cualquier otro rol ve únicamente las auditorías donde figura como supervisor

### Reglas de negocio
- **El administrador se nombra desde la suite, no desde el código.** Antes estaba
  fijo en la nómina 2435; ahora depende del campo `roles.procesos`. Nombrar o
  quitar un administrador no requiere publicar la aplicación.
- **El rol es por app, no global.** Una persona puede ser `ADMIN` en EPP y
  `SUPERVISOR` aquí. Cada app lee únicamente su propia entrada dentro de `roles`.
- **Ausencia de rol equivale a supervisor.** Nunca concede privilegios por omisión.
- Los roles vigentes en esta app son `ADMIN` y `SUPERVISOR`. Cualquier otro valor
  se comporta como supervisor.

### Flujos alternativos
- **Colaborador sin campo `roles`:** entra como supervisor
- **Cambio de rol con la sesión abierta:** surte efecto en el siguiente inicio de
  sesión, porque el rol se lee una sola vez al entrar

---

# SPEC-005 — Encabezado estándar de la suite

### Alcance

El encabezado es el mismo en las aplicaciones de la suite. Está definido en la
SPEC-035 del repositorio `rrhh-pwa`, que es la referencia; aquí se registra cómo
se aplicó en esta app y lo que tiene de particular.

### Qué hace

- **Marca a la izquierda, botones a la derecha, de borde a borde.** IMPREDIMEX en
  Jost peso 600 con espaciado amplio; debajo, «INGENIERÍA DE PROCESOS» en
  mayúsculas finas y grises.
- **Fijo arriba y opaco.** Sin la transparencia y el desenfoque que tenía, que
  dejaban pasar el fondo y lavaban el logotipo en iOS. Capa 45: por encima del
  contenido y por debajo de todas las ventanas emergentes (900 en adelante).
- **Nombre y puesto centrados, solo en pantalla ancha** (desde 760 px). En el
  teléfono no caben sin cortarse y viven en el panel.
- **Panel al tocar la nómina**: nombre, puesto, estado de conexión, nómina y
  papel, más «Ir al portal» y «Cerrar sesión».
- **Botón de portal**, los cuatro cuadros.
- **El estado de conexión es un punto sobre la nómina**: verde con red, rojo sin
  ella, según lo que reporta el teléfono.

### Particular de esta app

- **El nombre de la app cambió de «Control de Proceso» a «Ingeniería de
  Procesos».** Es como la llaman el portal y el título de la página. El anterior
  era casi idéntico al de Calidad, que se llama «Control de Procesos», y las dos
  apps se confundían.
- **La flecha de regreso va a la izquierda**, antes de la marca, y solo aparece
  fuera de la pantalla de inicio. Es la posición que tiene en cualquier app de
  teléfono. La marca también regresa al inicio al tocarla, como antes.
- **El botón del histórico conserva su número**, pero pasa de círculo relleno a
  círculo con borde. El relleno azul queda reservado para el círculo de la
  nómina: juntos en la barra, dos círculos azules con números se confundían.
- **Cerrar sesión se mudó al panel** y conserva su confirmación (SPEC-002).
- **Los botones se ven de 32 px pero responden en 44**, igual que en las demás.

### Dónde vive el estilo

En `src/index.css`, como clases `.hdr-*`, igual que en Recursos Humanos. Los
colores van fijos porque esta app no define las variables de marca.

---

# SPEC-006 — Abrir sin mostrar la contraseña de paso

### Por qué

Al pasar del portal a una app, o de una app al portal, se veía un instante la
pantalla de contraseña aunque ya hubiera sesión. Cada página arrancaba con la
contraseña a la vista y solo la escondía cuando Firebase confirmaba la sesión y
terminaba de leer la ficha del padrón: entre medio segundo y un segundo y medio.

### Cómo funciona

- **Las seis páginas de la suite comparten una nota** en el almacenamiento del
  navegador (`impredimex:sesion`), porque viven en el mismo dominio. Se escribe
  al abrir sesión y se borra al cerrarla, o cuando Firebase dice que no la hay.
- **Un bloque en la cabecera de `index.html` la lee antes de dibujar nada.** Si
  hay sesión, cubre la pantalla con la marca IMPREDIMEX mientras la app termina
  de abrir. Si no la hay, la contraseña aparece al instante.
- **Si la nota miente** —la sesión expiró—, la marca dura un momento y aparece
  la contraseña, que es lo correcto.
- **Red de seguridad:** si en 8 segundos la app no terminó de abrir, la marca se
  quita sola. Nadie se queda viendo la marca sin salida.
- **Al mostrar un error de acceso la marca se quita siempre**, o taparía el
  mensaje con el motivo.
- La marca se dibuja con `html::after`, sin tocar el contenido de la página.

### Particular de esta app

La pantalla «Cargando…» se cambió por la misma marca blanca que muestran las
demás apps. `arranqueListo` vive en `index.html`; `App.tsx` le avisa con
`avisarArranque`.

---

# El cambio de enfoque — por qué existen las SPEC-007 a la SPEC-012

Las auditorías funcionaron desde el primer día: se capturan bien, se guardan
bien y no se perdió ninguna. El problema fue otro. **La aplicación quedó armada
para registrar y lo que hace falta es decidir.**

El síntoma concreto: el histórico devuelve todas las auditorías, y el Gantt
dibuja una barra por cada hallazgo de cada una. Con uso real eso son cientos de
barras. Responde «¿qué se encontró?», que no es la pregunta de nadie. Las tres
preguntas que sí se hacen —dónde intervengo, qué procedimiento corregir, qué
área llevo semanas sin mirar— no tienen respuesta en ninguna pantalla.

Las auditorías de prueba se borraron el 29 de septiembre de 2026. La colección
`evaluaciones_proceso` arranca vacía; las plantillas se conservaron.

## Lo que ya se captura y no se estaba usando

Nada de lo que sigue necesita cambiar la captura. Ya está en cada documento de
`evaluaciones_proceso`:

| Campo | Qué contiene | Para qué sirve ahora |
|---|---|---|
| `respuestas` | `SI`/`NO` por cada punto del checklist | Ranking de puntos (SPEC-007) |
| `itemsSnapshot` | La plantilla completa usada, con la `seccion` de cada punto | Clasificar hallazgos por sección (SPEC-010) |
| `hallazgos[].puntoId` | El punto que originó el hallazgo | Reincidencia real (SPEC-009) |
| `maquinaId`, `fechaAuditoria` | Qué se auditó y cuándo | Cobertura (SPEC-008) |
| `turno`, `nominaAuditado` | Quién y en qué turno | Separar estándar malo de problema local |

El dato más desaprovechado es `respuestas`. Hoy solo sirve para reconstruir una
auditoría suelta dentro de un modal. Es la materia prima de casi todo lo que
sigue.

---

# SPEC-007 — Ranking de puntos que más fallan

**Estado:** implementada el 29 de septiembre de 2026.

### Qué problema resuelve

El objetivo de negocio no es sólo verificar que se sigan los procedimientos,
sino **mejorar los procedimientos a partir del cumplimiento**. Para eso hace
falta saber qué punto concreto falla, no qué auditoría salió mal.

Un punto que falla en el 60% de las revisiones, con gente distinta y máquinas
distintas, no es un problema de disciplina: el estándar está mal escrito, es
irreal, falta la herramienta para cumplirlo, o nunca se entrenó. Eso hoy es
invisible.

### Cómo se calcula

Se recorren todas las auditorías y se agrupan las `respuestas` **por punto**, no
por auditoría. Para cada punto:

```
tasaDeFalla = vecesQueSalióNO / vecesQueSeRespondió
```

El ranking ordena por tasa de falla, y muestra junto a ella el número de
revisiones que la respaldan.

### Las dos lecturas, que no son la misma

| Tipo | Un punto que falla seguido significa |
|---|---|
| **5S** | Esa área o máquina no se está manteniendo |
| **PROCESO** | El estándar es irreal, falta herramienta, o no se entrenó |

### Reglas de negocio

- **Los dos tipos no se mezclan nunca.** El checklist de 5S es el mismo para toda
  la planta, así que su ranking es comparable entre máquinas. El de proceso es
  **por familia** (`plantillasProceso[tipoMaquina]`): los 16 puntos de Pegado
  sólo se comparan contra otras auditorías de Pegado. Cruzarlos daría un ranking
  sin significado. Son dos tableros.

- **Que cada auditoría de proceso sea de una orden distinta es una ventaja, no un
  obstáculo.** Si el punto «presión de aire del tanque entre 0.51 y 0.65 MPa»
  falla en doce órdenes, con productos y materiales distintos, la orden queda
  descartada como explicación. Órdenes diferentes fallando en el mismo punto es
  mejor evidencia que la misma orden fallando dos veces.

- **Hace falta un mínimo de revisiones para entrar al ranking.** Con dos o tres,
  el porcentaje es ruido: un punto respondido una vez y fallada esa vez daría
  100%. **Umbral: 5 revisiones**, decidido el 29 de septiembre de 2026 y
  ajustable desde la app. Los puntos por debajo del umbral no desaparecen; se
  listan aparte como «sin historia suficiente».

- **El desglose es lo que vuelve accionable el ranking.** Cada punto se puede
  abrir por **máquina** y por **turno**. Ahí está la decisión: si falla parejo en
  todas partes se corrige el estándar; si falla en un solo turno o una sola
  máquina, se entrena o se repara ahí. Sin ese desglose el ranking sólo señala,
  no orienta.

- **El ranking no nombra personas.** `nominaAuditado` se usa para el desglose
  interno, pero la pantalla no publica un ranking por persona. El objetivo es
  arreglar procedimientos; un tablero de cumplimiento por nombre cambia el
  incentivo y degrada el dato, que es exactamente lo que le pasó a la versión
  anterior de Control de Procesos: 99.1% de cumplimiento promedio porque marcar
  todo conforme salía más rápido que registrar un hallazgo.

### Lo que esta spec no hace

No pondera los puntos entre sí. Que falle «paro de emergencia accesible» pesa
más que «casilleros disponibles», pero esa jerarquía vive en la SPEC-010, no
aquí.

---

# SPEC-008 — Cobertura: qué no se ha auditado

**Estado:** **retirada** el 30 de septiembre de 2026, tras una semana de uso.
Ver la SPEC-013. La spec se conserva completa porque explica un razonamiento que
sigue siendo válido, y su código sigue en `src/utils/cobertura.ts` sin usarse,
por si se retoma.

### Qué problema resuelve

El objetivo incluye **encontrar áreas de oportunidad que no hayan sido
detectadas**. Eso no se puede encontrar en una lista de lo que sí se auditó: por
definición vive en lo que nadie ha mirado.

Toda la aplicación está construida mirando hacia lo registrado. Esta spec
invierte la mirada.

### Qué muestra

Una tabla de máquinas y zonas ordenada por **días desde la última auditoría**,
con columnas separadas para 5S y para proceso, porque una máquina puede estar al
día en 5S y llevar dos meses sin validación de proceso.

El universo de máquinas y zonas sale del layout que la app ya tiene; no se
inventa un catálogo nuevo.

### Reglas de negocio

- **Una máquina sin ninguna auditoría no es un hueco en blanco, es el caso más
  grave.** Se muestra primero, no al final ni como «—».

- **La frecuencia objetivo es de 15 días**, tanto para 5S como para proceso.
  Decidido por Ingeniería de Procesos el 29 de septiembre de 2026; queda
  configurable desde la app. Sin un objetivo no habría «atrasado», sólo «hace
  mucho», y toda la pantalla perdería su orden.

  Quince días significan que **cada máquina debería verse dos veces al mes por
  cada tipo de auditoría**. Conviene contrastarlo contra la capacidad real de
  auditoría en los primeros meses: si el objetivo resulta inalcanzable, la
  pantalla se llena de rojo y el color deja de informar, que es la misma manera
  en que se degradó el indicador de la versión anterior de Control de Procesos.
  Por eso es configurable y no una constante en el código.

- **El orden por defecto es por abandono, no alfabético.** La pantalla existe
  para que lo olvidado salte a la vista.

- **No se cuenta como cobertura una auditoría de otro tipo.** Auditar 5S no
  cubre la validación de proceso ni al revés: miden cosas distintas.

### Por qué esta es la que más rinde a corto plazo

Con la colección vacía, el ranking de la SPEC-007 tarda semanas en tener
historia. La cobertura, en cambio, **es útil desde la primera auditoría**:
mientras menos haya, más señala.

### Cómo quedó

La lógica vive en `src/utils/cobertura.ts`, fuera de `App.tsx`, para poder
probarla sin montar React. La pantalla es la vista `COBERTURA`, con su tarjeta
en el launcher, que muestra el número de atrasadas para que se vea sin entrar.

**Tres respuestas distintas por celda, y se ven distintas:** «No aplica» en gris
para lo que no lleva ese tipo de auditoría, «Nunca» en rojo sólido, y un número
de días en verde o rojo según el objetivo. Con el cursor encima del número
aparece la fecha exacta de la última revisión.

El objetivo de días vive en el documento `configuracion/cobertura` del proyecto
`proceso-pwa`. **Es un documento, no una colección**, y se lee con una sola
escucha. Si no existe, vale 15 y la pantalla funciona igual. Sólo `ADMIN` puede
cambiarlo.

Se verificó con 28 casos de la lógica pura —incluidos el límite exacto de 15
días, el cruce del cambio de horario de verano, las áreas auxiliares y los
documentos incompletos— y 7 de la pantalla montada con el catálogo real de 33
máquinas y áreas.

### El defecto que salió al construirla

La pantalla habría mentido en su columna más importante, y el motivo no estaba
en ella sino en `resolverTipoAuditoria`, la función que decide de qué tipo es
una auditoría guardada. Una de sus condiciones decía:

```js
(tipoMaq !== 'Pegado' && totalRespuestas > 0)   // → '5S'
```

Es decir: **cualquier auditoría con respuestas en una máquina que no fuera
Pegado se leía como 5S**, aunque se hubiera guardado correctamente como proceso.
Sólo Pegado trae plantilla de proceso por omisión, y la regla se escribió para
reparar documentos viejos de cuando eso era lo único que existía.

La consecuencia para esta spec: la columna «sin validar proceso» habría dicho
**«Nunca» para siempre en las otras 22 máquinas**, por muchas validaciones de
proceso que se hicieran.

**El arreglo: se cree lo que el documento dice de sí mismo.** Si trae
`tipoAuditoria` con un valor entendible, ese es el tipo. La deducción se
conserva sólo como respaldo para un documento sin el campo. Al 29/09/2026 no
existe ninguno, porque la colección se vació ese día, así que el cambio no tiene
sobre qué producir un efecto distinto al anterior.

El arreglo toca código compartido —el histórico, el Gantt y los filtros leen esa
misma función—, y por eso se hizo con respaldo en vez de borrando la regla
vieja. Verificado con 12 casos.

---

# SPEC-009 — Reincidencia por punto y máquina

**Estado:** implementada el 29 de septiembre de 2026.

### Qué problema resuelve

Un hallazgo nuevo es trabajo. Un hallazgo que ya se había cerrado y volvió es un
proceso que no aprende, y es la señal más accionable que produce una auditoría:
significa que **la acción correctiva no sirvió**.

### Cómo se detecta hoy, y por qué está mal

```js
const esReincidente = h.esReincidente ||
  (h.hallazgo && h.hallazgo.toLowerCase().includes('reincidente'));
```

Depende de que el auditor escriba la palabra «reincidente» dentro del texto
libre. Si la escribe distinto, no la escribe, o la escribe en un hallazgo que no
lo es, la detección falla en ambos sentidos.

### Cómo se detecta a partir de esta spec

**La llave es `(maquinaId, puntoId)`.** Un hallazgo es reincidente cuando, en esa
misma máquina y ese mismo punto del checklist, existe un hallazgo anterior con
`estadoSeguimiento: 'TERMINADO'`.

El dato ya está: `Hallazgo.puntoId` guarda el punto de origen.

### Qué se muestra, que es lo que importa

La etiqueta «reincidente» sola no sirve de nada. Lo valioso es lo que va junto:

> Este punto ya falló el **14 de agosto**. La acción fue *«se recalibró la
> aguja»*, responsable **Juan Pérez**, se cerró el **20 de agosto**, y volvió a
> fallar **39 días después**.

Eso convierte un hallazgo suelto en evidencia de que hay que cambiar de
enfoque, no repetir la misma acción.

### Reglas de negocio

- **El hallazgo anterior no se reabre.** Cada hallazgo conserva su propia
  historia, su responsable y su fecha de cierre. El nuevo nace apuntando al
  anterior; no lo sustituye ni lo modifica.

- **La cadena puede tener más de dos eslabones,** y su largo es el dato: un punto
  que va en su cuarta reincidencia es un problema distinto que uno en la
  primera.

- **Los hallazgos `esExtra` no entran.** Se levantan fuera del checklist y no
  tienen `puntoId`, así que no hay llave con qué ligarlos. Quedan fuera de la
  detección automática, y eso se dice en pantalla en vez de fingir cobertura
  total.

- **El campo `esReincidente` guardado se conserva** para los documentos viejos,
  pero la detección nueva no depende de él.

---

# SPEC-010 — Los hallazgos de seguridad

**Estado:** implementada el 29 de septiembre de 2026.

### Qué problema resuelve

Garantizar un ambiente seguro de trabajo es un objetivo propio. Hoy un riesgo de
atrapamiento comparte fila y prioridad con un locker faltante, y compiten por la
misma atención en la misma lista.

### El dato ya existe

No hace falta un campo de severidad. El checklist de 5S ya está dividido en
secciones, y una de ellas es seguridad:

| # | Sección | Puntos |
|---|---|---|
| 1 | Orden y 5S | 4 |
| 2 | Limpieza | 4 |
| 3 | Condición de máquina | 5 |
| 4 | **Seguridad** | 3 |
| 5 | Infraestructura | 4 |

La cadena para clasificar un hallazgo ya está completa en el documento:
`hallazgo.puntoId` → `itemsSnapshot[puntoId].seccion`.

Los tres puntos de la sección 4 son paro de emergencia accesible, rutas y
equipos de emergencia despejados, y ausencia de riesgo inmediato de
atrapamiento, corte, golpe, incendio o derrame.

### Reglas de negocio

- **Un hallazgo de seguridad se muestra separado y primero**, en cualquier
  pantalla donde compita con otros.

- **La clasificación es por punto, no por sección.** La sección 3, condición de
  máquina, no es seguridad completa, pero uno de sus puntos sí lo es. Decidido
  el 29 de septiembre de 2026, cuentan como seguridad **los tres puntos de la
  sección 4** más **«guardas, cubiertas y protecciones de seguridad instaladas y
  en buen estado»** de la sección 3. La lista se declara en la app y es
  editable; no se deduce del nombre de la sección.

- **Los hallazgos `esExtra` necesitan marca manual.** Sin `puntoId` no hay
  sección de dónde deducirla. Al levantar un hallazgo fuera del checklist se
  pregunta si es de seguridad. Es el único cambio de captura de todo este
  paquete, y es de una casilla.

- **Las auditorías de proceso no tienen sección de seguridad.** Sus cuatro
  secciones son solvente y aporte, parámetros de manga, detección y
  trazabilidad, y validación y liberación. Un hallazgo de seguridad en una
  auditoría de proceso sólo puede llegar por la vía `esExtra`.

---

# SPEC-011 — El tablero acotado, y dónde vive lo cerrado

**Estado:** implementada el 29 de septiembre de 2026.

### Qué problema resuelve

El Gantt no está mal: está **sin límite**. Dibuja cada hallazgo de cada
auditoría, incluidos los ya cerrados. Un Gantt de hallazgos cerrados es un
archivo histórico, no una herramienta de decisión.

### Qué se acota

El tablero muestra **sólo lo abierto**, y dentro de eso destaca **lo vencido**:
hallazgos cuya `fechaCierre` comprometida ya pasó y siguen sin cerrarse. Esa
lista, sola, es probablemente el único tablero que hace falta ver al empezar la
semana.

### Dónde vive lo cerrado

**No se va a ningún lado, y no se borra nada.** Un hallazgo cerrado sigue en el
documento de su auditoría, con `estadoSeguimiento: 'TERMINADO'` y su fecha de
cierre. Lo único que cambia es que deja de competir por la atención en el
tablero.

Se consulta en dos lugares, y el segundo es el que importa:

1. **En su auditoría**, abriendo esa auditoría concreta. Es consulta de archivo:
   sirve cuando ya sabes qué buscas.

2. **En el historial del punto.** Para un punto de checklist en una máquina, la
   línea de tiempo de todas las veces que falló, con qué acción se cerró cada
   una y cuánto duró cerrada. Es la vista que alimenta la SPEC-009 y la que
   contesta «¿esto ya había pasado?».

### Cómo se liga lo cerrado con lo que vuelve a salir

Por la misma llave `(maquinaId, puntoId)` de la SPEC-009. Un hallazgo cerrado
sigue siendo consultable por esa llave justamente porque no se borró: cuando el
punto vuelve a fallar en esa máquina, el hallazgo nuevo encuentra al anterior y
muestra su acción, su responsable y cuánto aguantó cerrado.

Por eso **lo cerrado tiene que seguir siendo consultable, no sólo almacenado**.
Si algún día se archivaran los hallazgos cerrados a otro lado, la reincidencia
dejaría de funcionar el mismo día.

---

# SPEC-012 — El foco compartido con Control de Procesos

**Estado:** implementada el 29 de septiembre de 2026; su parte visible cambió
con la SPEC-013. El puente con Control y sus reglas siguen vigentes.

### Qué problema resuelve

El objetivo habla de reducir errores **que cuesten productividad y rechazos**.
Hoy nada liga un hallazgo de auditoría con un rechazo real. Sin ese puente se
puede demostrar que se audita mucho, pero no que auditar esté reduciendo algo.

### Lo que ya existe del otro lado

La aplicación `control-proceso-impredimex` ya calcula, y funciona:

- `calcularFoco(maquina)` suma **metros rechazados por defecto** en una ventana
  de tres meses, y **amplía la ventana sola** hasta juntar 500 metros cuando hay
  poca historia, diciendo con qué periodo calculó
- Devuelve los 6 defectos de mayor peso, con su tendencia contra el histórico
- Trae una semilla incrustada de **1 095 registros de merma de 2025 y 2026**

De ahí sale un dato que decide dónde auditar: **cuatro líneas de veintitrés
explican el 80% de los metros rechazados** — RT7 con 36.6%, RT6 con 20.1%, FL1
con 19.2% y FL4 con 6.8%.

### Cómo se conectan

**En la cobertura de la SPEC-008.** El orden deja de ser sólo «días sin
auditar» y pasa a cruzarlo con cuánto cuesta esa máquina en metros rechazados.
Una máquina con seis semanas sin revisar que explica el 36% de la merma no es lo
mismo que una con seis semanas que no rechaza nada.

### Reglas de negocio

- **Se comparte el foco, no los datos.** Son proyectos de Firebase distintos, y
  la SPEC-010 de Control lo establece: los datos se quedan en su proyecto porque
  **la cuota del plan gratuito es por proyecto**. Esta app no consulta la base de
  Control.

- **El puente es un resumen chico, no una consulta.** Control publica su ranking
  —dos docenas de máquinas con unos cuantos números— como un documento único que
  esta app lee. Se refresca cuando se carga merma nueva. Una lectura, no un
  recorrido sobre 1 095 registros. La lección de la crisis de lecturas de la
  suite aplica igual aquí.

- **Las unidades no se mezclan en un solo número.** Control mide en metros
  rechazados, que es pérdida consumada. Esta app mide en porcentaje de
  cumplimiento. Un promedio de las dos no significaría nada. Son dos ejes.

### El cuadrante, que es la razón de ser de esta spec

| | Cumplimiento bajo | Cumplimiento alto |
|---|---|---|
| **Merma alta** | Ahí se va primero | **El checklist no pregunta lo que importa** |
| **Merma baja** | Corregir, sin urgencia | En orden |

La casilla de arriba a la derecha es la valiosa. Una máquina que cumple bien la
auditoría y aun así rechaza mucho significa que **el checklist no está
preguntando por lo que de verdad causa los rechazos**. Eso es un hallazgo sobre
el checklist, no sobre la máquina, y es exactamente el objetivo de mejorar los
procedimientos a partir del cumplimiento.

### Lo que todavía no se puede

Casi todas las SPECs de Control siguen en estado **pendiente**. Lo construido es
el foco, el importador de merma y la pantalla de matriz; los flujos de
inspección y el **contenido** de la matriz defecto ↔ variable no existen —esa
matriz la define una junta de calidad, según su propia spec—.

Así que el puente puede usar **el foco desde hoy**, y la parte de «qué variables
vigilar» espera a esa junta.

---

# Cómo quedaron la SPEC-009, la SPEC-010 y la SPEC-011

Las tres miran el mismo dato desde ángulos distintos, así que su lógica vive
junta en `src/utils/hallazgos.ts`, fuera de `App.tsx` y probable sin montar
React. Se verificó con 39 casos de la lógica pura y 6 de las pantallas.

### Dos datos nuevos, y por qué

**`cerradoEn`.** `fechaCierre` es la fecha **comprometida**, capturada al
levantar el hallazgo, no la real. Sin saber cuándo se cerró de verdad no se
puede decir cuánto aguantó antes de volver, que es la mitad del valor de la
SPEC-009. Ahora se graba al marcar terminado, y se limpia al reabrir.

**`esSeguridad`.** Solo la usan los hallazgos `esExtra`, que no tienen punto de
dónde deducir la sección. Es una casilla en el formulario, y el **único cambio
de captura** de todo el paquete.

### El tablero se acotó cambiando su fuente, no su dibujo

La tabla, las barras y las exportaciones a Excel y PDF beben del mismo arreglo.
Cambiar de dónde sale ese arreglo las acota las tres de una vez, sin tocar el
dibujo de ninguna. El filtro de estatus dejó de ofrecer «TERMINADO», que ya no
devolvería nunca nada y se habría visto como una falla.

### El orden del tablero

Primero seguridad, luego lo más vencido, luego lo reincidente, y al final lo que
sigue en plazo. Un hallazgo reincidente pasa delante de uno nuevo con el mismo
retraso porque ya se le dedicó una acción que no sirvió.

### Qué se muestra de una reincidencia

La etiqueta sola no sirve. Junto a ella va la fecha en que ya falló, la acción
que se intentó, quién era el responsable y cuántos días aguantó cerrado antes de
volver. El botón abre el historial completo del punto en esa máquina, que es
**donde vive lo cerrado**.

---

# Cómo quedaron la SPEC-007 y la SPEC-012

### El ranking

Vive en `src/utils/ranking.ts`. Dos tableros que **nunca se mezclan**: 5S,
comparable en toda la planta, y proceso, que obliga a elegir familia porque su
checklist es distinto en cada una.

Los puntos por debajo de las 5 revisiones no desaparecen, pero **no compiten
por el primer lugar**: se listan aparte bajo «Sin historia suficiente». Sin eso,
un punto respondido una vez y fallado saldría en 100% arriba de todo.

Cada renglón se abre y muestra el desglose por máquina y por turno, y la app
dice lo que ese desglose significa:

| Patrón | Qué significa | Qué se hace |
|---|---|---|
| **Parejo** | El estándar está mal escrito, es irreal o no se entrenó | Corregir el procedimiento |
| **Solo en X** | Una máquina o un turno concreto | Reparar o entrenar ahí |

«Concentrado» es que un solo corte explique más de dos tercios de las fallas
teniendo otros con qué compararse.

**La seguridad no espera al umbral.** Un punto de seguridad que ya falló sale en
una banda roja arriba de la tabla aunque tenga tres revisiones. El umbral sigue
siendo correcto para *ordenar* —con cuatro revisiones el porcentaje es ruido—
pero aplicárselo a la seguridad la escondía entre los puntos al 0%, y la
SPEC-010 dice que va primero donde sea que compita con otra cosa. Se rescata a
la vista, no se le inventa significancia.

**Se agrupa por número de punto y texto, no solo por número.** Los `id` son por
plantilla: el punto 7 de Pegado y el 7 de Flexografía son preguntas distintas, y
agrupar solo por número las habría sumado como si fueran la misma en cuanto
alguien editara una plantilla. Con el texto en la llave, dos preguntas distintas
no se mezclan nunca, y una misma pregunta reescrita aparece partida en dos
renglones: un error visible en vez de uno silencioso. **El ranking no publica nombres de
personas**: el objetivo es arreglar procedimientos, y un tablero por nombre
cambia el incentivo y degrada el dato, que es exactamente lo que le pasó a la
versión anterior de Control de Procesos con su 99.1% de cumplimiento.

### El cruce con la merma

Vive en `src/utils/merma.ts`. La cobertura ahora trae dos columnas más —metros
rechazados y la lectura del cuadrante— y, por omisión, **manda el costo**:
primero lo atrasado, y dentro de lo atrasado, lo que más rechaza. El orden por
puro abandono sigue a un clic, porque sirve cuando lo que se busca es un hueco
de cobertura y no dónde duele.

**No se multiplican días por metros.** Ese número no significaría nada y
escondería de cuál de los dos viene la urgencia. Lo atrasado es la condición; el
costo, el desempate.

**Por qué los números son una copia y no una consulta.** Las dos apps viven en
proyectos distintos —esta en `proceso-pwa`, Control en `impredimex-procesos`— y
la cuota del plan gratuito es por proyecto. Consultar la base de la otra app en
cada carga sería repetir la crisis de lecturas de la suite. Es el mismo patrón
que Control usa consigo mismo: semilla incrustada que un dato cargado después
puede sustituir.

**Lo que falta para que se actualice solo:** que Control publique el resumen
—veintitantas máquinas y un número cada una— en un documento del proyecto de la
suite, al que las dos apps ya se conectan. Ese cambio es del repositorio de
Control y no existe todavía. `MERMA_PUBLICADA` es el hueco donde entra sin
tocar nada más.

**Los 15 059 metros que no cruzan.** El histórico de Control trae
identificadores que el catálogo de esta app no tiene: `LAM`, `PEG`, `PEG3`,
`PEG7`, `PEG1 ` —con un espacio al final—, `XEIKON` y `OMEGA`. Son el **1.2%**
de la merma, así que no cambian ninguna decisión, pero **se suman al
denominador a propósito**: si se dividiera solo entre las máquinas de este
catálogo, RT7 saldría en 37.1% aquí y en 36.6% en la pantalla de Calidad, y
nadie sabría cuál creer. Los porcentajes de esta app suman 98.8%, y la pantalla
lo dice.

Vale la pena depurar esos identificadores del lado de Control en algún momento.

---

---

# SPEC-013 — Dónde se concentran los rechazos

**Estado:** implementada el 30 de septiembre de 2026. **Retira la SPEC-008.**

### Por qué se retira la cobertura

La pantalla medía días sin auditar por máquina y tipo, cruzados con el costo.
Con una semana de uso real no convenció: pasaba la mitad del ancho contando lo
que **no** se ha hecho, y eso resultó menos accionable de lo que parecía en el
diseño. Un tablero donde 33 de 33 están en rojo no orienta, solo regaña.

Lo que sí orientaba de esa pantalla era la columna que vino después, con la
SPEC-012: cuánto cuesta cada máquina. Esta spec se queda con eso y tira el
resto.

### Qué queda

| Columna | De dónde sale |
|---|---|
| Máquina o área | El catálogo de esta app |
| Familia | El catálogo |
| Metros rechazados | Histórico de Control de Procesos |
| **Principales defectos** | Histórico de Control de Procesos |

Los cuatro defectos de mayor peso por máquina, cada uno con **qué parte de la
merma de esa máquina** explica —no de la planta—. En rojo los que pesan 30% o
más, porque un defecto así ya no es un problema difuso sino uno con nombre:
RT6 es 42.9% raya, PEG2 es 43.3% adhesivo, FL4 es 17.6% tonos.

Ese perfil por máquina es lo que Control usa para dirigir su inspección, y es
lo que dirige aquí a qué máquina entrarle primero.

### Reglas de negocio

- **Ordenado por metros rechazados**, de mayor a menor. Las máquinas sin
  rechazos caen al final y dicen «Sin rechazos registrados», que no es lo mismo
  que un dato faltante.
- **Se conservan las 33 filas del catálogo**, incluidas las áreas auxiliares,
  que nunca tendrán merma. Quitarlas escondería que existen.
- **Los porcentajes de cada defecto son sobre su propia máquina.** Mezclarlos
  con los de planta haría creer que la raya de RT6 es el 42.9% de todo.
- Como en la SPEC-012, los datos son **una copia** del histórico de Control y se
  sustituyen por lo que Control publique. `DEFECTOS_PUBLICADOS` es el hueco,
  igual que `MERMA_PUBLICADA`.

### Lo que se fue con la SPEC-008

El objetivo de 15 días, el documento `configuracion/cobertura` —que deja de
leerse, aunque el documento sigue en Firestore— los contadores de atrasadas y
nunca auditadas, el selector de orden y el cuadrante de cumplimiento. La
decisión 1 de este documento queda sin uso.

---

---

# SPEC-014 — Cerrar un hallazgo sin que desaparezca

**Estado:** implementada el 1 de octubre de 2026.

### El problema

La SPEC-011 dejó el tablero mostrando solo lo abierto, y eso creó un efecto que
no se previó: **al marcar un hallazgo como terminado, su renglón desaparecía en
el acto**. Sin confirmación de que se guardó, sin manera de deshacer un clic mal
dado, y en la única pantalla donde ese hallazgo estaba.

Peor: si la escritura fallaba, el error solo iba a la consola. El renglón se
quedaba en «PENDIENTE» y la pantalla se veía idéntica a no haber hecho nada.

### Qué cambia

**Lo que se cierra se queda a la vista durante la visita.** El renglón se marca
**✓ CERRADO** en verde, se atenúa, baja al final de la tabla y dice «Toca para
deshacer». Tocarlo otra vez lo reabre.

Al salir del tablero —a Auditorías, al inicio, a donde sea— ese recuerdo se
borra, y al volver el tablero muestra otra vez solo lo abierto. **La SPEC-011 no
se rompe**: el tablero sigue sin acumular cerrados entre visitas.

**Una escritura fallida ahora avisa.** Si no se pudo guardar, se dice; antes
callaba.

### Reglas de negocio

- **El conjunto vive en memoria, no en la base.** Lo que se conserva es quién se
  cerró en esta visita, y eso no es información que nadie más necesite.
- **Lo recién cerrado baja al final**, incluso por debajo de lo que está en
  plazo. Dejó de reclamar atención, pero no desaparece de golpe.
- **Si la escritura falla, no se marca nada.** Fingir que se cerró sería peor
  que el defecto original.

---

---

# SPEC-015 — El PDF del Gantt imprime el Gantt

**Estado:** implementada el 1 de octubre de 2026.

El botón llamaba a `window.print()`, que imprime **la página completa**: salían
el encabezado de la app, las tarjetas del resumen, los filtros y los selectores,
y el cronograma quedaba repartido en cuatro hojas con la mitad del papel gastado
en controles que no sirven impresos.

Ahora se arma un documento con los datos —los mismos que alimentan la
exportación a Excel— y se imprime ese: solo la tabla, en horizontal, con el
encabezado repetido en cada hoja y sin renglones partidos a la mitad. Incluye
qué filtros estaban puestos, porque un reporte sin eso no se puede interpretar
después.

Se usa un marco oculto y no una ventana nueva: **la ventana emergente la bloquea
el navegador**, el marco no.

---

# SPEC-016 — Las máquinas como tarjetas de cartera

**Estado:** implementada el 1 de octubre de 2026.

### El problema

La pantalla de rechazos era una lista de 33 renglones con un filtro arriba. Para
ver una máquina había que filtrar, y para comparar dos del mismo proceso había
que recorrer la lista. La información estaba, pero costaba llegar a ella.

### Qué cambia

**Un bloque por proceso**, ordenados por lo que cuesta cada uno: Rotograbado
691 595 m, Flexografía 388 352 m, Pegado 111 644 m, y así. El filtro desaparece
porque los bloques **son** la agrupación.

**Dentro de cada bloque, las máquinas se apilan como tarjetas de cartera.**
Cerradas se enciman y solo asoma su lomo —nombre y metros—; al tocar una se
separa, se trae al frente y despliega su participación en la planta y sus
principales defectos, cada uno con su barra.

### Reglas de negocio

- **Solo una tarjeta al frente a la vez**, incluso entre bloques distintos.
  Abrir una cierra la anterior: la pantalla es para mirar una máquina, no para
  acumular.
- **Se conservan las 33 máquinas y áreas.** Las que no rechazan siguen ahí, con
  su lomo en gris, y al abrirlas lo dicen. Esconderlas haría creer que no
  existen.
- **Los bloques sin rechazos van al final** y su encabezado lo declara.
- **Las barras de cada defecto son sobre su propia máquina.** Es lo mismo que
  decían los porcentajes antes, pero una barra se compara de un vistazo y un
  número hay que leerlo.

---

---

# SPEC-017 — Los rechazos por periodo

**Estado:** implementada el 1 de octubre de 2026.

### Por qué

Mirar veinte meses promediados esconde lo que cambió. El caso que lo demuestra
está en los propios datos: **el defecto que más duele en RT7 no es el mismo en
el histórico que en julio**.

| | Primero | Segundo |
|---|---|---|
| Histórico completo | Lagrimeo 19.6% | Raya 17.6% |
| Julio 2026 | **Raya** | Lagrimeo |

Si el perfil cambió, la variable que hay que vigilar cambió, y un promedio de
veinte meses nunca lo habría dicho.

### Qué se puede elegir

**Todo el histórico**, **los últimos 3 meses con datos** —la misma ventana que
usa Control para su foco— o **cualquiera de los 19 meses**, del más reciente al
más viejo.

Todo se recalcula con el periodo: los metros, los defectos, la participación y
**qué máquinas explican el 80%**. En julio son tres, no cuatro.

### Reglas de negocio

- **«Últimos 3 meses» son los últimos con datos, no los del calendario.** Si
  Calidad lleva meses sin cargar merma, contar meses vacíos daría un periodo sin
  nada y parecería una falla de la app.
- **Cambiar de periodo cierra la tarjeta abierta.** Lo que mostraba ya no
  corresponde a lo que se está mirando.
- **Los porcentajes de un periodo son sobre lo registrado en ese periodo.** En
  el histórico completo el denominador incluye los metros que no cruzan, para
  que coincida con Calidad; por mes no se puede, porque esos metros no están
  desglosados. La pantalla lo dice.
- **La pantalla declara cuál es el último mes cargado.** Al 1 de octubre de 2026
  es **julio**: tres meses sin merma nueva. Sin ese aviso, un agosto vacío
  parecería un error del filtro y no lo que es.

### El dato pesa 10 KB

Se pasó de copiar los totales a copiar el detalle mensual, que es lo que
Control guarda. Viaja en el propio código y **no cuesta una sola lectura**.

### Un registro con fecha imposible

El histórico trae **RT6 · RAYA · 2006-06 · 1 072 m**. Es un año mal tecleado en
la captura original, y no se puede adivinar cuál: RT6 ya tiene raya registrada
tanto en junio de 2025 como en junio de 2026.

Se conserva en el total del histórico completo, porque Control también lo cuenta
y los números de las dos apps tienen que coincidir, y queda fuera del selector,
donde «junio de 2006» solo confundiría. La pantalla declara esos metros.
Conviene corregirlo del lado de Control.

---

---

# SPEC-018 — El periodo en tres controles

**Estado:** implementada el 2 de octubre de 2026.

### Por qué

La SPEC-017 metió los 19 meses en una sola lista. Funcionaba, pero para llegar
a un mes había que recorrerla entera, y cada mes que Calidad cargue la hace más
larga. En un año serán 31.

### Cómo queda

| Control | Qué ofrece |
|---|---|
| **Año** | Todos los años · 2026 · 2025 |
| **Mes** | Todo el año · los meses **de ese año** con datos |
| **Últimos 3 meses** | Botón aparte |

Ninguna lista pasa de trece renglones, y no crecen con los años: un año nuevo
agrega **una** opción al primer control, no doce al único.

### Reglas de negocio

- **El mes depende del año y está bloqueado hasta elegirlo.** «Julio» a secas
  sería ambiguo —¿el de 2025 o el de 2026?— y ofrecer los dos devolvería la
  lista larga que esto viene a resolver.
- **Cambiar de año limpia el mes.** Julio de 2026 no significa nada si ahora se
  está mirando 2025.
- **Solo el año abarca el año completo**, de enero a diciembre.
- **El atajo de tres meses va aparte, y no cabía en ninguno de los dos**: cruza
  el año —mayo a julio de 2026 hoy, pero noviembre a enero cuando toque—. Al
  activarlo bloquea los dos selectores, porque mandar sobre ellos sin decirlo
  sería confuso.
- **Cualquier cambio de periodo cierra la tarjeta abierta.** Lo que mostraba ya
  no corresponde al periodo que se está mirando.
- **Sin filtro, la pantalla dice qué está viendo**: cuántos meses y de cuándo a
  cuándo. Antes el histórico completo era el estado mudo.

### Lo que se retiró

**La tarjeta «Explican el 80%»** del resumen. El dato no se perdió: sigue
pintando en rojo a las máquinas que lo explican, y el inicio lo resume. Como
tarjeta competía con los dos números que de verdad se leen —metros rechazados y
máquinas con rechazos— sin aportar una tercera cosa.

**El nombre.** «Dónde se concentran los rechazos» describía el dato;
**«Prioridades a revisar»** describe para qué sirve, que es lo que la pantalla
hace desde la SPEC-013.

---

---

# SPEC-019 — Comportamiento personal

**Estado:** implementada el 2 de octubre de 2026.

### Qué resuelve

Las demás pantallas miran la planta: dónde duele, qué punto falla, qué sigue
abierto. Ninguna contesta **«¿y yo cómo voy?»**, que es la pregunta que una
persona sí puede accionar sola.

Esta mira a una persona en sus dos papeles:

| Papel | Qué muestra |
|---|---|
| **Como auditor** | De las máquinas que tiene asignadas, a cuáles ya les hizo su revisión y a cuáles no |
| **Como auditado** | Cómo salieron las auditorías que le hicieron: cumplimiento, hallazgos y quién lo auditó |

Debajo, **su Gantt**: los hallazgos abiertos de sus propias auditorías, con
seguridad primero y lo más vencido después.

### La matriz de supervisores cambió de lugar

Vivía dentro de `App.tsx`, mezclada con la búsqueda en el padrón, y solo sabía
responder «¿quién atiende esta máquina?». Esta pantalla necesita lo contrario
—«¿qué máquinas atiende esta persona?»— y así no se podía preguntar.

Ahora la regla está sola, en nóminas, en `utils/comportamiento.ts`, y `App.tsx`
la consume. Sigue siendo una lista fija en código, que es la **deuda técnica 2**
del proyecto; al menos ya está en un solo lugar y es probable.

### Un campo nuevo: `nominaAuditor`

Para saber quién hizo una auditoría solo existía `auditor`, un **nombre escrito
a mano**. Venía prellenado con el del usuario, pero es editable, así que
comparar por texto nunca fue confiable.

Desde esta versión se guarda también la nómina. Los documentos anteriores se
siguen reconociendo por nombre, normalizando acentos y mayúsculas, y la pantalla
declara esa limitación.

### Reglas de negocio

- **El ADMIN puede ver a cualquiera.** Sin eso la pantalla le saldría vacía: la
  jefatura no tiene máquinas asignadas, y sería imposible de probar y de usar
  para dar seguimiento. Un supervisor solo se ve a sí mismo y no tiene selector.
- **«Contar desde» acota el periodo.** Sin corte, «ya la revisó» sería cierto
  para siempre en cuanto la revisara una vez, y la pantalla dejaría de pedir
  nada. Por omisión cuenta todo el histórico.
- **Lo que no aplica no cuenta como pendiente.** Las áreas auxiliares no llevan
  validación de proceso, y eso no las deja en falta.
- **De cada máquina se toma la revisión más reciente**, no la primera.
- **El Gantt personal son las auditorías donde la persona fue la auditada**, no
  aquellas donde aparece como responsable de un hallazgo. Ese campo es texto
  libre —«Mantenimiento», «Todos»— y no identifica a nadie.

### Lo que falta probar

Si esta pantalla resulta suficiente, **el Gantt general se retira**. Primero hay
que usarla.

---

# Decisiones de estas specs

Las tres primeras quedaron resueltas por Ingeniería de Procesos el **29 de
septiembre de 2026**. Los tres valores son configurables desde la app, no
constantes en el código: se fijaron para arrancar, no para siempre.

| # | Decisión | Valor | Spec |
|---|---|---|---|
| 1 | Frecuencia objetivo de auditoría por máquina | **15 días**, 5S y proceso | SPEC-008 |
| 2 | Mínimo de revisiones para entrar al ranking | **5 revisiones** | SPEC-007 |
| 3 | Qué puntos cuentan como seguridad | Los **3 de la sección 4**, más «guardas, cubiertas y protecciones de seguridad» de la sección 3 | SPEC-010 |

### Sigue pendiente

| # | Decisión | Quién | Estado |
|---|---|---|---|
| 4 | Contenido de la matriz defecto ↔ variable | Junta de calidad | No existe. Bloquea sólo la parte de «qué variables vigilar» de la SPEC-012; el cruce de cobertura con metros rechazados no depende de ella. |

---

# Deuda técnica conocida

| # | Tema | Detalle |
|---|---|---|
| 1 | Datos propios en otro proyecto | Evaluaciones, plantillas 5S y checklists siguen en el proyecto `proceso-pwa`, no en la suite. Migrarlos es un paso posterior. |
| 2 | Supervisores por área en código | Las funciones que asignan supervisores por familia de máquina usan nóminas fijas. Deberían salir de datos. |
| 3 | Variables sin uso | 15 avisos de TypeScript por variables declaradas y nunca leídas, remanentes de refactorizaciones. No rompen el build. |
| 4 | Módulos sin especificar | La captura de 5S, checklists y evaluaciones, y el layout 3D, siguen sin spec. El **análisis** de esas auditorías sí quedó especificado en las SPEC-007 a la SPEC-012; lo que falta documentar es cómo se capturan. |
| 5 | Repositorio público | El repo es público. Se vuelve privado cuando el hosting migre a Firebase Hosting. |
