import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private supabase: SupabaseClient;
  private bucket: string;

  constructor(configService: ConfigService) {
    const url = configService.get<string>('SUPABASE_URL');
    const key = configService.get<string>('SUPABASE_KEY');
    this.bucket = configService.get<string>('SUPABASE_BUCKET', 'exercise-media');

    if (!url || !key) {
      throw new Error(
        'SUPABASE_URL or SUPABASE_KEY is missing from environment variables',
      );
    }

    this.supabase = createClient(url, key);
  }

  async uploadFile(file: Express.Multer.File, path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload file to Supabase: ${error.message}`,
      );
    }

    // Get public URL
    const { data: publicUrlData } = this.supabase.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([path]);

    if (error) {
      throw new InternalServerErrorException(
        `Failed to delete file from Supabase: ${error.message}`,
      );
    }
  }

  async deleteFileByUrl(url: string): Promise<void> {
    const searchString = `/storage/v1/object/public/${this.bucket}/`;
    const index = url.indexOf(searchString);
    if (index === -1) {
      // If it's not a Supabase URL of this bucket, skip deletion
      return;
    }
    const path = url.substring(index + searchString.length);
    await this.deleteFile(path);
  }
}
