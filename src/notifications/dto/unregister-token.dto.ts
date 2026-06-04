import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UnregisterTokenDto {
  @ApiProperty({
    description: 'FCM device token to remove on logout',
    minLength: 20,
  })
  @IsString()
  @MinLength(20)
  token: string;
}
