"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Check, CopyIcon } from "lucide-react";
import { useSocket } from "@/context/SocketProvider";
import toast from "react-hot-toast";
import { TailSpin } from "react-loader-spinner";
import Peer from "simple-peer";
import FileUpload from "./FileUpload";
import FileUploadBtn from "./FileUploadBtn";
import FileDownload from "./FileDownload";
import ShareLink from "./ShareLink";
import { useSearchParams } from "next/navigation";

const ShareCard = () => {
  const userDetails = useSocket();
  const [partnerId, setpartnerId] = useState("");
  const [isLoading, setisLoading] = useState(false);
  const [isCopied, setisCopied] = useState(false);
  const [currentConnection, setcurrentConnection] = useState(false);
  const peerRef = useRef<any>();
  const [userId, setuserId] = useState<any>();
  const [signalingData, setsignalingData] = useState<any>();
  const [acceptCaller, setacceptCaller] = useState(false);
  const [terminateCall, setterminateCall] = useState(false);
  const [fileUpload, setfileUpload] = useState<any>();
  const fileInputRef = useRef<any>();
  const [downloadFile, setdownloadFile] = useState<any>();
  const [fileUploadProgress, setfileUploadProgress] = useState<number>(0);
  const [fileDownloadProgress, setfileDownloadProgress] = useState<number>(0);
  const [fileNameState, setfileNameState] = useState<any>();
  const [fileSending, setfileSending] = useState(false);
  const [fileReceiving, setfileReceiving] = useState(false);
  const [name, setname] = useState<any>();
  const searchParams = useSearchParams();
  const workerRef = useRef<Worker>();

  function CopyToClipboard(value: any) {
    setisCopied(true);
    toast.success("Copied");
    navigator.clipboard.writeText(value);
    setTimeout(() => {
      setisCopied(false);
    }, 3000);
  }

  useEffect(() => {
    // Initialize web worker
    try {
      workerRef.current = new Worker(
        new URL("../utils/worker.ts", import.meta.url)
      );
    } catch (error) {
      console.error("Failed to initialize web worker:", error);
      toast.error("Failed to initialize file transfer system");
    }

    // Set up socket connection
    if (userDetails.socket && userDetails.userId) {
      console.log("Setting up socket connection");
      setuserId(userDetails.userId);
      
      if (userDetails.socket.connected) {
        userDetails.socket.emit("details", {
          socketId: userDetails.socket.id,
          uniqueId: userDetails.userId,
        });
      }

      // Handle signaling
      userDetails.socket.on("signaling", (data: any) => {
        console.log("Received signaling data:", data);
        if (data && data.from) {
          setacceptCaller(true);
          setsignalingData(data);
          setpartnerId(data.from);
        }
      });

      // Handle call accepted
      userDetails.socket.on("callAccepted", (data: any) => {
        console.log("Call accepted:", data);
        if (peerRef.current && data.signalData) {
          peerRef.current.signal(data.signalData);
        }
      });
    }

    // Set partner ID from URL if present
    const codeParam = searchParams.get("code");
    if (codeParam) {
      setpartnerId(codeParam);
    }

    // Set up web worker event listener
    workerRef.current?.addEventListener("message", (event: any) => {
      if (event.data?.progress) {
        setfileDownloadProgress(Number(event.data.progress));
      } else if (event.data?.blob) {
        setdownloadFile(event.data?.blob);
        setfileDownloadProgress(0);
        setfileReceiving(false);
        toast.success("File download complete");
      }
    });

    return () => {
      cleanupPeerConnection();
      cleanupSocketConnection();
      workerRef.current?.terminate();
    };
  }, [userDetails.socket, userDetails.userId]);

  const cleanupPeerConnection = () => {
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (error) {
        console.error("Error destroying peer connection:", error);
      }
      setacceptCaller(false);
      setcurrentConnection(false);
      setterminateCall(false);
    }
  };

  const cleanupSocketConnection = () => {
    if (userDetails.socket) {
      userDetails.socket.off("signaling");
      userDetails.socket.off("callAccepted");
    }
  };

  const initializePeer = (isInitiator: boolean) => {
    const peer = new Peer({
      initiator: isInitiator,
      trickle: false,
      config: {
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:stun1.l.google.com:19302",
              "stun:stun2.l.google.com:19302",
            ],
          },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      },
    });

    peer.on("error", (err) => {
      console.error("Peer connection error:", err);
      toast.error("Connection error occurred");
      setisLoading(false);
      cleanupPeerConnection();
    });

    peer.on("close", () => {
      console.log("Peer connection closed");
      handlePeerClose();
    });

    return peer;
  };

  const callUser = () => {
    if (!partnerId) {
      toast.error("Please enter partner ID");
      return;
    }

    if (!userDetails.socket?.connected) {
      toast.error("Not connected to server");
      return;
    }

    setisLoading(true);
    const peer = initializePeer(true);
    peerRef.current = peer;

    peer.on("signal", (data) => {
      console.log("Sending signal to:", partnerId);
      userDetails.socket?.emit("send-signal", {
        from: userDetails.userId,
        signalData: data,
        to: partnerId,
      });
    });

    peer.on("connect", () => {
      console.log("Peer connection established");
      setisLoading(false);
      setcurrentConnection(true);
      setterminateCall(true);
      toast.success(`Connected to ${partnerId}`);
      userDetails.setpeerState(peer);
    });

    peer.on("data", handlePeerData);
  };

  const acceptUser = () => {
    if (!userDetails.socket?.connected) {
      toast.error("Not connected to server");
      return;
    }

    if (!signalingData?.signalData) {
      toast.error("Invalid connection data");
      return;
    }

    const peer = initializePeer(false);
    peerRef.current = peer;
    userDetails.setpeerState(peer);

    peer.on("signal", (data) => {
      console.log("Sending accept signal");
      userDetails.socket?.emit("acceptCall", {
        signalData: data,
        from: userDetails.userId,
        to: partnerId,
      });
    });

    peer.on("connect", () => {
      console.log("Peer connection established");
      setcurrentConnection(true);
      setterminateCall(true);
      setacceptCaller(false);
      toast.success(`Connected to ${partnerId}`);
    });

    peer.on("data", handlePeerData);
    console.log("Processing received signal");
    peer.signal(signalingData.signalData);
  };

  const handlePeerData = (data: any) => {
    try {
      const parsedData = JSON.parse(data);
      
      if (parsedData.chunk) {
        setfileReceiving(true);
        handleReceivingData(parsedData.chunk);
      } else if (parsedData.done) {
        handleReceivingData(parsedData);
        toast.success("File received successfully");
      } else if (parsedData.info) {
        handleReceivingData(parsedData);
        setfileNameState(parsedData.fileName);
        setname(parsedData.fileName);
      }
    } catch (error) {
      console.error("Error processing peer data:", error);
      toast.error("Error processing received data");
    }
  };

  const handlePeerClose = () => {
    console.log(`Peer ${partnerId} disconnected`);
    setpartnerId("");
    setcurrentConnection(false);
    toast.error(`${partnerId} disconnected`);
    setfileUpload(null);
    setterminateCall(false);
    userDetails.setpeerState(undefined);
  };

  const handleConnectionMaking = () => {
    if (partnerId.trim() === "") {
      toast.error("Please enter partner ID");
      return;
    }
    setisLoading(true);
    callUser();
  };

  const handleFileChange = (e: any) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setfileUpload(files);
    }
  };

  const handleReceivingData = (data: any) => {
    if (data.info) {
      workerRef.current?.postMessage({
        type: "initialize",
        fileName: data.fileName,
        fileSize: data.fileSize,
      });
      setfileNameState(data.fileName);
      setname(data.fileName);
    } else if (data.done) {
      workerRef.current?.postMessage("download");
    } else {
      workerRef.current?.postMessage(data);
    }
  };

  const handleWebRTCUpload = (peer: any) => {
    if (!fileUpload || !fileUpload[0]) {
      toast.error("Please select a file first");
      return;
    }

    const file = fileUpload[0];
    const chunkSize = 16384; // 16KB chunks
    let offset = 0;
    setfileSending(true);

    // Send file info first
    peer.write(
      JSON.stringify({
        info: true,
        fileName: file.name,
        fileSize: file.size,
      })
    );

    const readAndSendChunk = () => {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const reader = new FileReader();

      reader.onload = (event: any) => {
        try {
          const chunkData = event.target.result;
          const uint8ArrayChunk = new Uint8Array(chunkData);

          const progressPayload = {
            chunk: Array.from(uint8ArrayChunk),
            progress: (offset / file.size) * 100,
          };

          peer.write(JSON.stringify(progressPayload));
          setfileUploadProgress((offset / file.size) * 100);

          offset += chunk.size;

          if (offset < file.size) {
            readAndSendChunk();
          } else {
            peer.write(
              JSON.stringify({
                done: true,
                fileName: file.name,
                fileSize: file.size,
              })
            );
            setfileSending(false);
            setfileUploadProgress(0);
            toast.success("File sent successfully");
          }
        } catch (error) {
          console.error("Error sending chunk:", error);
          toast.error("Error sending file");
          setfileSending(false);
        }
      };

      reader.onerror = () => {
        console.error("Error reading file chunk");
        toast.error("Error reading file");
        setfileSending(false);
      };

      reader.readAsArrayBuffer(chunk);
    };

    readAndSendChunk();
  };

  return (
    <Card className="w-[350px]">
      <CardHeader>
        <h1 className="text-2xl font-bold">Share Files</h1>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="name">Your ID</Label>
            <div className="flex">
              <Input
                id="name"
                placeholder="Your ID"
                value={userId || ""}
                disabled
              />
              <Button
                onClick={() => CopyToClipboard(userId)}
                variant="outline"
                size="icon"
                className="ml-2"
              >
                {isCopied ? <Check /> : <CopyIcon />}
              </Button>
            </div>
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="framework">Partner&apos;s ID</Label>
            <div className="flex">
              <Input
                disabled={currentConnection}
                id="framework"
                placeholder="Partner's ID"
                value={partnerId}
                onChange={(e) => setpartnerId(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {!currentConnection && !acceptCaller && (
          <Button
            disabled={isLoading}
            onClick={handleConnectionMaking}
            className="w-full"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <TailSpin
                  height="20"
                  width="20"
                  color="white"
                  ariaLabel="tail-spin-loading"
                  radius="1"
                  visible={true}
                />
                <p>Connecting...</p>
              </div>
            ) : (
              "Connect"
            )}
          </Button>
        )}
        {acceptCaller && (
          <Button onClick={acceptUser} className="w-full">
            Accept Connection
          </Button>
        )}
        {currentConnection && (
          <>
            <FileUploadBtn
              handleFileChange={handleFileChange}
              fileInputRef={fileInputRef}
            />
            <FileUpload
              fileUpload={fileUpload}
              handleWebRTCUpload={() =>
                handleWebRTCUpload(userDetails.peerState)
              }
              fileSending={fileSending}
              fileUploadProgress={fileUploadProgress}
            />
            <FileDownload
              downloadFile={downloadFile}
              fileReceiving={fileReceiving}
              fileDownloadProgress={fileDownloadProgress}
              name={name}
            />
            <ShareLink userId={userId} />
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default ShareCard;
