import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import type { StateObjectSelector } from 'molstar/lib/mol-state';
import type { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StructureSelectionQueries as Q } from 'molstar/lib/mol-plugin-state/helpers/structure-selection-query';
import { Color } from 'molstar/lib/mol-util/color';
import type { Palette, RepresentationMode, ScenePart, StructureMetadata, VisualPreset } from './types';
import { chainColors, colorHex } from './palettes';
import { cartoonParams } from './visualPresets';
export type StructureNode = StateObjectSelector<PluginStateObject.Molecule.Structure>;
export interface RenderPart { node: StructureNode; state: ScenePart; protein: boolean; color: number; }
export { chainColors } from './palettes';
export async function renderPart(plugin: PluginContext, part: RenderPart, mode: RepresentationMode, preset: VisualPreset = 'discussion') {
  const reps = plugin.builders.structure.representation;
  if (part.protein) {
    const carbonColor = { carbonColor: { name: 'uniform' as const, params: { value: Color(part.color) } } };
    if (mode === 'cartoon' || mode === 'cartoon-sticks') {
      await reps.addRepresentation(part.node, { type: 'cartoon', color: 'uniform', colorParams: { value: Color(part.color) }, typeParams: cartoonParams(preset) });
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
export async function addDefaultRepresentations(plugin: PluginContext, structure: StructureNode, metadata: StructureMetadata, palette: Palette = 'vivid', mode: RepresentationMode = 'cartoon', colorOffset = 0, preset: VisualPreset = 'discussion') {
  const parts: RenderPart[] = [];

  for (let i = 0; i < metadata.chains.length; i++) {
    const chain = metadata.chains[i];
    const expression = MS.struct.modifier.intersectBy({ 0: Q.protein.expression, by: MS.struct.generator.atomGroups({ 'chain-test': MS.core.rel.eq([MS.struct.atomProperty.macromolecular.label_asym_id(), chain.chainId]) }) });
    const node = await plugin.builders.structure.tryCreateComponentFromExpression(structure, expression, `protein-${chain.chainId}`);
    if (!node) continue;
    const color = chainColors(palette, 1)[0];
    parts.push({ node, protein: true, color, state: { id: `protein-${chain.chainId}`, label: `Protein · Chain ${chain.authChainId || chain.chainId}${chain.authChainId !== chain.chainId ? ` (${chain.chainId})` : ''}`, visible: true, color: colorHex(color) } });
  }
  const colors = chainColors(palette, colorOffset + parts.length);
  parts.forEach((part, index) => { part.color = colors[colorOffset + index]; part.state.color = colorHex(part.color); });
  const categories = [ ['nucleic', 'DNA / RNA', 0xba90f5], ['ligand', 'Ligands', 0xffcf70], ['branched', 'Glycans', 0xee90bf], ['ion', 'Ions', 0xaaccff], ['lipid', 'Lipids', 0xe6a259], ['water', 'Water', 0xb1cde6] ] as const;
  for (const [query, label, color] of categories) {
    const node = await plugin.builders.structure.tryCreateComponentFromExpression(structure, query === 'ligand' ? MS.struct.modifier.exceptBy({ 0: Q.ligand.expression, by: Q.lipid.expression }) : Q[query].expression, query);
    if (node) parts.push({ node, protein: false, color, state: { id: query, label, visible: query !== 'water' } });
  }
  for (const part of parts) await renderPart(plugin, part, mode, preset);
  return parts;
}
