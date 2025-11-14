import css from '@eslint/css';
import eslint from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import { plugin as tseslintPlugin, configs as tseslintConfigs } from 'typescript-eslint';

export default defineConfig([
  {
    ignores: ['node_modules', '**/node_modules/**', '**/*.js', '**/*.d.ts', 'bin', '**/bin/**', 'rust-packages'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: ['tsconfig.json'],
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
      'unused-imports': unusedImports,
    },
    extends: [
      eslint.configs.recommended,
      tseslintConfigs.recommended,
      tseslintConfigs.recommendedTypeChecked,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
    ],
    settings: {
      'import/resolver': {
        typescript: {
          bun: true,
        },
      },
    },
    rules: {
      'no-empty': [
        'error',
        {
          allowEmptyCatch: true,
        },
      ],
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'signature',

            'public-static-field',
            'protected-static-field',
            'private-static-field',

            'public-abstract-field',
            'public-decorated-field',
            'public-instance-field',

            'protected-abstract-field',
            'protected-decorated-field',
            'protected-instance-field',

            'private-decorated-field',
            'private-instance-field',

            'public-constructor',
            'protected-constructor',
            'private-constructor',

            'public-static-method',
            'protected-static-method',
            'private-static-method',

            'public-abstract-method',
            'public-decorated-method',
            'public-instance-method',

            'protected-abstract-method',
            'protected-decorated-method',
            'protected-instance-method',

            'private-decorated-method',
            'private-instance-method',
          ],
        },
      ],
      curly: 'error',
      'block-spacing': 'error',
      'space-before-blocks': 'error',
      'brace-style': 'error',
      'no-else-return': 'error',
      'no-unneeded-ternary': 'error',
      'default-case': 'error',
      'default-case-last': 'error',
      'default-param-last': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-loop-func': 'error',
      'for-direction': 'error',
      'keyword-spacing': ['error', { before: true, after: true }],
      'semi-spacing': ['error', { before: false, after: true }],
      'space-in-parens': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-spacing': ['error', { before: false, after: true }],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'always',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json',
    extends: ['json/recommended'],
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    extends: ['markdown/recommended'],
  },
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    extends: ['css/recommended'],
  },
]);
