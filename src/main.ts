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
import { ModuleScene } from './scene/ModuleScene'
import { installSceneErrorHandling } from './utils/sceneErrors'

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
// 渲染端断开后各处场景调用的失败只记一条警告，不作为未处理错误抛到界面上
installSceneErrorHandling(app)
app.mount('#app')

// 页面关闭或刷新时删掉当前模块画的场景对象：它们存在共享的渲染实例里，不删会出现在下一个打开的页面上
window.addEventListener('pagehide', () => ModuleScene.active.forEach(scene => scene.abandon()))
