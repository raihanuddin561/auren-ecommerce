/**
 * Module layering from ARCHITECTURE section 3.1, shared by eslint.config.mjs and the
 * fixture-based test in tests/lint. Order matters: the first matching element wins, so specific
 * files come before broad folders.
 */

// NOTE: 'mode: full' is deprecated in eslint-plugin-boundaries 7 but 'partialMatch: false'
// does not classify single files in 7.2, so keep 'mode' until upstream fixes it.
const moduleFile = (type, file) => ({
  type,
  pattern: `src/modules/*/${file}`,
  mode: 'full',
  capture: ['module'],
});

export const boundaryElements = [
  {
    type: 'entry',
    pattern: 'src/{proxy,instrumentation,instrumentation-client}.{ts,tsx}',
    mode: 'full',
  },
  { type: 'app', pattern: 'src/app/**', mode: 'full' },
  // A module may split its actions, services and repositories over several files; each file is
  // named here so it is held to the rules of its layer (the first match wins).
  moduleFile('mod-actions', '{actions,list-actions,fulfilment-actions}.{ts,tsx}'),
  moduleFile('mod-queries', 'queries.{ts,tsx}'),
  moduleFile(
    'mod-service',
    '{service,verification,edit,placement,transitions,return-transitions,fulfilment,escalation,customer-extras,documents-data,workspace,detail,list,collection,refunds,dispatch,manual,shipments}.{ts,tsx}',
  ),
  moduleFile('mod-repository', '{repository,shipments-repository}.{ts,tsx}'),
  // schemas, types, events, errors, constants: pure shared module files
  moduleFile('mod-shared', '*.{ts,tsx}'),
  // anything nested deeper inside a module is private to that module
  moduleFile('mod-internal', '**/*.{ts,tsx}'),
  { type: 'integration', pattern: 'src/integrations/**', mode: 'full' },
  { type: 'component', pattern: 'src/components/**', mode: 'full' },
  { type: 'email', pattern: 'src/emails/**', mode: 'full' },
  { type: 'generated', pattern: 'src/generated/**', mode: 'full' },
  { type: 'lib-db', pattern: 'src/lib/db.{ts,tsx}', mode: 'full' },
  { type: 'lib', pattern: 'src/lib/**', mode: 'full' },
];

const el = (type) => ({ element: { type } });
const sameModule = (type) => ({
  element: { type, captured: { module: '{{ from.captured.module }}' } },
});

export const boundaryPolicies = [
  {
    from: el('app'),
    allow: {
      to: el(['app', 'mod-actions', 'mod-queries', 'mod-shared', 'component', 'email', 'lib']),
    },
  },
  { from: el('entry'), allow: { to: el(['lib', 'mod-queries', 'mod-shared']) } },
  {
    from: el('mod-actions'),
    allow: {
      to: [el(['mod-shared', 'lib']), sameModule('mod-service'), sameModule('mod-internal')],
    },
  },
  {
    from: el('mod-queries'),
    allow: {
      to: [
        el(['mod-shared', 'lib', 'lib-db', 'generated']),
        sameModule('mod-service'),
        sameModule('mod-repository'),
        sameModule('mod-internal'),
      ],
    },
  },
  {
    from: el('mod-service'),
    allow: {
      to: [
        el(['mod-shared', 'lib', 'lib-db', 'generated', 'integration', 'email']),
        sameModule('mod-repository'),
        sameModule('mod-internal'),
        // other modules: their public service functions only, never their repository
        el('mod-service'),
      ],
    },
  },
  {
    from: el('mod-repository'),
    allow: { to: [el(['mod-shared', 'lib', 'lib-db', 'generated']), sameModule('mod-internal')] },
  },
  {
    from: el('mod-shared'),
    allow: { to: [el(['mod-shared', 'lib', 'generated']), sameModule('mod-internal')] },
  },
  {
    from: el('mod-internal'),
    allow: { to: [el(['mod-shared', 'lib']), sameModule('mod-internal')] },
  },
  {
    from: el('integration'),
    allow: { to: el(['integration', 'lib', 'mod-shared', 'generated']) },
  },
  { from: el('component'), allow: { to: el(['component', 'lib', 'mod-shared', 'mod-actions']) } },
  { from: el('email'), allow: { to: el(['email', 'lib', 'mod-shared']) } },
  { from: el('lib-db'), allow: { to: el(['lib', 'generated']) } },
  // lib is shared infrastructure (auth, outbox, permissions) and may use the database client.
  { from: el('lib'), allow: { to: el(['lib', 'lib-db', 'mod-shared', 'generated', 'email']) } },
];
