import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
        process: 'readonly'
      }
    }
  }
];
