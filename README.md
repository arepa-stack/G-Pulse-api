# G-Pulse API

Backend API for G-Pulse, a fitness tracking application built with NestJS, Prisma, and PostgreSQL (Supabase).

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [NestJS](https://nestjs.com/) |
| ORM | [Prisma](https://www.prisma.io/) |
| Database | PostgreSQL ([Supabase](https://supabase.com/)) |
| Auth | Firebase JWT |
| AI | Google Gemini API |
| Docs | Swagger / OpenAPI |
| Container | Docker + Docker Compose |

## Prerequisites

- Node.js 20+
- npm 9+
- Docker & Docker Compose (optional, for containerized dev)

## Project Setup

### 1. Install dependencies

```bash
npm install
```

> `prisma generate` runs automatically via the `postinstall` script.

### 2. Configure environment variables

Create a `.env` file in the project root with the following variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase pooler connection string (port `6543`, transaction mode) |
| `DIRECT_URL` | Supabase session mode connection (port `5432`, for migrations) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `FIREBASE_SERVICE_ACCOUNT` | Path to Firebase service account JSON (local dev) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase service account JSON content as string (production) |

> **Supabase connections**: `DATABASE_URL` uses the transaction pooler (`pooler.supabase.com:6543`) for app runtime queries. `DIRECT_URL` uses session mode (`pooler.supabase.com:5432`) for schema operations like migrations. Both are configured in `prisma/schema.prisma` via the `url` and `directUrl` fields.

### 3. Run migrations

```bash
npx prisma migrate dev
```

## Running the App

### Local

```bash
# development (watch mode)
npm run start:dev

# production
npm run start:prod
```

### Docker (API + Local DB)

```bash
# development with hot reloading
docker compose watch

# or just start services
docker compose up -d --build
```

Prisma commands inside the container:

```bash
npm run docker:migrate    # run migrations
npm run docker:generate   # generate Prisma client
npm run docker:studio     # open Prisma Studio
```

## API Modules

| Module | Description |
|--------|-------------|
| `auth` | Firebase JWT authentication |
| `users` | User management and profiles |
| `exercises` | Exercise catalog with muscles, categories, and images |
| `routines` | Workout routines with ordered exercises |
| `progress` | Activity logs and training tracking |
| `subscriptions` | Subscription plans (Basic, Pro, Expert) |
| `gemini` | AI-powered features via Google Gemini |
| `admin` | Admin-only operations |

## Database

### Creating a New Migration

When you modify `prisma/schema.prisma`, follow these steps to create and apply a migration:

**1. Edit the schema**

Make your changes in `prisma/schema.prisma` (add/modify models, fields, relations, enums, etc.).

**2. Generate the migration**

```bash
npx prisma migrate dev --name descriptive_migration_name
```

This will:
- Compare your schema against the current database state
- Generate a SQL migration file in `prisma/migrations/<timestamp>_<name>/migration.sql`
- Apply the migration to your local database
- Regenerate the Prisma client

Use a descriptive name in snake_case, e.g.: `add_workout_sets`, `rename_user_level`, `add_index_exercise_name`.

**3. Verify**

```bash
npx prisma studio   # visually inspect the database
```

**4. Commit the migration**

Always commit both the schema and the generated migration file:

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add workout sets table"
```

> **Important**: Never manually edit generated migration SQL files unless you know exactly what you're doing. If a migration is wrong, roll it back and create a new one.

### Applying Migrations (Production / CI)

```bash
npx prisma migrate deploy
```

This applies all pending migrations without generating new ones. Use this in production, CI, and Docker environments.

### Migrations with Supabase (Manual Fallback)

If `prisma migrate deploy` hangs or can't reach the direct connection, apply migrations manually via `psql`:

```bash
psql "$DATABASE_URL" -f prisma/migrations/<migration_name>/migration.sql
```

Then register it in Prisma's tracking table:

```sql
INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES (gen_random_uuid()::text, 'manual', '<migration_name>', now(), 1);
```

### Seeds

```bash
npm run seed:exercises    # seed exercise catalog
npm run seed:local        # seed local dev data
```

## API Documentation (Swagger)

Once running, access interactive docs at:

```
http://localhost:3000/api/docs
```

## Tests

```bash
npm run test          # unit tests
npm run test:e2e      # e2e tests
npm run test:cov      # coverage
```

## Project Structure

```
src/
├── admin/              # Admin module
├── auth/               # Authentication (Firebase JWT)
├── exercises/          # Exercise catalog
├── exercise-images/    # Exercise image management
├── gemini/             # AI integration
├── prisma/             # Prisma service (DB access)
├── progress/           # Activity logs
├── routines/           # Workout routines
├── subscriptions/      # Subscription plans
├── users/              # User management
├── app.module.ts       # Root module
└── main.ts             # Entry point

prisma/
├── schema.prisma       # Database schema (single source of truth)
├── migrations/         # Generated SQL migrations
├── seed-exercises.ts   # Exercise seed script
└── seed-local.ts       # Local dev seed script
```
