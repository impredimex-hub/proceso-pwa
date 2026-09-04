# SPECS.md — Ingeniería de Procesos (proceso-pwa)

## Especificaciones funcionales del sistema

Este documento es la **fuente de verdad** del comportamiento de la aplicación.
Cualquier cambio futuro debe partir de actualizar primero estas specs y luego
implementar el código.

**Versión:** 1.0
**Fecha:** 3 de septiembre de 2026
**Metodología:** Spec-Driven Development (SDD)

> **Nota de alcance.** Este documento arranca con las specs de autenticación e
> identidad, que son las que cambian al integrarse a la suite Impredimex. Los
> módulos de 5S, checklists, evaluaciones, Gantt y layout 3D todavía no están
> especificados; se irán documentando conforme se toquen. Mientras tanto, el
> código sigue siendo la única descripción de esos módulos.

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
1. Usuario presiona el botón de cerrar sesión
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

# Deuda técnica conocida

| # | Tema | Detalle |
|---|---|---|
| 1 | Datos propios en otro proyecto | Evaluaciones, plantillas 5S y checklists siguen en el proyecto `proceso-pwa`, no en la suite. Migrarlos es un paso posterior. |
| 2 | Supervisores por área en código | Las funciones que asignan supervisores por familia de máquina usan nóminas fijas. Deberían salir de datos. |
| 3 | Variables sin uso | 15 avisos de TypeScript por variables declaradas y nunca leídas, remanentes de refactorizaciones. No rompen el build. |
| 4 | Módulos sin especificar | 5S, checklists, evaluaciones, Gantt y layout 3D no tienen spec escrita. |
| 5 | Repositorio público | El repo es público. Se vuelve privado cuando el hosting migre a Firebase Hosting. |
