<template>
  <el-dialog
    v-model="visible"
    title="事件详情"
    :width="'42rem'"
    draggable
    append-to-body
    :close-on-click-modal="false"
    class="event-detail-dialog"
    @closed="$emit('close')"
  >
    <div class="detail-body">
      <div class="section">
        <div class="section-title">基础信息</div>
        <div class="info-grid">
          <div v-for="item in basicInfo" :key="item.label" class="info-row">
            <span class="info-label">{{ item.label }}</span>
            <span class="info-value" :class="item.cls">{{ item.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; data?: any }>()
const emit = defineEmits(['update:modelValue', 'close'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const basicInfo = computed(() => [
  { label: '事件内容', value: props.data?.content ?? '蔡甸区沌口某某位置发现异常情况' },
  { label: '事件状态', value: props.data?.status ?? '处置中', cls: 'val-warn' },
  { label: '事件时间', value: props.data?.time ?? '2026-02-04 14:00:44' },
  { label: '事件分类', value: props.data?.type ?? '预警类型 - 火灾救援' },
  { label: '事件位置', value: props.data?.location ?? '某某区域某某位置' }
])
</script>

<style lang="scss">
.event-detail-dialog {
  $accent: #15BAC6;
  $border: rgba(21, 186, 198, 0.3);
  $text-dim: rgba(255, 255, 255, 0.5);

  background: linear-gradient(160deg, rgba(14, 42, 62, 0.97) 0%, rgba(10, 30, 46, 0.98) 100%) !important;
  border: 1px solid $border !important;
  border-radius: 0.5rem !important;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(21, 186, 198, 0.1) !important;

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, $accent 0%, rgba(21,186,198,0.05) 100%);
    border-radius: 0.5rem 0.5rem 0 0;
    z-index: 1;
  }

  .el-dialog__header {
    display: flex; align-items: center;
    height: 4.8rem; padding: 0 1.4rem;
    margin: 0;
    background: rgba(21, 186, 198, 0.08);
    border-bottom: 1px solid rgba(21, 186, 198, 0.15);

    &::before {
      content: '';
      width: 0.3rem; height: 1.5rem;
      background: linear-gradient(180deg, $accent 0%, rgba(21,186,198,0.15) 100%);
      border-radius: 2px; flex-shrink: 0;
      margin-right: 0.7rem;
    }

    .el-dialog__title {
      font-family: YouSheBiaoTiHei, sans-serif;
      font-size: 1.7rem; letter-spacing: 0.08em;
      background: linear-gradient(180deg, #e8f8ff 0%, #7dd8e8 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    }

    .el-dialog__headerbtn {
      top: 50%; transform: translateY(-50%);
      width: 2.6rem; height: 2.6rem;
      border-radius: 0.3rem; transition: all 0.2s;
      .el-dialog__close { color: rgba(255,255,255,0.4); font-size: 1.4rem; }
      &:hover { background: rgba(255,107,107,0.1); .el-dialog__close { color: #FF6B6B; } }
    }
  }

  .el-dialog__body {
    padding: 0;
  }

  .detail-body {
    padding: 1.2rem 1.4rem;
  }

  .section {
    .section-title {
      font-size: 1.2rem; color: rgba(255,255,255,0.45);
      margin-bottom: 0.7rem;
      display: flex; align-items: center; gap: 0.5rem;
      &::before {
        content: ''; display: inline-block;
        width: 0.25rem; height: 1.1rem;
        background: $accent; border-radius: 2px;
      }
    }
  }

  .info-grid {
    display: flex; flex-direction: column;

    .info-row {
      display: flex; align-items: flex-start;
      min-height: 3.2rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding: 0.5rem 0;
      &:last-child { border-bottom: none; }

      .info-label {
        width: 8rem; font-size: 1.2rem; color: $text-dim;
        flex-shrink: 0; padding-top: 0.1rem;
      }
      .info-value {
        flex: 1; font-size: 1.25rem; color: rgba(255,255,255,0.85); line-height: 1.5;
        &.val-warn { color: #FFB347; }
        &.val-green { color: #4AE8A0; }
        &.val-cyan { color: #60E4FF; }
      }
    }
  }
}
</style>
