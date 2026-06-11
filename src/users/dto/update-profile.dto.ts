import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionPlan, UserLevel } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'john_fitness',
    description: 'Unique public handle (3-30 chars, alphanumeric and underscore)',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username must contain only letters, numbers and underscores',
  })
  username?: string;

  @ApiPropertyOptional({
    example: 'Entrenador de fuerza. Comparto mi forma de hacer cada ejercicio.',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @ApiPropertyOptional({ enum: UserLevel })
  @IsOptional()
  @IsEnum(UserLevel)
  level?: UserLevel;

  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({
    description: 'Enable or disable push notifications',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}
