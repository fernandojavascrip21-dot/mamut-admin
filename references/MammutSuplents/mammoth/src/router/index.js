import { createRouter, createWebHistory } from 'vue-router'
import { useSesionStore } from '@/stores/sesion'
import LayoutPublico from '@/layouts/LayoutPublico.vue'
import LayoutAdmin from '@/layouts/LayoutAdmin.vue'
import CatalogoView from '@/vistas/CatalogoView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: LayoutPublico,
      children: [
        { path: '', name: 'catalogo', component: CatalogoView },
        { path: 'categoria/:slug', name: 'categoria', component: CatalogoView }
      ]
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('@/vistas/AdminLoginView.vue')
    },
    {
      path: '/admin',
      component: LayoutAdmin,
      meta: { requiereSesion: true },
      children: [
        { path: '', redirect: { name: 'admin-productos' } },
        { path: 'productos', name: 'admin-productos', component: () => import('@/vistas/AdminListadoView.vue') },
        { path: 'productos/nuevo', name: 'admin-nuevo', component: () => import('@/vistas/AdminFormularioView.vue') },
        { path: 'productos/:id/editar', name: 'admin-editar', component: () => import('@/vistas/AdminFormularioView.vue') }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'catalogo' } }
  ],
  scrollBehavior: () => ({ top: 0 })
})

// Protege todo lo que cuelga de /admin
router.beforeEach((to) => {
  const sesion = useSesionStore()
  if (to.matched.some((r) => r.meta.requiereSesion) && !sesion.autenticado) {
    return { name: 'admin-login', query: { redirigir: to.fullPath } }
  }
  if (to.name === 'admin-login' && sesion.autenticado) {
    return { name: 'admin-productos' }
  }
  return true
})

export default router
