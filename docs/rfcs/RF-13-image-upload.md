# RFC F-13 — Upload y gestión de imágenes propias

| Campo | Valor |
|---|---|
| **Feature ID** | F-13 |
| **PRD asociado** | [`../prds/PF-13-image-upload.md`](../prds/PF-13-image-upload.md) |
| **Status** | Propuesto |
| **Esfuerzo** | M (2-3 días) |

## 1. TL;DR

Implementar `ExerciseImagesModule` con multipart upload usando `multer` + cliente Supabase Storage. Endpoint análogo para avatares.

## 2. Contexto técnico

- NestJS soporta `FileInterceptor` (multer) nativo.
- Supabase Storage SDK JS: `@supabase/supabase-js`.
- Bucket público para `exercise-images` (URLs públicas directas).
- Bucket público o firmado para `avatars` (decidir según política de privacidad).

## 3. Diseño propuesto

### 3.1 Schema (cambio mínimo)

```prisma
model User {
  ...
  avatarUrl String?
}
```

Migración: `add_user_avatar_url`.

`ExerciseImage` ya existe.

### 3.2 Dependencias

```bash
npm i @supabase/supabase-js multer @types/multer
```

### 3.3 StorageService

```typescript
// src/exercise-images/storage.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class StorageService {
  private client: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  async upload(bucket: 'exercise-images' | 'avatars', folder: string, file: Express.Multer.File) {
    const ext = extname(file.originalname).toLowerCase();
    const key = `${folder}/${randomUUID()}${ext}`;
    const { error } = await this.client.storage.from(bucket).upload(key, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (error) throw new InternalServerErrorException(`Storage upload failed: ${error.message}`);
    const { data } = this.client.storage.from(bucket).getPublicUrl(key);
    return { key, url: data.publicUrl };
  }

  async remove(bucket: 'exercise-images' | 'avatars', key: string) {
    const { error } = await this.client.storage.from(bucket).remove([key]);
    if (error) throw new InternalServerErrorException(`Storage delete failed: ${error.message}`);
  }
}
```

### 3.4 Endpoints

#### Exercise images (admin)

```typescript
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/exercises/:exerciseId/images')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class ExerciseImagesController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
      cb(ok ? null : new UnsupportedMediaTypeException('Invalid file type'), ok);
    },
  }))
  async upload(@Param('exerciseId') exerciseId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('image required');
    const exercise = await this.prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) throw new NotFoundException();

    const { url } = await this.storage.upload('exercise-images', `exercises/${exerciseId}`, file);
    return this.prisma.exerciseImage.create({ data: { exerciseId, url } });
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('imageId') imageId: string) {
    const img = await this.prisma.exerciseImage.findUnique({ where: { id: imageId } });
    if (!img) throw new NotFoundException();
    // Derivar key del URL para poder borrarlo del bucket
    const key = new URL(img.url).pathname.split('/object/public/exercise-images/')[1];
    if (key) await this.storage.remove('exercise-images', key);
    await this.prisma.exerciseImage.delete({ where: { id: imageId } });
  }
}
```

#### Avatar

```typescript
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('users/me/avatar')
export class AvatarController {
  constructor(private readonly storage: StorageService, private readonly prisma: PrismaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: ...,
  }))
  async upload(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException();
    const { url } = await this.storage.upload('avatars', `users/${req.user.id}`, file);
    return this.prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
  }
}
```

### 3.5 Configuración

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Configurar buckets en panel Supabase:
- `exercise-images`: público.
- `avatars`: público (o privado con `getSignedUrl` en read).

## 4. Alternativas consideradas

- **Cloudinary**: feature-rich pero costo adicional. Rechazado para MVP.
- **S3**: viable; Supabase Storage es S3-compatible internamente y reduce config.
- **Base64 en BD**: rechazado por costo y rendimiento.

## 5. Migraciones / compatibilidad

- Migración `add_user_avatar_url`.
- API aditiva. `CreateExerciseDto.imageUrls` sigue funcionando para URLs externas.

## 6. Seguridad

- Validación estricta de mimetype y tamaño.
- Renombrado del archivo con UUID (evita path traversal y duplicados).
- Solo admins suben para `exercise-images`.

## 7. Performance

- Subida streaming a Supabase. Para imágenes < 2 MB el tiempo es < 1 s.

## 8. Testing

### Unit
- Validación mime/tamaño.
- Path generado correctamente.

### Integration
- Mock del cliente Supabase para test sin red.

## 9. Plan de rollout

| Día | Acción |
|---|---|
| D0 | Buckets configurados manualmente en Supabase. |
| D1 | Endpoints en staging. Subir avatar de prueba. |
| D2 | Producción. |
| Semana 1 | Migrar imágenes existentes (script) si aplica. |

## 10. Open questions

- ¿Permitir GIF/animated WebP? No para MVP — costo y moderación.
- ¿Generar thumbnails server-side? Postergado; cliente puede usar parámetros de Supabase Image Transformations.
