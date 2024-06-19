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

export type LandMark = NormalizedLandmark

export interface LandMarkerResult {
  type: string;
  landmarks: LandMark[][];
  startTime: number;
}
