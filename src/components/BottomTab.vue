<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const tabs = [
  { to: '/dashboard', label: '首页', icon: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10' },
  { to: '/exams', label: '考试', icon: 'M8 2h8l4 4v16H4V6l4-4zm0 4V4M8 12h8M8 16h5' },
  { to: '/questions', label: '错题', icon: 'M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4zm-1 6v6m-3-3h6' },
  { to: '/trends', label: '趋势', icon: 'M4 19V9M10 19V5M16 19v-7M22 19H2' },
  { to: '/settings', label: '我的', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0' }
]
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-10 bg-white border-t border-slate-200 pb-safe">
    <div class="max-w-md mx-auto grid grid-cols-5">
      <router-link
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="flex flex-col items-center py-2 text-[11px]"
        :class="route.path.startsWith(t.to) ? 'text-danger' : 'text-slate-400'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-6 h-6 mb-0.5">
          <path :d="t.icon" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {{ t.label }}
      </router-link>
    </div>
  </nav>
</template>
