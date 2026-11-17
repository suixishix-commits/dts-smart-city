/** 通用详情卡片（components/panel/DetailCard.vue）的内容：标签、标题、最多三个指标、若干「名称—内容」行 */
export interface DetailModel {
  tag?: { text: string; color: string }
  title: string
  stats?: { label: string; value: string | number; unit?: string; color?: string }[]
  rows: { label: string; value: string }[]
  /** 关联的摄像头：卡片里显示它的画面 */
  camera?: { id: string; online: boolean; replayMinutes?: number }
  /** 底部操作按钮（最多两个，第一个为主按钮）。点击后卡片派发 action 事件，参数为 key */
  actions?: { key: string; label: string }[]
}
