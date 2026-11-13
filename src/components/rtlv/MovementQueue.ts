/**
 * 3D坐标移动队列管理器
 * 确保多次移动操作按顺序执行
 */
export default class MovementQueue {
  // 移动队列
  private queue: Array<any>;
  // 是否正在执行移动
  private isMoving: boolean;
  // 当前位置
  private currentPosition: Array<number>;
  private currentStopFunction:any;
  constructor() {
    // 移动队列
    this.queue = [];
    // 是否正在执行移动
    this.isMoving = false;
    // 当前位置
    this.currentPosition = [0, 0, 0];
  }

  /**
   * 设置当前位置
   * @param {Array} position - [x, y, z] 坐标
   */
  setCurrentPosition(position) {
    if (!Array.isArray(position) || position.length !== 3) {
      throw new Error('位置必须是包含3个元素的数组 [x, y, z]');
    }
    this.currentPosition = [...position];
  }

  /**
   * 添加移动任务到队列
   * @param {Array} targetPos - 目标坐标 [x, y, z]
   * @param {number} moveDistance - 每次移动的距离（米）
   * @param {number} interval - 移动间隔时间（秒）
   * @param {Function} onUpdate - 每次位置更新后的回调函数
   * @param {Function} onComplete - 单个移动任务完成后的回调函数
   */
  addMovement(targetPos, moveDistance, interval, onUpdate, onComplete) {
    // 验证输入
    if (!Array.isArray(targetPos) || targetPos.length !== 3) {
      throw new Error('目标坐标必须是包含3个元素的数组 [x, y, z]');
    }

    if (typeof moveDistance !== 'number' || moveDistance <= 0) {
      throw new Error('每次移动距离必须是正数');
    }

    if (typeof interval !== 'number' || interval <= 0) {
      throw new Error('移动间隔时间必须是正数');
    }

    // 将移动任务添加到队列
    this.queue.push({
      targetPos,
      moveDistance,
      interval,
      onUpdate: onUpdate || (() => {}),
      onComplete: onComplete || (() => {})
    });

    // 如果当前没有在移动，开始执行队列
    if (!this.isMoving) {
      this.processNextMovement();
    }
  }

  /**
   * 处理队列中的下一个移动任务
   */
  processNextMovement() {
    // 如果队列为空，结束处理
    if (this.queue.length === 0) {
      this.isMoving = false;
      return;
    }

    // 标记为正在移动
    this.isMoving = true;

    // 获取队列中的第一个任务
    const movement = this.queue.shift();
    const { targetPos, moveDistance, interval, onUpdate, onComplete } = movement;

    // 执行移动
    const stopMovement = this.moveToTarget(
      this.currentPosition,
      targetPos,
      moveDistance,
      interval,
      (newPos) => {
        // 更新当前位置
        this.currentPosition = newPos;
        // 调用更新回调
        onUpdate(newPos);
      },
      (finalPos) => {
        // 更新最终位置
        this.currentPosition = finalPos;
        // 调用完成回调
        onComplete(finalPos);
        // 处理下一个移动任务
        this.processNextMovement();
      }
    );

    // 存储当前移动的停止函数，以便可以随时中断
    this.currentStopFunction = stopMovement;
  }

  /**
   * 移动到目标位置的实现
   * @param {Array} currentPos - 当前坐标
   * @param {Array} targetPos - 目标坐标
   * @param {number} moveDistance - 每次移动距离
   * @param {number} interval - 移动间隔
   * @param {Function} onUpdate - 更新回调
   * @param {Function} onComplete - 完成回调
   * @returns {Function} 停止移动的函数
   */
  moveToTarget(currentPos, targetPos, moveDistance, interval, onUpdate, onComplete) {
    // 计算坐标差值
    const deltaX = targetPos[0] - currentPos[0];
    const deltaY = targetPos[1] - currentPos[1];
    const deltaZ = targetPos[2] - currentPos[2];

    // 计算总距离
    const totalDistance = Math.sqrt(deltaX **2 + deltaY** 2 + deltaZ ** 2);

    // 如果总距离为0，直接完成
    if (totalDistance === 0) {
      onUpdate([...currentPos]);
      onComplete(currentPos);
      return () => {};
    }

    // 归一化方向向量
    const dirX = deltaX / totalDistance;
    const dirY = deltaY / totalDistance;
    const dirZ = deltaZ / totalDistance;

    // 当前位置
    let position = [...currentPos];
    let intervalId;

    // 移动一步
    function moveStep() {
      // 计算剩余距离
      const remainingDistance = Math.sqrt(
        (targetPos[0] - position[0]) **2 +
        (targetPos[1] - position[1])** 2 +
        (targetPos[2] - position[2]) ** 2
      );

      // 如果剩余距离小于等于步长，直接移动到目标位置
      if (remainingDistance <= moveDistance) {
        position = [...targetPos];
        onUpdate([...position]);
        clearInterval(intervalId);
        onComplete(position);
        return;
      }

      // 否则按步长移动
      position[0] += dirX * moveDistance;
      position[1] += dirY * moveDistance;
      position[2] += dirZ * moveDistance;

      onUpdate([...position]);
    }

    // 开始移动（转换为毫秒）
    intervalId = setInterval(moveStep, interval * 1000);

    // 立即执行第一步
    moveStep();

    // 返回停止移动的函数
    return function stopMovement() {
      clearInterval(intervalId);
      console.log('当前移动已停止');
    };
  }

  /**
   * 停止当前移动并清空队列
   */
  stopAllMovements() {
    if (this.currentStopFunction) {
      this.currentStopFunction();
    }
    this.queue = [];
    this.isMoving = false;
    console.log('所有移动已停止，队列已清空');
  }

  /**
   * 查看当前队列中的任务数量
   * @returns {number} 任务数量
   */
  getQueueLength() {
    return this.queue.length;
  }
}

// 使用示例
// // 创建移动队列实例
// const movementQueue = new MovementQueue();
//
// // 设置初始位置
// movementQueue.setCurrentPosition([0, 0, 0]);
//
// // 添加第一个移动任务
// movementQueue.addMovement(
//     [10, 5, 3],    // 目标坐标
//     0.5,           // 每次移动0.5米
//     1,             // 每1秒移动一次
//     (pos) => {     // 更新回调
//         console.log('第一个任务当前位置:', pos);
//     },
//     (pos) => {     // 完成回调
//         console.log('第一个任务完成，到达:', pos);
//     }
// );
//
// // 添加第二个移动任务（会在第一个完成后执行）
// movementQueue.addMovement(
//     [15, 8, 2],    // 目标坐标
//     0.3,           // 每次移动0.3米
//     0.5,           // 每0.5秒移动一次
//     (pos) => {     // 更新回调
//         console.log('第二个任务当前位置:', pos);
//     },
//     (pos) => {     // 完成回调
//         console.log('第二个任务完成，到达:', pos);
//     }
// );
//
// // 添加更多移动任务...
//
// // 如需停止所有移动：
// // movementQueue.stopAllMovements();
