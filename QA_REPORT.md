# QA Testing Report - Backend API
**Fecha:** 2026-03-04
**Estado:** Probado con PostgreSQL + NestJS (Docker Dev Environment)

## 1. Endpoints Probados (Resultados)

### ✅ Endpoints que responden correctamente y sin sorpresas
- `GET /` - **200 OK** (Devuelve `"Hello World!"`)
- `GET /exercises` - **200 OK** (Devuelve un array JSON de ejercicios correctamente filtrados / extraídos de DB).

### 🛡 Endpoints Protegidos / Funcionales que responden adecuadamente
- `POST /auth/login` - **401 Unauthorized** (El endpoint está protegido efectivamente con `@UseGuards(AuthGuard('firebase-jwt'))` y fue rechazado correctamente al no poseer Token).
- `GET /users/profile` - **401 Unauthorized**
- `PATCH /users/profile` - **401 Unauthorized**

### ❌ Endpoints con posibles Errores "500 Internal Server Error" escondidos (Por ausencia de validación)

El `ValidationPipe` global está configurado en el proyecto, pero hay **fallas de seguridad / inyección por el mal uso de DTOs en varios Controladores**.

#### A. Falta de validación en Query Params (`GET /exercises`)
- **Falla detectada:** En `ExercisesController.ts`, el endpoint recibe `( @Query('limit') limit?: string, @Query('page') page?: string )` y hace una conversión directa mediante `parseInt(limit)`.
- **Qué ocurre si mandamos `GET /exercises?limit=abc`?**
  El `parseInt('abc')` revienta devolviendo `NaN`. Prisma recibe `take: NaN` en la consulta `this.exercisesService.findAll()`, originando un **error 500 fatal a nivel de base de datos** (Prisma rompe por parámetros inválidos).
- **Es necesario:** Usar DTOs con `@Type(() => Number)` y `@IsNumber()` o los pipes `@Query('limit', ParseIntPipe)`.

#### B. `ValidationPipe` Inútil por usar "Types" e interfaces nativas en Body (`PATCH /users/profile`)
- **Fallo detectado:** En `UsersController.ts`, el `PATCH` usa un tipado en línea:
  `@Body() updateData: { name?: string; level?: UserLevel; plan?: SubscriptionPlan }`
- **¿Por qué falla?** `ValidationPipe` **requiere clases de TypeScript** decoradas (con `class-validator`) para saber qué validar en ejecución. TypeScript elimina el type `{name?: string}` luego de la transpilación (runtime). Si le envías información corrupta en el JSON (ej. `{"plan": "NO_EXISTE"}`, Primsma intentará guardar esto en PGSQL, crasheando y lanzando un stack trace 500 al cliente en lugar de un 400 elegante.

## 2. Endpoints Que Fallan por Control (400 Bad Request Funcional)
El proyecto configuró bien `main.ts` con el `ValidationPipe` global. Al no enviarles Body, generaron estas validaciones limpias en vez de lanzar Stack Traces de base de datos (lo cual es muy bueno y esperado):

- **`POST /auth/register`** ➡️ `400 Bad Request`
  *Respuesta:* `{"message":["email must be an email","password must be longer than or equal to 6 characters","password must be a string","name must be a string"],"error":"Bad Request"}`
- **`POST /auth/forgot-password`** ➡️ `400 Bad Request`
  *Respuesta:* `{"message":["email must be an email"],"error":"Bad Request"}`
- **`POST /routines`** ➡️ `400 Bad Request`
  *Respuesta:* `{"message":["name should not be empty","name must be a string","userId should not be empty","userId must be a string"],"error":"Bad Request"}`
- **`POST /gemini/generate`** ➡️ `400 Bad Request`
  *Respuesta:* `{"message":["prompt should not be empty","prompt must be a string"],"error":"Bad Request"}`

---

## 💡 Recomendaciones del Ingeniero QA
1. **Refactorizar TODOS los endpoints que reciben Object Literals/Interfaces a clases DTO**. `UsersController.ts` no debería tener `{ name?: string }` directamente en los argumentos del método sino un `@Body() updateUserDto: UpdateUserDto`.
2. Agregar Pipes de validación o DTOs formales a las peticiones tipo `GET` (Ej. en `/exercises`, validar que limit y page son numéricos mayores a 0 usando `ParseIntPipe`).
