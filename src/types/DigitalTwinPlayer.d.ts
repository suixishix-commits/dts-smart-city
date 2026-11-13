/*
 * @Author: dts
 * @Date: 2021-10-21 17:38:35
 * @LastEditTime: 2023-03-07
 * @LastEditors: zhouxq
 * @Description: 支持DTS 5.4.0228
 *
 */
declare let DigitalTwinPlayer: any
declare let $: any
declare let ue: any
declare let __xapi: any
declare let __xapi2: any

declare let HostConfig: {
  Manager: string
  Player: string
  options: { iid: string; pid: string }
  Path: string
  MatchServer: string
}

declare let Color: any
declare let BPFunctionData: any
declare let BPFuncParamType: any
declare let userInfo: any
declare let PolylineStyle: any
declare const AMap: any
declare const Polygon3DStyle: any

type CameraTourData = {
  id: string
  name: string
  keyFrames: Array
}