# G-Pulse — Análisis de gaps para llegar al MVP

> Documento complementario a [`PROJECT_MAP.md`](./PROJECT_MAP.md).
> Analiza **qué le falta a la app de gym G-Pulse** para considerarse un MVP funcional en producción, partiendo de lo que está construido hoy.

---

## TL;DR (resumen ejecutivo)

Hay un **bloqueador grande**: se pueden **crear** rutinas pero **no listarlas, abrirlas, editarlas ni borrarlas**, y el registro de entrenamiento solo guarda duración y calorías totales (sin sets/reps por ejercicio). Eso solo ya impide vender la app.

Además, `POST /routines` y `POST /gemini/generate` **no tienen `AuthGuard`** y reciben `userId` por body → riesgo de seguridad serio.

**Estimación**: ~4-5 semanas de backend para llegar a un MVP funcional.

---

## 1. El recorrido del usuario hoy (y dónde se rompe)

| Paso | ¿Funciona? | Comentario |
|---|---|---|
| 1. Registrarse / loguearse | Sí | Auth completo con Google y email |
| 2. Configurar perfil (nivel, plan) | Sí | `PATCH /users/profile` |
| 3. Explorar catálogo de ejercicios | Sí | `GET /exercises` con filtros |
| 4. Crear una rutina (manual o IA) | Sí | `POST /routines` |
| **5. Ver MIS rutinas para entrenar hoy** | **NO** | **No existe `GET /routines` del usuario** |
| **6. Abrir una rutina y entrenarla** | **NO** | No existe `GET /routines/:id` para usuarios |
| **7. Registrar lo que hice en cada ejercicio (peso/reps reales)** | **NO** | `ActivityLog` solo guarda `duration` + `calories` agregados |
| 8. Ver historial básico | Parcial | Lista de logs sin desglose por ejercicio |
| **9. Editar / borrar una rutina** | **NO** | Solo hay `POST`, no `PATCH`/`DELETE` |
| 10. Subir de plan | Sí | `POST /subscriptions/upgrade` |
| 11. Consultar a la IA | Sí | `POST /gemini/generate` (con cuotas) |

**Conclusión**: el ciclo principal **"ver mi rutina → ejecutarla → registrar lo que hice"** está roto. Eso es la columna vertebral de cualquier app de gym.

---

## 2. CRÍTICO — Sin esto no hay MVP

Son endpoints donde el **modelo en BD ya existe**, por lo que el costo de implementación es bajo.

### 2.1 Gestión de rutinas del usuario (BLOQUEADOR)

| Endpoint | Descripción |
|---|---|
| `GET /routines` | Listar las rutinas del usuario logueado (`creatorId = req.user.id`). |
| `GET /routines/:id` | Detalle con `exercises` + `Exercise` anidado y orden ascendente (como ya lo hace el admin). |
| `PATCH /routines/:id` | Actualizar nombre, descripción, `isPublic`, lista de ejercicios. |
| `DELETE /routines/:id` | Eliminar (en transacción borrar `RoutineExercise` y `UserFavorite`). |

### 2.2 Proteger correctamente endpoints sensibles

- `POST /routines` **no tiene `AuthGuard`** y recibe `userId` en el body → cualquiera puede crear rutinas a nombre de otro usuario. Hay que pasar a JWT y tomar `userId` de `req.user.id`.
- `POST /gemini/generate` **tampoco tiene `AuthGuard`** → cualquiera puede consumir cuota de IA en nombre de otros. Mismo arreglo.

### 2.3 Registro detallado de entrenamiento (set logging)

Hoy `ActivityLog` solo guarda `duration` + `calories`. Para una app de gym **se necesita guardar lo que hiciste por ejercicio**: peso, reps reales, set completado, etc. Esto implica un modelo nuevo:

```prisma
model WorkoutSet {
  id                String   @id @default(uuid())
  activityLogId     String
  routineExerciseId String?
  exerciseId        String
  setNumber         Int
  weightKg          Float?
  reps              Int?
  durationSec       Int?     // para ejercicios isométricos / cardio
  rpe               Int?     // esfuerzo percibido 1-10 (opcional)
  completed         Boolean  @default(true)
  notes             String?
  activityLog       ActivityLog @relation(fields: [activityLogId], references: [id])
  exercise          Exercise    @relation(fields: [exerciseId],    references: [id])
}
```

Y endpoints como:

- `POST /progress/log` extendido para aceptar `sets: WorkoutSetDto[]`.
- `GET /progress/history/:logId` con desglose por ejercicio.
- `GET /progress/exercise/:exerciseId` para ver tu evolución en un ejercicio concreto.

### 2.4 Listado de rutinas públicas (descubrimiento)

- `GET /routines/public` — lista paginada de rutinas con `isPublic=true`, ordenadas por `likes` o `createdAt`. El campo `isPublic` ya existe pero nadie puede ver ese feed.

---

## 3. IMPORTANTE — Necesario para retención (90% de probabilidad de pedirlo en semana 2)

### 3.1 Favoritos

Modelo `UserFavorite` ya existe sin endpoints. Faltan:

- `POST /routines/:id/favorite` — marcar.
- `DELETE /routines/:id/favorite` — desmarcar.
- `GET /users/me/favorites` — listar rutinas favoritas.

### 3.2 Records personales (PRs)

Una app de gym vive de los PRs. Calculado o cacheado:

- `GET /progress/prs` → devuelve por cada ejercicio: peso máximo levantado, mejor 1RM estimado, fecha.
- Requiere el modelo `WorkoutSet` del punto 2.3.

### 3.3 Mediciones corporales

Modelo nuevo `BodyMeasurement`:

- `weight`, `bodyFatPct?`, `waistCm?`, `chestCm?`, `armCm?`, `legCm?`, `date`.
- Endpoints `POST /measurements`, `GET /measurements`.

### 3.4 Objetivos / Goals

- "Entrenar 4 veces por semana", "subir X kg en bench press", "perder 3 kg en 2 meses".
- Modelo `Goal` con `type`, `target`, `currentValue`, `deadline`, `status`.

### 3.5 Calendario / programación

Hoy las rutinas no están asignadas a un día. Un MVP serio necesita:

- `RoutineSchedule` o `dayOfWeek` en `RoutineExercise` (lo más simple).
- Endpoint `GET /routines/today` para saber qué toca entrenar hoy.

### 3.6 Subir / gestionar imágenes propias de ejercicios

La carpeta `src/exercise-images/` existe **vacía**. Tres opciones:

- Integrar con storage (S3, Cloudinary, Supabase Storage).
- Solo URLs (lo que ya hace `CreateExerciseDto`).
- Imágenes de usuario para progreso (progress pics).

---

## 4. RECOMENDADO — Empuja la calidad del MVP

### 4.1 Catálogo: CRUD de músculos y categorías

Hoy solo se siembran por seed. Para que el admin pueda mantener el catálogo:

- `POST/PATCH/DELETE /admin/muscles`
- `POST/PATCH/DELETE /admin/categories`

### 4.2 Likes en rutinas

Campo `Routine.likes` existe pero no hay endpoint:

- `POST /routines/:id/like` / `DELETE /routines/:id/like`.

### 4.3 Suscripción: cancelación y estado

- `POST /subscriptions/cancel` (poner `isActive=false`, `endDate=now`).
- `GET /subscriptions/me` para ver estado actual y fecha de vencimiento.
- Job (cron) para vencer suscripciones expiradas y bajar el plan a `BASIC`.

### 4.4 Validación más estricta en admin

`PATCH /admin/users/:id` recibe `Prisma.UserUpdateInput` parcial **sin DTO con `class-validator`**. Crear un `UpdateUserAdminDto` formal.

### 4.5 Notificaciones push / recordatorios

Para una app móvil de gym, esto sube muchísimo la retención:

- Recordatorio "hoy toca entrenar".
- Recordatorio "llevas 2 días sin entrenar, ¿continuamos la racha?".
- Confirmación de PR conseguido.
- Requiere FCM (Firebase Cloud Messaging — ya tienes Firebase Admin).

---

## 5. POST-MVP — Para versiones siguientes

- Social: seguir usuarios, ver feed de amigos, comentarios en rutinas.
- Ranking de la comunidad (más PRs, mayor racha).
- Tracking de nutrición / agua / sueño.
- Integración con wearables (Google Fit, Apple Health).
- Plantillas de rutinas pre-armadas por entrenadores.
- Marketplace de rutinas premium.
- Modo "entrenador-cliente" (un usuario PRO asigna rutinas a otros).

---

## 6. Roadmap sugerido para llegar al MVP

Asumiendo **1 dev backend full-time**, este orden minimiza riesgo:

### Sprint 1 — Cerrar el ciclo (1 semana)

1. Proteger `POST /routines` y `POST /gemini/generate` con `AuthGuard` y tomar `userId` del JWT.
2. `GET /routines`, `GET /routines/:id`, `PATCH /routines/:id`, `DELETE /routines/:id`.
3. `GET /routines/public` (feed).

### Sprint 2 — Entrenamiento real (1-2 semanas)

4. Migración Prisma + modelo `WorkoutSet`.
5. Refactor de `POST /progress/log` para recibir sets detallados.
6. `GET /progress/exercise/:id` (histórico por ejercicio).
7. `GET /progress/prs` (records personales).

### Sprint 3 — Retención (1 semana)

8. Favoritos: 3 endpoints sobre `UserFavorite`.
9. Likes en rutinas.
10. Endpoint de estado y cancelación de suscripción.

### Sprint 4 — Pulido (1 semana)

11. Mediciones corporales (`BodyMeasurement`).
12. DTO formal para `PATCH /admin/users/:id`.
13. Notificaciones push (si la app móvil ya las consume).

**Total estimado para MVP funcional: ~4-5 semanas de backend.**

---

## 7. Tabla resumen — Gap analysis

| Área | Estado | Prioridad |
|---|---|---|
| Auth (register/login/google/recovery) | Completo | — |
| Catálogo de ejercicios (lectura) | Completo | — |
| Catálogo de ejercicios (escritura admin) | Completo | — |
| Crear rutina (manual + IA) | Completo | — |
| **Listar/ver/editar/borrar MIS rutinas** | **Falta** | **CRÍTICO** |
| **Sets/reps/peso por ejercicio en cada workout** | **Falta** | **CRÍTICO** |
| **Auth en `/routines` y `/gemini/generate`** | **Falta** | **CRÍTICO** |
| Feed de rutinas públicas | Falta | CRÍTICO |
| Favoritos | Falta (modelo existe) | Importante |
| Likes en rutinas | Falta | Importante |
| Records personales (PRs) | Falta | Importante |
| Mediciones corporales | Falta | Importante |
| Objetivos | Falta | Importante |
| Calendario semanal | Falta | Importante |
| Upload de imágenes | Falta | Recomendado |
| Cancelar / ver suscripción | Falta | Recomendado |
| Notificaciones push | Falta | Recomendado |
| CRUD admin de músculos / categorías | Falta | Recomendado |
| Tracking de nutrición | Falta | Post-MVP |
| Social (follow, comentarios) | Falta | Post-MVP |
| Integración wearables | Falta | Post-MVP |

---

## 8. Próximo paso recomendado

Atacar el **Sprint 1** primero: es el de menor esfuerzo y mayor impacto. Con esos 6 endpoints + las dos correcciones de seguridad, la app ya se puede usar end-to-end por un usuario real, incluso si todavía no hay set-logging detallado.

Una vez cerrado el ciclo de rutinas, el Sprint 2 (entrenamiento real con `WorkoutSet`) es lo que convierte la app de "un gestor de listas" en "una app de gym de verdad".
