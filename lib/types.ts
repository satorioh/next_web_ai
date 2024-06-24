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

export type LandmarkPoint = [number, number];

export interface HandTip {
  thumb_tip: LandmarkPoint | null;
  midle_tip: LandmarkPoint | null;
  midle_mcp: LandmarkPoint | null;
  pinky_tip: LandmarkPoint | null;
  wrist: LandmarkPoint | null;
  index_tip: LandmarkPoint | null;
  ring_tip: LandmarkPoint | null;
  index_mcp: LandmarkPoint | null;
}

export interface FrameData {
  type: string;
  image: ImageData;
}
