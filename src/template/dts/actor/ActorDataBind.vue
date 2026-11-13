<template>
  <div class="treebox">
    <!-- 工具区：图层刷新 / Actor 映射 / 导出 -->
    <div class="toolbar">
      <div class="toolbar-row">
        <el-input v-model="inputLayerNames" clearable placeholder="图层名称，多个用英文逗号分隔" size="small" class="toolbar-input" />
        <el-button :type="isPickingLayer ? 'danger' : 'info'" size="small" @click="togglePickLayer">
          {{ isPickingLayer ? '取消拾取' : '拾取' }}
        </el-button>
        <el-button :type="isPickingActor ? 'danger' : 'info'" size="small" @click="togglePickActor">
          {{ isPickingActor ? '取消点选' : '场景点选Actor' }}
        </el-button>
        <el-button type="primary" size="small" @click="refreshTree">刷新</el-button>
      </div>
      <div class="toolbar-row">
        <el-input :model-value="selectedActorId" readonly placeholder="当前 ActorID" size="small" class="toolbar-input actor-id" />
        <el-input
          v-model="mapNameInput"
          clearable
          placeholder="映射名称"
          size="small"
          class="toolbar-input"
          :disabled="!selectedActor"
          @keyup.enter="applyMapName"
        />
        <el-button type="success" size="small" :disabled="!selectedActor" @click="applyMapName">应用</el-button>
      </div>
      <div class="toolbar-row">
        <el-button type="warning" size="small" @click="exportJson">导出JSON</el-button>
        <el-button type="primary" size="small" @click="flashingActor">闪烁Actor</el-button>
      </div>
    </div>

    <el-tree
      class="treeScrollbar"
      :data="treeData"
      show-checkbox
      highlight-current
      node-key="id"
      @check="checkChangeHandle"
      @node-click="nodeClickHandle"
      :check-strictly="false"
      :default-checked-keys="checkedIds"
      :default-expanded-keys="expandedArr"
      :props="treeDefaultProps"
      :default-expand-all="true"
      ref="tree"
    >
      <template #default="{ node, data }">
        <span class="custom-tree-node" :title="node.label">
          <span class="name">{{ node.label }}</span>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<script setup lang="ts">
import DtsFacade from '@/components/dts/DtsFacade'
import store from '@/stores/index'
import emitter from '@/utils/emitter'
import MittEvent from '@/utils/MittEvent'
import { ElMessage } from 'element-plus'

/** Actor 树节点 */
interface ActorTreeNode {
  id: string
  name: string
  type: 'layer' | 'actor'
  layerId: string
  mapName?: string
  children: ActorTreeNode[]
}

/** 导出映射记录 */
interface ActorMapperRecord {
  layerId: string
  actorId: string
  mapName: string
}

/** 按图层分组后的显隐参数 */
interface ActorVisibleGroup {
  id: string
  objectIds: string[]
}

// 组件属性定义
const props = defineProps({
  // 图层唯一中文名称，多个以英文逗号间隔
  layerNames: {
    type: String,
    default: `场地`, //示例采用GZB工程
    required: false
  }
})

// 定义事件
const emit = defineEmits(['node-click', 'check'])

/** 图层名称输入（确认后用于刷新建树） */
const inputLayerNames = ref(props.layerNames || '')
/** 是否处于场景图层拾取模式 */
const isPickingLayer = ref(false)
/** 是否处于场景点选 Actor 模式（点击对象同步树节点） */
const isPickingActor = ref(false)
/** 当前选中的 Actor 节点 */
const selectedActor = ref<ActorTreeNode | null>(null)
/** 映射名称输入 */
const mapNameInput = ref('')
/** 当前选中 ActorID（只读展示） */
const selectedActorId = computed(() => selectedActor.value?.id || '')
/** 闪烁定时器 */
let flashingTimer: ReturnType<typeof setInterval> | null = null
/** 正在闪烁的 Actor（按图层分组），结束或离开页面时强制显示 */
let flashingTarget: ActorVisibleGroup[] | null = null
const FLASH_TIMES = 4
const FLASH_INTERVAL = 500
/** Actor 树实例：勾选读取、场景点选写回、滚动定位 */
const tree = ref<{
  getCheckedNodes: (leafOnly?: boolean, includeHalfChecked?: boolean) => ActorTreeNode[]
  setChecked: (key: string, checked: boolean, deep?: boolean) => void
  setCheckedKeys: (keys: string[]) => void
  setCurrentKey: (key: string | null) => void
  getNode: (key: string) => { $el?: HTMLElement } | null
} | null>(null)

// 展开节点
const expandedArr = ref<string[]>([])
// 控件属性定义
const treeDefaultProps = {
  children: 'children',
  label: 'name'
}
// UI树绑定数据
const treeData = ref<ActorTreeNode[]>([])
// 选中的节点id
const checkedIds = ref<string[]>([])

/**
 * 根据 mapName 与 ActorID 生成树节点展示文案
 * @param actorId Actor 原始 ID
 * @param mapName 映射名称（可空）
 */
function formatActorLabel(actorId: string, mapName?: string) {
  const trimmed = mapName?.trim()
  return trimmed ? `${trimmed}（${actorId}）` : actorId
}

/**
 * 开启场景 TileLayer 拾取（需配合 EventDispatcher 的 inPickUpInfoState）
 */
function startPickLayer() {
  // 与场景点选 Actor 互斥
  stopPickActor()
  isPickingLayer.value = true
  store.dtsStore.inPickUpInfoState = true
  ElMessage.info('请在场景中点击 TileLayer 拾取图层名称')
}

/**
 * 关闭场景 TileLayer 拾取
 */
function stopPickLayer() {
  isPickingLayer.value = false
  store.dtsStore.inPickUpInfoState = false
}

/**
 * 切换图层拾取模式
 */
function togglePickLayer() {
  if (isPickingLayer.value) {
    stopPickLayer()
  } else {
    startPickLayer()
  }
}

/**
 * 开启场景点选 Actor：点击场景对象同步到 Actor 树
 */
function startPickActor() {
  // 与图层拾取互斥
  stopPickLayer()
  isPickingActor.value = true
  ElMessage.info('请在场景中点击对象以选中 Actor')
}

/**
 * 关闭场景点选 Actor（保留树上已勾选状态）
 */
function stopPickActor() {
  isPickingActor.value = false
}

/**
 * 切换场景点选 Actor 模式
 */
function togglePickActor() {
  if (isPickingActor.value) {
    stopPickActor()
  } else {
    startPickActor()
  }
}

/**
 * 在当前树中按图层 ID + Actor ID 查找节点，避免跨图层 id 撞车
 * @param layerId 图层 ID
 * @param actorId Actor / ObjectID
 */
function findActorNode(layerId: string, actorId: string) {
  for (const layerNode of treeData.value) {
    if (String(layerNode.layerId) !== layerId) {
      continue
    }
    const hit = layerNode.children?.find((item) => item.type === 'actor' && String(item.id) === actorId)
    if (hit) {
      return hit
    }
  }
  return null
}

/**
 * 将 Actor 树节点滚入可视区域
 * @param actorId 节点 key（Actor ID）
 */
function scrollTreeNodeIntoView(actorId: string) {
  nextTick(() => {
    const node = tree.value?.getNode(actorId)
    node?.$el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

/**
 * 场景点选命中后：累加勾选、同步映射区、树高亮滚动、场景高亮
 * @param actor 树中已存在的 Actor 节点
 */
function selectActorFromScene(actor: ActorTreeNode) {
  tree.value?.setChecked(actor.id, true, false)
  selectedActor.value = actor
  mapNameInput.value = actor.mapName || ''
  tree.value?.setCurrentKey(actor.id)
  scrollTreeNodeIntoView(actor.id)

  if (__xapi?.isReady) {
    __xapi.tileLayer.stopHighlightAllActors()
    __xapi.tileLayer.highlightActor(actor.layerId, actor.id)
    // setChecked 不触发 @check，补一次显示兜底
    __xapi.tileLayer.showActor(actor.layerId, actor.id)
  }
}

/**
 * 监听场景左键：点选模式下将 TileLayer 对象同步到 Actor 树
 * @param evt MittEvent，data 为原始场景点击事件（含 Id / ObjectID）
 */
function onSceneLeftMouseClick(evt: MittEvent | unknown) {
  if (!isPickingActor.value) {
    return
  }
  const data = (evt as MittEvent)?.data ?? evt
  if (!data || data.Type !== 'TileLayer') {
    return
  }
  const layerId = data.Id != null ? String(data.Id) : ''
  const actorId = data.ObjectID != null ? String(data.ObjectID) : ''
  if (!layerId || !actorId) {
    return
  }
  const actor = findActorNode(layerId, actorId)
  if (!actor) {
    return
  }
  selectActorFromScene(actor)
}

/**
 * 监听 TileLayer 左键点击：将 e.PropertyName（图层名称）写入 layerNames 输入框
 * @param evt MittEvent，data 为原始场景点击事件
 */
function onTileLayerLeftClick(evt: MittEvent | unknown) {
  if (!isPickingLayer.value) {
    return
  }
  const layerName = (evt as MittEvent)?.data?.PropertyName
  if (!layerName) {
    return
  }
  // 已有列表则去重追加，支持多图层；否则直接赋值
  const names = inputLayerNames.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!names.includes(layerName)) {
    names.push(layerName)
    inputLayerNames.value = names.join(',')
  }
  stopPickLayer()
  ElMessage.success(`已拾取图层：${layerName}`)
}

/**
 * 收集当前树中已填写的映射，key 为 layerId|actorId
 */
function collectExistingMapNames() {
  const map = new Map<string, string>()
  treeData.value.forEach((layerNode) => {
    layerNode.children?.forEach((actorNode) => {
      if (actorNode.mapName?.trim()) {
        map.set(`${actorNode.layerId}|${actorNode.id}`, actorNode.mapName.trim())
      }
    })
  })
  return map
}

/**
 * 按图层名称列表构建 Actor 树；刷新时保留已有 mapName
 * @param layerNamesStr 逗号分隔的图层中文名
 */
async function buildTreeByLayerNames(layerNamesStr: string) {
  checkedIds.value = []
  selectedActor.value = null
  mapNameInput.value = ''

  const raw = layerNamesStr?.trim()
  if (!raw) {
    console.log('图层名称未设置')
    treeData.value = []
    return
  }

  const arrLayerName = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (arrLayerName.length === 0) {
    treeData.value = []
    return
  }

  if (!__xapi?.isReady) {
    ElMessage.warning('场景未就绪，无法刷新 Actor 树')
    return
  }

  const existingMap = collectExistingMapNames()
  const arrLayerId = DtsFacade.getLayerId(arrLayerName)
  const layerMap: Record<string, string> = {}

  if (!arrLayerId?.length) {
    console.log(arrLayerName, '的图层ID未获取到')
    ElMessage.warning('未获取到对应图层 ID，请检查图层名称')
    treeData.value = []
    return
  }

  arrLayerId.forEach((layerId, index) => {
    if (layerId) {
      layerMap[layerId as string] = arrLayerName[index] || String(layerId)
    }
  })

  // 过滤空 ID，避免接口异常
  const validLayerIds = arrLayerId.filter(Boolean) as string[]
  if (validLayerIds.length === 0) {
    ElMessage.warning('未获取到有效图层 ID')
    treeData.value = []
    return
  }

  const res = await __xapi.tileLayer.getObjectIDs(validLayerIds)
  console.log('图层对象ID', arrLayerName, validLayerIds, res)

  if (!res?.data?.length) {
    treeData.value = []
    return
  }

  const treeList: ActorTreeNode[] = []
  res.data.forEach((item: any) => {
    const layerNode: ActorTreeNode = {
      id: item.id,
      name: layerMap[item.id] || item.id,
      type: 'layer',
      layerId: item.id,
      children: []
    }
    ;(item.objectIds || []).forEach((actorId: any) => {
      const key = `${item.id}|${actorId}`
      const mapName = existingMap.get(key) || ''
      layerNode.children.push({
        id: actorId,
        name: formatActorLabel(actorId, mapName),
        type: 'actor',
        layerId: item.id,
        mapName,
        children: []
      })
    })
    treeList.push(layerNode)
  })

  console.log('Actor树数据：', treeList)
  treeData.value = treeList
}

/**
 * 勾选当前树全部节点，并对每个图层执行 showAllActors
 * 图层节点一并勾上，便于父级复选框显示为全选
 */
function checkAllActorsAndShow() {
  const allKeys: string[] = []
  const layerIds: string[] = []
  treeData.value.forEach((layerNode) => {
    allKeys.push(layerNode.id)
    layerIds.push(layerNode.layerId)
    layerNode.children?.forEach((actorNode) => {
      if (actorNode.type === 'actor') {
        allKeys.push(actorNode.id)
      }
    })
  })
  checkedIds.value = allKeys
  nextTick(() => {
    tree.value?.setCheckedKeys(allKeys)
    if (__xapi?.isReady) {
      layerIds.forEach((layerId) => {
        __xapi.tileLayer.showAllActors(layerId)
      })
    }
  })
}

/**
 * 点击「刷新」：按输入框图层名重新加载 Actor 树，并默认全选、显示全部 Actor
 */
async function refreshTree() {
  console.log('刷新Actor树', inputLayerNames.value)
  await buildTreeByLayerNames(inputLayerNames.value)
  checkAllActorsAndShow()
}

/**
 * 将映射名称应用到当前选中的 Actor 节点（不改 ActorID）
 */
function applyMapName() {
  const actor = selectedActor.value
  if (!actor || actor.type !== 'actor') {
    ElMessage.warning('请先选中 Actor 节点')
    return
  }
  const mapName = mapNameInput.value?.trim() || ''
  actor.mapName = mapName
  actor.name = formatActorLabel(actor.id, mapName)
  ElMessage.success(mapName ? '映射已应用' : '已清空映射名称')
}

/**
 * 导出已映射 Actor 为 JSON 文件（仅含 mapName 非空记录）
 */
function exportJson() {
  const records: ActorMapperRecord[] = []
  treeData.value.forEach((layerNode) => {
    layerNode.children?.forEach((actorNode) => {
      const mapName = actorNode.mapName?.trim()
      if (mapName) {
        records.push({
          layerId: actorNode.layerId,
          actorId: actorNode.id,
          mapName
        })
      }
    })
  })

  if (records.length === 0) {
    ElMessage.warning('暂无已映射的 Actor，请先填写映射名称')
    return
  }

  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `actor-mapper-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success(`已导出 ${records.length} 条映射记录`)
}

/**
 * 读取 Actor 树当前勾选的 Actor。图层节点不参与闪烁。
 * 父子关联勾选时，勾选图层会带出其下全部 Actor。
 */
function getCheckedActors() {
  const nodes = tree.value?.getCheckedNodes(true) || []
  return nodes.filter((item) => item.type === 'actor')
}

/**
 * 按图层把勾选 Actor 收成显隐接口需要的分组。同一图层的 Actor 合并为一次调用。
 * @param actors 当前勾选的 Actor 节点
 */
function groupActorsByLayer(actors: ActorTreeNode[]) {
  const map = new Map<string, string[]>()
  actors.forEach((actor) => {
    const ids = map.get(actor.layerId) || []
    ids.push(actor.id)
    map.set(actor.layerId, ids)
  })
  return Array.from(map.entries()).map(([id, objectIds]) => ({ id, objectIds }))
}

/**
 * 按图层分组显示或隐藏 Actor
 * @param groups 按图层分组的 Actor
 * @param visible true 显示，false 隐藏
 */
function setActorsVisible(groups: ActorVisibleGroup[], visible: boolean) {
  if (!groups.length) {
    return
  }
  if (visible) {
    __xapi.tileLayer.showActors(groups)
  } else {
    __xapi.tileLayer.hideActors(groups)
  }
}

/**
 * 停止闪烁。restore 为 true 时把尚未结束的 Actor 强制显示回来。
 * @param restore 是否恢复显示
 */
function stopFlashingActor(restore = false) {
  if (flashingTimer) {
    clearInterval(flashingTimer)
    flashingTimer = null
  }
  if (restore && flashingTarget?.length && __xapi?.isReady) {
    setActorsVisible(flashingTarget, true)
  }
  flashingTarget = null
}

/**
 * 闪烁当前勾选的 Actor：先取树中已勾选节点（一个或多个），再交替显隐。
 * 共 4 次，每次间隔 500ms，结束时保持显示。
 */
function flashingActor() {
  const actors = getCheckedActors()
  if (actors.length === 0) {
    ElMessage.warning('请先勾选要闪烁的 Actor')
    return
  }
  if (!__xapi?.isReady) {
    ElMessage.warning('场景未就绪，无法闪烁 Actor')
    return
  }

  const groups = groupActorsByLayer(actors)
  stopFlashingActor(true)
  flashingTarget = groups
  setActorsVisible(groups, false)

  let step = 1
  flashingTimer = setInterval(() => {
    const finished = step + 1 >= FLASH_TIMES * 2
    setActorsVisible(groups, finished || step % 2 !== 0)
    step += 1
    if (finished) {
      stopFlashingActor()
    }
  }, FLASH_INTERVAL)
}

/**
 * 节点被点击时的回调：同步选中 Actor 到映射录入区，并聚焦/高亮场景对象
 */
const nodeClickHandle = (data: any, node: any) => {
  console.log('图层树点了啥？', node, data)
  emit('node-click', data, node)

  if (data.type === 'actor') {
    selectedActor.value = data
    mapNameInput.value = data.mapName || ''
  } else {
    selectedActor.value = null
    mapNameInput.value = ''
  }

  if (__xapi?.isReady) {
    __xapi.tileLayer.stopHighlightAllActors()
    if (data.type == 'actor') {
      __xapi.tileLayer.focusActor(data.layerId, data.id)
      __xapi.tileLayer.highlightActor(data.layerId, data.id)
    } else if (data.type == 'layer') {
      __xapi.tileLayer.show(data.layerId)
      __xapi.tileLayer.focus(data.layerId)
    }
  }
}

/**
 * 节点勾选状态变化：控制 Actor / 图层显隐
 */
const checkChangeHandle = (data: any, checkedState: any) => {
  let checked = checkedState.checkedKeys.includes(data.id)
  console.log('点了啥？', data, checkedState, checked)
  emit('check', data, checkedState, checked)
  if (__xapi?.isReady) {
    __xapi.tileLayer.stopHighlightAllActors()
    if (checked) {
      if (data.type == 'actor') {
        __xapi.tileLayer.showActor(data.layerId, data.id)
      } else if (data.type == 'layer') {
        __xapi.tileLayer.showAllActors(data.layerId)
      }
    } else {
      if (data.type == 'actor') {
        __xapi.tileLayer.hideActor(data.layerId, data.id)
      } else if (data.type == 'layer') {
        __xapi.tileLayer.hideAllActors(data.layerId)
      }
    }
  }
}

// prop layerNames 变化时同步输入框并重建树
watch(
  () => props.layerNames,
  (newVal) => {
    inputLayerNames.value = newVal || ''
    if (newVal) {
      console.log('ActorDataBind属性layerNames发生变化了', newVal)
      buildTreeByLayerNames(newVal)
    } else {
      treeData.value = []
    }
  }
)

onMounted(() => {
  emitter.on('TileLayer_LeftClick', onTileLayerLeftClick)
  emitter.on('SceneLeftMouseClick', onSceneLeftMouseClick)
  buildTreeByLayerNames(inputLayerNames.value)
})

onUnmounted(() => {
  stopFlashingActor(true)
  stopPickLayer()
  stopPickActor()
  emitter.off('TileLayer_LeftClick', onTileLayerLeftClick)
  emitter.off('SceneLeftMouseClick', onSceneLeftMouseClick)
})
</script>

<style lang="scss" scoped>
.treebox {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  top: 0;
  bottom: 0;
  left: 0px;
  padding: 0px 10px;
  opacity: 1;
  box-sizing: border-box;
  color: #fff;
  pointer-events: all;

  .toolbar {
    flex-shrink: 0;
    padding: 8px 0 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;

    .toolbar-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toolbar-input {
      flex: 1;
      min-width: 0;
    }

    .actor-id {
      flex: 0.9;
    }
  }

  :deep(.el-tree) {
    flex: 1;
    min-height: 0;
    color: white;
    background: transparent;
    overflow: auto;
    /* 更改鼠标悬停时样式 */
    .el-tree-node__content:hover {
      background: transparent;
      color: #409eff;
    }

    /* 更改被选中节点的背景色和边框 */
    .el-tree-node__content:active {
      background-color: #eaf6fe; /* 更改节点被点击时的背景色 */
      color: #409eff; /* 更改节点被点击时的文字颜色 */
      border-color: #409eff; /* 更改节点被点击时的边框颜色 */
    }

    // 点击节点样式
    .el-tree-node:focus > .el-tree-node__content {
      background: transparent;
      color: #409eff;
    }
    // 当前高亮节点（场景点选 / setCurrentKey）
    .el-tree-node.is-current > .el-tree-node__content {
      background: rgba(64, 158, 255, 0.18);
      color: #409eff;
    }
    // 收缩图标样式
    .el-tree-node__expand-icon {
      color: white;
    }
    // 收缩图标叶节点
    .el-tree-node__expand-icon .is-leaf {
      color: transparent;
      cursor: default;
    }
    // 节点文字样式
    .custom-tree-node {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
  }
}
</style>
