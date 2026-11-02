// ESLint flat config (ESLint 9). Base do Expo + desativa regras que conflitam com o Prettier.
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = [
  { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'coverage/**'] },
  ...expoConfig,
  prettier,
  {
    // Regra de dependência da Clean Architecture: a apresentação não importa a infraestrutura.
    // Ela recebe tudo pronto pelo container de DI (src/di) e fala só com casos de uso e leituras.
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**'],
              message:
                'A apresentação não importa a infraestrutura. Use os casos de uso expostos pelo container (src/di).',
            },
          ],
        },
      ],
    },
  },
  {
    // O domínio e a aplicação não conhecem React, Expo nem a infraestrutura.
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'expo*',
                '**/infrastructure/**',
                '**/presentation/**',
              ],
              message: 'Domínio e aplicação são independentes de framework e de camadas externas.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.js', 'e2e/**/*.js'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
  },
];
