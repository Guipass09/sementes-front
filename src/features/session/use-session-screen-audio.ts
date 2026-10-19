import { useEffect, useState, type RefObject } from "react";
import { sessionChannelGain, subscribeSessionMix } from "./session-audio-mix";

export function useSessionScreenAudio(stream: MediaStream | null, active: boolean, contextRef: RefObject<AudioContext | null>) {
  const [managed, setManaged] = useState(false);
  useEffect(() => {
    setManaged(false);
    if (!active || !stream) return;
    let source: MediaStreamAudioSourceNode | null = null;
    let gain: GainNode | null = null;
    const disconnect = () => { source?.disconnect(); gain?.disconnect(); source = null; gain = null; };
    const refresh = () => {
      if (gain && contextRef.current) gain.gain.setTargetAtTime(sessionChannelGain("screen"), contextRef.current.currentTime, 0.025);
    };
    const connect = () => {
      disconnect(); setManaged(false);
      if (!stream.getAudioTracks().length || !contextRef.current) return;
      try {
        source = contextRef.current.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        gain = contextRef.current.createGain(); gain.gain.value = sessionChannelGain("screen");
        source.connect(gain); gain.connect(contextRef.current.destination); setManaged(true);
      } catch { disconnect(); }
    };
    connect();
    const unsubscribe = subscribeSessionMix(refresh);
    stream.addEventListener("addtrack", connect); stream.addEventListener("removetrack", connect);
    return () => { disconnect(); unsubscribe(); stream.removeEventListener("addtrack", connect); stream.removeEventListener("removetrack", connect); };
  }, [stream, active, contextRef]);
  return managed;
}
