module.exports = {
  root: true,
  parserOptions: {
    parser: '@babel/eslint-parser',
    ecmaVersion: 'latest'
  },
  env: {
    es6: true,
    browser: true,
    node: true
  },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  plugins: ['@babel/eslint-plugin'],
  rules: {
    'no-undef': 0,
    'no-unused-vars': 0,
    'no-empty': 0
  }
};
