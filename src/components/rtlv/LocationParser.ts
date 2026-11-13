
export default class LocationParser {
  option: any 
  constructor(option:any) {
    this.option=option
  }

  //播放
	public async play() {		
	}	

	//停止
	public async stop() {		
	}

  /**
   * 暂停
   */
  public async pause() {    
	}

  //恢复
	public async resume() {    
	}

  /**
   * 获取移动对象的最新数据
   * @param moId 移动对象ID
   */
  public getLastData(moId:any){

  }
}