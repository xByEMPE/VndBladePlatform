module.exports = {
  root: true,
  extends: ['react-app'],
  settings: { react: { version: '18.2' } },
  env: { browser: true, es2022: true, node: true },
  overrides: [
    {
      files: ['**/*.test.{js,jsx}', 'src/test/**'],
      env: { jest: true },
      globals: { vi: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly' },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', 'venv', 'public'],
};
