import webSocketData from "@routes/railway-digital-twin-system/mockData/webSocketData";

/**
 * WebSocket封装类
 */
export default class MockSocket {
  private url: string;
  private ws: WebSocket | null;
  private opts: any;
  private reconnectAttempts: number;
  private listeners: any;
  private heartbeatInterval: any;
  // mock数据
  private mockData = undefined
  private timerId = undefined

  constructor(url: string, opts = {}) {
    this.url = url;
    this.ws = null;
    this.opts = {
      heartbeatInterval: 30000, // 默认30秒
      reconnectInterval: 5000, // 默认5秒
      maxReconnectAttempts: 5, // 默认尝试重连5次
      ...opts,
    };
    this.reconnectAttempts = 0;
    this.listeners = {};
    this.init();
  }

  //初始化
  private init() {
    // 初始化Mock数据
    for (const url in webSocketData) {
      if (Object.prototype.hasOwnProperty.call(webSocketData, url)) {
        const element = webSocketData[url];
        if (url.includes(this.url)) {
          this.mockData = element
        }
      }
    }
    // console.log("初始化websocket...", webSocketData, this.mockData);
    if (this.mockData?.length > 0) {
      let i = 1
      this.emit('message', JSON.stringify(this.mockData[0]));
      console.log(`${new Date()}websocket mock数据：`, this.mockData)
      this.timerId = setInterval(() => {
        if (i < this.mockData.length) {
          this.emit('message', JSON.stringify(this.mockData[i]));
        } else {
          this.emit('message', JSON.stringify(this.mockData[0]));
          i = 0
        }
        i++
      }, 1000);
    }
  }

  private onOpen(event: any) {
    console.log('WebSocket opened:', event);
    this.reconnectAttempts = 0; // 重置重连次数
    //this.startHeartbeat();
    this.emit('open', event);
  }

  private onMessage(event: any) {
    //console.log('WebSocket message received:', event.data);
    this.emit('message', event.data);
  }

  private onError(event: any) {
    console.error('WebSocket error:', event);
    this.emit('error', event);
  }

  private onClose(event: any) {
    console.log('WebSocket closed:', event);
    this.stopHeartbeat();
    this.emit('close', event);
    if (this.reconnectAttempts < this.opts.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.init();
      }, this.opts.reconnectInterval);
    }
  }

  // 发送心跳
  startHeartbeat() {
    if (this.ws) {
      this.heartbeatInterval = setInterval(() => {
        if (this.ws!.readyState === WebSocket.OPEN) {
          this.ws!.send('ping'); // 可以修改为你的心跳消息格式
        }
      }, this.opts.heartbeatInterval);
    }
  }

  // 停止心跳
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(data: any) {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      } else {
        console.error('WebSocket is not open. Cannot send:', data);
      }
    }
  }

  on(event: any, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: any, callback: Function | undefined = undefined) {
    if (!this.listeners[event]) return;
    if (callback) {
      const index = this.listeners[event].indexOf(callback);
      if (index !== -1) {
        this.listeners[event].splice(index, 1);
      }
    } else {
      delete this.listeners[event];
    }
  }

  getState() {
    return this.ws?.readyState;
  }

  close() {
    if (this.ws) {
      //主动断开不重连
      this.opts.maxReconnectAttempts = -1;
    }
    if (this.timerId) {
      clearInterval(this.timerId)
    }
  }

  private emit(event: any, data: any) {
    if (event === 'message') {
      //内部消息
      if (data?.length > 0) {
        let msgObj = JSON.parse(data);
        if (msgObj?.type === 'onMessage' && msgObj?.subject?.length > 0) {
          let msgData = msgObj.data;
          let subEvent = msgObj.subject;
          if (this.listeners[subEvent]) {
            this.listeners[subEvent].forEach((callback: Function) => callback(msgData));
          }
        }
      }
      if (this.listeners['message']) {
        this.listeners['message'].forEach((callback: Function) => callback(data));
      }
    } else {
      if (this.listeners[event]) {
        this.listeners[event].forEach((callback: Function) => callback(data));
      }
    }
  }
}
