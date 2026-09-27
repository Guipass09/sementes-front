import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createMouthModel } from "./createMouthModel";

export type MouthView = "front" | "angle" | "section";
export type MouthDragMode = "jaw" | "tongue";
type MouthModelSceneProps = {
  opening: number;
  tongueLift: number;
  tongueReach: number;
  view: MouthView;
  dragMode: MouthDragMode;
  showFace: boolean;
  showLabels: boolean;
  onOpeningChange: (value: number) => void;
  onTongueLiftChange: (value: number) => void;
  onTongueReachChange: (value: number) => void;
};
const clamp = (value: number) => THREE.MathUtils.clamp(value, 0, 1);

export default function MouthModelScene(props: MouthModelSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef(props);
  const requestRenderRef = useRef<() => void>(() => {});
  const [unavailable, setUnavailable] = useState(false);
  callbacksRef.current = props;
  useEffect(() => { requestRenderRef.current(); }, [props.opening, props.tongueLift, props.tongueReach, props.view, props.showFace, props.showLabels]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0xeaf0f0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Boca 3D interativa. Controles de movimento disponíveis ao lado.");
    container.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.3;
    room.dispose();
    pmrem.dispose();
    const key = new THREE.DirectionalLight(0xfff5ec, 2.4);
    key.position.set(-3, 4, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 16 });
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0002;
    const fill = new THREE.DirectionalLight(0xe5f2ff, 0.75);
    fill.position.set(4, 1, 5);
    scene.add(key, fill, new THREE.HemisphereLight(0xffffff, 0x987c7f, 0.65));
    const model = createMouthModel();
    scene.add(model.group);
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 60);
    camera.position.set(0, 0.35, 8);
    const targetCamera = new THREE.Vector3();
    const focus = new THREE.Vector3(0, -0.25, 0);
    const pose = { opening: props.opening, tongueLift: props.tongueLift, tongueReach: props.tongueReach };
    let frame = 0;
    let active = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const labels = Array.from(container.querySelectorAll<HTMLElement>("[data-landmark]"));
    const render = () => {
      frame = 0;
      if (!active) return;
      const target = callbacksRef.current;
      const smoothing = reducedMotion ? 1 : 0.24;
      pose.opening = THREE.MathUtils.lerp(pose.opening, target.opening, smoothing);
      pose.tongueLift = THREE.MathUtils.lerp(pose.tongueLift, target.tongueLift, smoothing);
      pose.tongueReach = THREE.MathUtils.lerp(pose.tongueReach, target.tongueReach, smoothing);
      model.update(pose, target.view === "section", target.showFace);
      const aspect = container.clientWidth / container.clientHeight;
      const distance = Math.max(7.5, 6.4 / Math.max(aspect, 0.5));
      if (target.view === "section") targetCamera.set(distance * 0.98, 0.1, distance * 0.20);
      else if (target.view === "angle") targetCamera.set(distance * 0.43, 0.65, distance * 0.90);
      else targetCamera.set(0, 0.25, distance);
      camera.position.lerp(targetCamera, reducedMotion ? 1 : 0.18);
      camera.lookAt(focus);
      renderer.render(scene, camera);
      const landmarks = model.landmarks();
      for (const label of labels) {
        const name = label.dataset.landmark as keyof typeof landmarks;
        const position = landmarks[name].clone().project(camera);
        label.style.left = `${(position.x * 0.5 + 0.5) * 100}%`;
        label.style.top = `${(-position.y * 0.5 + 0.5) * 100}%`;
        label.hidden = !target.showLabels || (target.showFace && target.view !== "section" && (pose.opening < 0.4 || name === "palate"));
      }
      if (Math.abs(pose.opening - target.opening) > 0.001 || Math.abs(pose.tongueLift - target.tongueLift) > 0.001 || Math.abs(pose.tongueReach - target.tongueReach) > 0.001 || camera.position.distanceTo(targetCamera) > 0.005) frame = requestAnimationFrame(render);
    };
    const requestRender = () => { if (!frame && active) frame = requestAnimationFrame(render); };
    requestRenderRef.current = requestRender;
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = container;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      requestRender();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let drag: { id: number; mode: MouthDragMode; x: number; y: number; lift: number; reach: number; opening: number } | null = null;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || drag) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([model.tongueMesh, model.faceMesh, model.lipMesh].filter((mesh) => mesh.visible))[0];
      const current = callbacksRef.current;
      drag = { id: event.pointerId, mode: hit?.object === model.tongueMesh ? "tongue" : current.dragMode, x: event.clientX, y: event.clientY, lift: current.tongueLift, reach: current.tongueReach, opening: current.opening };
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const distance = Math.max(150, Math.min(container.clientWidth, container.clientHeight) * 0.45);
      const current = callbacksRef.current;
      if (drag.mode === "tongue") {
        current.onTongueLiftChange(clamp(drag.lift - (event.clientY - drag.y) / distance));
        // In the cutaway, anterior is on the left side of the screen.
        current.onTongueReachChange(clamp(drag.reach + (event.clientX - drag.x) / distance * (current.view === "section" ? -1 : 1)));
      } else current.onOpeningChange(clamp(drag.opening + (event.clientY - drag.y) / distance));
    };
    const onPointerUp = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      renderer.domElement.style.cursor = "grab";
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    };
    const onContextLost = (event: Event) => { event.preventDefault(); active = false; cancelAnimationFrame(frame); frame = 0; setUnavailable(true); };
    const onContextRestored = () => { active = true; setUnavailable(false); requestRender(); };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("lostpointercapture", onPointerUp);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
    renderer.domElement.style.cursor = "grab";
    requestRender();
    return () => {
      active = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      requestRenderRef.current = () => {};
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("lostpointercapture", onPointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      model.dispose();
      key.shadow.map?.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="mouth3d-canvas" ref={containerRef}>
    <span hidden className="mouth3d-landmark mouth3d-landmark-palate" data-landmark="palate">Palato</span>
    <span hidden className="mouth3d-landmark mouth3d-landmark-teeth" data-landmark="teeth">Dentes</span>
    <span hidden className="mouth3d-landmark mouth3d-landmark-tongue" data-landmark="tongue">Língua</span>
    {unavailable && <div className="mouth3d-unavailable" role="alert">A visualização 3D está indisponível. Verifique a aceleração gráfica do navegador ou recarregue a página.</div>}
  </div>;
}
