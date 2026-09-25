// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['.claude/**', 'lib/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Gate: referencing anything marked @deprecated in typings is an
      // error (e.g. coc.nvim's `registLanguageClient`, `showMessage`).
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
)
