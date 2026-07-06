import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateRoutineDto {
  @ApiProperty({
    example:
      'rutina de pecho enfoque parte superior con 3 ejercicios nivel avanzado, me duele el hombro derecho',
    description: 'Petición en lenguaje natural',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}
