import DtsFacade from "./DtsFacade"

export default class DtsApiExample {
  public static async addFiniteElement() {
    __xapi.finiteElement.clear()
    //有限元分析对象1
    let fe1 = {
      id: "displacements_S22",
      dataPath: "F:\\freedo\\nginx-1.24.0\\html\\mshout\\displacements",
      coordinate: [-6446.6050000000005, -15041.800000000001, 78.56125],
      rotation: [0, -45, 0],
      type: 6,
      valueRange: [-0.2665458712726831, 0.1007798942737281],
      showLine: true,
      showColorLine: false,
      contourParams: [
        [-0.13191628192240998, 0.006],
        [-0.08387468600024785, 0.006],
        [-0.035833090078085716, 0.006],
        [0.012208505844076428, 0.006],
        [0.06025010176623857, 0.006],
        [0.10829169768840069, 0.006],
        [0.15633329361056286, 0.006],
        [0.20437488953272498, 0.006],
        [0.2524164854548871, 0.006],
        [0.30045808137704927, 0.006],
        [0.34849967729921144, 0.006]
      ],
      sections: [0, 8, 15, 16, 6, 4, 10, 9, 13, 12, 5, 17, 18, 20, 19, 7, 11, 14, 3, 2, 1],
      colors: {
        file: "F:/freedo/nginx-1.24.0/html/mshout/defaultColor.png"
      },
      groupId: "def_finite",
      userData: "{}"
    };
    await __xapi.finiteElement.add(fe1);
  }
}