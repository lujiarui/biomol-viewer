export function rcsbId(input: string) {
  const id = input.trim().toUpperCase();
  if (!/^[1-9][A-Z0-9]{3}$/.test(id) && !/^PDB_[A-Z0-9]{8}$/.test(id)) throw new Error('Enter a PDB ID such as 4HHB or pdb_00004hhb.');
  return id.startsWith('PDB_') ? `pdb_${id.slice(4)}` : id;
}
export async function fetchStructure(url: string, name: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not open ${name} (${response.status}). Check the ID or refresh the Mac library.`);
  return new File([await response.text()], name);
}
