// Preload for CLI scripts (seed, owner setup) that import code marked `server-only`.
// The marker package throws outside a React server build; scripts run in plain Node, so neutralise it.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
