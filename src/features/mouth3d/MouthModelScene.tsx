import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type MouthView = "front" | "angle";

type MouthModelSceneProps = {
  opening: number;
  tongueLift: number;
  tongueReach: number;
  view: MouthView;
  onOpeningChange: (value: number) => void;
  onTongueLiftChange: (value: number) => void;
  onTongueReachChange: (value: number) => void;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function MouthModelScene(props: MouthModelSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacksRef = useRef(props);
  const requestRenderRef = useRef<() => void>(() => {});
  callbacksRef.current = props;

  useEffect(() => {
    requestRenderRef.current();
  }, [props.opening, props.tongueLift, props.tongueReach, props.view]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      container.dataset.webgl = "unsupported";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0xe9f2ee);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute("aria-label", "Modelo tridimensional da boca");
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.05, 7.4);
    camera.lookAt(0, -0.15, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xbca4a0, 2.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.1);
    keyLight.position.set(-3, 5, 7);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffc9a7, 1.6);
    rimLight.position.set(3, -1, -4);
    scene.add(rimLight);

    const root = new THREE.Group();
    scene.add(root);
    const ball = new THREE.SphereGeometry(1, 48, 32);
    const geometries: THREE.BufferGeometry[] = [ball];
    const skin = new THREE.MeshPhysicalMaterial({ color: 0xdba18d, roughness: 0.82, clearcoat: 0.05 });
    const skinLight = new THREE.MeshPhysicalMaterial({ color: 0xe9b6a3, roughness: 0.76 });
    const skinShadow = new THREE.MeshPhysicalMaterial({ color: 0xaf6f70, roughness: 0.85 });
    const lip = new THREE.MeshPhysicalMaterial({ color: 0xa6495c, roughness: 0.65, clearcoat: 0.14 });
    const lipLight = new THREE.MeshPhysicalMaterial({ color: 0xc56c77, roughness: 0.64, clearcoat: 0.12 });
    const mouthDark = new THREE.MeshStandardMaterial({ color: 0x512f3a, roughness: 1 });
    const tonguePink = new THREE.MeshPhysicalMaterial({ color: 0xc96c77, roughness: 0.74 });
    const tooth = new THREE.MeshPhysicalMaterial({ color: 0xfff8ed, roughness: 0.38, clearcoat: 0.3 });
    const materials = [skin, skinLight, skinShadow, lip, lipLight, mouthDark, tonguePink, tooth];

    const addBall = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      const mesh = new THREE.Mesh(ball, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
      return mesh;
    };

    addBall(root, skin, 0, 0.32, -0.48, 1.7, 0.9, 0.75);

    const jaw = new THREE.Group();
    root.add(jaw);
    addBall(jaw, skin, 0, -0.77, -0.4, 1.5, 0.59, 0.7);
    addBall(jaw, skinLight, 0, -0.89, -0.13, 1.15, 0.38, 0.43);

    const cavity = addBall(root, mouthDark, 0, -0.29, 0.58, 1.23, 0.32, 0.18);
    const cavityDepth = addBall(root, skinShadow, 0, -0.31, 0.43, 1.31, 0.38, 0.17);

    const upperLipPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.3, -0.03, 0.72),
      new THREE.Vector3(-0.85, 0.1, 0.86),
      new THREE.Vector3(-0.22, 0.19, 0.91),
      new THREE.Vector3(0, 0.12, 0.94),
      new THREE.Vector3(0.22, 0.19, 0.91),
      new THREE.Vector3(0.85, 0.1, 0.86),
      new THREE.Vector3(1.3, -0.03, 0.72),
    ]);
    const upperLipGeometry = new THREE.TubeGeometry(upperLipPath, 56, 0.12, 12, false);
    geometries.push(upperLipGeometry);
    root.add(new THREE.Mesh(upperLipGeometry, lipLight));
    addBall(root, lipLight, -1.3, -0.03, 0.72, 0.12, 0.12, 0.12);
    addBall(root, lipLight, 1.3, -0.03, 0.72, 0.12, 0.12, 0.12);

    const lowerLipPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.3, -0.05, 0.75),
      new THREE.Vector3(-0.85, -0.19, 0.89),
      new THREE.Vector3(0, -0.28, 0.96),
      new THREE.Vector3(0.85, -0.19, 0.89),
      new THREE.Vector3(1.3, -0.05, 0.75),
    ]);
    const closedLipPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.3, -0.05, 0.75),
      new THREE.Vector3(-0.85, -0.08, 0.89),
      new THREE.Vector3(0, -0.09, 0.96),
      new THREE.Vector3(0.85, -0.08, 0.89),
      new THREE.Vector3(1.3, -0.05, 0.75),
    ]);
    const lowerLipGeometry = new THREE.TubeGeometry(lowerLipPath, 56, 0.14, 12, false);
    const closedLipGeometry = new THREE.TubeGeometry(closedLipPath, 56, 0.14, 12, false);
    lowerLipGeometry.morphAttributes.position = [closedLipGeometry.attributes.position];
    geometries.push(lowerLipGeometry, closedLipGeometry);
    const lowerLip = new THREE.Mesh(lowerLipGeometry, lip);
    const lowerLipGroup = new THREE.Group();
    lowerLipGroup.add(lowerLip);
    addBall(lowerLipGroup, lip, -1.3, -0.05, 0.75, 0.14, 0.14, 0.14);
    addBall(lowerLipGroup, lip, 1.3, -0.05, 0.75, 0.14, 0.14, 0.14);
    root.add(lowerLipGroup);

    const upperTeeth = new THREE.Group();
    const lowerTeeth = new THREE.Group();
    root.add(upperTeeth, lowerTeeth);
    addBall(upperTeeth, skinShadow, 0, -0.09, 0.64, 1.12, 0.18, 0.16);
    addBall(lowerTeeth, skinShadow, 0, -0.26, 0.64, 1.09, 0.16, 0.16);
    const toothGeometry = new RoundedBoxGeometry(1, 1, 1, 4, 0.2);
    geometries.push(toothGeometry);
    for (let i = 0; i < 8; i++) {
      const x = (i - 3.5) * 0.27;
      const edge = Math.abs(x) / 0.95;
      const width = edge > 0.65 ? 0.17 : 0.22;
      const top = new THREE.Mesh(toothGeometry, tooth);
      top.position.set(x, -0.1 - edge * 0.08, 0.88 - edge * 0.07);
      top.scale.set(width, 0.21 - edge * 0.04, 0.14);
      top.rotation.y = x * 0.13;
      upperTeeth.add(top);
      const bottom = new THREE.Mesh(toothGeometry, tooth);
      bottom.position.set(x, -0.32 + edge * 0.05, 0.87 - edge * 0.07);
      bottom.scale.set(width * 0.92, 0.15, 0.13);
      bottom.rotation.y = x * 0.13;
      lowerTeeth.add(bottom);
    }

    const tongue = new THREE.Group();
    root.add(tongue);
    const tongueBody = addBall(tongue, tonguePink, 0, 0, 0.81, 0.76, 0.19, 0.26);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let drag: { id: number; mode: "jaw" | "tongue"; x: number; y: number; lift: number; reach: number; opening: number } | null = null;
    const current = { opening: props.opening, lift: props.tongueLift, reach: props.tongueReach };
    let frame = 0;

    const render = () => {
      frame = 0;
      const target = callbacksRef.current;
      current.opening += (target.opening - current.opening) * 0.22;
      current.lift += (target.tongueLift - current.lift) * 0.22;
      current.reach += (target.tongueReach - current.reach) * 0.22;
      const open = current.opening;
      jaw.position.y = -open * 0.62;
      cavity.scale.y = 0.055 + open * 0.66;
      cavity.position.y = -0.2 - open * 0.33;
      cavityDepth.scale.y = 0.08 + open * 0.68;
      cavityDepth.position.y = cavity.position.y;
      lowerLipGroup.position.y = -open * 0.8;
      if (lowerLip.morphTargetInfluences) lowerLip.morphTargetInfluences[0] = 1 - open;
      lowerTeeth.position.y = 0.23 - open * 0.88;
      tongue.position.set(0, -0.2 - open * 0.48 + current.lift * 0.43, current.reach * 0.25);
      tongueBody.scale.y = 0.1 + open * 0.23;
      tongue.visible = open > 0.04;
      upperTeeth.visible = open > 0.04;
      lowerTeeth.visible = open > 0.04;

      const compact = container.clientWidth < 550;
      const cameraTarget = target.view === "angle"
        ? new THREE.Vector3(compact ? 3 : 3.7, 0.3, compact ? 6.2 : 7)
        : new THREE.Vector3(0, 0.05, compact ? 6.5 : 7.4);
      camera.position.lerp(cameraTarget, 0.14);
      camera.lookAt(0, -0.18, 0);
      renderer.render(scene, camera);

      if (
        Math.abs(current.opening - target.opening) > 0.002 ||
        Math.abs(current.lift - target.tongueLift) > 0.002 ||
        Math.abs(current.reach - target.tongueReach) > 0.002 ||
        camera.position.distanceTo(cameraTarget) > 0.01
      ) frame = requestAnimationFrame(render);
    };
    const requestRender = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    requestRenderRef.current = requestRender;

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width < 550 ? 40 : 35;
      camera.updateProjectionMatrix();
      requestRender();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const onPointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const onTongue = raycaster.intersectObject(tongueBody, false).length > 0;
      drag = {
        id: event.pointerId,
        mode: onTongue ? "tongue" : "jaw",
        x: event.clientX,
        y: event.clientY,
        lift: callbacksRef.current.tongueLift,
        reach: callbacksRef.current.tongueReach,
        opening: callbacksRef.current.opening,
      };
      renderer.domElement.setPointerCapture(event.pointerId);
      renderer.domElement.style.cursor = "grabbing";
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const distance = Math.max(160, Math.min(container.clientWidth, container.clientHeight) * 0.44);
      if (drag.mode === "tongue") {
        callbacksRef.current.onTongueLiftChange(clamp(drag.lift - (event.clientY - drag.y) / distance));
        callbacksRef.current.onTongueReachChange(clamp(drag.reach + (event.clientX - drag.x) / distance));
      } else {
        callbacksRef.current.onOpeningChange(clamp(drag.opening + (event.clientY - drag.y) / distance));
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      if (drag?.id !== event.pointerId) return;
      drag = null;
      renderer.domElement.style.cursor = "grab";
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.style.cursor = "grab";
    requestRender();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(frame);
      requestRenderRef.current = () => {};
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="mouth3d-canvas" ref={containerRef} role="img" aria-label="Modelo tridimensional interativo da boca" />;
}
