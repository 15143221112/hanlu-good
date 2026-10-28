<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{ option: Record<string, unknown> }>()
const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

onMounted(() => {
  if (el.value) {
    chart = echarts.init(el.value)
    try {
      chart.setOption(props.option)
    } catch (e) {
      console.error('EChart setOption error keys=' + Object.keys(props.option || {}).join(','), e)
    }
    window.addEventListener('resize', onResize)
  }
})

function onResize() {
  chart?.resize()
}

watch(
  () => props.option,
  (o) => {
    if (chart && o) chart.setOption(o, true)
  },
  { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="w-full" style="height: 100%"></div>
</template>
