import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import type { StateObjectSelector } from 'molstar/lib/mol-state';
import type { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StructureSelectionQueries as Q } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { Color } from 'molstar/lib/mol-util/color';
import { distinctColors } from 'molstar/lib/mol-util/color/distinct';
import type { Palette, RepresentationMode, ScenePart, StructureMetadata } from './types';
export type StructureNode = StateObjectSelector<PluginStateObject.Molecule.Structure>;
export interface RenderPart { node: StructureNode; state: ScenePart; protein: boolean; color: number; }
const palettes: Record<Palette, number[]> = {
  vivid: [0x3bc9aa, 0xffaa58, 0x72a7ff, 0xed72b6, 0xc8da59, 0xb18df2, 0x55d3df, 0xf07878],
  pastel: [0x9ed9c5, 0xf5c49e, 0xafc9f5, 0xe8b3cf, 0xd8dda5, 0xcabce9, 0xa8dade, 0xeab6af],
  accessible: [0x56b4e9, 0xe69f00, 0x009e73, 0xcc79a7, 0xf0e442, 0x0072b2, 0xd55e00, 0xffffff],
};
export function chainColors(palette: Palette, count: number) {
  return count <= palettes[palette].length ? palettes[palette].slice(0, count) : distinctColors(count, palette === 'pastel' ? { luminance: [65, 90], chroma: [15, 40] } : palette === 'accessible' ? { hue: [20, 300], luminance: [45, 85] } : {});
}
export async function renderPart(plugin: PluginContext, part: RenderPart, mode: RepresentationMode) {
  const reps = plugin.builders.structure.representation;
  if (part.protein) {
    const carbonColor = { carbonColor: { name: 'uniform' as const, params: { value: Color(part.color) } } };
    if (mode === 'cartoon' || mode === 'cartoon-sticks') {
      await reps.addRepresentation(part.node, { type: 'cartoon', color: 'uniform', colorParams: { value: Color(part.color) } });
    }
    if (mode === 'cartoon-sticks' || mode === 'atoms') {
      await reps.addRepresentation(part.node, { type: 'ball-and-stick', color: 'element-symbol', colorParams: carbonColor, typeParams: { sizeFactor: 0.18 } });
    }
    if (mode === 'backbone') {
      await reps.addRepresentation(part.node, { type: 'backbone', color: 'uniform', colorParams: { value: Color(part.color) } });
    }
    if (mode === 'lines') {
      await reps.addRepresentation(part.node, { type: 'line', color: 'element-symbol', colorParams: carbonColor, typeParams: { sizeFactor: 1 } });
    }
    if (mode === 'spacefill') {
      await reps.addRepresentation(part.node, { type: 'spacefill', color: 'element-symbol', colorParams: carbonColor, typeParams: { sizeFactor: 0.85 } });
    }
    if (mode === 'surface') {
      await reps.addRepresentation(part.node, { type: 'molecular-surface', color: 'uniform', colorParams: { value: Color(part.color) }, typeParams: { alpha: 0.72 } });
    }
  } else {
    const ion = part.state.label === 'Ions';
    const glycan = part.state.label === 'Glycans';
    await reps.addRepresentation(part.node, { type: ion ? 'spacefill' : glycan ? 'carbohydrate' : 'ball-and-stick', color: glycan ? 'carbohydrate-symbol' : 'element-symbol', colorParams: glycan ? {} : { carbonColor: { name: 'uniform', params: { value: Color(part.color) } } } });
  }
}
export async function addDefaultRepresentations(plugin: PluginContext, structure: StructureNode, metadata: StructureMetadata, palette: Palette = 'vivid', mode: RepresentationMode = 'cartoon', colorOffset = 0) {
  const parts: RenderPart[] = [];

  for (let i = 0; i < metadata.chains.length; i++) {
    const chain = metadata.chains[i];
    const expression = MS.struct.modifier.intersectBy({ 0: Q.protein.expression, by: MS.struct.generator.atomGroups({ 'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_asym_id(), chain.chainId]) }) });
    const node = await plugin.builders.structure.tryCreateComponentFromExpression(structure, expression, `protein-${chain.chainId}`);
    if (!node) continue;
    const color = palettes[palette][0];
    parts.push({ node, protein: true, color, state: { id: `protein-${chain.chainId}`, label: `Protein · Chain ${chain.authChainId || chain.chainId}${chain.authChainId !== chain.chainId ? ` (${chain.chainId})` : ''}`, visible: true, color: '#' + color.toString(16).padStart(6, '0') } });
  }
  const colors = chainColors(palette, Math.max(8, parts.length));
  parts.forEach((part, index) => { part.color = colors[(index + colorOffset) % colors.length]; part.state.color = '#' + part.color.toString(16).padStart(6, '0'); });
  const categories = [ ['nucleic', 'DNA / RNA', 0xba90f5], ['ligand', 'Ligands', 0xffcf70], ['branched', 'Glycans', 0xee90bf], ['ion', 'Ions', 0xaaccff], ['lipid', 'Lipids', 0xe6a259], ['water', 'Water', 0xb1cde6] ] as const;
  for (const [query, label, color] of categories) {
    const node = await plugin.builders.structure.tryCreateComponentFromExpression(structure, query === 'ligand' ? MS.struct.modifier.exceptBy({ 0: Q.ligand.expression, by: Q.lipid.expression }) : Q[query].expression, query);
    if (node) parts.push({ node, protein: false, color, state: { id: query, label, visible: query !== 'water' } });
  }
  for (const part of parts) await renderPart(plugin, part, mode);
  return parts;
}
