import type { Palette } from './types';

export const paletteOptions: { id: Palette; label: string; colors: number[] }[] = [
  { id: 'vivid', label: 'Vivid', colors: [0x3bc9aa, 0xffaa58, 0x72a7ff, 0xed72b6, 0xc8da59, 0xb18df2, 0x55d3df, 0xf07878] },
  { id: 'pastel', label: 'Pastel', colors: [0x9ed9c5, 0xf5c49e, 0xafc9f5, 0xe8b3cf, 0xd8dda5, 0xcabce9, 0xa8dade, 0xeab6af] },
  { id: 'accessible', label: 'Colorblind-friendly', colors: [0x56b4e9, 0xe69f00, 0x009e73, 0xcc79a7, 0xf0e442, 0x0072b2, 0xd55e00, 0xffffff] },
  { id: 'ocean', label: 'Ocean', colors: [0x00b8d9, 0x4178d4, 0x19c2a0, 0x7b8cff, 0x42d4e8, 0x2962a7, 0x75d69c, 0x9b7fe8] },
  { id: 'sunset', label: 'Sunset', colors: [0xff6b6b, 0xffa94d, 0xf06595, 0xffd43b, 0xcc5de8, 0xe8590c, 0xff8787, 0xf783ac] },
  { id: 'forest', label: 'Forest', colors: [0x40c057, 0x94d82d, 0x20c997, 0xa9844f, 0x66a80f, 0x2f9e44, 0x8fbc8f, 0xd4b483] },
  { id: 'berry', label: 'Berry', colors: [0xd6336c, 0x845ef7, 0xe64980, 0x5f3dc4, 0xf06595, 0x9775fa, 0xc2255c, 0xb197fc] },
];

const paletteMap = Object.fromEntries(paletteOptions.map(option => [option.id, option.colors])) as Record<Palette, number[]>;

function hslToRgb(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return (Math.round(channel(0) * 255) << 16) | (Math.round(channel(8) * 255) << 8) | Math.round(channel(4) * 255);
}

/** Stable palette prefixes let a session assign every protein chain a unique color index. */
export function chainColors(palette: Palette, count: number) {
  const colors = paletteMap[palette].slice(0, count);
  const used = new Set(colors);
  const softness = palette === 'pastel';
  for (let index = colors.length; index < count; index++) {
    let attempt = 0;
    let color: number;
    do {
      const hue = (index * 137.507764 + attempt * 17 + (paletteOptions.findIndex(p => p.id === palette) * 23)) % 360;
      color = hslToRgb(hue, softness ? 0.52 : 0.68, softness ? 0.76 : 0.57);
      attempt++;
    } while (used.has(color));
    colors.push(color);
    used.add(color);
  }
  return colors;
}

export function colorHex(color: number) { return `#${color.toString(16).padStart(6, '0')}`; }
