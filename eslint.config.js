import { config, configs } from 'typescript-eslint';
import vitest from 'eslint-plugin-vitest';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import importPlugin from 'eslint-plugin-import';

export default config(
  {
    extends: [...configs.strictTypeChecked, ...configs.stylisticTypeChecked],
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.test.ts'],
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/no-deprecated': 'off',
    },
  },
  importPlugin.flatConfigs.recommended,
  {
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          project: ['tsconfig.json', 'packages/*/tsconfig.json'],
        },
        node: {
          project: ['tsconfig.json', 'packages/*/tsconfig.json'],
        },
      },
    },
    rules: {
      'import/no-extraneous-dependencies': ['error'],
      'import/no-cycle': ['error'],
    },
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  eslintPluginPrettierRecommended,
  { ignores: ['**/dist/', 'coverage/'] },
);
