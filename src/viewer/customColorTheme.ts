import { Bond, Structure, StructureElement, StructureProperties as P, Unit } from 'molstar/lib/mol-model/structure';
import type { ThemeDataContext } from 'molstar/lib/mol-theme/theme';
import type { ColorTheme } from 'molstar/lib/mol-theme/color';
import type { Location } from 'molstar/lib/mol-model/location';
import { Color } from 'molstar/lib/mol-util/color';
import { ColorThemeCategory } from 'molstar/lib/mol-theme/color/categories';

export interface ScalarRecord { chain: string; residue: number; atom?: string; value: number; }
interface ScalarConfig { values: Map<string, number>; min: number; max: number; }
const configs = new WeakMap<Structure, ScalarConfig>();

const key = (chain: string, residue: number, atom = '*') => `${chain}\t${residue}\t${atom}`;

export function parseScalarMapping(text: string): ScalarRecord[] {
  const records: ScalarRecord[] = [];
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    const fields = line.split(/[\s,]+/);
    if (fields.length !== 3 && fields.length !== 4) throw new Error(`Custom scalar line ${index + 1}: use chain,residue[,atom],value.`);
    const residue = Number(fields[1]), value = Number(fields.at(-1));
    if (!fields[0] || !Number.isInteger(residue) || !Number.isFinite(value)) throw new Error(`Custom scalar line ${index + 1} contains an invalid chain, residue, or value.`);
    records.push({ chain: fields[0], residue, ...(fields.length === 4 ? { atom: fields[2] } : {}), value });
  }
  if (!records.length) throw new Error('Enter at least one custom scalar value.');
  return records;
}

export function setScalarMapping(structure: Structure, records: ScalarRecord[]) {
  const values = new Map(records.map(record => [key(record.chain, record.residue, record.atom), record.value]));
  const numbers = records.map(record => record.value);
  configs.set(structure.root, { values, min: Math.min(...numbers), max: Math.max(...numbers) });
}

function ramp(value: number, min: number, max: number) {
  const t = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const stops = [[0x2c,0x7b,0xb6], [0xff,0xff,0xbf], [0xd7,0x19,0x1c]];
  const side = t < 0.5 ? 0 : 1, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const a = stops[side], b = stops[side + 1];
  return Color((Math.round(a[0] + (b[0] - a[0]) * u) << 16) | (Math.round(a[1] + (b[1] - a[1]) * u) << 8) | Math.round(a[2] + (b[2] - a[2]) * u));
}

function locationValue(location: StructureElement.Location) {
  if (!Unit.isAtomic(location.unit)) return;
  const config = configs.get(location.structure.root); if (!config) return;
  const chain = P.chain.auth_asym_id(location) || P.chain.label_asym_id(location);
  const residue = P.residue.auth_seq_id(location) || P.residue.label_seq_id(location);
  const atom = P.atom.label_atom_id(location);
  return { config, value: config.values.get(key(chain, residue, atom)) ?? config.values.get(key(chain, residue)) };
}

type EmptyParams = Record<string, never>;
export function BiomolCustomScalarColorTheme(ctx: ThemeDataContext): ColorTheme<EmptyParams> {
  const scratch = ctx.structure ? StructureElement.Location.create(ctx.structure) : undefined;
  const color = (location: Location) => {
    let item;
    if (StructureElement.Location.is(location)) item = locationValue(location);
    else if (Bond.isLocation(location) && scratch) { scratch.unit = location.aUnit; scratch.element = location.aUnit.elements[location.aIndex]; item = locationValue(scratch); }
    return item?.value === undefined ? Color(0x8b98a3) : ramp(item.value, item.config.min, item.config.max);
  };
  return { factory: BiomolCustomScalarColorTheme, granularity: 'group', color, props: {}, description: 'User-provided residue or atom scalar values.' };
}

export const BiomolCustomScalarColorThemeProvider: ColorTheme.Provider<EmptyParams, 'biomol-custom-scalar'> = {
  name: 'biomol-custom-scalar', label: 'Biomol custom scalar', category: ColorThemeCategory.Misc,
  factory: BiomolCustomScalarColorTheme, getParams: () => ({}), defaultValues: {}, isApplicable: ctx => !!ctx.structure,
};
