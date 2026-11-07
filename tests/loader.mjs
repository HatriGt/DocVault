// Node test loader: maps Expo native modules to Node equivalents and resolves extensionless TS imports.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STUBS = { 'expo-crypto': new URL('./stubs/expo-crypto.mjs', import.meta.url).href };

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  if (specifier.startsWith('.') && context.parentURL && !/\.[mc]?[jt]s$/.test(specifier)) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    if (existsSync(`${base}.ts`)) return { url: pathToFileURL(`${base}.ts`).href, shortCircuit: true };
  }
  return next(specifier, context);
}
