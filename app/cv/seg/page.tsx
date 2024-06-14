"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { When } from "react-if";
import { ImageSegmenterResult } from "@/lib/types";
import { BackBtn } from "@/components/common/BackBtn";

const legendColors = [
  [255, 197, 0, 255], // Vivid Yellow
  [128, 62, 117, 255], // Strong Purple
  [255, 104, 0, 255], // Vivid Orange
  [166, 189, 215, 255], // Very Light Blue
  [193, 0, 32, 255], // Vivid Red
  [206, 162, 98, 255], // Grayish Yellow
  [129, 112, 102, 255], // Medium Gray
  [0, 125, 52, 255], // Vivid Green
  [246, 118, 142, 255], // Strong Purplish Pink
  [0, 83, 138, 255], // Strong Blue
  [255, 112, 92, 255], // Strong Yellowish Pink
  [83, 55, 112, 255], // Strong Violet
  [255, 142, 0, 255], // Vivid Orange Yellow
  [179, 40, 81, 255], // Strong Purplish Red
  [244, 200, 0, 255], // Vivid Greenish Yellow
  [127, 24, 13, 255], // Strong Reddish Brown
  [147, 170, 0, 255], // Vivid Yellowish Green
  [89, 51, 21, 255], // Deep Yellowish Brown
  [241, 58, 19, 255], // Vivid Reddish Orange
  [35, 44, 22, 255], // Dark Olive Green
  [0, 161, 194, 255], // Vivid Blue
];

let inferCount = 0;
let totalInferTime = 0;
let isBusy = false;
let device = "";
let requestId = 0;
let result: Uint8Array | undefined;

export default function SegPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const workerRef = useRef<Worker>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../../../worker/seg.worker.ts", import.meta.url),
    );

    const onMessageReceived = (event: MessageEvent) => {
      const data = event.data;
      switch (data.type) {
        case "modelLoading":
          onModelLoading(data);
          break;
        case "modelLoaded":
          onModelLoaded(data);
          break;
        case "modelResult":
          onModelResult(data);
          break;
      }
    };

    // Attach the callback function as an event listener.
    workerRef.current.addEventListener("message", onMessageReceived);

    return () => {
      reset();
    };
  }, []);

  const onModelLoading = (data: { progress: number }) => {
    const { progress } = data;
    console.log("progress", progress);
    setProgress(progress);
  };

  const onModelLoaded = (data: { threads: number; deviceName: string }) => {
    const { deviceName } = data;
    device = deviceName;
    setIsLoading(false);
    initWebcam();
  };

  const onModelResult = (data: ImageSegmenterResult) => {
    const { startTime, maskImage } = data;
    const endTime = performance.now(); // 记录结束时间
    const inferTime = endTime - startTime; // 计算执行时间
    inferCount++;
    totalInferTime += inferTime;
    const averageInferTime = parseInt(String(totalInferTime / inferCount));
    console.log(`Infer count: ${inferCount}`);
    console.log(`Average infer time: ${averageInferTime} ms`);

    if (canvasRef.current === null) return;
    process_output(maskImage);
    isBusy = false;
  };

  const initWebcam = async () => {
    const errorMessage =
      "You have to give browser the Webcam permission to run detection";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: "destructive",
        title: errorMessage,
      });
      return;
    }
    console.log("initWebcam");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: errorMessage,
      });
    }
  };

  const detect = async () => {
    if (canvasRef.current === null || videoRef.current === null) return;
    canvasRef.current.width = 640;
    canvasRef.current.height = 480;
    const context = canvasRef.current.getContext("2d");
    const process = () => {
      console.log("interval");
      if (context && videoRef.current && canvasRef.current) {
        context.drawImage(videoRef.current, 0, 0);
        draw_boxes(canvasRef.current);
        const input = prepare_input(canvasRef.current);
        if (!isBusy) {
          const startTime = performance.now(); // 记录开始时间
          workerRef.current?.postMessage({ type: "frame", input, startTime }); // 将开始时间发送到 worker
          isBusy = true;
        }
      }
      requestId = window.requestAnimationFrame(process);
    };
    process();
  };

  const start = async () => {
    console.log("start");
    await videoRef.current?.play();
    await detect();
  };

  const pause = async () => {
    console.log("pause");
    window.cancelAnimationFrame(requestId);
    videoRef.current?.pause();
  };

  const closeWorker = () => {
    workerRef.current?.postMessage({ type: "close" });
    workerRef.current?.terminate();
  };

  const reset = async () => {
    console.log("reset");
    closeWorker();
    pause();
    setIsLoading(true);
    inferCount = 0;
    totalInferTime = 0;
    isBusy = false;
    result = undefined;
    device = "";
    requestId = 0;
  };

  const handleClick = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await start();
    }
    setIsPlaying(!isPlaying);
  };

  const prepare_input = (img: HTMLCanvasElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context || img.width === 0) return;
    context.drawImage(img, 0, 0, 640, 640);
    return context.getImageData(0, 0, 640, 640);
  };

  const process_output = (maskImage: Uint8Array) => {
    result = maskImage;
  };

  const draw_boxes = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx || !result || !videoRef.current) return;
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.font = "18px serif";

    const { videoWidth, videoHeight } = videoRef.current;

    let imageData = ctx.getImageData(0, 0, videoWidth, videoHeight).data;

    let j = 0;
    for (let i = 0; i < result.length; ++i) {
      const maskVal = Math.round(result[i] * 255.0);
      const legendColor = legendColors[maskVal % legendColors.length];
      imageData[j] = (legendColor[0] + imageData[j]) / 2;
      imageData[j + 1] = (legendColor[1] + imageData[j + 1]) / 2;
      imageData[j + 2] = (legendColor[2] + imageData[j + 2]) / 2;
      imageData[j + 3] = (legendColor[3] + imageData[j + 3]) / 2;
      j += 4;
    }
    const uint8Array = new Uint8ClampedArray(imageData.buffer);
    const dataNew = new ImageData(uint8Array, videoWidth, videoHeight);
    ctx.putImageData(dataNew, 0, 0);

    // 绘制 Infer count 和 Average infer time
    ctx.font = "16px Arial";
    ctx.fillStyle = "black";
    ctx.fillText(`Infer count: ${inferCount}`, 10, 20);
    ctx.fillText(
      `Average infer time: ${
        inferCount ? parseInt(String(totalInferTime / inferCount)) : 0
      } ms`,
      10,
      40,
    );
    ctx.fillText(`Device: ${device}`, 10, 60);
  };

  return (
    <div>
      <div className="relative">
        <BackBtn />
        <h2 className="text-center scroll-m-20 pb-2 text-2xl font-semibold tracking-tight first:mt-0">
          Image Segmentation
        </h2>
      </div>
      <video controls className="hidden" ref={videoRef}></video>
      <div className="flex flex-col justify-center items-center relative">
        <When condition={isLoading}>
          <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%]">
            <Progress value={progress} />
            <div>Loading model, please wait...</div>
          </div>
        </When>
        <canvas
          className="w-full text-center max-w-3xl"
          ref={canvasRef}
        ></canvas>
      </div>
      <div className="text-center space-x-4 mt-4">
        <When condition={!isLoading}>
          <Button
            onClick={handleClick}
            variant={isPlaying ? "destructive" : "default"}
          >
            {isPlaying ? "Pause" : "Start"}
          </Button>
        </When>
      </div>
    </div>
  );
}
