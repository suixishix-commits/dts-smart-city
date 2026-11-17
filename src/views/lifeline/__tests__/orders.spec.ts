import { describe, expect, it } from 'vitest'
import { buildLifelineData } from '@/api/mock/lifeline'
import type { GeoData } from '@/types/geo'
import geoJson from '../../../../public/data/smart-city/geo.json'
import { bridgeDetail, facilityDetail, findFacility } from '../details'
import { dispatchInspection, dispatchRepair, openOrderFor } from '../orders'

const data = buildLifelineData(geoJson as unknown as GeoData)
const alarm = (id: string) => data.alarms.find(a => a.id === id)!

describe('工单派发', () => {
  it('没有工单的告警：新建抢修工单放在最前，工单号顺延，预计完成取影响分析的恢复时间', () => {
    expect(openOrderFor(data.orders, 'a6')).toBeUndefined()
    const orders = dispatchRepair(data.orders, alarm('a6'))
    expect(orders).toHaveLength(data.orders.length + 1)
    expect(orders[0]).toMatchObject({ id: 'WO-1113-06', kind: 'repair', alarmId: 'a6', targetId: 'a6', title: alarm('a6').title, crew: '变电运维一班', eta: '17:00', progress: 5, status: '已派单' })
    expect(openOrderFor(orders, 'a6')).toBe(orders[0])
    // 原数组不被修改
    expect(openOrderFor(data.orders, 'a6')).toBeUndefined()
  })

  it('已有工单的告警：催办推进进度，不新建', () => {
    const before = openOrderFor(data.orders, 'a1')!
    const orders = dispatchRepair(data.orders, alarm('a1'))
    expect(orders).toHaveLength(data.orders.length)
    expect(openOrderFor(orders, 'a1')).toMatchObject({ id: before.id, progress: before.progress + 10, status: '已催办' })
  })

  it('催办最多推进到 95%', () => {
    let orders = data.orders
    for (let i = 0; i < 20; i++) orders = dispatchRepair(orders, alarm('a5'))
    expect(openOrderFor(orders, 'a5')?.progress).toBe(95)
  })

  it('没有影响分析的告警：预计完成取最后一个处置步骤的时间', () => {
    const orders = dispatchRepair(data.orders, alarm('b1'))
    expect(orders[0]).toMatchObject({ alarmId: 'b1', eta: '16:00' })
  })

  it('巡检工单：新建后再派发是催办', () => {
    const target = { id: 'maqta-bridge', name: '马克塔桥', crew: '桥梁养护组', eta: '16:30' }
    const first = dispatchInspection(data.orders, target)
    expect(first[0]).toMatchObject({ kind: 'inspect', targetId: 'maqta-bridge', title: '马克塔桥巡检', progress: 5, status: '待巡检' })
    expect(first[0].alarmId).toBeUndefined()
    const second = dispatchInspection(first, target)
    expect(second).toHaveLength(first.length)
    expect(second[0]).toMatchObject({ id: first[0].id, progress: 15, status: '已催办' })
  })
})

describe('详情卡片', () => {
  it('五类设施都能找到，带位置和巡检班组', () => {
    for (const x of [data.substations[1], data.gasStations[0], data.floodPoints[1], data.pumpStations[0], data.coolingPlants[0]]) {
      const f = findFacility(data, x.id)
      expect(f?.name).toBe(x.name)
      expect(f?.anchor).toEqual(x.anchor)
      expect(f?.crew).toBeTruthy()
      expect(f?.stats.length).toBeGreaterThanOrEqual(2)
    }
    expect(findFacility(data, '不存在')).toBeNull()
  })

  it('设施详情：两个按钮（派发巡检、定位到现场），有工单时变为催办并显示工单行', () => {
    const id = data.coolingPlants[0].id
    const d = facilityDetail(data, id)
    expect(d?.actions).toEqual([
      { key: 'inspect', label: '派发巡检' },
      { key: 'locate', label: '定位到现场' }
    ])
    expect(d?.tag?.text).toBe('供冷站 · 正常')
    const orders = dispatchInspection(data.orders, { id, name: data.coolingPlants[0].name, crew: '供冷运维班', eta: '16:30' })
    const withOrder = facilityDetail(data, id, openOrderFor(orders, id))
    expect(withOrder?.actions?.[0]).toEqual({ key: 'inspect', label: '催办巡检' })
    expect(withOrder?.rows.find(r => r.label === '巡检工单')?.value).toContain(orders[0].id)
    expect(facilityDetail(data, '不存在')).toBeNull()
  })

  it('桥梁详情：查看 / 收起监测曲线 + 派发巡检，列出在办告警', () => {
    const closed = bridgeDetail(data, 'mussafah-bridge', { trendOpen: false })
    expect(closed?.actions).toEqual([
      { key: 'trend', label: '查看监测曲线' },
      { key: 'inspect', label: '派发巡检' }
    ])
    expect(closed?.rows.find(r => r.label === '在办告警')?.value).toBe(alarm('b1').title)
    expect(bridgeDetail(data, 'mussafah-bridge', { trendOpen: true })?.actions?.[0].label).toBe('收起监测曲线')
    expect(bridgeDetail(data, '不存在', { trendOpen: false })).toBeNull()
  })
})
