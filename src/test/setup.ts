// jsdom 没有 canvas：getContext 直接返回 null（场景标注据此退回文字标注），免得 jsdom 每次打印 Not implemented
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
