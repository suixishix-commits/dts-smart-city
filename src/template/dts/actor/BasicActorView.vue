<template>
  <div class="treebox">
    <el-tree
      class="treeScrollbar"
      :data="treeData"
      show-checkbox
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

// 展开节点
const expandedArr = ref<string[]>([])
// 控件属性定义
const treeDefaultProps = {
  children: 'children',
  label: 'name'
}
// UI树绑定数据
const treeData = ref<any>([])
// 选中的节点id
const checkedIds = ref<string[]>([])
// 是否初始化完成
const hasReady = ref(false)

// 节点被点击时的回调
const nodeClickHandle = (data: any, node: any) => {
  console.log('图层树点了啥？', node, data)
  emit('node-click', data, node)
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

// 节点选中状态发生变化时的回调
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

// 初始化树
async function initTree() {
  console.log('初始化Actor树', props.layerNames)
  checkedIds.value = []
  if (props.layerNames) {
    let arrLayerName = props.layerNames.split(',')
    if (arrLayerName?.length > 0 && __xapi?.isReady) {
      let arrLayerId = DtsFacade.getLayerId(arrLayerName)
      let layerMap: any = {}
      if (arrLayerId?.length > 0) {
        arrLayerId.forEach((layerId, index) => {
          layerMap[layerId] = arrLayerName[index]
        })
        const res = await __xapi.tileLayer.getObjectIDs(arrLayerId)
        console.log('图层对象ID', arrLayerName, arrLayerId, res)
        if (res?.data?.length > 0) {
          let treeList: any = []
          res.data.forEach((item: any, index: any) => {
            let layerNode = {
              id: item.id,
              name: layerMap[item.id],
              type: 'layer',
              layerId: item.id,
              children: []
            } as { id: any; name: string; type: string; children: Array<{ id: any; name: string; type: string; layerId: string; children: any }> }
            // Actor子节点
            item.objectIds.forEach((actorId: any) => {
              layerNode.children.push({
                id: actorId,
                name: actorId,
                type: 'actor',
                layerId: item.id,
                children: []
              })
            })
            // 图层父节点
            treeList.push(layerNode)
          })
          console.log('Actor树数据：', treeList)
          treeData.value = treeList
        }
      } else {
        console.log(arrLayerName, '的图层ID未获取到')
      }
    }
  } else {
    console.log('图层名称未设置')
    treeData.value = []
  }
}

// 属性监听
watch([() => props.layerNames], (newVal, oldVal) => {
  if (newVal[0]) {
    console.log('BasicActorView属性layerNames发生变化了', newVal[0], oldVal[0])
    initTree()
  } else {
    treeData.value = []
  }
})

onMounted(() => {
  initTree()
})
</script>

<style lang="scss" scoped>
.treebox {
  position: relative;
  width: 100%;
  height: 100%;
  top: 0;
  bottom: 0;
  left: 0px;
  padding: 0px 10px;
  // border-radius: 12px;
  opacity: 1;
  // background: linear-gradient(314deg, rgba(16, 182, 246, 0.4) -1%, rgba(16, 182, 246, 0) 46%), rgba(0, 62, 88, 0.5);
  box-sizing: border-box;
  // border: 1px solid #6fbdff;
  color: #fff;
  pointer-events: all;
  :deep(.el-tree) {
    height: 100%;
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
