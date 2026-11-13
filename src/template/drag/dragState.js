// 用于跨组件共享拖拽状态
export const dragState = {
    draggingItem: null,
    fromList: null,
    setDragging(item, listId) {
        this.draggingItem = item;
        this.fromList = listId;
    },
    clear() {
        this.draggingItem = null;
        this.fromList = null;
    }
};