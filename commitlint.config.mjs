/** Conventional Commits, plus the AUREN rule: module numbers never appear in subjects. */
const noModuleNumbers = ({ subject }) => [
  !/\bmodule\s*\d+/i.test(subject ?? ''),
  'subject must not reference a module number',
];

const config = {
  // Dependabot writes long bodies and its own subjects.
  ignores: [(message) => /^(chore|ci)\(deps/.test(message)],
  extends: ['@commitlint/config-conventional'],
  plugins: [{ rules: { 'no-module-numbers': noModuleNumbers } }],
  rules: {
    'no-module-numbers': [2, 'always'],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};

export default config;
