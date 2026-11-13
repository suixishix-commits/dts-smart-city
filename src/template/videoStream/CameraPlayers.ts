import moment from 'moment';

// 声明全局的 window 对象，使其可以存储任意类型的属性
declare global {
    interface Window {
        [key: string]: any;
    }
}

/**
 * CameraPlayers 管理摄像头播放器的各种操作
 */
class CameraPlayers {
    player: any;
    muted: any = true;

    constructor() {}

    // 初始化播放器，设置播放容器的宽高并监听窗口大小变化
    init = () => {
        window.addEventListener('resize', () => {
            this.player.JS_Resize();
        });
    };

    // 创建播放器实例，并绑定各种事件回调
    createPlayer = (playersContainer: any) => {
        this.player = playersContainer;
        console.log('createPlayer', this.player);
        this.init();
        // 事件回调绑定
        this.player.JS_SetWindowControlCallback({
            windowEventSelect: (iWndIndex: any) => {  // 插件选中窗口回调
                console.log('windowSelect callback: ', iWndIndex);
            },
            pluginErrorHandler: (iWndIndex: any, iErrorCode: any, oError: any) => {  // 插件错误回调
                console.log('pluginError callback: ', iWndIndex, iErrorCode, oError);
            },
            windowEventOver: (iWndIndex: any) => {  // 鼠标移过回调
                // console.log(iWndIndex);
            },
            windowEventOut: (iWndIndex: any) => {  // 鼠标移出回调
                // console.log(iWndIndex);
            },
            windowEventUp: (iWndIndex: any) => {  // 鼠标 mouseup 事件回调
                // console.log(iWndIndex);
            },
            windowFullCcreenChange: (bFull: any) => {  // 全屏切换回调
                console.log('fullScreen callback: ', bFull);
            },
            firstFrameDisplay: (iWndIndex: any, iWidth: any, iHeight: any) => {  // 首帧显示回调
                console.log('firstFrame loaded callback: ', iWndIndex, iWidth, iHeight);
            },
            performanceLack: () => {  // 性能不足回调
                console.log('performanceLack callback: ');
            },
        });
    };

    // 安排窗口布局
    arrangeWindow = (splitNum: any) => {
        this.player.JS_ArrangeWindow(splitNum).then(
            () => {
                console.log(`arrangeWindow to ${splitNum}x${splitNum} success`);
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 开启全屏显示
    wholeFullScreen = () => {
        this.player.JS_FullScreenDisplay(true).then(
            () => {
                console.log(`wholeFullScreen success`);
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    /* 预览&对讲 */
    // 开始实时预览或对讲
    realplay = (mode: any, urls: any) => {
        const index = this.player.currentWindowIndex;
        const playURL = urls.realplay;
        this.player.JS_Play(playURL, { playURL, mode }, index).then(
            () => {
                console.log('realplay success',playURL);
            },
            (e: any) => {
                console.error(e,playURL);
            }
        );
    };

    // 停止播放
    stopPlay = (playback: any) => {
        this.player.JS_Stop().then(
            () => {
                playback.rate = 0;
                console.log('stop realplay success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 开始对讲
    talkStart = (urls: any) => {
        let url = urls.talk;
        this.player.JS_SetConnectTimeOut(0, 1000);
        this.player.JS_StartTalk(url).then(
            () => {
                console.log('talkStart success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 停止对讲
    talkStop = () => {
        this.player.JS_StopTalk().then(
            () => {
                console.log('talkStop success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 停止所有播放
    stopAllPlay = (playback: any) => {
        this.player.JS_StopRealPlayAll().then(
            () => {
                playback.rate = 0;
                console.log('stopAllPlay success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    /* 回放 */
    // 开始回放
    playbackStart = (mode: any, urls: any, playback: any) => {
        const index = this.player.currentWindowIndex;
        const playURL = urls.playback;
        let { startTime, endTime } = playback;
        startTime += 'Z';
        endTime += 'Z';
        this.player.JS_Play(playURL, { playURL, mode }, index, startTime, endTime).then(
            () => {
                console.log('playbackStart success');
                playback.rate = 1;
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 暂停回放
    playbackPause = () => {
        this.player.JS_Pause().then(
            () => {
                console.log('playbackPause success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 恢复回放
    playbackResume = () => {
        this.player.JS_Resume().then(
            () => {
                console.log('playbackResume success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 跳转到指定时间点
    seekTo = (playback: any) => {
        let { seekStart, endTime } = playback;
        seekStart += 'Z';
        endTime += 'Z';
        this.player.JS_Seek(this.player.currentWindowIndex, seekStart, endTime).then(
            () => {
                console.log('seekTo success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 慢放回放
    playbackSlow = (playback: any) => {
        this.player.JS_Slow().then(
            (rate: any) => {
                playback.rate = rate;
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 快放回放
    playbackFast = (playback: any) => {
        this.player.JS_Fast().then(
            (rate: any) => {
                playback.rate = rate;
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 单帧前进
    frameForward = (playback: any) => {
        this.player.JS_FrameForward(this.player.currentWindowIndex).then(
            () => {
                playback.rate = 1;
                console.log('frameForward success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    /* 声音、抓图、录像 */
    // 打开声音
    openSound = async () => {
        await this.player.JS_OpenSound().then(
            () => {
                console.log('openSound success');
                this.muted = false;
            },
            (e: any) => {
                console.error(e);
            }
        );
        return false;
    };

    // 关闭声音
    closeSound =async () => {
        await this.player.JS_CloseSound().then(
            () => {
                console.log('closeSound success');
                this.muted = true;
            },
            (e: any) => {
                console.error(e);
            }
        );
        return true;
    };

    // 设置音量
    setVolume = (value: any) => {
        const index = this.player.currentWindowIndex;
        this.player.JS_SetVolume(index, value).then(
            () => {
                console.log('setVolume success', value);
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 抓图
    capture = (imageType: any) => {
        const index = this.player.currentWindowIndex;
        this.player.JS_CapturePicture(index, 'img', imageType).then(
            () => {
                console.log('capture success', imageType);
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 开始录像
    recordStart = (type: string) => {
        const codeMap: { [key: string]: number } = { MP4: 5, PS: 2 };
        const index = this.player.currentWindowIndex;
        const fileName = `${moment().format('YYYYMMDDHHmm')}.mp4`;
        const typeCode: number = codeMap[type];

        this.player.JS_StartSaveEx(index, fileName, typeCode).then(
            () => {
                console.log('record start ...');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 停止录像
    recordStop = () => {
        const index = this.player.currentWindowIndex;
        this.player.JS_StopSave(index).then(
            () => {
                console.log('record stoped, saving ...');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    /* 电子放大、智能信息 */
    // 开启电子放大功能
    enlarge = () => {
        const index = this.player.currentWindowIndex;
        this.player.JS_EnableZoom(index).then(
            () => {
                console.log('enlarge start..., select range...');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 关闭电子放大功能
    enlargeClose = () => {
        const index = this.player.currentWindowIndex;
        this.player.JS_DisableZoom(index).then(
            () => {
                console.log('enlargeClose success');
            },
            (e: any) => {
                console.error(e);
            }
        );
    };

    // 触发智能信息显示或关闭
    intellectTrigger = (openFlag: any) => {
        const index = this.player.currentWindowIndex;
        const result = this.player.JS_RenderALLPrivateData(index, openFlag);
        console.log(`${openFlag ? 'open' : 'close'} intellect ${result === 1 ? 'success' : 'failed'}`);
    };

    // 获取视频信息
    getvideoInfo = () => {
        const index = this.player.currentWindowIndex;
        this.player.JS_GetVideoInfo(index).then((videoInfo: any) => {
            console.log("videoInfo:", videoInfo);
        });
    };

    // 获取 OSD 时间
    getOSDTime = () => {
        const index = this.player.currentWindowIndex;
        this.player.JS_GetOSDTime(index).then((time: any) => {
            console.log("osdTime:", new Date(time));
        });
    };
}

export default CameraPlayers;