import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import { Structure, StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { addDefaultRepresentations } from './representations';
import type { ChainSummary, StructureFormat, StructureMetadata, Palette, RepresentationMode, VisualPreset } from './types';

export function detectFormat(fileName: string): StructureFormat {
  const extension = fileName.match(/\.([^.]+)$/)?.[1].toLowerCase();
  if (extension === 'pdb') return 'pdb';
  if (extension === 'cif' || extension === 'mmcif') return 'mmcif';
  throw new Error('Choose a .pdb, .cif, or .mmcif file.');
}

export function extractMetadata(structure: Structure, fileName: string, format: StructureFormat): StructureMetadata {
  const chains = new Map<string, ChainSummary>();
  const residues = new Set<string>();
  const location = StructureElement.Location.create(structure);
  for (const unit of structure.units) {
    if (!Unit.isAtomic(unit)) continue;
    location.unit = unit;
    for (let i = 0; i < unit.elements.length; i++) {
      const element = unit.elements[i];
      location.element = element;
      const chainId = StructureProperties.chain.label_asym_id(location);
      const authChainId = StructureProperties.chain.auth_asym_id(location);
      const chainKey = `${unit.model.modelNum}:${chainId}`;
      const residueKey = `${chainKey}:${unit.residueIndex[element]}`;
      if (residues.has(residueKey)) continue;
      residues.add(residueKey);
      const chain = chains.get(chainKey) ?? { chainId, authChainId, residueCount: 0 };
      chain.residueCount++;
      chains.set(chainKey, chain);
    }
  }
  return { fileName, format, chains: [...chains.values()], residueCount: residues.size, atomCount: structure.elementCount };
}

/** Stage a new data subtree; caller deletes the old tree only after this succeeds. */
export async function loadStructure(plugin: PluginContext, text: string, fileName: string, format: StructureFormat, palette: Palette = 'vivid', mode: RepresentationMode = 'cartoon', colorOffset = 0, preset: VisualPreset = 'discussion') {
  if (!text.trim()) throw new Error('This file is empty. Choose a PDB or mmCIF structure.');
  const data = await plugin.builders.data.rawData({ data: text, label: fileName });
  try {
    const trajectory = await plugin.builders.structure.parseTrajectory(data, format);
    if (!trajectory.obj?.data.frameCount) throw new Error('No molecular models found.');
    const model = await plugin.builders.structure.createModel(trajectory, { modelIndex: 0 });
    const original = await plugin.builders.structure.createStructure(model, { name: 'model', params: {} });
    const structure = await plugin.build().to(original).apply(StateTransforms.Model.TransformStructureConformation, { transform: { name: 'matrix', params: { data: Mat4.identity(), transpose: false } } }).commit();
    if (!structure.obj?.data.elementCount) throw new Error('No atoms found.');
    const metadata = extractMetadata(structure.obj.data, fileName, format);
    const parts = await addDefaultRepresentations(plugin, structure, metadata, palette, mode, colorOffset, preset);
    return { dataRef: data.ref, metadata, structure, parts, sourceText: text, colorOffset };
  } catch (error) {
    await plugin.build().delete(data.ref).commit();
    throw new Error('Could not read this structure. Check that it contains valid PDB or mmCIF atom coordinates.', { cause: error });
  }
}
