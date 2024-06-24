import { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type Box = [number, number, number, number, string, number];

interface CategoryItem {
  score: number;
  index: number;
  categoryName: string;
  displayName: string;
}

interface BoundingBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
  angle: number;
}

export interface ObjectDetectionResult {
  categories: CategoryItem[];
  boundingBox: BoundingBox;
}

export interface ImageSegmenterResult {
  type: string;
  maskImage: Uint8Array;
  startTime: number;
}

export type LandMark = NormalizedLandmark;

export interface LandMarkerResult {
  type: string;
  landmarks: LandMark[][];
  startTime: number;
}

export interface HandTip {
  thumb_tip: [number, number] | null;
  midle_tip: [number, number] | null;
  midle_mcp: [number, number] | null;
  pinky_tip: [number, number] | null;
  wrist: [number, number] | null;
  index_tip: [number, number] | null;
  ring_tip: [number, number] | null;
  index_mcp: [number, number] | null;
}

export interface FrameData {
  type: string;
  image: ImageData;
  startTime: number;
}
