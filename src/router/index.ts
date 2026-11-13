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
  }
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})
