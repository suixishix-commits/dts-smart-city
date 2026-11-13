import { registerStore } from '@/stores/register'
import '@/styles/index.scss'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import router from './router'
// 引入和风天气图标
import 'qweather-icons/font/qweather-icons.css'
import BimFacade from './template/dts/bim/BimFacade'
const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
// 注册 Pinia
registerStore()

// 全局注册组件
const requireModules = import.meta.glob('./template/**/*.vue', { eager: true })
for (const path in requireModules) {
  const result: any = path.match(/.\/(\w+).vue$/)
  const modulesConent: any = requireModules[path]
  app.component(result[1], modulesConent.default)
  // console.log('全局组件注册：', result[1], modulesConent.default)
}
app.use(router)
app.use(i18n)
app.use(ElementPlus)
app.mount('#app')

// 全局组件查看
window.vueApp = app
console.log('全局组件:', app._context.components);

// 测试函数
window.TestFun = { BimFacade }

