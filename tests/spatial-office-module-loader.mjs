import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import * as model from '../lib/spatial-office/model.ts';
export function loadTS(path, deps = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, URL, structuredClone, require: name => {
    if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`);
    return deps[name];
  }, ...globals };
  vm.runInNewContext(source, context); return context.exports;
}
export const spaceModel = loadTS('../lib/spatial-office/space.ts', { './model': model });
