# G-Pulse API — Mapa Detallado del Proyecto

> Análisis estático del backend `G-Pulse/backend-api`.
> Documento generado para describir **qué tiene construido el proyecto**, **qué se puede hacer hoy**, **qué endpoints existen**, **qué reciben** y **qué devuelven**.

---

## 1. Resumen ejecutivo

G-Pulse API es un **backend REST** para una aplicación de fitness/gimnasio que permite:

- Registrar y autenticar usuarios (email/password y Google vía Firebase).
- Consultar un **catálogo de ejercicios** con músculos, categorías e imágenes.
- **Crear rutinas de entrenamiento** (manualmente o **generadas por IA** con Gemini).
- **Registrar entrenamientos completados** (logs de actividad) con duración y calorías.
- Calcular automáticamente la **racha de entrenamiento** (training streak).
- **Subir el plan de suscripción** del usuario (BASIC / PRO / EXPERT).
- **Generar texto con IA (Gemini)** con cuotas diarias por plan, caché y fallback a base de datos.
- **Panel administrativo** completo (usuarios, ejercicios, rutinas, dashboard).

Construido con **NestJS 11 + Prisma 6 + PostgreSQL (Supabase) + Firebase Admin + Google Gemini + Resend (emails)**.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | NestJS 11 |
| Lenguaje | TypeScript 5.7 |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL (Supabase) |
| Autenticación | Firebase Admin + JWT (`@nestjs/jwt`, `passport-jwt`) |
| Hashing de contraseñas | bcrypt (10 rounds) |
| IA | Google Generative AI (`gemini-flash-lite-latest`) |
| Email transaccional | Resend |
| Documentación API | Swagger (`@nestjs/swagger`) en `/api/docs` |
| Validación | `class-validator` + `class-transformer` (`ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`) |
| Contenedor | Docker + Docker Compose |
| Puerto por defecto | `3000` (CORS habilitado globalmente) |

---

## 3. Arquitectura general — Módulos

El `AppModule` importa los siguientes módulos (ver `src/app.module.ts`):

| Módulo | Responsabilidad | Prefijo de ruta |
|--------|-----------------|-----------------|
| `AuthModule` | Registro, login, login con Google, sesión, cambio y recuperación de contraseña | `/auth` |
| `UsersModule` | Perfil del usuario logueado y estadísticas | `/users` |
| `ExercisesModule` | Catálogo público de ejercicios (lectura) | `/exercises` |
| `RoutinesModule` | Creación de rutinas (manual o por IA) | `/routines` |
| `ProgressModule` | Registro y consulta del historial de entrenamientos | `/progress` |
| `SubscriptionsModule` | Cambiar / activar plan de suscripción | `/subscriptions` |
| `GeminiModule` | Generación de texto con IA (Gemini) con cuotas y caché | `/gemini` |
| `AdminModule` | Operaciones administrativas (solo rol ADMIN) | `/admin` |
| `MailModule` | Envío de emails transaccionales (welcome, password reset, password changed) | — (servicio interno) |
| `PrismaModule` | Acceso a base de datos | — (servicio interno) |

Además existe `AppController` con un `GET /` que devuelve un "hello".

---

## 4. Mapa de capacidades funcionales (qué se puede hacer hoy)

### Para **usuarios finales**

| Funcionalidad | ¿Soportada? | Endpoint |
|---|---|---|
| Registrarse con email + password | Sí | `POST /auth/register` |
| Login con email + password | Sí | `POST /auth/login` |
| Login social con Google (Firebase) | Sí | `POST /auth/google` |
| Validar sesión vigente (splash) | Sí | `GET /auth/session` |
| Cambiar contraseña | Sí | `POST /auth/change-password` |
| Recuperar contraseña (email) | Sí | `POST /auth/forgot-password` |
| Ver su perfil | Sí | `GET /users/profile` |
| Editar su perfil (nombre, nivel, plan) | Sí | `PATCH /users/profile` |
| Ver sus estadísticas (racha, calorías, etc.) | Sí | `GET /users/stats` |
| Listar ejercicios (con filtro y paginación) | Sí | `GET /exercises` |
| Ver detalle de un ejercicio | Sí | `GET /exercises/:id` |
| Crear una rutina manualmente | Sí | `POST /routines` |
| Crear una rutina **con IA (Gemini)** | Sí | `POST /routines` con `fromAi: true` |
| Registrar entrenamiento completado | Sí | `POST /progress/log` |
| Ver historial de entrenamientos | Sí | `GET /progress/history` |
| Cambiar de plan (BASIC/PRO/EXPERT) | Sí | `POST /subscriptions/upgrade` |
| Hacer una consulta libre a IA | Sí | `POST /gemini/generate` |

### Para **administradores** (rol `ADMIN`)

| Funcionalidad | Endpoint |
|---|---|
| Listar usuarios (con filtros y paginación) | `GET /admin/users` |
| Ver detalle de usuario | `GET /admin/users/:id` |
| Actualizar usuario (plan, rol, nivel) | `PATCH /admin/users/:id` |
| Eliminar usuario (con cascada de relaciones) | `DELETE /admin/users/:id` |
| Crear ejercicio en el catálogo | `POST /admin/exercises` |
| Actualizar ejercicio | `PATCH /admin/exercises/:id` |
| Eliminar ejercicio | `DELETE /admin/exercises/:id` |
| Listar rutinas del sistema | `GET /admin/routines` |
| Ver detalle de rutina | `GET /admin/routines/:id` |
| Ver estadísticas globales del dashboard | `GET /admin/stats` |

---

## 5. Modelo de datos (Prisma)

Archivo: `prisma/schema.prisma` (PostgreSQL).

### 5.1 Modelos

#### `User`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String` (uuid) | PK |
| `email` | `String` | único |
| `password` | `String?` | opcional (Google-only no tiene) |
| `googleId` | `String?` | único, UID de Firebase |
| `name` | `String?` | |
| `role` | `Role` | `USER` \| `ADMIN`, default `USER` |
| `level` | `UserLevel` | `BEGINNER` \| `INTERMEDIATE` \| `ADVANCED` |
| `trainingStreak` | `Int` | racha de días consecutivos entrenando |
| `quotasUsed` | `Int` | (legado) |
| `lastQuotaReset` | `DateTime` | (legado) |
| `aiPromptCount` | `Int` | consumo diario de IA |
| `lastAiPromptDate` | `DateTime` | última vez que usó IA |
| `plan` | `SubscriptionPlan` | `BASIC` \| `PRO` \| `EXPERT` |
| `createdAt` / `updatedAt` | `DateTime` | |
| Relaciones | `activityLogs[]`, `routines[]`, `subscription?`, `favorites[]` | |

#### `Exercise`
| Campo | Tipo |
|---|---|
| `id` | `String` (uuid) |
| `name` | `String` (único) |
| `description` | `String?` |
| `instructions` | `String[]` |
| `difficulty` | `String?` (`beginner` \| `intermediate` \| `expert`) |
| `mechanic` | `String?` (`compound` \| `isolation`) |
| `force` | `String?` (`push` \| `pull` \| `static`) |
| `equipment` | `String?` |
| `categoryId` | `String?` → `Category` |
| `primaryMuscles` | `Muscle[]` (M:N) |
| `secondaryMuscles` | `Muscle[]` (M:N) |
| `images` | `ExerciseImage[]` |
| `routines` | `RoutineExercise[]` |

#### `Category`
- `id`, `name` (único), `exercises[]`.

#### `Muscle`
- `id`, `name` (único), `target` (opcional, p. ej. `arms`, `legs`), relaciones `primaryExercises[]` / `secondaryExercises[]`.

#### `ExerciseImage`
- `id`, `url`, `exerciseId` → `Exercise` (onDelete: Cascade).

#### `Routine`
| Campo | Tipo |
|---|---|
| `id` | `String` (uuid) |
| `name` | `String` |
| `description` | `String?` |
| `isPublic` | `Boolean` (default `false`) |
| `likes` | `Int` (default 0) |
| `creatorId` | `String` → `User` |
| `exercises` | `RoutineExercise[]` |
| `activities` | `ActivityLog[]` |
| `favoritedBy` | `UserFavorite[]` |

#### `RoutineExercise` (tabla intermedia ordenada)
- `id`, `routineId`, `exerciseId`, `order`, `sets?`, `reps?`, `duration?`.

#### `UserFavorite`
- PK compuesta `(userId, routineId)`, `createdAt`. Representa rutinas favoritas del usuario (sin endpoint hoy).

#### `ActivityLog`
- `id`, `userId`, `routineId?`, `date`, `duration`, `calories`.

#### `Subscription`
- `id`, `userId` (único), `plan`, `startDate`, `endDate?`, `isActive`.

#### `AiResponseCache`
- `id`, `prompt` (único), `response`, `createdAt`. **Caché de respuestas de Gemini por prompt normalizado.**

### 5.2 Enums

```text
UserLevel        : BEGINNER | INTERMEDIATE | ADVANCED
SubscriptionPlan : BASIC | PRO | EXPERT
Role             : USER  | ADMIN
```

---

## 6. Detalle de endpoints

> **Convención de autenticación**:
> - `Public` → no requiere token.
> - `JWT` → requiere header `Authorization: Bearer <token>` emitido por `/auth/login`, `/auth/register` o `/auth/google`.
> - `JWT + ADMIN` → requiere JWT **y** que el campo `role` del usuario en BD sea `ADMIN` (valida `RolesGuard`).

---

### 6.1 Módulo `auth` — `/auth`

#### `POST /auth/register` — Registrar usuario
- **Auth**: Public
- **Body** (`RegisterDto`):
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }
  ```
  - `email`: email válido.
  - `password`: string, mínimo 6 caracteres.
  - `name`: string.
- **Qué hace**: crea el usuario en Firebase Auth, hashea la contraseña con bcrypt, lo guarda en la BD, envía un email de bienvenida y devuelve un JWT firmado.
- **Respuesta**:
  ```json
  { "token": "jwt...", "user": { "id": "...", "email": "...", "name": "...", "role": "USER", ... } }
  ```

#### `POST /auth/login` — Login con email/password
- **Auth**: Public
- **Body** (`LoginDto`): `{ email, password }` (password mínimo 6).
- **Qué hace**: busca al usuario por email, compara la contraseña con bcrypt y devuelve `{ token, user }`.
- **Errores**: `401 Unauthorized` si credenciales inválidas.

#### `POST /auth/google` — Login con Google (Firebase)
- **Auth**: Public
- **Body** (`GoogleLoginDto`):
  ```json
  { "idToken": "eyJhbGciOiJSUzI1NiIs..." }
  ```
  - Token de Firebase obtenido por el cliente tras iniciar sesión con Google.
- **Qué hace**: verifica el `idToken` con Firebase, busca al usuario por `googleId`, si no existe lo crea (o lo vincula por email si ya existía cuenta local) y devuelve `{ token, user }`.

#### `GET /auth/session` — Validar sesión
- **Auth**: JWT
- **Qué hace**: valida que el JWT siga vigente y que el usuario aún exista. Pensado para usar en una *splash screen*.
- **Respuesta**: `{ "authenticated": true, "user": { ... } }`. `401` si no es válido.

#### `POST /auth/change-password` — Cambiar contraseña
- **Auth**: JWT
- **Body** (`ChangePasswordDto`):
  ```json
  { "currentPassword": "actual", "newPassword": "nueva" }
  ```
  (ambos mínimo 6 caracteres).
- **Qué hace**: verifica la contraseña actual, hashea la nueva, la guarda, y envía un email de notificación. **No disponible para cuentas Google-only** (sin password) → `400 BadRequest`.
- **Respuesta**: `{ "message": "Password updated successfully" }`.

#### `POST /auth/forgot-password` — Recuperar contraseña
- **Auth**: Public
- **Body** (`ForgotPasswordDto`): `{ email }`.
- **Qué hace**: genera un link de reset de Firebase y envía email vía Resend.
- **Respuesta**: `{ "message": "If the email exists, a reset link has been generated." }`.

---

### 6.2 Módulo `users` — `/users`

> **Todo el controlador requiere `JWT`.**

#### `GET /users/profile` — Obtener perfil propio
- **Auth**: JWT
- **Qué hace**: devuelve el usuario actual (sin el campo `password`).
- **Errores**: `404 NotFoundException` si el usuario del token no existe.

#### `PATCH /users/profile` — Actualizar perfil propio
- **Auth**: JWT
- **Body** (`UpdateProfileDto`, todos opcionales):
  ```json
  { "name": "John", "level": "INTERMEDIATE", "plan": "PRO" }
  ```
  - `level`: enum `UserLevel`.
  - `plan`: enum `SubscriptionPlan`.
- **Qué hace**: actualiza los campos enviados.

#### `GET /users/stats` — Estadísticas de entrenamiento
- **Auth**: JWT
- **Respuesta**:
  ```json
  {
    "trainingStreak": 5,
    "routinesCount": 3,
    "totalWorkouts": 27,
    "totalCalories": 8400,
    "totalDurationMinutes": 1320,
    "plan": "PRO",
    "level": "INTERMEDIATE"
  }
  ```

---

### 6.3 Módulo `exercises` — `/exercises`

> Endpoints **públicos** (sin JWT en el código actual).

#### `GET /exercises` — Listar ejercicios
- **Auth**: Public
- **Query params** (`FindAllExercisesDto`, todos opcionales):
  | Param | Tipo | Descripción |
  |---|---|---|
  | `muscle` | string | filtra por nombre de músculo (primario o secundario, case-insensitive) |
  | `difficulty` | string | `beginner` / `intermediate` / `expert` |
  | `search` | string | búsqueda parcial por `name` |
  | `page` | string numérico | por defecto `1` |
  | `limit` | string numérico | por defecto `20` |
- **Qué hace**: devuelve un array de ejercicios paginados con `images`, `primaryMuscles`, `secondaryMuscles` y `category` incluidos.

#### `GET /exercises/:id` — Detalle de un ejercicio
- **Auth**: Public
- **Params**: `id` (uuid del ejercicio).
- **Respuesta**: el ejercicio con sus `images`.

---

### 6.4 Módulo `routines` — `/routines`

#### `POST /routines` — Crear una rutina (manual o por IA)
- **Auth**: Public (en código actual el endpoint **no tiene `AuthGuard`** y el `userId` se recibe explícitamente en el body — ver sección 9).
- **Body** (`CreateRoutineDto`):
  ```json
  {
    "name": "My Awesome Routine",
    "userId": "uuid-del-usuario",
    "description": "Una rutina full body",
    "isPublic": false,
    "fromAi": true,
    "aiPrompt": "Rutina full body para principiante 3 días a la semana",
    "exercises": [
      { "exerciseName": "Bench Press", "sets": 4, "reps": 10, "duration": null },
      { "exerciseName": "Squats",      "sets": 4, "reps": 12 }
    ]
  }
  ```
  | Campo | Tipo | Notas |
  |---|---|---|
  | `name` | string | obligatorio |
  | `userId` | string | obligatorio (creator) |
  | `description` | string | opcional |
  | `isPublic` | boolean | default `false` |
  | `fromAi` | boolean | si es `true`, ignora `exercises` y los genera con Gemini |
  | `aiPrompt` | string | prompt usado cuando `fromAi=true` |
  | `exercises[]` | array `RoutineExerciseDto` | lista manual (`exerciseName`, `sets?`, `reps?`, `duration?`) |
- **Qué hace**:
  1. Valida `name` y `userId`.
  2. Si `fromAi=true` y hay `aiPrompt`, llama a `GeminiService.generateRoutineJson` y reemplaza la lista de ejercicios.
  3. Crea la `Routine`.
  4. Por cada ejercicio: si no existe en BD por `name`, lo crea como placeholder con `description: "AI Generated"`. Luego inserta el `RoutineExercise` con `order` consecutivo, `sets` (default 3), `reps` (default 10) y `duration`.
  5. Devuelve la rutina con sus ejercicios anidados.

---

### 6.5 Módulo `progress` — `/progress`

> **Todo el controlador requiere `JWT`.**

#### `POST /progress/log` — Registrar un entrenamiento
- **Auth**: JWT
- **Body** (`LogActivityDto`):
  ```json
  { "routineId": "uuid-opcional", "duration": 45, "calories": 320 }
  ```
  | Campo | Tipo | Notas |
  |---|---|---|
  | `routineId` | string | opcional, UUID de la rutina realizada |
  | `duration` | number | minutos, obligatorio |
  | `calories` | number | obligatorio |
- **Qué hace**:
  1. Crea el `ActivityLog` ligado al usuario del JWT.
  2. Recalcula la **training streak**:
     - Busca la actividad anterior (excluyendo la recién creada).
     - Si la diferencia con hoy es 1 día → streak +1.
     - Si es 0 → se mantiene.
     - Si es > 1 → se reinicia a 1.
     - Si no había actividades previas → streak = 1.
- **Respuesta**: el `ActivityLog` creado.

#### `GET /progress/history` — Historial de actividades
- **Auth**: JWT
- **Qué hace**: devuelve **todos** los logs del usuario actual ordenados por fecha descendente, incluyendo `{ routine: { name } }`.

---

### 6.6 Módulo `subscriptions` — `/subscriptions`

#### `POST /subscriptions/upgrade` — Cambiar de plan
- **Auth**: JWT
- **Body** (`UpgradeSubscriptionDto`):
  ```json
  { "plan": "PRO" }
  ```
  - `plan`: enum `SubscriptionPlan` (`BASIC` | `PRO` | `EXPERT`).
- **Qué hace**:
  1. Actualiza `user.plan`.
  2. Hace `upsert` en `Subscription` con `startDate = now`, `endDate = now + 1 mes`, `isActive = true`.
- **Respuesta**: el registro de `Subscription`.

> Nota: no hay endpoint de cancelación / downgrade explícito; reasignar plan a `BASIC` lo simula.

---

### 6.7 Módulo `gemini` — `/gemini`

#### `POST /gemini/generate` — Generar texto con IA
- **Auth**: Public (en el código actual el endpoint **no tiene `AuthGuard`** — pero recibe `userId` por body para aplicar cuotas. Ver sección 9.)
- **Body** (`GenerateTextDto`):
  ```json
  {
    "prompt": "Sugiere una rutina full body",
    "userId": "uuid-opcional",
    "forceUpdate": false,
    "filters": { "muscle": "chest" }
  }
  ```
  | Campo | Tipo | Notas |
  |---|---|---|
  | `prompt` | string | obligatorio |
  | `userId` | string | opcional, si se envía aplica cuota diaria por plan |
  | `forceUpdate` | boolean | si es `true` ignora el caché y vuelve a llamar a Gemini |
  | `filters.muscle` | string | usado como **fallback** si el usuario se queda sin cuota |
- **Qué hace** (lógica compleja, ver `gemini.service.ts`):
  1. Si no hay `GEMINI_API_KEY` → devuelve mock.
  2. Busca en `AiResponseCache` por `prompt` normalizado. Si encuentra y `forceUpdate=false` → devuelve cache con `meta.isCached=true`.
  3. Si hay `userId`, llama a `checkQuota`:
     - Si es un nuevo día → resetea `aiPromptCount` y permite.
     - Si excede límite del plan (BASIC=1, PRO=3, EXPERT=5) y se envió `filters.muscle` → hace **fallback** consultando hasta 5 ejercicios de la BD que coincidan con ese músculo.
     - Si no hay fallback → lanza `429 LIMIT_REACHED`.
  4. Llama a Gemini, incrementa el contador del usuario y guarda/actualiza el caché.
- **Respuesta**: `{ text, meta: { isCached, source: 'cache'|'ai'|'database', message } }` o `{ data: [exercises], meta: { isFallback: true, ... } }`.

---

### 6.8 Módulo `admin` — `/admin`

> **Todo el controlador requiere `JWT + ADMIN`** (`AuthGuard('jwt')` + `RolesGuard` + `@Roles(Role.ADMIN)`).

#### Usuarios

##### `GET /admin/users` — Listar usuarios
- **Query**: `page?`, `limit?` (default 10), `search?` (busca en email o nombre, case-insensitive), `plan?` (`BASIC`/`PRO`/`EXPERT`), `role?` (`USER`/`ADMIN`).
- **Respuesta**:
  ```json
  { "data": [ ... ], "meta": { "total": 120, "page": 1, "limit": 10, "totalPages": 12 } }
  ```

##### `GET /admin/users/:id` — Detalle de usuario
- Incluye últimas 5 actividades y conteos de rutinas/actividades. `404` si no existe.

##### `PATCH /admin/users/:id` — Actualizar usuario
- **Body** (parcial): `{ name?, level?, plan?, role? }`.

##### `DELETE /admin/users/:id` — Eliminar usuario
- En transacción borra: `userFavorite` → `activityLog` → `routine` (donde es creador) → `subscription` → `user`.

#### Ejercicios

##### `POST /admin/exercises` — Crear ejercicio
- **Body** (`CreateExerciseDto`):
  ```json
  {
    "name": "Bench Press",
    "description": "...",
    "instructions": ["paso 1", "paso 2"],
    "difficulty": "intermediate",
    "mechanic": "compound",
    "force": "push",
    "equipment": "barbell",
    "categoryId": "uuid-cat",
    "imageUrls": ["https://.../img1.png"]
  }
  ```
  Campos opcionales excepto `name`. Validados con `IsIn` en `difficulty`/`mechanic`/`force` y `IsUrl` en cada URL.
- **Qué hace**: crea el `Exercise` y sus `ExerciseImage` asociadas.

##### `PATCH /admin/exercises/:id` — Actualizar ejercicio
- **Body**: `UpdateExerciseDto` (todos los campos opcionales, `PartialType` de `CreateExerciseDto`).
- **Qué hace**: si se envía `imageUrls`, **borra todas las imágenes anteriores** del ejercicio y crea las nuevas.

##### `DELETE /admin/exercises/:id` — Eliminar ejercicio
- En transacción borra: `routineExercise` → `exerciseImage` → `exercise`.

#### Rutinas

##### `GET /admin/routines` — Listar rutinas
- **Query**: `page?`, `limit?`, `search?` (por nombre).
- **Incluye**: `creator: { name, email }` y `_count.exercises`.

##### `GET /admin/routines/:id` — Detalle de rutina
- Incluye `creator` y `exercises` (con `Exercise` y orden ascendente).

#### Dashboard

##### `GET /admin/stats` — Estadísticas globales
- **Respuesta**:
  ```json
  {
    "totalUsers": 1200,
    "activeUsersToday": 87,
    "premiumUsers": 230,
    "totalRoutines": 5400,
    "routinesCreatedToday": 12,
    "premiumConversionRate": 19.16
  }
  ```
  - `activeUsersToday` = usuarios distintos con al menos un `ActivityLog` hoy.
  - `premiumUsers` = usuarios con plan `PRO` o `EXPERT`.

---

### 6.9 Root

#### `GET /` — Hello
- **Auth**: Public. Devuelve un string de prueba.

---

## 7. Planes y cuotas

| Plan | Límite diario de prompts a IA |
|------|-------------------------------|
| `BASIC` | 1 |
| `PRO` | 3 |
| `EXPERT` | 5 |
| `FREE` *(legado)* | 1 |
| `PREMIUM` *(legado)* | 3 |

- El conteo se guarda en `user.aiPromptCount` y se **resetea automáticamente** cuando `lastAiPromptDate` corresponde a un día distinto al actual (comparación por `toDateString()`).
- El upgrade desde `/subscriptions/upgrade` genera/upserta un registro en `Subscription` con vigencia de 1 mes (no hay job de expiración automática actualmente).

---

## 8. Sistema de IA (Gemini)

Ver `src/gemini/gemini.service.ts`.

- **Modelo**: `gemini-flash-lite-latest` (Google Generative AI).
- **Métodos clave**:
  - `generateText(prompt, expectJson, userId?, forceUpdate?, filters?)` → motor principal con caché, cuota y fallback.
  - `generateRoutineJson(prompt)` → fuerza salida JSON estricta con estructura `{ exercises: [{ exerciseName, muscle, sets, reps, duration }] }`. Usado por `RoutinesService.createRoutine` cuando `fromAi=true`.
  - `generateRoutine(promptData, userId?)` → arma un prompt a partir de `{ muscle, level, equipment }`.
- **Caché**: tabla `AiResponseCache` con `prompt` único; al haber match exacto y `forceUpdate=false` evita llamar a la API.
- **Fallback a BD**: si el usuario excede su cuota y envía `filters.muscle`, devuelve hasta 5 ejercicios del catálogo cuyos músculos primarios/secundarios coincidan.

---

## 9. Brechas funcionales detectadas

Funcionalidades que **el modelo de datos soporta** pero **no tienen endpoint expuesto hoy**:

| Capacidad | Modelo en BD | ¿Endpoint? |
|---|---|---|
| Listar rutinas propias del usuario logueado | `Routine.creatorId` | **Falta** |
| Ver detalle de una rutina (no-admin) | `Routine` | **Falta** (solo existe en `/admin/routines/:id`) |
| Actualizar una rutina | `Routine` | **Falta** |
| Eliminar una rutina | `Routine` | **Falta** |
| Marcar/desmarcar rutina como favorita | `UserFavorite` | **Falta** (modelo existe sin endpoints) |
| Listar rutinas favoritas | `UserFavorite` | **Falta** |
| Listar rutinas **públicas** (`isPublic=true`) tipo "feed" | `Routine.isPublic`, `likes` | **Falta** |
| Dar "like" a una rutina | `Routine.likes` | **Falta** |
| CRUD de músculos / categorías | `Muscle`, `Category` | **Falta** (solo seed) |
| Subir/gestionar imágenes de ejercicios desde API | `ExerciseImage` | **Falta** (existe carpeta `src/exercise-images/dto` vacía — módulo sin implementar) |
| Cancelación / fin de suscripción explícito | `Subscription` | **Falta** |

Otras observaciones de seguridad / consistencia que conviene revisar:

- `POST /routines` y `POST /gemini/generate` **no tienen `AuthGuard`**, pero esperan `userId` en el body. Esto permite que cualquiera cree rutinas o consuma IA en nombre de otro `userId` si lo conoce. Lo natural sería protegerlos con JWT y tomar el `userId` de `req.user.id`.
- `AdminController.updateUser` recibe el body tipado como `Prisma.UserUpdateInput` parcial; no usa un DTO con `class-validator`, por lo que la validación es más laxa que en otros endpoints (depende del `ValidationPipe` global, pero sin decoradores no valida realmente).
- El `RolesGuard` consulta la BD en cada request admin para validar el rol (más seguro pero genera 1 query extra por request).

---

## 10. Resumen rápido (cheat-sheet)

```text
PUBLIC
  GET    /
  POST   /auth/register                  body: { email, password, name }
  POST   /auth/login                     body: { email, password }
  POST   /auth/google                    body: { idToken }
  POST   /auth/forgot-password           body: { email }
  GET    /exercises                      query: muscle?, difficulty?, search?, page?, limit?
  GET    /exercises/:id
  POST   /routines                       body: CreateRoutineDto (fromAi opcional)
  POST   /gemini/generate                body: { prompt, userId?, forceUpdate?, filters? }

JWT
  GET    /auth/session
  POST   /auth/change-password           body: { currentPassword, newPassword }
  GET    /users/profile
  PATCH  /users/profile                  body: { name?, level?, plan? }
  GET    /users/stats
  POST   /progress/log                   body: { routineId?, duration, calories }
  GET    /progress/history
  POST   /subscriptions/upgrade          body: { plan }

JWT + ADMIN
  GET    /admin/users                    query: page?, limit?, search?, plan?, role?
  GET    /admin/users/:id
  PATCH  /admin/users/:id                body: { name?, level?, plan?, role? }
  DELETE /admin/users/:id
  POST   /admin/exercises                body: CreateExerciseDto
  PATCH  /admin/exercises/:id            body: UpdateExerciseDto (Partial)
  DELETE /admin/exercises/:id
  GET    /admin/routines                 query: page?, limit?, search?
  GET    /admin/routines/:id
  GET    /admin/stats
```

> **Documentación interactiva**: con el servidor corriendo, todo lo anterior está disponible en `http://localhost:3000/api/docs` (Swagger).
