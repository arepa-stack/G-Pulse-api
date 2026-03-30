# Reporte de Estado del Backend (STATUS.md)

## 1. Escaneo Rápido de Arquitectura
- **Framework Principal:** [NestJS](https://nestjs.com/) (Versión 11, muy reciente).
- **Base de Datos / ORM:** [Prisma](https://www.prisma.io/) (Versión 6, reciente) conectado localmente y probablemente usando PostgreSQL acorde a convenciones de Prisma, con scripts de migración (`prisma:migrate`) definidos en el `package.json`.
- **Autenticación:** Utiliza `firebase-admin` y `@nestjs/passport` con una estrategia de Custom JWT de Firebase (`firebase-jwt`).
- **Integración IA:** Conecta con Google Gemini a través del SDK `@google/generative-ai`.
- **Arquitectura:** Sigue el patrón modular y de inyección de dependencias estándar de NestJS (Módulos, Controladores, Servicios).

## 2. Mapa de Endpoints Definidos
A continuación la lista de rutas expuestas agrupadas por controlador:

- **Auth** (`/auth`)
  - `POST /auth/register` - Registro de usuarios.
  - `POST /auth/login` - Inicio de sesión (protegido por `firebase-jwt`).
  - `POST /auth/forgot-password` - Recuperación de contraseña.

- **Users** (`/users`) *[Protegidos por AuthGuard('firebase-jwt')]*
  - `GET /users/profile` - Obtiene el perfil del usuario utilizando el UID de Google.
  - `PATCH /users/profile` - Actualiza el perfil (nombre, nivel, plan).

- **Routines** (`/routines`)
  - `POST /routines` - Crea una nueva rutina (puede también invocar la generación por IA llamando al `GeminiService`).

- **Exercises** (`/exercises`)
  - `GET /exercises` - Listado con filtros de músculos, dificultad, paginación y búsqueda insensible a mayúsculas.

- **Gemini** (`/gemini`)
  - `POST /gemini/generate` - Generación de texto (via prompt) y consultas a Gemini.

- **App** (`/`)
  - `GET /` - Endpoint base `getHello()`.

> **Nota:** Los controladores `subscriptions` y `progress` existen y están decorados con `@Controller()`, pero **no exponen ningún endpoint** (están vacíos internamente).

## 3. Métodos Vacíos, Incompletos o con TODOs implicitos
Tras analizar los controladores y servicios (`src`), destaco lo siguiente:

- **Controladores Vacíos:**
  - `SubscriptionsController` (`src/subscriptions/subscriptions.controller.ts`): Creado pero sin métodos (rutas).
  - `ProgressController` (`src/progress/progress.controller.ts`): Creado pero sin métodos (rutas).

- **Servicios y Métodos Incompletos (Marcados en comentarios):**
  - **`ProgressService.updateStreak(userId)`:**
    Contiene comentarios de lógica por terminar o placeholders:
    - *"Logic to check last activity and update streak"*
    - *"This is a placeholder for the date comparison logic"*
    - *"If 0 (same day), keep same unless it was 0?"*
  - **`SubscriptionsService.checkQuota(userId)`:**
    Tiene lógica comentada y mantenida por retrocompatibilidad. Indica que la verificación real de la IA pasó a `GeminiService`:
    - *"This logic is now primarily handled in GeminiService.checkQuota. We keep this for backward compatibility or other feature checks if needed."*
  - **`RoutinesService.createRoutine(data)`:**
    Tiene comentarios sobre simplificaciones hechas por falta de completitud en la relación Categoría/Músculos al momento de guardar rutinas generadas por IA:
    - *"If AI suggests an exercise not in DB, we create a placeholder... This is a bit complex for a quick fix, so let's check if we can just create with minimal info."*
    - *"For now, leave empty to avoid errors."* (Al crear `Exercise` generado por IA, lo deja sin relaciones).

## 4. Resumen de Dependencias Generales
El proyecto tiene un ecosistema tecnológico en estado muy **saludable y actualizado**. Gran parte de las dependencias principales están en sus últimas versiones *major* disponibles a día de hoy (NestJS v11, Prisma v6, Firebase Admin v13):

* Dependencias destacadas:
  * `@nestjs/*` en la versión **`^11.0.1`** (Al día)
  * `@prisma/client` y `prisma` en la versión **`^6.1.0`** (Al día)
  * `firebase-admin` en la versión **`^13.6.0`** (Al día)
  * `@google/generative-ai` en la versión **`^0.24.1`** (Muy reciente)
  * Entorno de tipado y ESLint ya usa el estándar del **Flat Config** (`eslint.config.mjs` y versiones 9.x de eslint).

**Conclusión Dependencias:** 
Actualmente, **no existen dependencias críticas desactualizadas**. El ecosistema fue inicializado (o actualizado) de manera reciente, utilizando en muchos casos las herramientas de vanguardia, como el nuevo esquema flat de eslint para NestJS 11 y las últimas integraciones de AI/Prisma. Todo está en orden de mantenimiento.
