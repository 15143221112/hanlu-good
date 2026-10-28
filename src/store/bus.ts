// 全局数据变更通知：任何写操作后 bump()，页面 watch tick 刷新
import { reactive } from 'vue'

export const bus = reactive({ tick: 0 })
export function bump(): void {
  bus.tick++
}
