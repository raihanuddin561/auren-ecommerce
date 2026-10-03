// Preload for CLI scripts (seed, owner setup) and Playwright that import code marked `server-only`.
// The marker package throws outside a React server build; scripts run in plain Node, so neutralise it.
// Plain Node ESM also needs the file extension for `next/<subpath>` imports (next/headers), which
// the bundler adds for us; resolve those to their .js entry.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    }
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (/^next\/[a-z-]+$/.test(specifier) && error?.code === 'ERR_MODULE_NOT_FOUND') {
        return nextResolve(`${specifier}.js`, context);
      }
      throw error;
    }
  },
});
