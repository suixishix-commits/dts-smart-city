// ESLint 9 扁平配置（替代旧的 .eslintrc.cjs：ESLint 9 不再读取它，也不再支持 --ignore-path）。
// 规则与原配置一致：vue3-essential + eslint:recommended + TypeScript 推荐 + 跳过格式化（格式交给 prettier）。
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import { readFileSync } from 'node:fs'
import globals from 'globals'

// unplugin-auto-import 生成的全局变量清单
const autoImport = JSON.parse(readFileSync(new URL('./.eslintrc-auto-import.json', import.meta.url), 'utf-8')).globals

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue,js,mjs,cjs,jsx}']
  },
  {
    name: 'app/files-to-ignore',
    // public 下是第三方效果库和运行时配置脚本，dist 是构建产物
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**', 'public/**', '*.d.ts']
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    name: 'app/globals',
    languageOptions: {
      globals: { ...globals.browser, ...autoImport, gVar: 'writable', __xapi: 'writable' }
    }
  },
  {
    name: 'app/node-scripts',
    files: ['scripts/**', '*.config.{js,ts,cjs,mjs}', '.*.cjs'],
    languageOptions: { globals: globals.node }
  },
  {
    name: 'app/rules',
    rules: {
      'vue/multi-word-component-names': 'off',
      // 约定允许 __xapi、gVar、emitter 事件参数用 any，其余尽量避免：记为警告，不挡提交
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  },
  {
    // 从 dts-web-template 继承的 SDK 封装和工具函数：保持与模板一致，不按业务代码的标准改写，只放宽类型相关规则
    name: 'app/legacy-template',
    files: ['src/components/dts/**', 'src/utils/**', 'src/api/dts/**', 'src/stores/**', 'src/types/**/*.d.ts', 'src/router/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-array-constructor': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      // 这几条能被 --fix 自动改写：关掉，免得 npm run lint 动到模板代码
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
      'prefer-rest-params': 'off',
      'prefer-spread': 'off',
      'no-var': 'off'
    }
  },
  {
    // 测试里的假 SceneApi、假 __xapi 记录任意参数
    name: 'app/tests',
    files: ['**/__tests__/**', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
