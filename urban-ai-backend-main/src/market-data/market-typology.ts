import { BadRequestException } from '@nestjs/common';
import { isCapacityBand, isListingType } from './market-math';
import { MarketTypology } from './market-data.types';

/**
 * Query string do market intel → tipologia. Vazio/"any"/"todos" = sem filtro naquele campo;
 * valor inválido = 400 (não adivinhamos o que o cliente quis).
 */
export function parseMarketTypologyQuery(query: {
  rooms?: string;
  listingType?: string;
  capacity?: string;
}): MarketTypology | null {
  const blank = (value: string | undefined) =>
    value === undefined || value === '' || ['any', 'all', 'todos', 'qualquer'].includes(String(value).toLowerCase());
  const typology: MarketTypology = {};

  if (!blank(query.rooms)) {
    const rooms = Number(query.rooms);
    if (!Number.isInteger(rooms) || rooms < 0 || rooms > 20) {
      throw new BadRequestException('rooms deve ser um inteiro de 0 a 20 (4 = "4 ou mais")');
    }
    typology.rooms = rooms;
  }
  if (!blank(query.listingType)) {
    if (!isListingType(query.listingType)) {
      throw new BadRequestException('listingType inválido (entire_home, private_room, shared_room, hotel_room, other)');
    }
    typology.listingType = query.listingType;
  }
  if (!blank(query.capacity)) {
    if (!isCapacityBand(query.capacity)) {
      throw new BadRequestException('capacity inválida (1-2, 3-4, 5-6, 7+)');
    }
    typology.capacity = query.capacity;
  }
  return Object.keys(typology).length ? typology : null;
}
