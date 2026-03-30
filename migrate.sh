#!/bin/sh
export DATABASE_URL="postgresql://postgres:postgres@db:5432/gym_pulse?schema=public"
echo "Running prisma migrate with DATABASE_URL=$DATABASE_URL"
npx prisma migrate dev --name init
