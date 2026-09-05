import type { PluginContext } from 'molstar/lib/mol-plugin/context';
import type { StateObjectSelector } from 'molstar/lib/mol-state';
import type { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';

export async function addDefaultRepresentations(plugin: PluginContext, structure: StateObjectSelector<PluginStateObject.Molecule.Structure>) {
  const builder = plugin.builders.structure;
  const polymer = await builder.tryCreateComponentStatic(structure, 'polymer');
  if (polymer) await builder.representation.addRepresentation(polymer, { type: 'cartoon', color: 'chain-id' });
  const ligand = await builder.tryCreateComponentStatic(structure, 'ligand');
  if (ligand) await builder.representation.addRepresentation(ligand, { type: 'ball-and-stick', color: 'element-symbol' });
  const ion = await builder.tryCreateComponentStatic(structure, 'ion');
  if (ion) await builder.representation.addRepresentation(ion, { type: 'spacefill', color: 'element-symbol' });
}
