"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { When } from "react-if";
import { Box, ObjectDetectionResult } from "@/lib/types";
import { BackBtn } from "@/components/common/BackBtn";

let inferCount = 0;
let totalInferTime = 0;
let boxes: Box[] = [];
let isBusy = false;
let device = "";
let requestId = 0;

export default function ODPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const workerRef = useRef<Worker>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../../../worker/od.worker.ts", import.meta.url),
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

  const onModelResult = (data: {
    startTime: number;
    result: ObjectDetectionResult[];
  }) => {
    const { startTime, result } = data;
    const endTime = performance.now(); // 记录结束时间
    const inferTime = endTime - startTime; // 计算执行时间
    inferCount++;
    totalInferTime += inferTime;
    const averageInferTime = parseInt(String(totalInferTime / inferCount));
    console.log(`Infer count: ${inferCount}`);
    console.log(`Average infer time: ${averageInferTime} ms`);

    if (canvasRef.current === null) return;
    boxes = process_output(
      result,
      canvasRef.current.width,
      canvasRef.current.height,
    );
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
        draw_boxes(canvasRef.current, boxes);
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
    boxes = [];
    isBusy = false;
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

  const process_output = (
    output: ObjectDetectionResult[],
    img_width: number,
    img_height: number,
  ) => {
    let boxes: Box[] = [];
    const outputLength = output.length;
    for (let index = 0; index < outputLength; index++) {
      const row = output[index];
      const max_prob = row.categories[0].score;
      const label = row.categories[0].categoryName;
      const { originX, originY, width, height } = row.boundingBox;
      const x1 = (originX / 640) * img_width;
      const y1 = (originY / 640) * img_height;
      const w = (width / 640) * img_width;
      const h = (height / 640) * img_height;
      boxes.push([x1, y1, w, h, label, max_prob]);
    }
    return boxes;
  };

  const draw_boxes = (canvas: HTMLCanvasElement, boxes: Box[]) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.font = "18px serif";
    boxes.forEach(([x1, y1, w, h, label]) => {
      ctx.strokeRect(x1, y1, w, h);
      ctx.fillStyle = "#00ff00";
      const width = ctx.measureText(label).width;
      ctx.fillRect(x1, y1, width + 10, 25);
      ctx.fillStyle = "#000000";
      ctx.fillText(label, x1, y1 + 18);
    });

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
          Object Detection
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
