import { registerStore } from '@/stores/register'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
import '@/styles/index.scss'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import router from './router'
import { vPop } from './utils/motion'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)
registerStore()
app.use(router)
app.use(i18n)
app.use(ElementPlus)
// 弹窗卡片的弹出动效（GSAP）
app.directive('pop', vPop)
app.mount('#app')
