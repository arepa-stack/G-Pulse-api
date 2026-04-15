import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'Firebase ID token obtained after Google Sign-In',
    example: 'eyJhbGciOiJSUzI1NiIs...',
  })
  @IsString()
  @MinLength(10)
  idToken: string;
}
