import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildEnvironmentData } from '@/api/mock/environment'
import { COLOR, LEVEL_COLOR } from '@/scene/kit'
import type { GeoData } from '@/types/geo'
import { nextStatus, sourceDetail, waterDetail } from '../details'
import { WATER_COLORS } from '../EnvironmentScene'

const geo: GeoData = JSON.parse(readFileSync('public/data/smart-city/geo.json', 'utf-8'))
const data = buildEnvironmentData(geo)

describe('处置状态流转', () => {
  it('待处置 → 派发核查 → 核查中 → 标记办结 → 已办结；其它操作不改状态', () => {
    expect(nextStatus('待处置', 'dispatch')).toBe('核查中')
    expect(nextStatus('核查中', 'close')).toBe('已办结')
    expect(nextStatus('待处置', 'close')).toBe('待处置')
    expect(nextStatus('已办结', 'dispatch')).toBe('已办结')
    expect(nextStatus('核查中', 'locate')).toBe('核查中')
  })
})

describe('污染源详情', () => {
  const source = data.sources.find(s => s.id === 'src-fume-hamdan')!

  it('标签用告警等级色，行里有处置进度和状态', () => {
    const d = sourceDetail(source, '待处置')
    expect(d.tag).toEqual({ text: '三级', color: LEVEL_COLOR[3] })
    expect(d.title).toBe(source.name)
    expect(d.rows.find(r => r.label === '处置状态')?.value).toBe('待处置')
    expect(d.camera).toBeUndefined()
  })

  it('按状态给操作：待处置可派发核查，核查中可办结，已办结只剩定位；最多两个', () => {
    expect(sourceDetail(source, '待处置').actions).toEqual([{ key: 'dispatch', label: '派发核查' }, { key: 'locate', label: '定位污染源' }])
    expect(sourceDetail(source, '核查中').actions?.map(a => a.key)).toEqual(['close', 'locate'])
    expect(sourceDetail(source, '已办结').actions).toEqual([{ key: 'locate', label: '定位污染源' }])
  })
})

describe('水质采样点详情', () => {
  it('达标点：三个指标不标暖色，只有定位操作', () => {
    const w = data.waterSamples.find(x => x.grade === 1)!
    const d = waterDetail(w, null)
    expect(d.tag).toEqual({ text: '一类', color: WATER_COLORS[1] })
    expect(d.stats?.map(s => s.label)).toEqual(['溶解氧', '无机氮', '活性磷酸盐'])
    d.stats?.forEach(s => expect(s.color).toBeUndefined())
    expect(d.actions).toEqual([{ key: 'locate', label: '定位采样点' }])
  })

  it('超标点：超标指标标暖色，带处置状态和派发复测', () => {
    const w = data.waterSamples.find(x => x.grade === 4)!
    const d = waterDetail(w, '待处置')
    expect(d.stats?.find(s => s.label === '无机氮')?.color).toBe(COLOR.warn)
    expect(d.rows.find(r => r.label === '处置状态')?.value).toBe('待处置')
    expect(d.rows[0].value).toContain('超二类标准')
    expect(d.actions?.[0]).toEqual({ key: 'dispatch', label: '派发复测' })
    expect(waterDetail(w, '核查中').actions?.[0].key).toBe('close')
  })
})
