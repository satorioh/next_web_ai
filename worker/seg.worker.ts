"use client";

import {
  ImageSegmenter,
  FilesetResolver,
  ImageSegmenterResult,
} from "@mediapipe/tasks-vision";
import { S3_SIG_BUCKET, MP_VERSION } from "@/lib/constants";

let device = "webgl";
const modelName = "seg";
const modelFileName = "selfie_segmenter.tflite";
const wasmPath = `${S3_SIG_BUCKET}/tflite/wasm/${MP_VERSION}`;
const modelPath = `${S3_SIG_BUCKET}/tflite/model/${modelName}/${modelFileName}`;
let imageSegmenter: ImageSegmenter;
const runningMode = "VIDEO";

const createImageSegmenter = async () => {
  try {
    const vision = await FilesetResolver.forVisionTasks(wasmPath);
    postMessage({ type: "modelLoading", progress: 50 });
    imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: modelPath,
        delegate: "CPU",
      },
      runningMode: runningMode,
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
  } catch (e) {
    console.error(e);
    console.log("retrying");
    await createImageSegmenter();
  }
};

async function init() {
  console.log("init");
  load_model();
}

init();

async function load_model() {
  await createImageSegmenter();
  postMessage({ type: "modelLoaded", deviceName: device });
}

async function run_model(input: ImageData, startTime: number) {
  let startTimeMs = performance.now();
  imageSegmenter.segmentForVideo(input, startTimeMs, (result) =>
    callbackForVideo(result, startTime),
  );
}

async function callbackForVideo(
  result: ImageSegmenterResult,
  startTime: number,
) {
  if (result.categoryMask) {
    const maskImage = result.categoryMask.getAsUint8Array();
    postMessage({ type: "modelResult", maskImage, startTime });
  }
}

addEventListener("message", async (event: MessageEvent) => {
  const { type } = event.data;
  switch (type) {
    case "frame":
      await handleFrame(event.data);
      break;
    case "close":
      handleClose();
      break;
  }
});

async function handleFrame(data: { input: ImageData; startTime: number }) {
  const { input, startTime } = data;
  await run_model(input, startTime);
}

function handleClose() {
  close();
}

function close() {
  imageSegmenter.close();
  console.log("imageSegmenter closed");
}
