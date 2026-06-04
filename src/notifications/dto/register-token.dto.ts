import { IsIn, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTokenDto {
  @ApiProperty({
    description: 'FCM device token from the mobile client SDK',
    minLength: 20,
    example: 'dK3xYz...long-fcm-token...',
  })
  @IsString()
  @MinLength(20)
  token: string;

  @ApiProperty({
    description: 'Client platform',
    enum: ['ios', 'android', 'web'],
    example: 'android',
  })
  @IsIn(['ios', 'android', 'web'])
  platform: 'ios' | 'android' | 'web';
}
