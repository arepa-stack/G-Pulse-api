# PRD F-13 — Upload y gestión de imágenes propias

| Campo | Valor |
|---|---|
| **Feature ID** | F-13 |
| **Sprint** | MVP (priorización flex) |
| **Prioridad** | Media |
| **Tareas Fibery** | #68 |
| **Documento RFC** | [`../rfcs/RF-13-image-upload.md`](../rfcs/RF-13-image-upload.md) |

## 1. TL;DR

Habilitar upload de imágenes desde el cliente (no solo URLs externas) usando Supabase Storage (ya está dentro del stack). Soporta:
- Imágenes para ejercicios creados por admin.
- Avatares de usuario.
- Fotos de progreso del usuario (opcional v2).

## 2. Contexto y problema

- `CreateExerciseDto` solo acepta URLs externas → si nadie las hospeda, no hay imágenes.
- La carpeta `src/exercise-images/` existe **vacía** desde hace tiempo.
- Un panel admin necesita poder subir archivos directamente.

## 3. Objetivo y métricas de éxito

| Objetivo | Métrica | Meta |
|---|---|---|
| Habilitar upload directo | Endpoint operativo y archivos accesibles | Sí |
| Catálogo con imágenes | % ejercicios con ≥ 1 imagen | ≥ 80% |
| Tamaño máximo razonable | < 2 MB por archivo, formatos JPEG/PNG/WebP | Sí |

## 4. Alcance

### In scope
- Configurar Supabase Storage bucket (`exercise-images` público, `user-avatars` público o firmado).
- `POST /admin/exercises/:id/images` (multipart): admin sube imagen para un ejercicio.
- `DELETE /admin/exercises/:id/images/:imageId`: admin borra una imagen.
- `POST /users/me/avatar` (multipart): usuario sube su avatar.
- Validación: mime type, tamaño máx 2 MB.
- Generación de URL final pública (Supabase) y persistencia en BD.

### Out of scope
- Imágenes de progreso del usuario (v2 — requiere bucket privado y signed URLs).
- Recorte server-side / thumbnails. Cliente envía la imagen ya optimizada.
- CDN custom (Supabase ya provee uno).

## 5. Usuarios y casos de uso

- **Actor admin**: poblar el catálogo de ejercicios con imágenes correctas.
- **Actor usuario**: cambiar su avatar.

## 6. Requisitos funcionales

| RF | Descripción |
|---|---|
| RF-01 | Aceptar `multipart/form-data` con file `image`. |
| RF-02 | Validar MIME type ∈ {image/jpeg, image/png, image/webp}. |
| RF-03 | Rechazar > 2 MB. |
| RF-04 | Generar key única: `exercises/{exerciseId}/{uuid}.{ext}` o `avatars/{userId}/{uuid}.{ext}`. |
| RF-05 | Persistir `ExerciseImage.url` con la URL pública del bucket. |
| RF-06 | Persistir `User.avatarUrl` (nuevo campo). |
| RF-07 | `DELETE` borra primero de storage, luego de BD. Si falla el storage → no borrar de BD. |

## 7. Requisitos no funcionales

- **Auth**: admin para endpoints de ejercicio; JWT para avatar.
- **Seguridad**: solo MIME válidos; nombres aleatorios (no usar el name del cliente).
- **Resiliencia**: si storage no responde → 503 con retry.

## 8. Criterios de aceptación

- [ ] Upload de un PNG válido → 201 con URL accesible vía GET.
- [ ] Upload de archivo > 2 MB → 413.
- [ ] Upload de archivo .exe → 415.
- [ ] DELETE quita la imagen de BD y del bucket.

## 9. Dependencias y riesgos

- **Dependencia**: configurar bucket en Supabase. Requiere credenciales en `.env` (URL, anon key, service key).
- **Riesgo**: costos de storage si los usuarios suben mucho. **Mitigación**: tamaño máx + tipos limitados.
- **Riesgo**: contenido inapropiado en avatares. **Mitigación**: política de TOS + moderación (futura).

## 10. Referencias

- `MVP_GAP_ANALYSIS.md` §3.6
- Tareas: Fibery #68
- Archivos afectados:
  - `prisma/schema.prisma` (campo `User.avatarUrl`)
  - `src/exercise-images/` (módulo nuevo)
  - `src/users/users.controller.ts` (avatar endpoint)
  - `.env` y `.env.example` (Supabase Storage)
