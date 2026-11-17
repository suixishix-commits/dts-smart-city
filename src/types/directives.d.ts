import type { vPop } from '@/utils/motion'

// 全局注册的指令（main.ts），让模板里的 v-pop 有类型
declare module 'vue' {
  interface GlobalDirectives {
    vPop: typeof vPop
  }
}

export {}
