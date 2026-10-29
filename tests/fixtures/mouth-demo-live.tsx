import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import SessionMouthOverlay from "../../src/features/mouth3d/SessionMouthOverlay";
import { initialSessionMouthState, type SessionMouthState } from "../../src/features/mouth3d/sessionMouthState";
import { MOUTH_DEMO_LEASE } from "../../src/features/mouth3d/mouth-demonstrations";
import "../../src/index.css";

const now = () => Date.now();
const contexts = new Map<string, AudioContext>();
async function audio(role: string) { let context = contexts.get(role); if (!context) { context = new AudioContext(); contexts.set(role, context); } if (context.state !== "running") await context.resume(); return context; }
function Harness() {
  const [professional, setProfessional] = useState<SessionMouthState>({ ...initialSessionMouthState, open: true, x: 0, y: 0, w: .95, h: .95 });
  const [patient, setPatient] = useState(professional);
  const latest = useRef(professional); latest.current = professional;
  const delivery = useRef(true);
  const publish = (state: SessionMouthState) => { setProfessional(state); latest.current = state; if (delivery.current) setPatient(structuredClone(state)); };
  useEffect(() => {
    (window as any).__mouthTest = { delivery(value: boolean) { delivery.current = value; }, close() { publish({ ...latest.current, open: false, demo: null }); }, contexts: () => [...contexts.values()].map(c => c.state) };
    const timer = window.setInterval(() => {
      const state = latest.current;
      if (state.demo?.status === "playing") publish({ ...state, demo: { ...state.demo, expiresAt: now() + MOUTH_DEMO_LEASE } });
    }, 1800);
    return () => window.clearInterval(timer);
  }, []);
  return <><button type="button" onClick={() => void audio("patient")}>Preparar áudio do paciente</button><div style={{ display: "flex", gap: 12 }}>
    <div data-role="professional" style={{ position: "relative", width: 720, height: 620 }}><SessionMouthOverlay state={professional} editable onChange={publish} now={now} connected prepareAudio={() => audio("professional")} /></div>
    <div data-role="patient" style={{ position: "relative", width: 600, height: 620 }}><SessionMouthOverlay state={patient} editable={false} onChange={() => {}} now={now} connected prepareAudio={() => audio("patient")} /></div>
  </div></>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
