// property-coordinates.dto.ts

import {
  ApiProperty
} from '@nestjs/swagger';

export class PropertyCoordinatesDto {
  @ApiProperty({
    description: 'A latitude da propriedade.',
    example: -23.5618831
  })
  latitude: number;

  @ApiProperty({
    description: 'A longitude da propriedade.',
    example: -46.6351441
  })
  longitude: number;
}