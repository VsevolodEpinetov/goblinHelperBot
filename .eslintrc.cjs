/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  settings: {
    'import/resolver': {
      typescript: { project: './tsconfig.json' },
      node: true,
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': 'error',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      },
    ],
    // Feature boundary enforcement: features may not import siblings' internals
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@features/*/repo', '@features/*/repo.*', '@features/*/service', '@features/*/service.*'],
            message:
              "Features must not import sibling features' internal repo/service modules. Import the feature's public surface via @features/<name> instead.",
          },
        ],
      },
    ],
    // Only repo.ts files may import knex directly
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'ImportDeclaration[source.value=/knex|@db\\/client/]:not([source.value=/repo\\.ts$/])',
        message: "Direct knex imports are only allowed in repo.ts files. Use the feature's repo layer.",
      },
    ],
  },
  overrides: [
    {
      // repo.ts files are allowed to import knex/db
      files: ['src/features/**/repo.ts', 'src/db/**', 'scripts/**'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
    {
      // Tests can import freely
      files: ['**/*.test.ts', '**/*.spec.ts', 'tests/**'],
      rules: {
        'no-restricted-imports': 'off',
        'no-restricted-syntax': 'off',
      },
    },
    {
      // Legacy JS files are not linted by this config; keep them out of scope
      files: ['modules/**', 'index.js', 'indexf.js', 'INTEGRATION_EXAMPLES.js', 'scripts/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    {
      // Meta config files (not part of tsconfig project) — disable typed linting
      files: ['.eslintrc.cjs', 'knexfile.js', '*.config.js', '*.config.cjs'],
      parserOptions: {
        project: null,
      },
      env: {
        node: true,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
};
