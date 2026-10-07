import { readdir, mkdir, copyFile } from 'node:fs/promises';
const source = new URL('../src/Char-assets/', import.meta.url);
const target = new URL('../public/spatial-assets/', import.meta.url);
await mkdir(target, { recursive: true });
const files = (await readdir(source)).filter(name => name.endsWith('.glb') && !['dinur_character_lineup.glb', 'sample_workspace.glb'].includes(name));
const characterSource = new URL('v2-char/', source);
const characterTarget = new URL('v2-char/', target);
await mkdir(characterTarget, { recursive: true });
const characters = (await readdir(characterSource)).filter(name => name.endsWith('.glb'));
await Promise.all([
  ...files.map(name => copyFile(new URL(name, source), new URL(name, target))),
  ...characters.map(name => copyFile(new URL(name, characterSource), new URL(name, characterTarget))),
]);
console.log(`Prepared ${files.length} office assets and ${characters.length} animated characters.`);
