import { describe, expect, it, vi } from 'vitest'

const drawLabel = vi.fn(() => ({ url: 'data:image/png;base64,AAAA', size: [120, 90] as [number, number], anchor: [-60, 80] as [number, number] }))
vi.mock('../labelImage', () => ({ drawLabel, peekLabel: () => null }))

const { pin, COLOR } = await import('../kit')

describe('pin with a drawn label', () => {
  it('shows the drawn image anchored at its ground dot, without DTS text or lead line', () => {
    const p = pin({ id: 'p1', groupId: 'sc_x', at: [1, 2], text: '两车刮蹭', tag: '事故', color: COLOR.warn, lineHeight: 56, priority: 10 })
    expect(drawLabel).toHaveBeenCalledWith({ text: '两车刮蹭', color: COLOR.warn, tag: '事故', value: undefined, lead: 56, fontSize: undefined, emphasis: true })
    expect(p).toMatchObject({ text: '', imagePath: 'data:image/png;base64,AAAA', imageSize: [120, 90], anchors: [-60, 80], showLine: false, displayMode: 2, priority: 10 })
    // 悬停图还没画过：先用普通图，空闲时再补
    expect(p.hoverImagePath).toBe('data:image/png;base64,AAAA')
    expect(JSON.parse(p.userData)).toEqual({ id: 'p1' })
  })
})
