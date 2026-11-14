/** 通用详情卡片（components/panel/DetailCard.vue）的内容：标签、标题、最多三个指标、若干「名称—内容」行 */
export interface DetailModel {
  tag?: { text: string; color: string }
  title: string
  stats?: { label: string; value: string | number; unit?: string; color?: string }[]
  rows: { label: string; value: string }[]
}
