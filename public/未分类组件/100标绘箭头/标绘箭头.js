

/**
 * 根据两点绘制标准箭头(两点式)
 * @param {*} endPoint 终点
 * @param {*} startPoint  起点
 * @param {*} outAngle 外角度 0 - 180
 * @param {*} inAngle 内角度 0 - 180
 * @param {*} inAngle 内角度 0 - 180
 * @param {*} ratio 箭头长度占比
 * @param {*} concave 缩进比例
 * @returns 
 */
function arrow1(endPoint, startPoint, outAngle = 60, inAngle = 40, Angle = 10, ratio = 0.2, concave = 0.15) {
    let r = Math.sqrt(Math.pow(endPoint[0] - startPoint[0], 2) + Math.pow(endPoint[1] - startPoint[1], 2) + Math.pow(endPoint[2] - startPoint[2], 2));
    let r2 = r * ratio;
    let r3 = r * concave;

    //计算与X轴夹角 并偏移pn(0-360)（三角）
    let pn = 90;//默认0°
    let sAnale = Math.atan2((endPoint[1] - startPoint[1]), (endPoint[0] - startPoint[0]));
    sAnale -= Math.PI * 90 / 180;

    let [x, y, z] = startPoint;
    let points = [startPoint];
    //外1左
    let angle = Math.PI + sAnale - Math.PI * outAngle / 360;
    points.push([x + r2 * Math.sin(angle), y - r2 * Math.cos(angle), z]);

    //外2左
    angle = Math.PI + sAnale - Math.PI * inAngle / 360;
    points.push([x + r3 * Math.sin(angle), y - r3 * Math.cos(angle), z]);

    //外3左
    angle = Math.PI + sAnale - Math.PI * Angle / 360;
    points.push([x + r * Math.sin(angle), y - r * Math.cos(angle), z]);

    //外3右
    angle = Math.PI + sAnale + Math.PI * Angle / 360;
    points.push([x + r * Math.sin(angle), y - r * Math.cos(angle), z]);


    //外2右
    angle = Math.PI + sAnale + Math.PI * inAngle / 360;
    points.push([x + r3 * Math.sin(angle), y - r3 * Math.cos(angle), z]);

    //外1右
    angle = Math.PI + sAnale + Math.PI * outAngle / 360;
    points.push([x + r2 * Math.sin(angle), y - r2 * Math.cos(angle), z]);

    // points.push(startPoint);
    return points;
}

/**
 * 根据两点绘制标准箭头(某段箭头形式)(两点式)
 * @param {*} endPoint 终点
 * @param {*} startPoint  起点
 * @param {*} outAngle 外角度 0 - 180
 * @param {*} inAngle 内角度 0 - 180
 * @param {*} inAngle 内角度 0 - 180
 * @param {*} ratio 箭头长度占比
 * @param {*} concave 缩进比例
 * @param {*} endConcave 末端缩进比例
 * @returns 
 */
function arrow2(endPoint, startPoint, outAngle = 60, inAngle = 40, Angle = 10, ratio = 0.2, concave = 0.15, endConcave = 0.05) {
    let r = Math.sqrt(Math.pow(endPoint[0] - startPoint[0], 2) + Math.pow(endPoint[1] - startPoint[1], 2) + Math.pow(endPoint[2] - startPoint[2], 2));
    let r2 = r * ratio;
    let r3 = r * concave;
    let r4 = r * (1 - endConcave);

    //计算与X轴夹角 并偏移pn(0-360)（三角）
    let pn = 90;//默认0°
    let sAnale = Math.atan2((endPoint[1] - startPoint[1]), (endPoint[0] - startPoint[0]));
    sAnale -= Math.PI * 90 / 180;

    let [x, y, z] = startPoint;
    let points = [startPoint];
    //外1左
    let angle = Math.PI + sAnale - Math.PI * outAngle / 360;
    points.push([x + r2 * Math.sin(angle), y - r2 * Math.cos(angle), z]);

    //外2左
    angle = Math.PI + sAnale - Math.PI * inAngle / 360;
    points.push([x + r3 * Math.sin(angle), y - r3 * Math.cos(angle), z]);

    //外3左
    angle = Math.PI + sAnale - Math.PI * Angle / 360;
    points.push([x + r * Math.sin(angle), y - r * Math.cos(angle), z]);

    //中末端点
    angle = Math.PI + sAnale;
    points.push([x + r4 * Math.sin(angle), y - r4 * Math.cos(angle), z]);

    //外3右
    angle = Math.PI + sAnale + Math.PI * Angle / 360;
    points.push([x + r * Math.sin(angle), y - r * Math.cos(angle), z]);


    //外2右
    angle = Math.PI + sAnale + Math.PI * inAngle / 360;
    points.push([x + r3 * Math.sin(angle), y - r3 * Math.cos(angle), z]);

    //外1右
    angle = Math.PI + sAnale + Math.PI * outAngle / 360;
    points.push([x + r2 * Math.sin(angle), y - r2 * Math.cos(angle), z]);

    return points;
}


/**
 * 根据两点绘制标准箭头(二次贝塞尔曲线)(三点式)
 * @param {*} endPoint 终点
 * @param {*} startPoint  起点
 * @param {*} outAngle 外角度 0 - 180
 * @param {*} inAngle 内角度 0 - 180
 * @param {*} inAngle 内角度 0 - 180
 * @param {*} ratio 箭头长度占比
 * @param {*} concave 缩进比例
 * @param {*} endConcave 末端缩进比例
 * @returns 
 */
function arrow3(endPoint, startPoint, centerPoint, outAngle = 60, inAngle = 40, Angle = 10, ratio = 0.2, concave = 0.15, endConcave = 0.05) {
    let r11 = Math.sqrt(Math.pow(centerPoint[0] - startPoint[0], 2) + Math.pow(centerPoint[1] - startPoint[1], 2) + Math.pow(centerPoint[2] - startPoint[2], 2));
    let r22 = Math.sqrt(Math.pow(endPoint[0] - centerPoint[0], 2) + Math.pow(endPoint[1] - centerPoint[1], 2) + Math.pow(endPoint[2] - centerPoint[2], 2));
    let r2 = r11 * ratio;
    let r3 = r11 * concave;
    let r4 = r22 * (1 - endConcave);

    //计算与X轴夹角 并偏移pn(0-360)（三角）
    let pn = 90;//默认0°
    let sAnale = Math.atan2((endPoint[1] - startPoint[1]), (endPoint[0] - startPoint[0]));
    sAnale -= Math.PI * 90 / 180;

    let sAnale1 = Math.atan2((centerPoint[1] - startPoint[1]), (centerPoint[0] - startPoint[0]));
    sAnale1 -= Math.PI * 90 / 180;

    let sAnale2 = Math.atan2((endPoint[1] - centerPoint[1]), (endPoint[0] - centerPoint[0]));
    sAnale2 -= Math.PI * 90 / 180;

    let [x, y, z] = startPoint;
    let [x2, y2, z2] = centerPoint;
    let points = [startPoint];
    //外1左
    let angle = Math.PI + sAnale1 - Math.PI * outAngle / 360;
    points.push([x + r2 * Math.sin(angle), y - r2 * Math.cos(angle), z]);

    //外2左
    angle = Math.PI + sAnale1 - Math.PI * inAngle / 360;
    let _l2 = [x + r3 * Math.sin(angle), y - r3 * Math.cos(angle), z];

    //外3左
    angle = Math.PI + sAnale2 - Math.PI * Angle / 360;
    let _l3 = [x2 + r22 * Math.sin(angle), y2 - r22 * Math.cos(angle), z2];
    points.push(...getBS2Coors(_l2, centerPoint, _l3));

    //中末端点
    angle = Math.PI + sAnale2;
    points.push([x2 + r4 * Math.sin(angle), y2 - r4 * Math.cos(angle), z2]);

    //外3右
    angle = Math.PI + sAnale2 + Math.PI * Angle / 360;
    let _r3 = [x2 + r22 * Math.sin(angle), y2 - r22 * Math.cos(angle), z2];

    //外2右
    angle = Math.PI + sAnale1 + Math.PI * inAngle / 360;
    let _r2 = [x + r3 * Math.sin(angle), y - r3 * Math.cos(angle), z];
    points.push(...getBS2Coors(_r2, centerPoint, _r3).reverse());

    //外1右
    angle = Math.PI + sAnale1 + Math.PI * outAngle / 360;
    points.push([x + r2 * Math.sin(angle), y - r2 * Math.cos(angle), z]);

    // points.push(startPoint);
    return points;
}

/**
 * 根据两点绘制标准箭头(二次贝塞尔曲线)(四点式)
 * @param {*} endPoint 终点
 * @param {*} startPoint  起点
 * @param {*} outAngle 外角度 0 - 180
 * @param {*} inAngle 内角度 0 - 180
 * @param {*} inAngle 内角度 0 - 180
 * @param {*} ratio 箭头长度占比
 * @param {*} concave 缩进比例
 * @param {*} endConcave 末端缩进比例
 * @returns 
 */
function arrow4(endPoint, startPoint, centerPoint, outAngle = 60, inAngle = 40, Angle = 10, ratio = 0.2, concave = 0.15, endConcave = 0.05) {
    let r11 = Math.sqrt(Math.pow(centerPoint[0] - startPoint[0], 2) + Math.pow(centerPoint[1] - startPoint[1], 2) + Math.pow(centerPoint[2] - startPoint[2], 2));
    let r22 = Math.sqrt(Math.pow(endPoint[0] - centerPoint[0], 2) + Math.pow(endPoint[1] - centerPoint[1], 2) + Math.pow(endPoint[2] - centerPoint[2], 2));
    let r2 = r11 * ratio;
    let r3 = r11 * concave;
    let r4 = r22 * (1 - endConcave);

    //计算与X轴夹角 并偏移pn(0-360)（三角）
    let pn = 90;//默认0°
    let sAnale = Math.atan2((endPoint[1] - startPoint[1]), (endPoint[0] - startPoint[0]));
    sAnale -= Math.PI * 90 / 180;

    let sAnale1 = Math.atan2((centerPoint[1] - startPoint[1]), (centerPoint[0] - startPoint[0]));
    sAnale1 -= Math.PI * 90 / 180;

    let sAnale2 = Math.atan2((endPoint[1] - centerPoint[1]), (endPoint[0] - centerPoint[0]));
    sAnale2 -= Math.PI * 90 / 180;

    let [x, y, z] = startPoint;
    let [x2, y2, z2] = centerPoint;
    let points = [startPoint];
    //外1左
    let angle = Math.PI + sAnale1 - Math.PI * outAngle / 360;
    points.push([x + r2 * Math.sin(angle), y - r2 * Math.cos(angle), z]);

    //外2左
    angle = Math.PI + sAnale1 - Math.PI * inAngle / 360;
    let _l2 = [x + r3 * Math.sin(angle), y - r3 * Math.cos(angle), z];

    //外3左
    angle = Math.PI + sAnale2 - Math.PI * Angle / 360;
    let _l3 = [x2 + r22 * Math.sin(angle), y2 - r22 * Math.cos(angle), z2];
    points.push(...getBS2Coors(_l2, centerPoint, _l3));

    //中末端点
    angle = Math.PI + sAnale2;
    points.push([x2 + r4 * Math.sin(angle), y2 - r4 * Math.cos(angle), z2]);

    //外3右
    angle = Math.PI + sAnale2 + Math.PI * Angle / 360;
    let _r3 = [x2 + r22 * Math.sin(angle), y2 - r22 * Math.cos(angle), z2];

    //外2右
    angle = Math.PI + sAnale1 + Math.PI * inAngle / 360;
    let _r2 = [x + r3 * Math.sin(angle), y - r3 * Math.cos(angle), z];
    points.push(...getBS2Coors(_r2, centerPoint, _r3).reverse());

    //外1右
    angle = Math.PI + sAnale1 + Math.PI * outAngle / 360;
    points.push([x + r2 * Math.sin(angle), y - r2 * Math.cos(angle), z]);

    // points.push(startPoint);
    return points;
}

/**
 * B（t） =  (1-t)²P0 +2t(1-t)P1+t²P2  [0<t<1] 一次贝塞尔曲线
 * @param {*} p0 
 * @param {*} p1 
 * @param {*} p2 
 * @param {*} count 
 * @returns 
 */
function getBS1Coors(p0, p1, p2, count = 100) {
    let coors = [];
    for (let i = 0; i < count; i++) {
        let t = i / count;
        let x = (1 - t) * (1 - t) * p0[0] + 2 * t * (1 - t) * p1[0] + t * t * p2[0];
        let y = (1 - t) * (1 - t) * p0[1] + 2 * t * (1 - t) * p1[1] + t * t * p2[1];
        coors.push([x, y, p1[2]]);
    }
    return coors;
}
/**
 * B（t） =  (1-t)²P0 +2t(1-t)P1+t²P2  [0<t<1] 二次贝塞尔曲线
 * @param {*} p0 
 * @param {*} p1 
 * @param {*} p2 
 * @param {*} count 
 * @returns 
 */
function getBS2Coors(p0, p1, p2, count = 100) {
    let coors = [];
    for (let i = 0; i < count; i++) {
        let t = i / count;
        let x = (1 - t) * (1 - t) * p0[0] + 2 * t * (1 - t) * p1[0] + t * t * p2[0];
        let y = (1 - t) * (1 - t) * p0[1] + 2 * t * (1 - t) * p1[1] + t * t * p2[1];
        coors.push([x, y, p1[2]]);
    }
    return coors;
}
/**
 * B（t=(1-t)(1-t)(1-t)P0+3t(1-t)(1-t)P1+3tt(1-t)P2+tttP3  [0<t<1] 三次贝塞尔曲线
 * @param {*} p0 
 * @param {*} p1 
 * @param {*} p2 
 * @param {*} p3 
 * @param {*} count 
 * @returns 
 */
function getBS3Coors(p0, p1, p2, p3, count = 100) {
    let coors = [];
    for (let i = 0; i < count; i++) {
        let t = i / count;
        let x = (1 - t) * (1 - t) * (1 - t) * p0[0] + 3 * t * (1 - t) * (1 - t) * p1[0] + 3 * t * t * (1 - t) * p2[0] + t * t * t * p3[0];
        let y = (1 - t) * (1 - t) * (1 - t) * p0[1] + 3 * t * (1 - t) * (1 - t) * p1[1] + 3 * t * t * (1 - t) * p2[1] + t * t * t * p3[1];
        coors.push([x, y, p1[2]]);
    }
    return coors;
}




/**
 * 根据起点，终点，创建扇形面
 * @param {*} startPoint 起点坐标
 * @param {*} endPoint 终点坐标
 * @param {*} showAngle 扇形弧度 （0 - 360）
 * @param {*} n 边数复杂度（太大会出现锯齿现场默认半径5倍）
 */
function createSectorPolygonByPoint(startPoint, endPoint, showAngle, n, addR = 0) {
    let r = Math.sqrt(Math.pow(endPoint[0] - startPoint[0], 2) + Math.pow(endPoint[1] - startPoint[1], 2) + Math.pow(endPoint[2] - startPoint[2], 2)) + addR;
    if (!n) {
        n = r * 5;
        n < 20 && (n = 20);
        n > 20 && (n = 100);
    }
    let sAnale = getTheta(startPoint, endPoint, 90);
    let [x, y, z] = startPoint;
    let points = [startPoint];
    let angle = Math.PI + sAnale - Math.PI * showAngle / 360;
    let counterclockwise = false;
    points.push([x + r * Math.sin(angle),       //从第一个顶点开始一条新的子路径
    y - r * Math.cos(angle), z])
    var delta = 2 * Math.PI / n;            //两个顶点之间的夹角
    var maxCount = parseInt(n * showAngle / 360);
    for (var i = 1; i < maxCount; i++) {          //循环剩余的每个顶点
        angle += counterclockwise ? -delta : delta;   //调整角度
        points.push([x + r * Math.sin(angle),   //以下个顶点为端点添加线段
        y - r * Math.cos(angle), z]);
    }
    return points;
}

//计算与X轴夹角 并偏移pn(0-360)（三角）
function getTheta(p1, p2, pn = 0) {
    let angle = Math.atan2((p2[1] - p1[1]), (p2[0] - p1[0]));
    angle -= Math.PI * pn / 180;
    return angle;
}

/**
 * 根据起点，终点，创建扇形面
 * @param {*} startPoint 起点坐标
 * @param {*} endPoint 终点坐标
 * @param {*} showAngle 扇形弧度 （0 - 360）
 * @param {*} n 边数复杂度（太大会出现锯齿现场默认半径5倍）
 */
function createSectorPolygonByPoint(startPoint, endPoint, showAngle, n, addR = 0) {
    let r = Math.sqrt(Math.pow(endPoint[0] - startPoint[0], 2) + Math.pow(endPoint[1] - startPoint[1], 2) + Math.pow(endPoint[2] - startPoint[2], 2)) + addR;
    if (!n) {
        n = r * 5;
        n < 20 && (n = 20);
        n > 20 && (n = 100);
    }
    let sAnale = getTheta(startPoint, endPoint, 90);
    let [x, y, z] = startPoint;
    let points = [startPoint];
    let angle = Math.PI + sAnale - Math.PI * showAngle / 360;
    points.push([x + r * Math.sin(angle), y - r * Math.cos(angle), z]);
    angle = Math.PI + sAnale + Math.PI * showAngle / 360;
    points.push([x + r * Math.sin(angle), y - r * Math.cos(angle), z]);
    return points;
}

