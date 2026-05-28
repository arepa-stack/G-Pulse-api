# G-Pulse API — Documentación Completa

> **Versión:** 1.0  
> **Framework:** NestJS 11 + Prisma 6 + PostgreSQL  
> **Generado:** Mayo 2026  
> **Propósito:** Referencia para desarrolladores de apps móviles/web que integran esta API sin necesidad de Postman.

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Autenticación](#2-autenticación)
3. [Convenciones y reglas globales](#3-convenciones-y-reglas-globales)
4. [Modelos de datos](#4-modelos-de-datos)
5. [Módulo Auth](#5-módulo-auth)
6. [Módulo Users](#6-módulo-users)
7. [Módulo Exercises](#7-módulo-exercises)
8. [Módulo Routines](#8-módulo-routines)
9. [Módulo Progress](#9-módulo-progress)
10. [Módulo Subscriptions](#10-módulo-subscriptions)
11. [Módulo Admin](#11-módulo-admin)
12. [Módulo Gemini AI](#12-módulo-gemini-ai)
13. [Códigos de error globales](#13-códigos-de-error-globales)

---

## 1. Introducción

G-Pulse es una API REST para una aplicación de fitness/gym. Permite registrar usuarios, explorar ejercicios, crear rutinas (con o sin IA), registrar actividad física y gestionar suscripciones.

### URL Base

```
http://localhost:3000
```

En producción reemplazar con la URL del servidor desplegado. El puerto se configura con la variable de entorno `PORT`.

### Documentación interactiva (Swagger)

```
http://localhost:3000/api/docs
```

Swagger está disponible en desarrollo y permite probar los endpoints directamente desde el navegador.

### CORS

CORS está habilitado globalmente. Cualquier origen puede hacer peticiones durante el desarrollo.

### Formato de datos

Todas las peticiones y respuestas usan `Content-Type: application/json`.

---

## 2. Autenticación

La API usa **JWT (JSON Web Tokens)** con estrategia Bearer. Firebase Authentication se utiliza para validar tokens de Google Sign-In en el flujo OAuth.

### Cómo obtener un token

1. Registrarse: `POST /auth/register`
2. Iniciar sesión: `POST /auth/login`
3. Login con Google: `POST /auth/google`

Todos los endpoints anteriores devuelven un campo `token` en la respuesta.

### Cómo usar el token

Incluir en el header de cada petición protegida:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Expiración del token

El token JWT expira **a los 7 días** (`JWT_EXPIRES_IN=7d`). Usar `GET /auth/session` para verificar si el token sigue siendo válido (útil en la pantalla de carga de la app).

### Roles de usuario

| Rol     | Descripción                                      |
|---------|--------------------------------------------------|
| `USER`  | Usuario estándar (rol por defecto al registrarse)|
| `ADMIN` | Administrador con acceso a `/admin/*`            |

### Niveles de acceso por endpoint

A lo largo de esta documentación cada endpoint indica su nivel de acceso:

- **Público** — No requiere token
- **JWT requerido** — Requiere `Authorization: Bearer <token>`
- **JWT + ADMIN** — Requiere token Y que el usuario tenga `role: ADMIN`

---

## 3. Convenciones y reglas globales

### Validación de entrada

La API usa `class-validator` con las siguientes reglas globales:

- **`whitelist: true`** — Se ignoran propiedades no declaradas en el DTO.
- **`forbidNonWhitelisted: true`** — Si el body contiene campos no permitidos, se retorna `400 Bad Request`.
- **`transform: true`** — Los tipos se transforman automáticamente (ej: string `"20"` en query param se convierte al número `20`).

### Formato de errores

NestJS devuelve errores en este formato estándar:

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 6 characters"],
  "error": "Bad Request"
}
```

Para errores simples (no de validación):

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### Paginación

Los endpoints con listas usan los query params `page` (default: `1`) y `limit` (default varía). Las respuestas paginadas incluyen un objeto `meta`:

```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 10,
    "totalPages": 15
  }
}
```

---

## 4. Modelos de datos

Referencia de los tipos de datos que aparecen en las respuestas.

### User

```typescript
{
  id: string          // UUID, generado automáticamente
  email: string       // Único
  name: string | null
  role: "USER" | "ADMIN"
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED"
  plan: "BASIC" | "PRO" | "EXPERT"
  trainingStreak: number  // Días consecutivos de entrenamiento
  aiPromptCount: number   // Prompts de IA usados hoy
  lastAiPromptDate: string // ISO 8601
  quotasUsed: number
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
  // Nota: el campo `password` NUNCA se devuelve en las respuestas
  // Nota: el campo `googleId` se devuelve pero puede ser null
}
```

### Exercise

```typescript
{
  id: string
  name: string          // Único
  description: string | null
  instructions: string[]
  difficulty: "beginner" | "intermediate" | "expert" | null
  mechanic: "compound" | "isolation" | null
  force: "push" | "pull" | "static" | null
  equipment: string | null
  categoryId: string | null
  category: Category | null
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  images: ExerciseImage[]
  createdAt: string
  updatedAt: string
}
```

### Category

```typescript
{
  id: string
  name: string  // Único (ej: "Strength", "Cardio", "Stretching")
}
```

### Muscle

```typescript
{
  id: string
  name: string   // Único (ej: "chest", "biceps", "quadriceps")
  target: string | null  // Agrupación (ej: "upper body", "legs")
}
```

### ExerciseImage

```typescript
{
  id: string
  url: string      // URL pública de la imagen
  exerciseId: string
}
```

### Routine

```typescript
{
  id: string
  name: string
  description: string | null
  isPublic: boolean
  likes: number
  creatorId: string
  createdAt: string
  updatedAt: string
  exercises: RoutineExercise[]  // Incluido en algunas respuestas
  creator: { name: string, email: string }  // Incluido en Admin
}
```

### RoutineExercise

```typescript
{
  id: string
  routineId: string
  exerciseId: string
  order: number    // Posición en la rutina (1-indexed)
  sets: number | null
  reps: number | null
  duration: number | null  // En segundos
  exercise: Exercise       // Incluido en las respuestas de rutinas
}
```

### ActivityLog

```typescript
{
  id: string
  userId: string
  routineId: string | null
  date: string      // ISO 8601 - fecha/hora del registro
  duration: number  // En minutos
  calories: number  // Calorías quemadas estimadas
  routine: { name: string } | null  // Incluido en historial
}
```

### Subscription

```typescript
{
  id: string
  userId: string    // Único (un usuario = una suscripción activa)
  plan: "BASIC" | "PRO" | "EXPERT"
  startDate: string
  endDate: string | null
  isActive: boolean
}
```

### Enums importantes

**SubscriptionPlan:**
| Valor    | Descripción                          | Límite de IA/día |
|----------|--------------------------------------|-----------------|
| `BASIC`  | Plan gratuito por defecto            | 1 prompt        |
| `PRO`    | Plan intermedio de pago              | 3 prompts       |
| `EXPERT` | Plan premium con acceso completo     | 5 prompts       |

**UserLevel:**
| Valor          | Descripción        |
|----------------|--------------------|
| `BEGINNER`     | Principiante       |
| `INTERMEDIATE` | Intermedio         |
| `ADVANCED`     | Avanzado           |

**Role:**
| Valor   | Descripción          |
|---------|----------------------|
| `USER`  | Usuario estándar     |
| `ADMIN` | Administrador        |

---

## 5. Módulo Auth

Gestión de autenticación: registro, login, sesión y cambio de contraseña.

---

### POST /auth/register

**Descripción:** Registra un nuevo usuario. Crea la cuenta en Firebase Authentication y en la base de datos local. Envía un email de bienvenida.

**Acceso:** Público

**Headers:**
```
Content-Type: application/json
```

**Body:**

| Campo    | Tipo   | Requerido | Validación           |
|----------|--------|-----------|----------------------|
| email    | string | Sí        | Debe ser email válido|
| password | string | Sí        | Mínimo 6 caracteres  |
| name     | string | Sí        | Cualquier string     |

**Ejemplo de body:**
```json
{
  "email": "juan@example.com",
  "password": "miPassword123",
  "name": "Juan Pérez"
}
```

**Respuesta exitosa — 201 Created:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjAxMjM0NTY3ODkiLCJlbWFpbCI6Imp1YW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc0NjY1MjAwMCwiZXhwIjoxNzQ3MjU2ODAwfQ.signature",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
    "email": "juan@example.com",
    "googleId": "firebase-uid-abc123",
    "name": "Juan Pérez",
    "role": "USER",
    "level": "BEGINNER",
    "plan": "BASIC",
    "trainingStreak": 0,
    "quotasUsed": 0,
    "aiPromptCount": 0,
    "lastAiPromptDate": "2026-05-07T21:30:00.000Z",
    "lastQuotaReset": "2026-05-07T21:30:00.000Z",
    "createdAt": "2026-05-07T21:30:00.000Z",
    "updatedAt": "2026-05-07T21:30:00.000Z"
  }
}
```

**Errores posibles:**

| Status | Mensaje                                         | Causa                                      |
|--------|-------------------------------------------------|--------------------------------------------|
| 400    | `"The email address is already in use by another account."` | Email ya registrado en Firebase |
| 400    | `"email must be an email"`                     | Formato de email inválido                  |
| 400    | `"password must be longer than or equal to 6 characters"` | Contraseña demasiado corta      |
| 400    | `"name must be a string"`                      | Campo name faltante o tipo incorrecto      |

**Ejemplo de error 400 (validación):**
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 6 characters"],
  "error": "Bad Request"
}
```

**Ejemplo de error 400 (email duplicado):**
```json
{
  "statusCode": 400,
  "message": "The email address is already in use by another account.",
  "error": "Bad Request"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@example.com","password":"miPassword123","name":"Juan Pérez"}'
```

---

### POST /auth/login

**Descripción:** Inicia sesión con email y contraseña. No funciona para usuarios que solo tienen cuenta de Google (sin contraseña local).

**Acceso:** Público

**Headers:**
```
Content-Type: application/json
```

**Body:**

| Campo    | Tipo   | Requerido | Validación            |
|----------|--------|-----------|-----------------------|
| email    | string | Sí        | Debe ser email válido |
| password | string | Sí        | Mínimo 6 caracteres   |

**Ejemplo de body:**
```json
{
  "email": "juan@example.com",
  "password": "miPassword123"
}
```

**Respuesta exitosa — 200 OK:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjAxMjM0NTY3ODkiLCJlbWFpbCI6Imp1YW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc0NjY1MjAwMCwiZXhwIjoxNzQ3MjU2ODAwfQ.signature",
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
    "email": "juan@example.com",
    "googleId": "firebase-uid-abc123",
    "name": "Juan Pérez",
    "role": "USER",
    "level": "BEGINNER",
    "plan": "BASIC",
    "trainingStreak": 5,
    "quotasUsed": 0,
    "aiPromptCount": 1,
    "lastAiPromptDate": "2026-05-07T10:00:00.000Z",
    "lastQuotaReset": "2026-05-07T00:00:00.000Z",
    "createdAt": "2026-04-01T12:00:00.000Z",
    "updatedAt": "2026-05-07T10:00:00.000Z"
  }
}
```

**Errores posibles:**

| Status | Mensaje               | Causa                                                   |
|--------|-----------------------|---------------------------------------------------------|
| 401    | `"Invalid credentials"` | Email no existe, contraseña incorrecta, o cuenta solo tiene Google login |
| 400    | `"email must be an email"` | Formato de email inválido                          |
| 400    | `"password must be longer than or equal to 6 characters"` | Contraseña corta      |

**Ejemplo de error 401:**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@example.com","password":"miPassword123"}'
```

---

### POST /auth/google

**Descripción:** Inicia sesión con Google usando el ID Token de Firebase. El cliente debe completar el flujo de Google Sign-In con Firebase y enviar el `idToken` resultante. Si el usuario no existe, se crea automáticamente.

**Acceso:** Público

**Headers:**
```
Content-Type: application/json
```

**Body:**

| Campo   | Tipo   | Requerido | Validación                              |
|---------|--------|-----------|-----------------------------------------|
| idToken | string | Sí        | Token Firebase válido, mínimo 10 chars  |

**Ejemplo de body:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImZiYWJjMTIzNDU2Nzg5MCIsInR5cCI6IkpXVCJ9..."
}
```

**Respuesta exitosa — 200 OK:**

La respuesta tiene el mismo formato que `/auth/login`. Devuelve el token JWT propio de G-Pulse (no el de Firebase) y los datos del usuario.

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f01234567890",
    "email": "juan.google@gmail.com",
    "googleId": "google-firebase-uid-xyz789",
    "name": "Juan Google",
    "role": "USER",
    "level": "BEGINNER",
    "plan": "BASIC",
    "trainingStreak": 0,
    "quotasUsed": 0,
    "aiPromptCount": 0,
    "lastAiPromptDate": "2026-05-07T21:30:00.000Z",
    "lastQuotaReset": "2026-05-07T21:30:00.000Z",
    "createdAt": "2026-05-07T21:30:00.000Z",
    "updatedAt": "2026-05-07T21:30:00.000Z"
  }
}
```

**Errores posibles:**

| Status | Mensaje                       | Causa                                             |
|--------|-------------------------------|---------------------------------------------------|
| 401    | `"Invalid or expired token"`  | El `idToken` de Firebase no es válido o expiró    |
| 401    | `"Token has no email claim"`  | El token de Firebase no contiene email            |
| 400    | `"idToken must be longer than or equal to 10 characters"` | Token demasiado corto |

**Ejemplo de error 401:**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"eyJhbGciOiJSUzI1NiIsImtpZCI6ImZiYWJjMTIzNDU2Nzg5MCIsInR5cCI6IkpXVCJ9..."}'
```

---

### GET /auth/session

**Descripción:** Verifica si el token JWT actual sigue siendo válido y el usuario existe en la base de datos. Ideal para usar en la pantalla de carga (splash screen) de la app.

**Acceso:** JWT requerido

**Headers:**
```
Authorization: Bearer <token>
```

**Body:** Ninguno

**Respuesta exitosa — 200 OK:**
```json
{
  "authenticated": true,
  "user": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
    "email": "juan@example.com",
    "googleId": "firebase-uid-abc123",
    "name": "Juan Pérez",
    "role": "USER",
    "level": "BEGINNER",
    "plan": "PRO",
    "trainingStreak": 12,
    "quotasUsed": 0,
    "aiPromptCount": 2,
    "lastAiPromptDate": "2026-05-07T10:00:00.000Z",
    "lastQuotaReset": "2026-05-07T00:00:00.000Z",
    "createdAt": "2026-04-01T12:00:00.000Z",
    "updatedAt": "2026-05-07T21:00:00.000Z"
  }
}
```

**Errores posibles:**

| Status | Mensaje                       | Causa                                            |
|--------|-------------------------------|--------------------------------------------------|
| 401    | `"Unauthorized"`              | Token ausente, malformado o expirado             |
| 401    | `"Session no longer valid"`   | Token válido pero el usuario fue eliminado de la BD |

**Ejemplo de error 401 (token ausente):**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Ejemplo de error 401 (usuario eliminado):**
```json
{
  "statusCode": 401,
  "message": "Session no longer valid",
  "error": "Unauthorized"
}
```

**cURL:**
```bash
curl -X GET http://localhost:3000/auth/session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### POST /auth/change-password

**Descripción:** Cambia la contraseña del usuario autenticado. Requiere la contraseña actual para confirmar. No disponible para cuentas que solo usan Google (sin contraseña local). Envía un email de notificación al completarse.

**Acceso:** JWT requerido

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

| Campo           | Tipo   | Requerido | Validación           |
|-----------------|--------|-----------|----------------------|
| currentPassword | string | Sí        | Mínimo 6 caracteres  |
| newPassword     | string | Sí        | Mínimo 6 caracteres  |

**Ejemplo de body:**
```json
{
  "currentPassword": "miPassword123",
  "newPassword": "miNuevaPassword456"
}
```

**Respuesta exitosa — 200 OK:**
```json
{
  "message": "Password updated successfully"
}
```

**Errores posibles:**

| Status | Mensaje                                                                    | Causa                                     |
|--------|----------------------------------------------------------------------------|-------------------------------------------|
| 400    | `"This account uses social login and does not have a password"`            | El usuario solo tiene cuenta de Google    |
| 401    | `"Current password is incorrect"`                                          | La contraseña actual no coincide          |
| 401    | `"Unauthorized"`                                                           | Token inválido o ausente                  |
| 400    | `"currentPassword must be longer than or equal to 6 characters"`           | Validación de campo                       |

**Ejemplo de error 400 (cuenta Google):**
```json
{
  "statusCode": 400,
  "message": "This account uses social login and does not have a password",
  "error": "Bad Request"
}
```

**Ejemplo de error 401 (contraseña incorrecta):**
```json
{
  "statusCode": 401,
  "message": "Current password is incorrect",
  "error": "Unauthorized"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/auth/change-password \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"miPassword123","newPassword":"miNuevaPassword456"}'
```

---

### POST /auth/forgot-password

**Descripción:** Genera un enlace de restablecimiento de contraseña usando Firebase y lo envía por email. Por seguridad, siempre devuelve el mismo mensaje sin importar si el email existe o no.

**Acceso:** Público

**Headers:**
```
Content-Type: application/json
```

**Body:**

| Campo | Tipo   | Requerido | Validación            |
|-------|--------|-----------|-----------------------|
| email | string | Sí        | Debe ser email válido |

**Ejemplo de body:**
```json
{
  "email": "juan@example.com"
}
```

**Respuesta exitosa — 200 OK:**

> El mensaje es siempre el mismo, independientemente de si el email existe en el sistema.

```json
{
  "message": "If the email exists, a reset link has been generated."
}
```

**Errores posibles:**

| Status | Mensaje                   | Causa                                                |
|--------|---------------------------|------------------------------------------------------|
| 400    | `"email must be an email"` | Formato de email inválido                            |
| 400    | `"<Firebase error msg>"`  | Error al generar el link en Firebase (ej: dominio no autorizado) |

**cURL:**
```bash
curl -X POST http://localhost:3000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@example.com"}'
```

---

## 6. Módulo Users

Gestión del perfil del usuario autenticado y sus estadísticas de entrenamiento.

> **Todos los endpoints de este módulo requieren JWT.**

---

### GET /users/profile

**Descripción:** Obtiene el perfil completo del usuario autenticado (sin el campo `password`).

**Acceso:** JWT requerido

**Headers:**
```
Authorization: Bearer <token>
```

**Body:** Ninguno

**Respuesta exitosa — 200 OK:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "email": "juan@example.com",
  "googleId": "firebase-uid-abc123",
  "name": "Juan Pérez",
  "role": "USER",
  "level": "INTERMEDIATE",
  "plan": "PRO",
  "trainingStreak": 12,
  "quotasUsed": 0,
  "lastQuotaReset": "2026-05-07T00:00:00.000Z",
  "aiPromptCount": 1,
  "lastAiPromptDate": "2026-05-07T10:00:00.000Z",
  "createdAt": "2026-04-01T12:00:00.000Z",
  "updatedAt": "2026-05-07T10:00:00.000Z"
}
```

**Errores posibles:**

| Status | Mensaje            | Causa                               |
|--------|--------------------|-------------------------------------|
| 401    | `"Unauthorized"`   | Token inválido o ausente            |
| 404    | `"User not found"` | El usuario del token ya no existe   |

**cURL:**
```bash
curl -X GET http://localhost:3000/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### PATCH /users/profile

**Descripción:** Actualiza el perfil del usuario autenticado. Solo se actualizan los campos enviados (todos son opcionales).

**Acceso:** JWT requerido

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (todos los campos son opcionales):**

| Campo | Tipo   | Requerido | Validación                                      |
|-------|--------|-----------|-------------------------------------------------|
| name  | string | No        | Cualquier string                                |
| level | string | No        | Enum: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`    |
| plan  | string | No        | Enum: `BASIC`, `PRO`, `EXPERT`                  |

> **Nota:** Para cambiar el plan de suscripción formalmente se recomienda usar `POST /subscriptions/upgrade`. Este endpoint puede cambiar el plan directamente pero no crea el registro de suscripción.

**Ejemplo de body:**
```json
{
  "name": "Juan Carlos Pérez",
  "level": "INTERMEDIATE"
}
```

**Respuesta exitosa — 200 OK:**

Devuelve el objeto User completo actualizado (incluyendo el campo `password` hasheado — considerar filtrar en el cliente).

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "email": "juan@example.com",
  "googleId": "firebase-uid-abc123",
  "name": "Juan Carlos Pérez",
  "role": "USER",
  "level": "INTERMEDIATE",
  "plan": "PRO",
  "trainingStreak": 12,
  "quotasUsed": 0,
  "lastQuotaReset": "2026-05-07T00:00:00.000Z",
  "aiPromptCount": 1,
  "lastAiPromptDate": "2026-05-07T10:00:00.000Z",
  "createdAt": "2026-04-01T12:00:00.000Z",
  "updatedAt": "2026-05-07T21:45:00.000Z"
}
```

**Errores posibles:**

| Status | Mensaje                                       | Causa                          |
|--------|-----------------------------------------------|--------------------------------|
| 401    | `"Unauthorized"`                              | Token inválido o ausente       |
| 400    | `"level must be one of the following values"` | Enum inválido                  |
| 400    | `"property X should not exist"`               | Campo no permitido en el body  |

**Ejemplo de error 400 (campo extra):**
```json
{
  "statusCode": 400,
  "message": ["property age should not exist"],
  "error": "Bad Request"
}
```

**cURL:**
```bash
curl -X PATCH http://localhost:3000/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan Carlos Pérez","level":"INTERMEDIATE"}'
```

---

### GET /users/stats

**Descripción:** Obtiene estadísticas de entrenamiento del usuario autenticado: racha, rutinas, workouts totales, calorías y duración.

**Acceso:** JWT requerido

**Headers:**
```
Authorization: Bearer <token>
```

**Body:** Ninguno

**Respuesta exitosa — 200 OK:**
```json
{
  "trainingStreak": 12,
  "routinesCount": 5,
  "totalWorkouts": 48,
  "totalCalories": 18500,
  "totalDurationMinutes": 2160,
  "plan": "PRO",
  "level": "INTERMEDIATE"
}
```

**Descripción de los campos:**

| Campo                 | Tipo   | Descripción                                    |
|-----------------------|--------|------------------------------------------------|
| trainingStreak        | number | Días consecutivos de entrenamiento             |
| routinesCount         | number | Total de rutinas creadas por el usuario        |
| totalWorkouts         | number | Total de sesiones de entrenamiento registradas |
| totalCalories         | number | Suma total de calorías quemadas registradas    |
| totalDurationMinutes  | number | Suma total de minutos de entrenamiento         |
| plan                  | string | Plan de suscripción actual                     |
| level                 | string | Nivel de entrenamiento actual                  |

**Errores posibles:**

| Status | Mensaje          | Causa                    |
|--------|------------------|--------------------------|
| 401    | `"Unauthorized"` | Token inválido o ausente |

**cURL:**
```bash
curl -X GET http://localhost:3000/users/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 7. Módulo Exercises

Catálogo de ejercicios con filtros y paginación.

> **Nota de seguridad:** Actualmente los endpoints de ejercicios son **públicos** (no requieren JWT).

---

### GET /exercises

**Descripción:** Obtiene la lista de ejercicios con soporte para filtros por músculo, dificultad y búsqueda por nombre. Los resultados incluyen imágenes, músculos y categoría.

**Acceso:** Público

**Query Parameters (todos opcionales):**

| Parámetro  | Tipo   | Default | Descripción                                               |
|------------|--------|---------|-----------------------------------------------------------|
| muscle     | string | —       | Filtra por músculo (principal o secundario). Ej: `chest`  |
| difficulty | string | —       | Filtra por dificultad: `beginner`, `intermediate`, `expert` |
| search     | string | —       | Búsqueda parcial por nombre (insensible a mayúsculas)     |
| page       | string | `"1"`   | Número de página                                          |
| limit      | string | `"20"`  | Resultados por página                                     |

**Ejemplos de URL:**
```
GET /exercises
GET /exercises?muscle=chest&difficulty=intermediate
GET /exercises?search=bench&page=2&limit=10
GET /exercises?muscle=biceps&limit=5
```

**Respuesta exitosa — 200 OK:**

Devuelve un array de ejercicios (sin wrapper de paginación — la respuesta es el array directamente).

```json
[
  {
    "id": "c3d4e5f6-a7b8-9012-cdef-012345678901",
    "name": "Barbell Bench Press - Medium Grip",
    "description": "A classic push exercise to develop the chest muscles.",
    "instructions": [
      "Lie back on a flat bench.",
      "Lift the bar from the rack and hold it straight over you with locked arms.",
      "Breathe in and begin lowering the bar slowly until it touches your middle chest.",
      "Push the bar back to the starting position while breathing out."
    ],
    "difficulty": "intermediate",
    "mechanic": "compound",
    "force": "push",
    "equipment": "barbell",
    "categoryId": "cat-uuid-001",
    "category": {
      "id": "cat-uuid-001",
      "name": "Strength"
    },
    "primaryMuscles": [
      { "id": "mus-uuid-001", "name": "chest", "target": "upper body" }
    ],
    "secondaryMuscles": [
      { "id": "mus-uuid-002", "name": "triceps", "target": "upper body" },
      { "id": "mus-uuid-003", "name": "front delts", "target": "upper body" }
    ],
    "images": [
      { "id": "img-uuid-001", "url": "https://raw.githubusercontent.com/.../0.jpg", "exerciseId": "c3d4e5f6-a7b8-9012-cdef-012345678901" },
      { "id": "img-uuid-002", "url": "https://raw.githubusercontent.com/.../1.jpg", "exerciseId": "c3d4e5f6-a7b8-9012-cdef-012345678901" }
    ],
    "createdAt": "2026-04-01T00:00:00.000Z",
    "updatedAt": "2026-04-01T00:00:00.000Z"
  }
]
```

**Respuesta con resultados vacíos — 200 OK:**
```json
[]
```

**Errores posibles:**

| Status | Mensaje                                          | Causa                                |
|--------|--------------------------------------------------|--------------------------------------|
| 400    | `"limit must be a number string"`                | El parámetro `limit` no es numérico  |
| 400    | `"page must be a number string"`                 | El parámetro `page` no es numérico   |

**cURL:**
```bash
# Todos los ejercicios (primera página, 20 por página)
curl -X GET "http://localhost:3000/exercises"

# Filtrar por músculo y dificultad
curl -X GET "http://localhost:3000/exercises?muscle=chest&difficulty=intermediate"

# Búsqueda con paginación
curl -X GET "http://localhost:3000/exercises?search=squat&page=1&limit=10"
```

---

### GET /exercises/:id

**Descripción:** Obtiene un ejercicio específico por su ID. Incluye las imágenes del ejercicio.

**Acceso:** Público

**Path Parameters:**

| Parámetro | Tipo   | Descripción          |
|-----------|--------|----------------------|
| id        | string | UUID del ejercicio   |

**Respuesta exitosa — 200 OK:**
```json
{
  "id": "c3d4e5f6-a7b8-9012-cdef-012345678901",
  "name": "Barbell Bench Press - Medium Grip",
  "description": "A classic push exercise to develop the chest muscles.",
  "instructions": [
    "Lie back on a flat bench.",
    "Lift the bar from the rack and hold it straight over you with locked arms.",
    "Breathe in and begin lowering the bar slowly until it touches your middle chest.",
    "Push the bar back to the starting position while breathing out."
  ],
  "difficulty": "intermediate",
  "mechanic": "compound",
  "force": "push",
  "equipment": "barbell",
  "categoryId": "cat-uuid-001",
  "images": [
    { "id": "img-uuid-001", "url": "https://raw.githubusercontent.com/.../0.jpg", "exerciseId": "c3d4e5f6-a7b8-9012-cdef-012345678901" },
    { "id": "img-uuid-002", "url": "https://raw.githubusercontent.com/.../1.jpg", "exerciseId": "c3d4e5f6-a7b8-9012-cdef-012345678901" }
  ],
  "createdAt": "2026-04-01T00:00:00.000Z",
  "updatedAt": "2026-04-01T00:00:00.000Z"
}
```

> **Nota:** A diferencia de `GET /exercises`, este endpoint **no incluye** `primaryMuscles`, `secondaryMuscles` ni `category` en su respuesta — solo incluye `images`.

**Respuesta cuando el ID no existe — 200 OK con `null`:**

El endpoint actualmente devuelve `null` si no encuentra el ejercicio (no lanza 404).

```json
null
```

**Errores posibles:**

| Status | Mensaje          | Causa                    |
|--------|------------------|--------------------------|
| —      | `null`           | ID no existe (retorna null en lugar de 404) |

**cURL:**
```bash
curl -X GET "http://localhost:3000/exercises/c3d4e5f6-a7b8-9012-cdef-012345678901"
```

---

## 8. Módulo Routines

Creación de rutinas de entrenamiento, con soporte para generación automática por IA.

> **Nota de seguridad:** Actualmente `POST /routines` es **público** (no requiere JWT). El `userId` se envía en el body. Se recomienda proteger este endpoint en el futuro.

---

### POST /routines

**Descripción:** Crea una nueva rutina de entrenamiento. Puede crearse de dos formas:
1. **Manual**: enviando la lista de ejercicios en el campo `exercises`.
2. **Con IA**: enviando `fromAi: true` y `aiPrompt` con la descripción del entrenamiento deseado. La IA genera la lista de ejercicios automáticamente.

**Acceso:** Público (sin JWT actualmente)

**Headers:**
```
Content-Type: application/json
```

**Body:**

| Campo       | Tipo             | Requerido | Descripción                                            |
|-------------|------------------|-----------|--------------------------------------------------------|
| name        | string           | Sí        | Nombre de la rutina                                    |
| userId      | string           | Sí        | ID del usuario creador                                 |
| description | string           | No        | Descripción de la rutina                               |
| isPublic    | boolean          | No        | Si la rutina es visible para otros (default: `false`)  |
| fromAi      | boolean          | No        | Si se usa IA para generar ejercicios (default: `false`)|
| aiPrompt    | string           | No        | Instrucciones para la IA (requerido si `fromAi: true`) |
| exercises   | Exercise[]       | No        | Lista de ejercicios (ver estructura abajo)             |

**Estructura de cada elemento en `exercises`:**

| Campo        | Tipo   | Requerido | Descripción                                |
|--------------|--------|-----------|--------------------------------------------|
| exerciseName | string | Sí        | Nombre exacto del ejercicio en la BD       |
| sets         | number | No        | Número de series (default: `3`)            |
| reps         | number | No        | Número de repeticiones (default: `10`)     |
| duration     | string | No        | Duración en segundos o descripción textual |

**Ejemplo de body — Rutina Manual:**
```json
{
  "name": "Full Body Lunes",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "description": "Rutina completa para el lunes",
  "isPublic": false,
  "exercises": [
    {
      "exerciseName": "Barbell Squat",
      "sets": 4,
      "reps": 8
    },
    {
      "exerciseName": "Barbell Bench Press - Medium Grip",
      "sets": 3,
      "reps": 10
    },
    {
      "exerciseName": "Bent Over Barbell Row",
      "sets": 3,
      "reps": 12
    }
  ]
}
```

**Ejemplo de body — Rutina con IA:**
```json
{
  "name": "Mi Rutina de Pecho IA",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "fromAi": true,
  "aiPrompt": "Crea una rutina de 5 ejercicios para desarrollar el pecho, nivel intermedio, usando barra y mancuernas. Incluye sets y repeticiones.",
  "isPublic": false
}
```

**Respuesta exitosa — 201 Created:**
```json
{
  "id": "d4e5f6a7-b8c9-0123-def0-123456789012",
  "name": "Full Body Lunes",
  "description": "Rutina completa para el lunes",
  "isPublic": false,
  "likes": 0,
  "creatorId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "createdAt": "2026-05-07T21:30:00.000Z",
  "updatedAt": "2026-05-07T21:30:00.000Z",
  "exercises": [
    {
      "id": "re-uuid-001",
      "routineId": "d4e5f6a7-b8c9-0123-def0-123456789012",
      "exerciseId": "ex-uuid-barbell-squat",
      "order": 1,
      "sets": 4,
      "reps": 8,
      "duration": null,
      "exercise": {
        "id": "ex-uuid-barbell-squat",
        "name": "Barbell Squat",
        "description": "A fundamental compound exercise...",
        "instructions": ["..."],
        "difficulty": "intermediate",
        "mechanic": "compound",
        "force": "push",
        "equipment": "barbell",
        "categoryId": "cat-uuid-001",
        "createdAt": "2026-04-01T00:00:00.000Z",
        "updatedAt": "2026-04-01T00:00:00.000Z"
      }
    }
  ]
}
```

**Errores posibles:**

| Status | Mensaje                        | Causa                                   |
|--------|--------------------------------|-----------------------------------------|
| 400    | `"Name and userId are required"` | Faltan los campos requeridos           |
| 500    | `"Failed to generate routine JSON"` | La API de Gemini falló al generar con IA |

**Ejemplo de error 400:**
```json
{
  "statusCode": 400,
  "message": "Name and userId are required",
  "error": "Bad Request"
}
```

**cURL — Rutina Manual:**
```bash
curl -X POST http://localhost:3000/routines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Full Body Lunes",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
    "exercises": [
      {"exerciseName": "Barbell Squat", "sets": 4, "reps": 8},
      {"exerciseName": "Barbell Bench Press - Medium Grip", "sets": 3, "reps": 10}
    ]
  }'
```

**cURL — Rutina con IA:**
```bash
curl -X POST http://localhost:3000/routines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rutina IA Pecho",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
    "fromAi": true,
    "aiPrompt": "Crea una rutina de 5 ejercicios para pecho, nivel intermedio"
  }'
```

---

## 9. Módulo Progress

Registro y consulta del historial de actividad física del usuario.

> **Todos los endpoints de este módulo requieren JWT.**

---

### POST /progress/log

**Descripción:** Registra una sesión de entrenamiento completada. Actualiza automáticamente la racha de entrenamiento (`trainingStreak`) del usuario según la lógica de días consecutivos.

**Lógica de racha:**
- Si el último entrenamiento fue ayer → racha incrementa en 1.
- Si el último entrenamiento fue hace más de 1 día → racha se reinicia a 1.
- Si el usuario entrena múltiples veces el mismo día → la racha no cambia.

**Acceso:** JWT requerido

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

| Campo     | Tipo   | Requerido | Descripción                                          |
|-----------|--------|-----------|------------------------------------------------------|
| duration  | number | Sí        | Duración de la sesión en minutos                     |
| calories  | number | Sí        | Calorías quemadas estimadas                          |
| routineId | string | No        | UUID de la rutina realizada (para vincular el log)   |

**Ejemplo de body:**
```json
{
  "duration": 45,
  "calories": 320,
  "routineId": "d4e5f6a7-b8c9-0123-def0-123456789012"
}
```

**Ejemplo sin rutina:**
```json
{
  "duration": 30,
  "calories": 200
}
```

**Respuesta exitosa — 201 Created:**
```json
{
  "id": "e5f6a7b8-c9d0-1234-ef01-234567890123",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "routineId": "d4e5f6a7-b8c9-0123-def0-123456789012",
  "date": "2026-05-07T21:30:00.000Z",
  "duration": 45,
  "calories": 320
}
```

**Errores posibles:**

| Status | Mensaje                                 | Causa                              |
|--------|-----------------------------------------|------------------------------------|
| 401    | `"Unauthorized"`                        | Token inválido o ausente           |
| 400    | `"duration must be a number conforming to the specified constraints"` | duration no es número |
| 400    | `"calories must be a number conforming to the specified constraints"` | calories no es número |

**cURL:**
```bash
curl -X POST http://localhost:3000/progress/log \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"duration":45,"calories":320,"routineId":"d4e5f6a7-b8c9-0123-def0-123456789012"}'
```

---

### GET /progress/history

**Descripción:** Obtiene el historial completo de sesiones de entrenamiento del usuario autenticado, ordenado de más reciente a más antiguo. Incluye el nombre de la rutina vinculada (si existe).

**Acceso:** JWT requerido

**Headers:**
```
Authorization: Bearer <token>
```

**Body:** Ninguno

**Respuesta exitosa — 200 OK:**
```json
[
  {
    "id": "e5f6a7b8-c9d0-1234-ef01-234567890123",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
    "routineId": "d4e5f6a7-b8c9-0123-def0-123456789012",
    "date": "2026-05-07T21:30:00.000Z",
    "duration": 45,
    "calories": 320,
    "routine": {
      "name": "Full Body Lunes"
    }
  },
  {
    "id": "f6a7b8c9-d0e1-2345-f012-345678901234",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
    "routineId": null,
    "date": "2026-05-06T19:00:00.000Z",
    "duration": 30,
    "calories": 200,
    "routine": null
  }
]
```

**Respuesta sin historial — 200 OK:**
```json
[]
```

**Errores posibles:**

| Status | Mensaje          | Causa                    |
|--------|------------------|--------------------------|
| 401    | `"Unauthorized"` | Token inválido o ausente |

**cURL:**
```bash
curl -X GET http://localhost:3000/progress/history \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 10. Módulo Subscriptions

Gestión del plan de suscripción del usuario.

> **Todos los endpoints de este módulo requieren JWT.**

---

### POST /subscriptions/upgrade

**Descripción:** Actualiza el plan de suscripción del usuario. Crea o actualiza el registro de suscripción con una duración de 1 mes desde la fecha actual. También actualiza el campo `plan` en el perfil del usuario.

**Acceso:** JWT requerido

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**

| Campo | Tipo   | Requerido | Validación                          |
|-------|--------|-----------|-------------------------------------|
| plan  | string | Sí        | Enum: `BASIC`, `PRO`, `EXPERT`      |

**Ejemplo de body:**
```json
{
  "plan": "PRO"
}
```

**Respuesta exitosa — 201 Created:**
```json
{
  "id": "sub-uuid-001",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "plan": "PRO",
  "startDate": "2026-05-07T21:30:00.000Z",
  "endDate": "2026-06-07T21:30:00.000Z",
  "isActive": true
}
```

**Errores posibles:**

| Status | Mensaje                                             | Causa                        |
|--------|-----------------------------------------------------|------------------------------|
| 401    | `"Unauthorized"`                                    | Token inválido o ausente     |
| 400    | `"plan must be one of the following values: BASIC, PRO, EXPERT"` | Plan inválido  |
| 400    | `"plan should not be empty"`                        | Campo `plan` faltante        |

**Ejemplo de error 400:**
```json
{
  "statusCode": 400,
  "message": ["plan must be one of the following values: BASIC, PRO, EXPERT"],
  "error": "Bad Request"
}
```

**cURL:**
```bash
curl -X POST http://localhost:3000/subscriptions/upgrade \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"plan":"PRO"}'
```

---

## 11. Módulo Admin

Administración de usuarios, ejercicios, rutinas y estadísticas del sistema. Todos los endpoints requieren JWT con `role: ADMIN`.

> **Acceso:** JWT requerido + rol `ADMIN`
>
> Si el usuario tiene JWT válido pero no es ADMIN, recibirá `403 Forbidden`.

---

### GET /admin/users

**Descripción:** Lista todos los usuarios con paginación y filtros opcionales.

**Query Parameters (todos opcionales):**

| Parámetro | Tipo   | Default | Descripción                                           |
|-----------|--------|---------|-------------------------------------------------------|
| page      | string | `"1"`   | Número de página                                      |
| limit     | string | `"10"`  | Usuarios por página                                   |
| search    | string | —       | Búsqueda por nombre o email (insensible a mayúsculas) |
| plan      | string | —       | Filtro por plan: `BASIC`, `PRO`, `EXPERT`             |
| role      | string | —       | Filtro por rol: `USER`, `ADMIN`                       |

**Respuesta exitosa — 200 OK:**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
      "email": "juan@example.com",
      "password": "$2b$10$hashedPasswordXyz...",
      "googleId": "firebase-uid-abc123",
      "name": "Juan Pérez",
      "role": "USER",
      "level": "INTERMEDIATE",
      "plan": "PRO",
      "trainingStreak": 12,
      "quotasUsed": 0,
      "lastQuotaReset": "2026-05-07T00:00:00.000Z",
      "aiPromptCount": 1,
      "lastAiPromptDate": "2026-05-07T10:00:00.000Z",
      "createdAt": "2026-04-01T12:00:00.000Z",
      "updatedAt": "2026-05-07T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 125,
    "page": 1,
    "limit": 10,
    "totalPages": 13
  }
}
```

> **Advertencia:** Este endpoint devuelve el campo `password` (hasheado). Filtrar en el cliente si se va a mostrar.

**Errores posibles:**

| Status | Mensaje                                            | Causa                                   |
|--------|----------------------------------------------------|-----------------------------------------|
| 401    | `"Unauthorized"`                                   | Token inválido o ausente                |
| 403    | `"You do not have permission to access this resource"` | El usuario no tiene rol ADMIN       |

**cURL:**
```bash
curl -X GET "http://localhost:3000/admin/users?page=1&limit=10&plan=PRO" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### GET /admin/users/:id

**Descripción:** Obtiene información detallada de un usuario específico, incluyendo los últimos 5 logs de actividad y conteo de rutinas y actividades.

**Path Parameters:**

| Parámetro | Tipo   | Descripción       |
|-----------|--------|-------------------|
| id        | string | UUID del usuario  |

**Respuesta exitosa — 200 OK:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "email": "juan@example.com",
  "name": "Juan Pérez",
  "role": "USER",
  "level": "INTERMEDIATE",
  "plan": "PRO",
  "trainingStreak": 12,
  "createdAt": "2026-04-01T12:00:00.000Z",
  "updatedAt": "2026-05-07T10:00:00.000Z",
  "activityLogs": [
    {
      "id": "log-uuid-001",
      "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
      "routineId": "d4e5f6a7-b8c9-0123-def0-123456789012",
      "date": "2026-05-07T21:30:00.000Z",
      "duration": 45,
      "calories": 320
    }
  ],
  "_count": {
    "routines": 5,
    "activityLogs": 48
  }
}
```

**Errores posibles:**

| Status | Mensaje                          | Causa                        |
|--------|----------------------------------|------------------------------|
| 401    | `"Unauthorized"`                 | Token inválido o ausente     |
| 403    | `"You do not have permission..."` | No es ADMIN                 |
| 404    | `"User with ID {id} not found"`  | El ID no existe              |

**Ejemplo de error 404:**
```json
{
  "statusCode": 404,
  "message": "User with ID a1b2c3d4-e5f6-7890-abcd-ef0123456789 not found",
  "error": "Not Found"
}
```

**cURL:**
```bash
curl -X GET "http://localhost:3000/admin/users/a1b2c3d4-e5f6-7890-abcd-ef0123456789" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### PATCH /admin/users/:id

**Descripción:** Actualiza campos del perfil de un usuario (como cambiar su plan, rol o nivel).

**Path Parameters:**

| Parámetro | Tipo   | Descripción       |
|-----------|--------|-------------------|
| id        | string | UUID del usuario  |

**Body (todos los campos son opcionales):**

| Campo | Tipo   | Descripción                                   |
|-------|--------|-----------------------------------------------|
| name  | string | Nombre del usuario                            |
| level | string | Nivel: `BEGINNER`, `INTERMEDIATE`, `ADVANCED` |
| plan  | string | Plan: `BASIC`, `PRO`, `EXPERT`                |
| role  | string | Rol: `USER`, `ADMIN`                          |

**Ejemplo de body:**
```json
{
  "plan": "EXPERT",
  "role": "ADMIN"
}
```

**Respuesta exitosa — 200 OK:**

Devuelve el usuario actualizado completo.

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "email": "juan@example.com",
  "name": "Juan Pérez",
  "role": "ADMIN",
  "level": "INTERMEDIATE",
  "plan": "EXPERT",
  "trainingStreak": 12,
  "createdAt": "2026-04-01T12:00:00.000Z",
  "updatedAt": "2026-05-07T22:00:00.000Z"
}
```

**Errores posibles:**

| Status | Mensaje                              | Causa                        |
|--------|--------------------------------------|------------------------------|
| 401    | `"Unauthorized"`                     | Token inválido o ausente     |
| 403    | `"You do not have permission..."`    | No es ADMIN                  |
| 404    | `"User with ID {id} not found"`      | El ID no existe              |

**cURL:**
```bash
curl -X PATCH "http://localhost:3000/admin/users/a1b2c3d4-e5f6-7890-abcd-ef0123456789" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"plan":"EXPERT","role":"ADMIN"}'
```

---

### DELETE /admin/users/:id

**Descripción:** Elimina permanentemente un usuario y todos sus datos asociados (logs de actividad, rutinas, suscripción, favoritos). Esta operación es irreversible.

**Path Parameters:**

| Parámetro | Tipo   | Descripción       |
|-----------|--------|-------------------|
| id        | string | UUID del usuario  |

**Body:** Ninguno

**Respuesta exitosa — 200 OK:**
```json
{
  "message": "User deleted successfully"
}
```

**Errores posibles:**

| Status | Mensaje                              | Causa                        |
|--------|--------------------------------------|------------------------------|
| 401    | `"Unauthorized"`                     | Token inválido o ausente     |
| 403    | `"You do not have permission..."`    | No es ADMIN                  |
| 404    | `"User with ID {id} not found"`      | El ID no existe              |

**cURL:**
```bash
curl -X DELETE "http://localhost:3000/admin/users/a1b2c3d4-e5f6-7890-abcd-ef0123456789" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### POST /admin/exercises

**Descripción:** Crea un nuevo ejercicio en el catálogo. Permite agregar imágenes via URLs.

**Body:**

| Campo       | Tipo     | Requerido | Validación                                   |
|-------------|----------|-----------|----------------------------------------------|
| name        | string   | Sí        | Único en la BD                               |
| description | string   | No        | Descripción del ejercicio                    |
| instructions| string[] | No        | Array de pasos como strings                  |
| difficulty  | string   | No        | `beginner`, `intermediate`, `expert`         |
| mechanic    | string   | No        | `compound`, `isolation`                      |
| force       | string   | No        | `push`, `pull`, `static`                     |
| equipment   | string   | No        | Nombre del equipo (libre)                    |
| categoryId  | string   | No        | UUID de la categoría                         |
| imageUrls   | string[] | No        | Array de URLs válidas de imágenes            |

**Ejemplo de body:**
```json
{
  "name": "Incline Dumbbell Press",
  "description": "A chest exercise performed on an incline bench.",
  "instructions": [
    "Set the bench to a 30-45 degree angle.",
    "Hold a dumbbell in each hand at shoulder level.",
    "Press the dumbbells up until arms are extended.",
    "Lower back slowly."
  ],
  "difficulty": "intermediate",
  "mechanic": "compound",
  "force": "push",
  "equipment": "dumbbell",
  "imageUrls": [
    "https://example.com/exercises/incline-press/0.jpg",
    "https://example.com/exercises/incline-press/1.jpg"
  ]
}
```

**Respuesta exitosa — 201 Created:**
```json
{
  "id": "new-ex-uuid-001",
  "name": "Incline Dumbbell Press",
  "description": "A chest exercise performed on an incline bench.",
  "instructions": ["Set the bench...", "Hold a dumbbell...", "..."],
  "difficulty": "intermediate",
  "mechanic": "compound",
  "force": "push",
  "equipment": "dumbbell",
  "categoryId": null,
  "createdAt": "2026-05-07T22:00:00.000Z",
  "updatedAt": "2026-05-07T22:00:00.000Z",
  "images": [
    { "id": "img-new-001", "url": "https://example.com/exercises/incline-press/0.jpg", "exerciseId": "new-ex-uuid-001" },
    { "id": "img-new-002", "url": "https://example.com/exercises/incline-press/1.jpg", "exerciseId": "new-ex-uuid-001" }
  ]
}
```

**Errores posibles:**

| Status | Mensaje                                           | Causa                             |
|--------|---------------------------------------------------|-----------------------------------|
| 401    | `"Unauthorized"`                                  | Token inválido o ausente          |
| 403    | `"You do not have permission..."`                 | No es ADMIN                       |
| 400    | `"each value in imageUrls must be an URL address"` | Una URL de imagen no es válida   |
| 400    | `"difficulty must be one of the following values: beginner, intermediate, expert"` | Enum inválido |

**cURL:**
```bash
curl -X POST http://localhost:3000/admin/exercises \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"name":"Incline Dumbbell Press","difficulty":"intermediate","mechanic":"compound","force":"push","equipment":"dumbbell"}'
```

---

### PATCH /admin/exercises/:id

**Descripción:** Actualiza un ejercicio existente. Si se envía `imageUrls`, las imágenes anteriores se eliminan y se reemplazan con las nuevas.

**Path Parameters:**

| Parámetro | Tipo   | Descripción         |
|-----------|--------|---------------------|
| id        | string | UUID del ejercicio  |

**Body:** Mismo formato que `POST /admin/exercises` pero todos los campos son opcionales.

**Ejemplo de body:**
```json
{
  "difficulty": "expert",
  "imageUrls": ["https://example.com/exercises/updated/0.jpg"]
}
```

**Respuesta exitosa — 200 OK:**

Devuelve el ejercicio actualizado completo con las imágenes.

**Errores posibles:**

| Status | Mensaje                                    | Causa                    |
|--------|--------------------------------------------|--------------------------|
| 401    | `"Unauthorized"`                           | Token inválido o ausente |
| 403    | `"You do not have permission..."`          | No es ADMIN              |
| 404    | `"Exercise with ID {id} not found"`        | El ID no existe          |

**cURL:**
```bash
curl -X PATCH "http://localhost:3000/admin/exercises/new-ex-uuid-001" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"difficulty":"expert"}'
```

---

### DELETE /admin/exercises/:id

**Descripción:** Elimina un ejercicio y todas sus imágenes y vínculos con rutinas. Operación irreversible.

**Path Parameters:**

| Parámetro | Tipo   | Descripción         |
|-----------|--------|---------------------|
| id        | string | UUID del ejercicio  |

**Respuesta exitosa — 200 OK:**
```json
{
  "message": "Exercise deleted successfully"
}
```

**Errores posibles:**

| Status | Mensaje                               | Causa                    |
|--------|---------------------------------------|--------------------------|
| 401    | `"Unauthorized"`                      | Token inválido o ausente |
| 403    | `"You do not have permission..."`     | No es ADMIN              |
| 404    | `"Exercise with ID {id} not found"`   | El ID no existe          |

**cURL:**
```bash
curl -X DELETE "http://localhost:3000/admin/exercises/new-ex-uuid-001" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### GET /admin/routines

**Descripción:** Lista todas las rutinas con paginación, búsqueda y datos del creador.

**Query Parameters (todos opcionales):**

| Parámetro | Tipo   | Default | Descripción                              |
|-----------|--------|---------|------------------------------------------|
| page      | string | `"1"`   | Número de página                         |
| limit     | string | `"10"`  | Rutinas por página                       |
| search    | string | —       | Búsqueda por nombre de rutina            |

**Respuesta exitosa — 200 OK:**
```json
{
  "data": [
    {
      "id": "d4e5f6a7-b8c9-0123-def0-123456789012",
      "name": "Full Body Lunes",
      "description": "Rutina completa para el lunes",
      "isPublic": false,
      "likes": 0,
      "creatorId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
      "createdAt": "2026-05-07T21:30:00.000Z",
      "updatedAt": "2026-05-07T21:30:00.000Z",
      "creator": {
        "name": "Juan Pérez",
        "email": "juan@example.com"
      },
      "_count": {
        "exercises": 3
      }
    }
  ],
  "meta": {
    "total": 87,
    "page": 1,
    "limit": 10,
    "totalPages": 9
  }
}
```

**Errores posibles:**

| Status | Mensaje                          | Causa                    |
|--------|----------------------------------|--------------------------|
| 401    | `"Unauthorized"`                 | Token inválido o ausente |
| 403    | `"You do not have permission..."` | No es ADMIN             |

**cURL:**
```bash
curl -X GET "http://localhost:3000/admin/routines?page=1&limit=10&search=Full" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### GET /admin/routines/:id

**Descripción:** Obtiene una rutina específica con todos sus ejercicios ordenados y los datos del creador.

**Path Parameters:**

| Parámetro | Tipo   | Descripción       |
|-----------|--------|-------------------|
| id        | string | UUID de la rutina |

**Respuesta exitosa — 200 OK:**
```json
{
  "id": "d4e5f6a7-b8c9-0123-def0-123456789012",
  "name": "Full Body Lunes",
  "description": "Rutina completa para el lunes",
  "isPublic": false,
  "likes": 0,
  "creatorId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "createdAt": "2026-05-07T21:30:00.000Z",
  "updatedAt": "2026-05-07T21:30:00.000Z",
  "creator": {
    "name": "Juan Pérez",
    "email": "juan@example.com"
  },
  "exercises": [
    {
      "id": "re-uuid-001",
      "routineId": "d4e5f6a7-b8c9-0123-def0-123456789012",
      "exerciseId": "ex-uuid-barbell-squat",
      "order": 1,
      "sets": 4,
      "reps": 8,
      "duration": null,
      "exercise": {
        "id": "ex-uuid-barbell-squat",
        "name": "Barbell Squat",
        "difficulty": "intermediate",
        "equipment": "barbell"
      }
    }
  ]
}
```

**Errores posibles:**

| Status | Mensaje                              | Causa                    |
|--------|--------------------------------------|--------------------------|
| 401    | `"Unauthorized"`                     | Token inválido o ausente |
| 403    | `"You do not have permission..."`    | No es ADMIN              |
| 404    | `"Routine with ID {id} not found"`   | El ID no existe          |

**cURL:**
```bash
curl -X GET "http://localhost:3000/admin/routines/d4e5f6a7-b8c9-0123-def0-123456789012" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### GET /admin/stats

**Descripción:** Obtiene estadísticas globales del sistema para el dashboard de administración.

**Body:** Ninguno

**Respuesta exitosa — 200 OK:**
```json
{
  "totalUsers": 1250,
  "activeUsersToday": 87,
  "premiumUsers": 340,
  "totalRoutines": 3200,
  "routinesCreatedToday": 15,
  "premiumConversionRate": 27.2
}
```

**Descripción de los campos:**

| Campo                 | Tipo   | Descripción                                               |
|-----------------------|--------|-----------------------------------------------------------|
| totalUsers            | number | Total de usuarios registrados                             |
| activeUsersToday      | number | Usuarios que registraron actividad hoy                    |
| premiumUsers          | number | Usuarios con plan PRO o EXPERT                            |
| totalRoutines         | number | Total de rutinas creadas en el sistema                    |
| routinesCreatedToday  | number | Rutinas creadas hoy                                       |
| premiumConversionRate | number | Porcentaje de usuarios con plan de pago (0-100)           |

**Errores posibles:**

| Status | Mensaje                          | Causa                    |
|--------|----------------------------------|--------------------------|
| 401    | `"Unauthorized"`                 | Token inválido o ausente |
| 403    | `"You do not have permission..."` | No es ADMIN             |

**cURL:**
```bash
curl -X GET http://localhost:3000/admin/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 12. Módulo Gemini AI

Generación de contenido usando Google Gemini Flash con sistema de caché y cuotas por plan.

> **Nota de seguridad:** Actualmente `POST /gemini/generate` es **público** (no requiere JWT). Si se envía `userId`, se aplican las cuotas del plan del usuario.

### Sistema de caché

Cada prompt enviado se almacena en caché. Si se hace la misma pregunta (prompt exacto), la respuesta se recupera del caché y no consume cuota. Para forzar una nueva llamada a la IA, usar `forceUpdate: true`.

### Cuotas diarias por plan

| Plan     | Prompts por día |
|----------|----------------|
| `BASIC`  | 1              |
| `PRO`    | 3              |
| `EXPERT` | 5              |

Las cuotas se reinician cada día (basado en fecha local del servidor). Si se supera la cuota y se proporciona `filters.muscle`, la API hace un fallback a la base de datos de ejercicios antes de lanzar el error de límite.

---

### POST /gemini/generate

**Descripción:** Genera texto o contenido usando Gemini Flash. Soporta caché de respuestas y cuotas por usuario.

**Acceso:** Público (sin JWT actualmente)

**Headers:**
```
Content-Type: application/json
```

**Body:**

| Campo       | Tipo             | Requerido | Descripción                                                      |
|-------------|------------------|-----------|------------------------------------------------------------------|
| prompt      | string           | Sí        | La instrucción o pregunta para la IA                             |
| userId      | string           | No        | UUID del usuario (activa el sistema de cuotas)                   |
| forceUpdate | boolean          | No        | Si `true`, ignora el caché y llama a la IA directamente          |
| filters     | object           | No        | Filtros para el fallback (ver estructura)                        |
| filters.muscle | string        | No        | Músculo para el fallback a BD si la cuota está agotada           |

**Ejemplo de body — Consulta simple:**
```json
{
  "prompt": "Sugiere 3 ejercicios efectivos para trabajar los bíceps sin equipo"
}
```

**Ejemplo de body — Con usuario y filtros:**
```json
{
  "prompt": "Dame una rutina de 5 ejercicios para pecho nivel intermedio",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  "forceUpdate": false,
  "filters": {
    "muscle": "chest"
  }
}
```

**Respuesta exitosa — 200 OK (respuesta de la IA):**
```json
{
  "text": "Aquí tienes una rutina de 5 ejercicios para pecho...\n\n1. **Press de Banca con Barra** - 4 series x 8 repeticiones...",
  "meta": {
    "isCached": false,
    "source": "ai",
    "message": "Respuesta generada por Gemini AI."
  }
}
```

**Respuesta exitosa — 200 OK (respuesta desde caché):**
```json
{
  "text": "Aquí tienes una rutina de 5 ejercicios para pecho...",
  "meta": {
    "isCached": true,
    "source": "cache",
    "message": "Respuesta recuperada del historial (Cache)."
  }
}
```

**Respuesta exitosa — 200 OK (fallback a BD por cuota agotada):**

Cuando la cuota del usuario está agotada pero se proporcionó `filters.muscle` y hay ejercicios en la BD para ese músculo:

```json
{
  "data": [
    {
      "id": "ex-uuid-chest-001",
      "name": "Barbell Bench Press - Medium Grip",
      "difficulty": "intermediate",
      "equipment": "barbell",
      "images": [...]
    }
  ],
  "meta": {
    "isCached": false,
    "isFallback": true,
    "source": "database",
    "message": "Límite diario alcanzado. Aquí tienes 5 ejercicios de nuestra base de datos para chest."
  }
}
```

**Errores posibles:**

| Status | Mensaje                                                               | Causa                                                |
|--------|-----------------------------------------------------------------------|------------------------------------------------------|
| 400    | `"prompt should not be empty"`                                        | El campo `prompt` está vacío                         |
| 429    | `"Daily AI Limit Reached for your plan. Upgrade your plan or try again tomorrow."` | Cuota diaria agotada sin fallback disponible |
| 429    | `"Gemini Quota Exceeded. Please try again later."`                    | La API de Google Gemini alcanzó su propia cuota      |
| 500    | `"Failed to generate content from Gemini"`                            | Error interno al llamar a la API de Gemini           |

**Ejemplo de error 429 (cuota de usuario agotada):**
```json
{
  "statusCode": 429,
  "error": "Daily AI Limit Reached for your plan. Upgrade your plan or try again tomorrow.",
  "type": "LIMIT_REACHED"
}
```

**Ejemplo de error 429 (cuota de Google agotada):**
```json
{
  "statusCode": 429,
  "error": "Gemini Quota Exceeded. Please try again later.",
  "details": "..."
}
```

**Ejemplo de error 500:**
```json
{
  "statusCode": 500,
  "message": "Failed to generate content from Gemini"
}
```

**cURL — Consulta simple:**
```bash
curl -X POST http://localhost:3000/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Sugiere 3 ejercicios para bíceps sin equipo"}'
```

**cURL — Con usuario y filtro de fallback:**
```bash
curl -X POST http://localhost:3000/gemini/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Dame una rutina de pecho nivel intermedio",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
    "filters": {"muscle": "chest"}
  }'
```

---

## 13. Códigos de error globales

Referencia rápida de todos los códigos HTTP que puede devolver la API.

| Código | Nombre                | Cuándo ocurre                                                                          |
|--------|-----------------------|----------------------------------------------------------------------------------------|
| 400    | Bad Request           | Validación fallida (campos inválidos, tipos incorrectos, campos extra no permitidos)   |
| 401    | Unauthorized          | Token ausente, expirado, malformado, o credenciales incorrectas                        |
| 403    | Forbidden             | Token válido pero sin permisos suficientes (ej: acceder a `/admin` sin ser ADMIN)      |
| 404    | Not Found             | El recurso solicitado no existe en la BD (usuario, ejercicio, rutina)                  |
| 429    | Too Many Requests     | Cuota diaria de IA agotada (usuario o API de Google)                                   |
| 500    | Internal Server Error | Error inesperado del servidor (ej: fallo en la API de Gemini)                          |

### Formato estándar de error NestJS

**Error de validación (múltiples mensajes):**
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request"
}
```

**Error simple (un mensaje):**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**Error con estructura personalizada (Gemini):**
```json
{
  "statusCode": 429,
  "error": "Daily AI Limit Reached for your plan. Upgrade your plan or try again tomorrow.",
  "type": "LIMIT_REACHED"
}
```

### Notas de seguridad importantes

> Los siguientes endpoints **no tienen guard de autenticación** actualmente. Se recomienda agregar `@UseGuards(AuthGuard('jwt'))` en el futuro si se desea restringir el acceso:
>
> - `POST /routines` — Cualquiera puede crear rutinas para cualquier `userId`
> - `POST /gemini/generate` — Cualquiera puede usar la IA (sin cuota si no se envía `userId`)
> - `GET /exercises` y `GET /exercises/:id` — Catálogo público (esto puede ser intencional)

---

*Documentación generada el 07/05/2026 — G-Pulse Backend API v1.0*
