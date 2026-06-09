import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    plugins: { react: reactPlugin, "react-hooks": reactHooks },
    languageOptions: { ecmaVersion: 2022, sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { window: true, document: true, console: true,
        setTimeout: true, clearTimeout: true, setInterval: true,
        clearInterval: true, Promise: true, URL: true, atob: true,
        btoa: true, fetch: true, import: true }
    },
    rules: {
      "no-unused-vars": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-undef": "error",
    },
    settings: { react: { version: "18" } },
  }
];
