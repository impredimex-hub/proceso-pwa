# CHANGELOG

Todos los cambios notables del proyecto Ingeniería de Procesos se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado sigue [Semantic Versioning](https://semver.org/lang/es/).

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
