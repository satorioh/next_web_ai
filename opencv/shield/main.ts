import cv from "@techstark/opencv-js";
import { HandTip } from "@/lib/types";

const ANG_VEL = 2.0; // 角速度
const SHOW_SHIELD_RATIO = 1.0;
const SHIELD_SCALE = 2.0;

export class ShieldModule {
  private result: null;
  private deg: number;
  private hand0: HandTip;
  private hand1: HandTip;

  constructor() {
    this.result = null;
    this.deg = 0; // 旋转角度
    this.hand0 = {
      wrist: null,
      thumb_tip: null,
      index_mcp: null,
      index_tip: null,
      midle_mcp: null,
      midle_tip: null,
      ring_tip: null,
      pinky_tip: null,
    };
    this.hand1 = {
      wrist: null,
      thumb_tip: null,
      index_mcp: null,
      index_tip: null,
      midle_mcp: null,
      midle_tip: null,
      ring_tip: null,
      pinky_tip: null,
    };
  }

  matToImageData(mat: cv.Mat): ImageData {
    return new ImageData(new Uint8ClampedArray(mat.data), mat.cols, mat.rows);
  }

  process(frame: ImageData): ImageData {
    let image = new cv.Mat();
    const temp = cv.matFromImageData(frame);
    cv.flip(temp, image, 1);
    const result = this.matToImageData(image);
    // 释放内存
    temp.delete();
    image.delete();
    return result;
  }
}
