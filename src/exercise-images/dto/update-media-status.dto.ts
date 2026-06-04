import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateMediaStatusDto {
  @ApiProperty({ description: 'Whether the media is paused/disabled by admin' })
  @IsBoolean()
  isPaused: boolean;
}
