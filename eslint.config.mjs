// @ts-check
import ts from 'typescript-eslint';
import js from'@eslint/js';
import prettier from 'eslint-config-prettier';
import cypress from 'eslint-plugin-cypress/flat';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    ignores: ['lib/**'],
  },
  {
    files: ['**/*.*js', '**/*.*ts'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-undef': 'warn',
    },
  },
  {
    files: ['tests/**/*.*js', 'tests/**/*.*ts'],
    ...cypress.configs.recommended,
  },
  {
    languageOptions: {
      globals: {
        __dirname: true,
        console: true,
        exports: true,
        module: true,
        require: true,
        process: true,
        NodeJS: true,
        CypressCommandLine: true,
      },
    },
  },
);
