import { readdir, mkdir, copyFile } from 'node:fs/promises';
const source = new URL('../src/Char-assets/', import.meta.url);
const target = new URL('../public/spatial-assets/', import.meta.url);
await mkdir(target, { recursive: true });
const files = (await readdir(source)).filter(name => name.endsWith('.glb') && !['dinur_character_lineup.glb', 'sample_workspace.glb'].includes(name));
await Promise.all(files.map(name => copyFile(new URL(name, source), new URL(name, target))));
console.log(`Prepared ${files.length} supplied office assets.`);
