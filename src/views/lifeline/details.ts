import { bridgeStatus } from '@/api/mock/lifeline'
import { STATUS_RAMP } from '@/scene/kit'
import type { DetailModel } from '@/types/detail'
import type { Anchor, FacilityStatus, LifelineData, WorkOrder } from '@/types/lifeline'

const STATUS_TEXT = ['正常', '关注', '预警', '异常']

/** 设施（变电站、调压站、易涝点、泵站、供冷站）的统一描述 */
export interface FacilityInfo {
  id: string
  /** 类别名，如 变电站 */
  kind: string
  name: string
  anchor: Anchor
  location: string
  status: FacilityStatus
  /** 巡检班组 */
  crew: string
  stats: NonNullable<DetailModel['stats']>
}

/** 按业务 id 找设施；找不到返回 null */
export function findFacility(data: LifelineData, id: string): FacilityInfo | null {
  const base = <T extends { id: string; name: string; anchor: Anchor; location: string; status: FacilityStatus }>(x: T, kind: string, crew: string) => ({
    id: x.id,
    kind,
    name: x.name,
    anchor: x.anchor,
    location: x.location,
    status: x.status,
    crew
  })
  const color = (status: FacilityStatus) => (status ? STATUS_RAMP[status] : undefined)
  const sub = data.substations.find(s => s.id === id)
  if (sub)
    return {
      ...base(sub, '变电站', '变电运维班'),
      stats: [
        { label: '负荷率', value: sub.loadPercent, unit: '%', color: color(sub.status) },
        { label: '主变容量', value: sub.capacityMva, unit: 'MVA' },
        { label: '有功功率', value: Math.round((sub.capacityMva * sub.loadPercent) / 100), unit: 'MW' }
      ]
    }
  const gas = data.gasStations.find(g => g.id === id)
  if (gas)
    return {
      ...base(gas, '调压站', '燃气运维班'),
      stats: [
        { label: '进口压力', value: gas.inletKpa, unit: 'kPa' },
        { label: '出口压力', value: gas.outletKpa, unit: 'kPa', color: color(gas.status) }
      ]
    }
  const flood = data.floodPoints.find(f => f.id === id)
  if (flood)
    return {
      ...base(flood, '易涝点', '排水巡查组'),
      stats: [
        { label: '积水深度', value: flood.depthCm, unit: 'cm', color: color(flood.status) },
        { label: '监测半径', value: flood.radius, unit: 'm' }
      ]
    }
  const pump = data.pumpStations.find(p => p.id === id)
  if (pump)
    return {
      ...base(pump, '泵站', '排水机电班'),
      stats: [
        { label: '运行水泵', value: `${pump.running}/${pump.total}`, unit: '台', color: color(pump.status) },
        { label: '抽排量', value: pump.flow.toLocaleString(), unit: 'm³/h' }
      ]
    }
  const plant = data.coolingPlants.find(c => c.id === id)
  if (plant)
    return {
      ...base(plant, '供冷站', '供冷运维班'),
      stats: [
        { label: '负荷率', value: plant.loadPercent, unit: '%', color: color(plant.status) },
        { label: '装机冷量', value: plant.capacityRt.toLocaleString(), unit: 'RT' },
        { label: '供 / 回水', value: `${plant.supplyTemp}/${plant.returnTemp}`, unit: '℃' }
      ]
    }
  return null
}

function orderRow(order: WorkOrder | undefined): { label: string; value: string }[] {
  return order ? [{ label: '巡检工单', value: `${order.id} · ${order.crew} · ${order.status} ${order.progress}%` }] : []
}

/** 设施的详情卡片：指标 + 位置 + 巡检工单，按钮为「派发巡检 / 催办巡检」和「定位到现场」 */
export function facilityDetail(data: LifelineData, id: string, order?: WorkOrder): DetailModel | null {
  const f = findFacility(data, id)
  if (!f) return null
  return {
    tag: { text: `${f.kind} · ${STATUS_TEXT[f.status]}`, color: STATUS_RAMP[f.status] },
    title: f.name,
    stats: f.stats,
    rows: [{ label: '位置', value: f.location }, { label: '在办告警', value: data.alarms.filter(a => a.facilityId === id).map(a => a.title).join('、') || '无' }, ...orderRow(order)],
    actions: [
      { key: 'inspect', label: order ? '催办巡检' : '派发巡检' },
      { key: 'locate', label: '定位到现场' }
    ]
  }
}

/** 桥梁的详情卡片：按钮为「查看 / 收起监测曲线」和「派发巡检 / 催办巡检」 */
export function bridgeDetail(data: LifelineData, id: string, opts: { order?: WorkOrder; trendOpen: boolean }): DetailModel | null {
  const bridge = data.bridges.find(b => b.id === id)
  if (!bridge) return null
  const status = bridgeStatus(bridge.score)
  return {
    tag: { text: bridge.grade, color: STATUS_RAMP[status] },
    title: bridge.name,
    stats: [
      { label: '健康评分', value: bridge.score, color: status ? STATUS_RAMP[status] : undefined },
      { label: '在线传感器', value: bridge.sensors, unit: '个' },
      { label: '建成年份', value: bridge.builtYear }
    ],
    rows: [
      { label: '最近检测', value: bridge.lastInspect },
      { label: '在办告警', value: data.alarms.filter(a => a.facilityId === bridge.id).map(a => a.title).join('、') || '无' },
      ...orderRow(opts.order)
    ],
    actions: [
      { key: 'trend', label: opts.trendOpen ? '收起监测曲线' : '查看监测曲线' },
      { key: 'inspect', label: opts.order ? '催办巡检' : '派发巡检' }
    ]
  }
}
