import type { ResolvedTheme } from '@/theme/useTheme';

export interface OfficePalette {
  statusIdle: number;
  statusWorking: number;
  statusDone: number;
  statusCheckpoint: number;
  nameCardBg: number;
  nameCardBorder: number;
  nameCardText: number;
  nameCardStroke: number;
  background: number;
  floor: number;
  floorAlt: number;
  floorHighlight: number;
  wall: number;
  wallBand: number;
  wallTrim: number;
  wallHighlight: number;
  roomBorder: number;
}

export const OFFICE_PALETTES: Record<ResolvedTheme, OfficePalette> = {
  dark: {
    statusIdle: 0xbbbbdd,
    statusWorking: 0x60b0ff,
    statusDone: 0x70ff90,
    statusCheckpoint: 0xffcc33,
    nameCardBg: 0x14141c,
    nameCardBorder: 0x6a5a80,
    nameCardText: 0xffffff,
    nameCardStroke: 0x000000,
    background: 0x1a1420,
    floor: 0xc8ac86,
    floorAlt: 0xbca07a,
    floorHighlight: 0xddc89e,
    wall: 0xe6dace,
    wallBand: 0xede2d6,
    wallTrim: 0xa89888,
    wallHighlight: 0xc8b8a8,
    roomBorder: 0x2a2030,
  },
  light: {
    statusIdle: 0x718096,
    statusWorking: 0x008ac5,
    statusDone: 0x1f9d55,
    statusCheckpoint: 0xc27803,
    nameCardBg: 0xffffff,
    nameCardBorder: 0x9fb0c7,
    nameCardText: 0x172033,
    nameCardStroke: 0xffffff,
    background: 0xf5f7fb,
    floor: 0xd9c29d,
    floorAlt: 0xc9ad82,
    floorHighlight: 0xf0dfbd,
    wall: 0xf4efe8,
    wallBand: 0xfffbf5,
    wallTrim: 0xb8aa99,
    wallHighlight: 0xd8caba,
    roomBorder: 0xb8c2d0,
  },
};

export const COLORS = OFFICE_PALETTES.dark;

export const TILE = 32;
export const CELL_W = 3 * TILE;
export const CELL_H = 3 * TILE;
export const MARGIN = 3 * TILE;
export const WALL_H = 3 * TILE;

export function getOfficePalette(theme: ResolvedTheme): OfficePalette {
  return OFFICE_PALETTES[theme];
}

export function toHexColor(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
