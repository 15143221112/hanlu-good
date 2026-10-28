<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BottomTab from './components/BottomTab.vue'

const route = useRoute()
const hideTab = computed(() => !!route.meta.hideTab)
</script>

<template>
  <div class="max-w-md mx-auto min-h-screen flex flex-col bg-bg">
    <header
      v-if="!hideTab"
      class="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 py-3 flex items-center justify-between"
    >
      <h1 class="text-lg font-bold text-slate-800">考后复盘本</h1>
      <span class="text-xs text-slate-400">{{ route.meta.label || '' }}</span>
    </header>
    <main class="flex-1 px-4 py-4 pb-20">
      <router-view />
    </main>
    <BottomTab v-if="!hideTab" />
  </div>
</template>
