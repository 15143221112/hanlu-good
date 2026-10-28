import { createRouter, createWebHistory } from 'vue-router'

const base = (import.meta.env.BASE_URL || '/')

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('../views/Dashboard.vue'), meta: { tab: true, label: '首页' } },
  { path: '/exams', name: 'exams', component: () => import('../views/ExamList.vue'), meta: { tab: true, label: '考试' } },
  { path: '/exams/new', name: 'exam-new', component: () => import('../views/ExamNew.vue'), meta: { hideTab: true } },
  { path: '/exams/:id', name: 'exam-detail', component: () => import('../views/ExamDetail.vue'), meta: { hideTab: true } },
  { path: '/questions', name: 'questions', component: () => import('../views/QuestionList.vue'), meta: { tab: true, label: '错题' } },
  { path: '/questions/new', name: 'question-new', component: () => import('../views/QuestionNew.vue'), meta: { hideTab: true } },
  { path: '/trends', name: 'trends', component: () => import('../views/Trends.vue'), meta: { tab: true, label: '趋势' } },
  { path: '/actions', name: 'actions', component: () => import('../views/Actions.vue'), meta: { tab: true, label: '行动项' } },
  { path: '/settings', name: 'settings', component: () => import('../views/Settings.vue'), meta: { tab: true, label: '我的' } }
]

export default createRouter({
  history: createWebHistory(base),
  routes
})
