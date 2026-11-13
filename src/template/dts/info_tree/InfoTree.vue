<template>
  <div class="treebox">
    <el-tree
      class="treeScrollbar"
      :data="realTreeData"
      show-checkbox
      node-key="iD"
      @check="checkChangeHandle"
      @node-click="nodeClickHandle"
      :check-strictly="false"
      :default-checked-keys="checkedIds"
      :default-expanded-keys="expandedArr"
      :props="defaultProps"
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
import store from '@/stores/index'
// 组件属性定义
const props = defineProps({
  title: {
    type: String,
    default: '图层树',
    required: false
  },
  searchNode: {
    type: String,
    default: 'all', //all查全部，none不查，或指定一个或多个节点id字符串
    required: false
  },
  appendTreeData: Array
})
// 定义事件
const emit = defineEmits(['node-click', 'check'])

// 展开节点
const expandedArr = ref<string[]>([])
// 控件属性定义
const defaultProps = {
  children: 'children',
  label: 'name'
}
// UI树绑定数据
const realTreeData = ref<any>([])
// 选中的节点id
const checkedIds = ref<string[]>([])

// 节点被点击时的回调
const nodeClickHandle = (data: any, node: any) => {
  console.log('图层树点了啥？', node, data)
  emit('node-click', data, node)
  if (node.type !== 'EPT_Folder') {
    __xapi.infoTree.focus(data.iD)
  }
}

// 节点选中状态发生变化时的回调
const checkChangeHandle = (data: any, checkedState: any) => {
  let checked = checkedState.checkedKeys.includes(data.iD)
  //console.log('点了啥？', data, checked)
  emit('check', data, checkedState, checked)
  if (checked) {
    __xapi.infoTree.show(data.iD)
  } else {
    __xapi.infoTree.hide(data.iD)
  }
}

// 初始化树
const initTree = () => {
  if (!realTreeData.value?.length) {
    checkedIds.value = []
    //有过滤条件的树
    if (props.searchNode == 'all') {
      realTreeData.value = buildAllTree(store.dtsStore.infoTree)
    } else if (props.searchNode != 'none') {
      let filterNode = props.searchNode.split(',')
      realTreeData.value = buildFilterTree(store.dtsStore.infoTree, filterNode)
    }
  }
  console.log('图层树控件初始化', realTreeData.value)
}

// 全部树
const buildAllTree = (items: any) => {
  const lookup: any = {}
  const result: any = []
  // 第一步：创建查找表
  items.forEach((item: any) => {
    lookup[item['index']] = { ...item, children: [] }
    if (item?.visiblity) {
      checkedIds.value.push(item.iD)
    }
  })
  // 第二步：构建树
  items.forEach((item: any) => {
    if (item['parentIndex'] === null) {
      // 如果没有parentId，则是根节点
      result.push(lookup[item['index']])
    } else {
      // 否则，找到父节点并添加到其子节点列表中
      if (lookup[item['parentIndex']]) {
        lookup[item['parentIndex']].children.push(lookup[item['index']])
      } else {
        //游离的根节点
        result.push(lookup[item['index']])
      }
    }
  })

  return result
}

// 过滤树
const buildFilterTree = (items: any, filterNode: any) => {
  const lookup: any = {}
  const result: any = []
  // 第一步：创建查找表
  items.forEach((item: any) => {
    lookup[item['index']] = { ...item, children: [] }
    if (item?.visiblity) {
      checkedIds.value.push(item.iD)
    }
  })

  // 第二步：构建树
  items.forEach((item: any) => {
    // 将子节点追加到父节点上
    if (item['parentIndex'] && lookup[item['parentIndex']]) {
      lookup[item['parentIndex']].children.push(lookup[item['index']])
    }
    if (filterNode.indexOf(item['iD']) >= 0) {
      result.push(lookup[item['index']])
    }
  })

  return result
}

watch(
  store.dtsStore?.infoTree,
  (newVal) => {
    newVal?.length && initTree()
  },
  {
    immediate: true
  }
)

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
