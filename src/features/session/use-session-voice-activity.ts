import { useEffect, type RefObject } from "react";

export function useSessionVoiceActivity(stream: MediaStream | null, contextRef: RefObject<AudioContext | null>, report: (speaking: boolean) => void) {
  useEffect(() => {
    if (!stream) { report(false); return; }
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let raf = 0;
    const stop = () => {
      cancelAnimationFrame(raf); source?.disconnect(); analyser?.disconnect(); source = null; analyser = null; report(false);
    };
    const start = () => {
      stop();
      if (!stream.getAudioTracks().length || !contextRef.current) return;
      try {
        source = contextRef.current.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        analyser = contextRef.current.createAnalyser(); analyser.fftSize = 1024; source.connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let lastVoice = -Infinity;
        const tick = () => {
          if (!analyser) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const sample of data) sum += ((sample - 128) / 128) ** 2;
          const hot = Math.sqrt(sum / data.length) >= 0.025;
          if (hot) lastVoice = performance.now();
          report(hot || performance.now() - lastVoice < 400);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { stop(); }
    };
    start();
    stream.addEventListener("addtrack", start); stream.addEventListener("removetrack", start);
    return () => { stop(); stream.removeEventListener("addtrack", start); stream.removeEventListener("removetrack", start); };
  }, [stream, contextRef, report]);
}
