import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/overview' },
  {
    path: '/app',
    name: 'app',
    component: () => import('@/views/layout/Layout.vue'),
    children: [
      {
        path: '/overview',
        name: 'overview',
        component: () => import('@/views/overview/OverviewMain.vue')
      }
    ]
  },
  // 未匹配的地址回到总览，避免卸载 Layout（会销毁三维场景）
  { path: '/:pathMatch(.*)*', redirect: '/overview' }
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})
