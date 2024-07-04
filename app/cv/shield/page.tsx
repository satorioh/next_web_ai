"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Progress } from "@/components/ui/progress";
import { When } from "react-if";
import { BackBtn } from "@/components/common/BackBtn";
import { STUN_SERVER, BACKEND_URL_PREFIX } from "@/lib/constants";

let pc: RTCPeerConnection | null = null;
let dc: RTCDataChannel | null = null;
let dcInterval = 0;

export default function ShieldPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(10);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [cpuUsage, setCpuUsage] = useState(0);
  const { toast } = useToast();

  const averageRTT = useMemo(() => {
    return pingCount ? (totalElapsedTime / pingCount).toFixed(2) : 0;
  }, [pingCount, totalElapsedTime]);

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

  const refreshPage = () => {
    window.location.reload();
  };

  const tryAgainToast = (message: string) =>
    toast({
      variant: "destructive",
      title: message,
      action: (
        <ToastAction altText="Try again" onClick={refreshPage}>
          Try again
        </ToastAction>
      ),
    });

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
        if (pc && pc.iceGatheringState === "complete") {
          setProgress(70);
        }
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
        switch (pc && pc.iceConnectionState) {
          case "connected":
            setProgress(90);
            break;
          case "failed":
          case "disconnected":
            tryAgainToast("Lost connection to the server.");
            break;
        }
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
    dc = pc.createDataChannel("shield", { ordered: false, maxRetransmits: 0 });
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
      if (evt.data.substring(0, 4) === "pong") {
        const data = evt.data.split(" ");
        const [_, ping, cpu, client] = data;
        const elapsed_ms = performance.now() - parseInt(ping, 10);
        setPingCount((prev) => prev + 1);
        setTotalElapsedTime((prev) => prev + elapsed_ms);
        setCpuUsage(parseFloat(cpu));
        setClientCount(parseInt(client, 10));
      } else if (evt.data === "timeout") {
        toast({
          variant: "destructive",
          title:
            "You've reached the maximum connection duration. Connection will close.", // 您已达到最大连接时长，连接即将关闭
        });
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
        try {
          const response = await fetch(`${BACKEND_URL_PREFIX}webrtc/offer`, {
            body: JSON.stringify({
              sdp: finalOffer.sdp,
              type: finalOffer.type,
              video_transform: "shield",
            }),
            headers: {
              "Content-Type": "application/json",
            },
            method: "POST",
          });

          const answer = await response.json();
          const { sdp, type, errorMsg } = answer;
          if (sdp) {
            await pc.setRemoteDescription(answer);
            setIsLoading(false);
          } else {
            toast({
              variant: "destructive",
              title: errorMsg,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const start = async () => {
    console.log("start");
    await videoRef.current?.play();
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
    setPingCount(0);
    setTotalElapsedTime(0);
    setClientCount(0);
    setCpuUsage(0);
  };

  return (
    <div className="h-full relative">
      <div className="relative">
        <BackBtn />
        <h2 className="text-center scroll-m-20 pb-2 text-2xl font-semibold tracking-tight first:mt-0">
          Magic Shield
        </h2>
      </div>
      <div className="flex flex-col items-center relative h-[calc(100%-40px)]">
        <When condition={isLoading}>
          <div className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%]">
            <Progress value={progress} />
            <div>Loading, please wait...</div>
          </div>
        </When>
        <p className="w-full flex justify-between">
          <span>Average RTT: {averageRTT}ms</span>
          <span>Server CPU Usage: {cpuUsage}%</span>
          <span>Client online: {clientCount}</span>
        </p>
        <video
          className="w-full h-[calc(100%-40px)] object-cover"
          ref={videoRef}
        ></video>
      </div>
      <div className="absolute bottom-8 left-[50%] -translate-x-[50%]">
        <When condition={!isLoading}>
          <Button
            className="w-16 h-16 rounded-[50%]"
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
