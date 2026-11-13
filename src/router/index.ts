import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import store from '@/stores/index'
const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home_box',
    name: 'home_box',
    component: () => import('@/views/layout/Layout.vue'),
    children: [
      {
        path: '/home',
        name: 'home',
        component: () => import('@/views/home/Main.vue'),
      },
        {
            path: '/frontAndBackCardLayout',
            name: 'FrontAndBackCardLayout',
            component: () => import('@/views/home/FrontAndBackCardLayout.vue'),
        },
      {
        path: '/widescreen',
        name: 'Widescreen',
        component: () => import('@/views/home/CollapsibleWidescreenMain.vue'),
      },
      {
        path: '/infotree',
        name: 'infotree',
        component: () => import('../template/dts/info_tree/InfoTree.vue'),
      },
      {
        path: '/sidebar',
        name: 'sidebar',
        component: () => import('@/views/module-a/ModuleAMain.vue'),
      },
      {
        path: '/collapsible-panel',
        name: 'collapsible-panel',
        component: () => import('@/views/module-b/ModuleBMain.vue'),
      },
      {
        path: '/finite-element',
        name: 'finite-element',
        component: () => import('@/template/dts/finite_element/FiniteElement.vue'),
      },
      {
        path: '/smart-park',
        name: 'smart-park',
        component: () => import('@/views/test/SmartParkMain.vue'),
      },
      {
        path: '/event-monitor',
        name: 'event-monitor',
        component: () => import('@/views/test2/EventMain.vue'),
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: constantRoutes
})

// 白名单列表
const whiteList: any[] = ['/login']
// 路由跳转前
router.beforeEach(async (to, from, next) => {
  //const userStore = userStoreDefine()
  console.log('跳转路由是啥？', to, store)
  // token存在的情况
  if (store.userStore.getToken()) {
    next()
  } else {
    // 没有token的情况下，可以进入白名单
    if (whiteList.indexOf(to.path) > -1) {
      next()
    } else {
      window.location.href = gVar.loginUrl
    }
  }
})

// 路由加载后
router.afterEach((to, from) => {
})
export default router
