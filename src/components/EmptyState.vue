<script setup lang="ts">
defineProps<{ title?: string; desc?: string; steps?: string[] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" class="w-7 h-7">
        <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15zM4 20.5A2.5 2.5 0 006.5 23H20v-5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M9 8h7M9 12h5" stroke-linecap="round" />
      </svg>
    </div>
    <p class="text-slate-600 text-sm font-medium">{{ title || '暂无数据' }}</p>
    <p v-if="desc" class="text-slate-400 text-xs mt-1 max-w-[80%]">{{ desc }}</p>
    <div v-if="steps?.length" class="mt-4 space-y-1.5 text-left">
      <div v-for="(s, i) in steps" :key="i" class="flex items-center gap-2 text-xs text-slate-500">
        <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style="background: linear-gradient(135deg, #6366f1, #8b5cf6)">{{ i + 1 }}</span>
        {{ s }}
      </div>
    </div>
  </div>
</template>
