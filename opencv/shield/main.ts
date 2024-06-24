import cv from "@techstark/opencv-js";
import { HandTip, LandmarkPoint, LandMark } from "@/lib/types";

const ANG_VEL = 2.0; // 角速度
const SHOW_SHIELD_RATIO = 1.0;
const SHIELD_SCALE = 2.0;

const SHIELD_1 = cv.imread("/images/magic_circle_ccw.png");
const SHIELD_2 = cv.imread("/images/magic_circle_cw.png");

export class ShieldModule {
  private result: null;
  private deg: number;
  private hand0: HandTip;
  private hand1: HandTip;
  private width: number;
  private height: number;

  constructor() {
    this.result = null;
    this.deg = 0; // 旋转角度
    this.width = 0;
    this.height = 0;
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

  draw_line(img: cv.Mat, p1: LandmarkPoint, p2: LandmarkPoint, size = 5) {
    const p1Point = new cv.Point(p1[0], p1[1]);
    const p2Point = new cv.Point(p2[0], p2[1]);
    cv.line(img, p1Point, p2Point, [50, 50, 255], size);
    cv.line(img, p1Point, p2Point, [255, 255, 255], Math.round(size / 2));
  }

  set_position_data(lmlist: LandmarkPoint[], hand: HandTip) {
    hand["wrist"] = [lmlist[0][0], lmlist[0][1]];
    hand["thumb_tip"] = [lmlist[4][0], lmlist[4][1]];
    hand["index_mcp"] = [lmlist[5][0], lmlist[5][1]];
    hand["index_tip"] = [lmlist[8][0], lmlist[8][1]];
    hand["midle_mcp"] = [lmlist[9][0], lmlist[9][1]];
    hand["midle_tip"] = [lmlist[12][0], lmlist[12][1]];
    hand["ring_tip"] = [lmlist[16][0], lmlist[16][1]];
    hand["pinky_tip"] = [lmlist[20][0], lmlist[20][1]];
  }

  calc_distance(p1: LandmarkPoint, p2: LandmarkPoint) {
    const [x1, y1, x2, y2] = [p1[0], p1[1], p2[0], p2[1]];
    return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** (1.0 / 2);
  }

  calc_ratio(hand: HandTip) {
    const wrist = hand["wrist"];
    const index_mcp = hand["index_mcp"];
    const index_tip = hand["index_tip"];
    const pinky_tip = hand["pinky_tip"];
    if (wrist && index_tip && index_mcp && pinky_tip) {
      const hand_close = this.calc_distance(wrist, index_mcp);
      const hand_open = this.calc_distance(index_tip, pinky_tip);
      return { ratio: hand_open / hand_close, hand_close, hand_open };
    }
  }

  draw_hand_lines(image: cv.Mat, hand: HandTip) {
    const wrist = hand["wrist"];
    const thumb_tip = hand["thumb_tip"];
    const index_tip = hand["index_tip"];
    const midle_tip = hand["midle_tip"];
    const ring_tip = hand["ring_tip"];
    const pinky_tip = hand["pinky_tip"];
    if (
      !wrist ||
      !thumb_tip ||
      !index_tip ||
      !midle_tip ||
      !ring_tip ||
      !pinky_tip
    )
      return;
    this.draw_line(image, wrist, thumb_tip);
    this.draw_line(image, wrist, index_tip);
    this.draw_line(image, wrist, midle_tip);
    this.draw_line(image, wrist, ring_tip);
    this.draw_line(image, wrist, pinky_tip);
    this.draw_line(image, thumb_tip, index_tip);
    this.draw_line(image, thumb_tip, midle_tip);
    this.draw_line(image, thumb_tip, ring_tip);
    this.draw_line(image, thumb_tip, pinky_tip);
  }

  calc_shield_position(hand: HandTip, hand_close: number) {
    const midle_mcp = hand["midle_mcp"];
    if (midle_mcp) {
      const [center_x, center_y] = midle_mcp;
      let diameter = Math.round(hand_close * SHIELD_SCALE);
      let x1 = Math.round(center_x - diameter / 2); // shield left
      let y1 = Math.round(center_y - diameter / 2); // shield top
      const w = this.width;
      const h = this.height;
      if (x1 < 0) {
        x1 = 0;
      } else if (x1 > w) {
        x1 = w;
      }
      if (y1 < 0) {
        y1 = 0;
      } else if (y1 > h) {
        y1 = h;
      }
      if (x1 + diameter > w) diameter = w - x1;
      if (y1 + diameter > h) diameter = h - y1;
      const shield_size = [diameter, diameter];
      return { x1, y1, diameter, shield_size };
    }
  }

  get_rotated_image() {
    this.deg += ANG_VEL;
    if (this.deg > 360) this.deg = 0;
    const wid = SHIELD_1.cols; // SHIELD_1和SHIELD_2尺寸相同
    const hei = SHIELD_1.rows;
    const size = new cv.Size(wid, hei);
    const cen = new cv.Point(Math.floor(wid / 2), Math.floor(hei / 2));
    const M1 = cv.getRotationMatrix2D(cen, Math.round(this.deg), 1.0);
    const M2 = cv.getRotationMatrix2D(cen, Math.round(360 - this.deg), 1.0);
    let rotated1 = new cv.Mat();
    let rotated2 = new cv.Mat();
    cv.warpAffine(SHIELD_1, rotated1, M1, size);
    cv.warpAffine(SHIELD_2, rotated2, M2, size);
    M1.delete();
    M2.delete();
    rotated1.delete();
    rotated2.delete();
    return { rotated1, rotated2 };
  }

  transparent(
    shield_img: cv.Mat,
    x: number,
    y: number,
    image: cv.Mat,
    size: number[],
  ) {
    if (size) {
      const cvSize = new cv.Size(size[0], size[1]);
      cv.resize(shield_img, shield_img, cvSize);
    }
    const original_image = image.clone();
    let b = new cv.Mat();
    let g = new cv.Mat();
    let r = new cv.Mat();
    let a = new cv.Mat();
    let mv = new cv.MatVector();
    cv.split(shield_img, mv);
    b = mv.get(0);
    g = mv.get(1);
    r = mv.get(2);
    a = mv.get(3);

    let overlay_color = new cv.Mat();
    mv = new cv.MatVector();
    mv.push_back(b);
    mv.push_back(g);
    mv.push_back(r);
    cv.merge(mv, overlay_color);

    let mask = new cv.Mat();
    cv.medianBlur(a, mask, 1);

    let roi = original_image.roi(
      new cv.Rect(x, y, overlay_color.cols, overlay_color.rows),
    );

    let img1_bg = new cv.Mat();
    let img2_fg = new cv.Mat();
    let not_mask = new cv.Mat();
    cv.bitwise_not(mask, not_mask);

    cv.bitwise_and(roi, roi, img1_bg, not_mask);
    cv.bitwise_and(overlay_color, overlay_color, img2_fg, mask);

    roi.copyTo(
      original_image
        .rowRange(y, y + overlay_color.rows)
        .colRange(x, x + overlay_color.cols),
    );

    let result = new cv.Mat();
    cv.add(img1_bg, img2_fg, result);

    b.delete();
    g.delete();
    r.delete();
    a.delete();
    mv.delete();
    overlay_color.delete();
    mask.delete();
    roi.delete();
    img1_bg.delete();
    img2_fg.delete();
    not_mask.delete();

    return result;
  }

  loop_hands_landmark(image: cv.Mat, landmarks: LandMark[][]) {
    const [h, w, c] = [image.rows, image.cols, image.channels];
    for (let index = 0; index < landmarks.length; index++) {
      const hand_landmark = landmarks[index];
      const hand = index === 0 ? this.hand0 : this.hand1;

      // set hand landmarks data
      let lm_list: LandmarkPoint[] = [];
      for (let idx = 0; idx < hand_landmark.length; idx++) {
        const lm = hand_landmark[idx];
        const coor_x = Math.round(lm.x * w);
        const coor_y = Math.round(lm.y * h);
        lm_list.push([coor_x, coor_y]);
      }
      this.set_position_data(lm_list, hand);

      // calculate distance and ratio
      const ratioResult = this.calc_ratio(hand);
      if (ratioResult) {
        const { ratio, hand_close, hand_open } = ratioResult;
        console.log(ratio);

        // draw hand lines or show shield
        if (ratio && 0.5 < ratio && ratio < SHOW_SHIELD_RATIO) {
          this.draw_hand_lines(image, hand);
        }
        if (ratio && ratio > SHOW_SHIELD_RATIO) {
          const shieldPosition = this.calc_shield_position(hand, hand_close);
          if (shieldPosition) {
            const { x1, y1, diameter, shield_size } = shieldPosition;
            const { rotated1, rotated2 } = this.get_rotated_image();
            if (diameter !== 0) {
              image = this.transparent(rotated1, x1, y1, image, shield_size);
              image = this.transparent(rotated2, x1, y1, image, shield_size);
            }
          }
        }
      }
    }

    return image;
  }

  process(frame: ImageData, lankMarks: LandMark[][]): ImageData {
    if (this.width === 0 || this.height === 0) {
      this.width = frame.width;
      this.height = frame.height;
    }
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
