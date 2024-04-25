import * as tf from "@tensorflow/tfjs";
import { setWasmPaths, getThreadsCount } from "@tensorflow/tfjs-backend-wasm";
import "@tensorflow/tfjs-backend-webgpu";

let device = "wasm";
let model: null | tf.GraphModel = null;

async function init() {
  if (navigator.gpu && (await navigator.gpu.requestAdapter())) {
    device = "webgpu";
  } else {
    setWasmPaths(
      "https://regulussig.s3.ap-southeast-1.amazonaws.com/tfjs/wasm/",
    );
  }
  load_model();
}

init();

async function load_model() {
  await tf.setBackend(device);
  model = await tf.loadGraphModel(
    "https://regulussig.s3.ap-southeast-1.amazonaws.com/tfjs/model/model.json",
  );
  console.log("model loaded", model);
  let threadsCount = 0;
  if (device === "wasm") {
    try {
      threadsCount = getThreadsCount();
    } catch (e) {
      console.log("getThreadsCount Error", e);
    }
  }
  postMessage({ type: "modelLoaded", threadsCount, device });
}

async function run_model(input: ImageData) {
  if (!model) {
    model = await model;
  } else {
    const tf_img = tf.browser.fromPixels(input);
    const tensor = tf_img.div(255.0).expandDims().toFloat();
    const outputs = model.predict(tensor);
    if (outputs instanceof tf.Tensor) {
      return outputs.data();
    }
  }
}

addEventListener("message", async (event: MessageEvent) => {
  const { input, startTime } = event.data;
  const output = await run_model(input);
  postMessage({ type: "modelResult", result: output, startTime });
});
