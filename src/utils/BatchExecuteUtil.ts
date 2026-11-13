/** 失败批次详情 */
export interface BatchFailedDetail<T> {
  batchNum: number; // 批次号（从1开始）
  dataRange: [number, number]; // 数据索引范围 [start, end]
  error: string; // 错误信息
  batchData: T[]; // 该批次数据
}

/** 执行结果统计 */
export interface BatchExecuteResult<T> {
  totalData: number; // 总数据量
  batchSize: number; // 批次大小
  totalBatches: number; // 总批次
  successBatches: number; // 成功批次
  failedBatches: number; // 失败批次
  failedDetails: BatchFailedDetail<T>[]; // 失败详情
}

/**
 * 并发执行结果类型（兼容任意返回值）
 */
export interface ConcurrentBatchResult<T, R = any> {
  batchNum: number;       // 批次号
  dataRange: [number, number]; // 数据索引范围
  batchData: T[];         // 该批次数据
  success: boolean;       // 是否执行成功
  result?: R;             // 执行函数返回值（成功时）
  error?: string;         // 错误信息（失败时）
}

/**
 * 通用异步执行函数类型（支持任意返回值）
 */
export type AsyncBatchExecutor<T, R = any> = (batchData: T[]) => Promise<R>;

/** 同步批次执行函数类型 */
export type SyncBatchExecutor<T> = (batchData: T[]) => void;

/**
 * 通用分批次执行函数（同步版）
 * @param dataList 待处理的原始数据列表
 * @param batchSize 每批次处理的数据量（≥1）
 * @param executeFunc 单批次执行函数（同步）
 * @param interval 批次间执行间隔（毫秒），默认无间隔（同步间隔慎用）
 * @param ignoreError 是否忽略单批次异常（true=继续执行后续批次）
 * @returns 执行结果统计
 */
export async function batchExecuteSync<T>(
  dataList: T[],
  batchSize: number,
  executeFunc: SyncBatchExecutor<T>,
  interval: number = 0,
  ignoreError: boolean = true
): Promise<BatchExecuteResult<T>> {
  // 严格入参校验
  if (!Array.isArray(dataList)) {
    throw new TypeError('dataList 必须是数组类型');
  }
  if (typeof batchSize !== 'number' || batchSize < 1 || !Number.isInteger(batchSize)) {
    throw new Error('批次大小 batchSize 必须是≥1的整数');
  }
  if (typeof executeFunc !== 'function') {
    throw new TypeError('executeFunc 必须是可调用函数');
  }
  if (typeof interval !== 'number' || interval < 0) {
    throw new Error('间隔 interval 必须是≥0的数字');
  }

  // 初始化统计信息
  const totalCount = dataList.length;
  const totalBatches = Math.ceil(totalCount / batchSize);
  let successBatches = 0;
  let failedBatches = 0;
  const failedDetails: BatchFailedDetail<T>[] = [];

  //console.log(`[同步批次执行] 总数据量=${totalCount}，批次大小=${batchSize}，总批次=${totalBatches}`);

  // 拆分批次并执行
  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const startIdx = batchIdx * batchSize;
    const endIdx = Math.min((batchIdx + 1) * batchSize, totalCount);
    const batchData = dataList.slice(startIdx, endIdx);
    const batchNum = batchIdx + 1;

    try {
      //console.log(`\n${TimeUtil.parseDateTime()} [批次 ${batchNum}/${totalBatches}] 处理数据 [${startIdx}:${endIdx}]，数量=${batchData.length}`);
      // 执行当前批次的异步任务（如接口请求、批量写入）
      await executeFunc(batchData);
      successBatches++;
      console.log(`${TimeUtil.parseDateTime()} [批次 ${batchNum}] 执行成功${batchData.length} 条数据`);
    } catch (e) {
      failedBatches++;
      failedDetails.push({
        batchNum,
        dataRange: [startIdx, endIdx],
        error: e instanceof Error ? e.message : String(e),
        batchData
      });
      console.error(`[批次 ${batchNum}] 执行失败：`, e);
      if (!ignoreError) throw e; // 不忽略异常则终止全部执行
    }

    // 批次间隔：最后一批次无需等待，间隔真正生效（非阻塞）
    if (interval > 0 && batchNum < totalBatches) {
      //console.log(`${TimeUtil.parseDateTime()} [批次 ${batchNum}] 执行完成，等待 ${interval}ms 后执行下一批次...`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  const result: BatchExecuteResult<T> = {
    totalData: totalCount,
    batchSize,
    totalBatches,
    successBatches,
    failedBatches,
    failedDetails,
  };

  console.log('\n[同步批次执行完成]', result);
  return result;
}

/**
 * 并发分批次执行函数（修复类型错误，兼容任意返回值）
 * @param dataList 待处理数据
 * @param batchSize 批次大小
 * @param executeFunc 异步执行函数（可返回任意类型）
 * @param maxConcurrency 最大并发数（默认2）
 * @returns 所有批次的执行结果（含返回值/错误信息）
 */
export async function batchExecuteConcurrent<T, R = any>(
  dataList: T[],
  batchSize: number,
  executeFunc: AsyncBatchExecutor<T, R>,
  maxConcurrency: number = 2
): Promise<ConcurrentBatchResult<T, R>[]> {
  // 严格入参校验
  if (!Array.isArray(dataList)) throw new TypeError('dataList 必须是数组类型');
  if (typeof batchSize !== 'number' || batchSize < 1 || !Number.isInteger(batchSize)) {
    throw new Error('批次大小 batchSize 必须是≥1的整数');
  }
  if (typeof executeFunc !== 'function') throw new TypeError('executeFunc 必须是可调用函数');
  if (typeof maxConcurrency !== 'number' || maxConcurrency < 1 || !Number.isInteger(maxConcurrency)) {
    throw new Error('最大并发数 maxConcurrency 必须是≥1的整数');
  }

  // 拆分所有批次并记录批次信息
  const batches: {
    batchNum: number;
    dataRange: [number, number];
    batchData: T[];
  }[] = [];
  const totalBatches = Math.ceil(dataList.length / batchSize);

  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const end = Math.min((i + 1) * batchSize, dataList.length);
    batches.push({
      batchNum: i + 1,
      dataRange: [start, end],
      batchData: dataList.slice(start, end)
    });
  }

  // 控制并发执行核心逻辑
  const results: ConcurrentBatchResult<T, R>[] = [];
  const executing: Promise<void>[] = [];

  for (const batch of batches) {
    // 执行当前批次，捕获结果/异常，兼容任意返回值
    const p = executeFunc(batch.batchData)
      .then((result) => {
        // 成功：记录返回值
        results.push({
          batchNum: batch.batchNum,
          dataRange: batch.dataRange,
          batchData: batch.batchData,
          success: true,
          result
        });
      })
      .catch((e) => {
        // 失败：记录错误信息
        results.push({
          batchNum: batch.batchNum,
          dataRange: batch.dataRange,
          batchData: batch.batchData,
          success: false,
          error: e instanceof Error ? e.message : String(e)
        });
      });

    executing.push(p);

    // 控制并发数：达到最大值时，等待任一批次完成
    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      // 移除已完成的批次（避免内存泄漏）
      executing.splice(executing.findIndex(item => item === p), 1);
    }
  }

  // 等待剩余所有批次完成
  await Promise.allSettled(executing);

  // 按批次号排序返回（保证结果顺序与执行顺序一致）
  return results.sort((a, b) => a.batchNum - b.batchNum);
}