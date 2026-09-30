# CHANGELOG

Todos los cambios notables del proyecto Ingeniería de Procesos se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

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
