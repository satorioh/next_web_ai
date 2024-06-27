"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { When } from "react-if";
import { BackBtn } from "@/components/common/BackBtn";
import { STUN_SERVER, BACKEND_URL_PREFIX } from "@/lib/constants";

let pc: RTCPeerConnection | null = null;
let dc: RTCDataChannel | null = null;
let dcInterval = 0;
let requestId = 0;
let pingCount = 0;
let totalElapsedTime = 0;

export default function EdgePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!pc) {
      createPeerConnection();
      initWebcam();
    }
    if (!dc) createDataChannel();
    return () => {
      reset();
    };
  }, []);

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
      stream.getTracks().forEach((track) => {
        if (pc) {
          console.log("add track");
          pc.addTrack(track, stream);
        }
      });
      negotiate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: errorMessage,
      });
    }
  };

  const createPeerConnection = () => {
    console.log("createPeerConnection");
    const config = {
      sdpSemantics: "unified-plan",
      iceServers: [{ urls: [STUN_SERVER] as string[] }],
    };

    pc = new RTCPeerConnection(config);

    // register some listeners to help debugging
    pc.addEventListener(
      "icegatheringstatechange",
      () => {
        console.log(
          "ice gathering state change ->",
          pc && pc.iceGatheringState,
        );
      },
      false,
    );

    pc.addEventListener(
      "iceconnectionstatechange",
      () => {
        console.log(
          "ice connection state change -->",
          pc && pc.iceConnectionState,
        );
      },
      false,
    );

    pc.addEventListener(
      "signalingstatechange",
      () => {
        console.log("signaling state change -->", pc && pc.signalingState);
      },
      false,
    );

    // connect audio / video
    pc.addEventListener("track", (evt) => {
      console.log("get backend track ->", evt);
      if (videoRef.current && evt.track.kind === "video")
        videoRef.current.srcObject = evt.streams[0];
    });
  };

  const createDataChannel = () => {
    if (!pc) return;
    dc = pc.createDataChannel("edges", { ordered: false, maxRetransmits: 0 });
    dc.addEventListener("close", () => {
      clearInterval(dcInterval);
      console.log("data channel closed");
    });
    dc.addEventListener("open", () => {
      console.log("data channel opened");
      dcInterval = window.setInterval(() => {
        const message = "ping " + performance.now();
        dc && dc.send(message);
      }, 1000);
    });
    dc.addEventListener("message", (evt) => {
      // console.log("data channel message ->", evt.data);
      if (evt.data.substring(0, 4) === "pong") {
        const elapsed_ms =
          performance.now() - parseInt(evt.data.substring(5), 10);
        pingCount++;
        totalElapsedTime += elapsed_ms;
      }
    });
  };

  const negotiate = async () => {
    if (!pc) return;
    console.log("start negotiate...");
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc && pc.iceGatheringState === "complete") {
          console.log("negotiate: iceGatheringState Complete");
          resolve();
        } else {
          const checkState = () => {
            console.log("checkState");
            if (pc && pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", checkState);
              console.log("negotiate: iceGatheringState Complete");
              resolve();
            }
          };
          pc && pc.addEventListener("icegatheringstatechange", checkState);
        }
      });

      const finalOffer = pc.localDescription;
      if (finalOffer) {
        const response = await fetch(`${BACKEND_URL_PREFIX}webrtc/offer`, {
          body: JSON.stringify({
            sdp: finalOffer.sdp,
            type: finalOffer.type,
            video_transform: "edges",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        const answer = await response.json();
        await pc.setRemoteDescription(answer);
        setIsLoading(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const detect = async () => {
    if (videoRef.current === null) return;

    const process = () => {
      if (videoRef.current && canvasRef.current) {
        drawFrame(videoRef.current, canvasRef.current);
      }
      requestId = window.requestAnimationFrame(process);
    };
    process();
  };

  const drawFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    const { width: canvasWidth, height: canvasHeight } = canvas;
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(video, 0, 0);

    ctx.font = "16px Arial";
    ctx.fillStyle = "white";
    ctx.fillText(
      `Average RTT: ${
        pingCount ? (totalElapsedTime / pingCount).toFixed(2) : 0
      } ms`,
      10,
      20,
    );
  };

  const start = async () => {
    console.log("start");
    await videoRef.current?.play();
    await detect();
  };

  const handleClick = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await start();
    }
    setIsPlaying(!isPlaying);
  };

  const pause = async () => {
    console.log("pause");
    window.cancelAnimationFrame(requestId);
    videoRef.current?.pause();
  };

  function stopRTC() {
    if (!pc) return;

    // close data channel
    if (dc) {
      dc.close();
      dc = null;
      console.log("data channel closed");
    }

    // close transceivers
    if (pc.getTransceivers) {
      pc.getTransceivers().forEach((transceiver) => {
        if (transceiver.stop) {
          transceiver.stop();
        }
      });
    }

    // close local audio / video
    pc.getSenders().forEach((sender) => {
      sender.track?.stop();
    });

    // close peer connection
    setTimeout(() => {
      pc && pc.close();
      pc = null;
      console.log("peer connection closed");
    }, 500);
  }

  const reset = async () => {
    console.log("reset");
    pause();
    stopRTC();
    setIsLoading(true);
    requestId = 0;
    pingCount = 0;
    totalElapsedTime = 0;
  };

  return (
    <div className="h-full">
      <div className="relative">
        <BackBtn />
        <h2 className="text-center scroll-m-20 pb-2 text-2xl font-semibold tracking-tight first:mt-0">
          Edge Detection
        </h2>
      </div>
      <video
        controls
        width={640}
        height={480}
        className="hidden"
        ref={videoRef}
      ></video>
      <div className="flex flex-col justify-center items-center relative">
        <When condition={isLoading}>
          <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%]">
            <Progress value={progress} />
            <div>Loading, please wait...</div>
          </div>
        </When>
        <canvas
          className="text-center max-w-full"
          width={640}
          height={480}
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
