import * as THREE from "three";

export type MouthPose = { opening: number; tongueLift: number; tongueReach: number };
type Surface = (u: number, v: number, point: THREE.Vector3) => void;
const TAU = Math.PI * 2;
const mix = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;

// Indexed surfaces share vertices so deformation keeps the tissue continuous.
function surface(columns: number, rows: number, sample: Surface) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  const uv = new Float32Array((columns + 1) * (rows + 1) * 2);
  const indices: number[] = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= columns; i++) {
      const n = j * (columns + 1) + i;
      uv.set([i / columns, j / rows], n * 2);
      if (i < columns && j < rows) indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1);
    }
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const point = new THREE.Vector3();
  const update = (fn: Surface) => {
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= columns; i++) {
        fn(i / columns, j / rows, point);
        point.toArray(positions, (j * (columns + 1) + i) * 3);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  };
  update(sample);
  return { geometry, update };
}

function tissueTexture() {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  let seed = 17;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 110 + (seed >>> 26);
    data.set([value, value, value, 255], i * 4);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;
  return texture;
}

export function createMouthModel() {
  const group = new THREE.Group();
  const jaw = new THREE.Group();
  jaw.position.z = -1;
  group.add(jaw);
  const clippingPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const texture = tissueTexture();
  const materials: THREE.MeshPhysicalMaterial[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const material = (color: number, roughness: number, bumpScale = 0) => {
    const result = new THREE.MeshPhysicalMaterial({ color, roughness, side: THREE.DoubleSide, clipShadows: true,
      clearcoat: roughness < 0.6 ? 0.18 : 0.03, clearcoatRoughness: 0.35,
      bumpMap: bumpScale ? texture : null, bumpScale });
    materials.push(result);
    return result;
  };
  const skin = material(0xc9957e, 0.83, 0.018);
  const lips = material(0xb85864, 0.48, 0.007);
  const gum = material(0xb65e63, 0.6, 0.008);
  const palateMaterial = material(0xc7807e, 0.72, 0.009);
  const tongueMaterial = material(0xb95f6d, 0.53, 0.015);
  const throatMaterial = material(0x48252e, 0.97);
  const enamel = material(0xffffff, 0.3);
  enamel.vertexColors = true;
  const sectionMaterial = material(0xd58a90, 0.82);
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent = group) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  let pose: MouthPose = { opening: 0.72, tongueLift: 0.12, tongueReach: 0.25 };
  const lipPoint = (angle: number, radial: number, point: THREE.Vector3) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    const upper = s >= 0;
    const arch = Math.pow(Math.abs(s), 0.85);
    const open = pose.opening;
    const cupid = upper ? 0.065 * Math.exp(-Math.pow(c / 0.16, 2)) : 0;
    const innerY = upper ? (0.002 + open * 0.46) * arch - cupid * open : -(0.002 + open * 1.1) * arch;
    const thickness = (upper ? 0.18 - 0.045 * Math.exp(-Math.pow(c / 0.17, 2)) : 0.21) * Math.pow(Math.abs(s), 1.15);
    const x = c * (1.16 - open * 0.055 + radial * 0.16);
    const y = innerY + (upper ? 1 : -1) * thickness * radial;
    const z = 1.05 - 0.38 * Math.pow(Math.abs(c), 1.7) + 0.11 * Math.sin(radial * Math.PI) - 0.055 * radial;
    const folds = Math.sin(angle * 95 + Math.sin(angle * 17)) * 0.0025 * Math.sin(radial * Math.PI);
    point.set(x, y, z + folds);
  };
  const lipSurface = surface(144, 16, (u, v, p) => lipPoint(u * TAU, v, p));
  const lipMesh = add(lipSurface.geometry, lips);
  const lipColors: number[] = [];
  for (let j = 0; j <= 16; j++) {
    const color = new THREE.Color(0x8f3d4d).lerp(new THREE.Color(0xca7a7c), Math.sin(j / 16 * Math.PI / 2));
    for (let i = 0; i <= 144; i++) lipColors.push(color.r, color.g, color.b);
  }
  lips.color.set(0xffffff);
  lips.vertexColors = true;
  lipSurface.geometry.setAttribute("color", new THREE.Float32BufferAttribute(lipColors, 3));

  const edge = new THREE.Vector3();
  const facePoint: Surface = (u, v, p) => {
    const a = u * TAU, c = Math.cos(a), s = Math.sin(a);
    lipPoint(a, 1, edge);
    const outerX = c * 1.8;
    const outerY = s * (s > 0 ? 1.24 : 1.42 + pose.opening * 0.56);
    const x = mix(edge.x, outerX, v), y = mix(edge.y, outerY, v);
    let z = edge.z - 0.07 * v - (edge.z + 0.45) * v ** 5;
    // Philtrum and chin belong to the same facial surface as the lips.
    z += 0.20 * Math.exp(-Math.pow(x / 0.3, 2) - Math.pow((y - 0.98) / 0.25, 2));
    z -= 0.035 * Math.exp(-Math.pow(x / 0.07, 2)) * Math.sin(Math.PI * v) * Math.max(0, s);
    z += 0.10 * Math.exp(-Math.pow(x / 0.6, 2)) * Math.sin(Math.PI * v) * Math.max(0, -s);
    z -= 0.035 * Math.exp(-Math.pow((Math.abs(x) - 1.36 + y * 0.17) / 0.075, 2)) * Math.sin(Math.PI * v);
    p.set(x, y, z);
  };
  const face = surface(144, 24, facePoint);
  const faceMesh = add(face.geometry, skin);
  const wallPoint: Surface = (u, v, p) => {
    lipPoint(u * TAU, 0, p);
    const s = Math.sin(u * TAU), c = Math.cos(u * TAU);
    const depth = smooth(v, 0, 0.48);
    p.x = mix(p.x, c * (1.19 - 0.30 * v ** 4), depth);
    p.y = mix(p.y, s > 0 ? s * 0.98 : s * (0.54 + pose.opening * 0.98), depth);
    p.z = mix(p.z - 0.015, -1.35, v);
  };
  const oralWall = surface(112, 22, wallPoint);
  const wallMesh = add(oralWall.geometry, gum);
  const throatMesh = add(new THREE.SphereGeometry(1, 32, 24), throatMaterial);
  throatMesh.position.set(0, -0.18, -1.36);
  throatMesh.scale.set(0.85, 0.81, 0.12);
  const roofPoint: Surface = (u, v, p) => {
    const x = (u * 2 - 1) * (0.96 - 0.1 * v);
    const z = mix(0.69, -1.27, v);
    const dome = Math.max(0, 1 - (x / 1.03) ** 2);
    const rugae = 0.015 * Math.cos(v * 56 + Math.abs(x) * 5) * Math.exp(-v * 4) * dome;
    p.set(x, 0.42 + 0.40 * dome * Math.sin(0.35 + v * 2.35) + rugae, z);
  };
  add(surface(52, 64, roofPoint).geometry, palateMaterial);
  const uvula = add(new THREE.SphereGeometry(1, 20, 20), gum);
  uvula.position.set(0, 0.42, -1.22);
  uvula.scale.set(0.075, 0.18, 0.08);
  const archPoint = (angle: number, lower: boolean) => new THREE.Vector3(
    Math.sin(angle) * (lower ? 0.91 : 0.97), lower ? -0.38 : 0.48, Math.cos(angle) * 1.53 - 0.83,
  );
  for (const lower of [false, true]) {
    const parent = lower ? jaw : group;
    const gums = surface(100, 20, (u, v, p) => {
      const a = mix(-1.65, 1.65, u), t = v * TAU;
      p.copy(archPoint(a, lower));
      p.x += Math.sin(a) * Math.cos(t) * 0.17;
      p.z += Math.cos(a) * Math.cos(t) * 0.17 + (lower ? 1 : 0);
      p.y += (lower ? -0.05 : 0.07) + Math.sin(t) * (lower ? 0.21 : 0.25);
    });
    add(gums.geometry, gum, parent);
    // Individual crown profiles: incisors, canines, premolars and molars.
    const angles = [0.14, 0.40, 0.64, 0.86, 1.08, 1.32, 1.57];
    angles.forEach((angle, index) => {
      for (const side of [-1, 1]) {
        const incisor = index < 2, canine = index === 2;
        const width = [0.265, 0.23, 0.225, 0.255, 0.275, 0.32, 0.32][index] * (lower ? 0.92 : 1);
        const height = (incisor ? 0.36 : canine ? 0.38 : 0.27) * (lower ? 0.88 : 1);
        const depth = incisor ? 0.16 : canine ? 0.22 : 0.29;
        const crown = surface(36, 22, (u, v, p) => {
          const theta = u * TAU;
          const rounded = (value: number) => Math.sign(value) * Math.pow(Math.abs(value), 0.58);
          const taper = 0.80 + 0.18 * Math.sin(v * Math.PI * 0.8);
          const capProgress = smooth(v, 0.8, 1);
          const cap = Math.cos(capProgress * Math.PI / 2);
          const x = rounded(Math.cos(theta)) * width / 2 * taper * cap;
          const z = rounded(Math.sin(theta)) * depth / 2 * cap;
          const cusp = canine ? (1 - Math.abs(x) / (width / 2)) * 0.055 * smooth(v, 0.65, 1) : 0;
          const occlusal = !incisor && !canine ? (0.02 + 0.023 * Math.cos(theta * 4)) * Math.sin(capProgress * Math.PI) - 0.026 * capProgress : 0;
          const crownCurve = incisor ? -0.026 * Math.sin(v * Math.PI) : 0;
          const heightAtV = v < 0.8 ? v / 0.8 * height * 0.94 : height * (0.94 + 0.06 * Math.sin(capProgress * Math.PI / 2));
          p.set(x, (lower ? 1 : -1) * (heightAtV + cusp + occlusal), z + crownCurve);
        });
        const colors: number[] = [];
        for (let row = 0; row <= 22; row++) {
          const color = new THREE.Color(0xd9c7a9).lerp(new THREE.Color(0xf6f1e5), smooth(row / 22, 0, 0.6));
          for (let column = 0; column <= 36; column++) colors.push(color.r, color.g, color.b);
        }
        crown.geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        const tooth = add(crown.geometry, enamel, parent);
        tooth.name = `${lower ? "lower" : "upper"}-tooth-${side}-${index}`;
        tooth.position.copy(archPoint(angle * side, lower));
        tooth.position.y += lower ? 0.06 : -0.055;
        tooth.position.z += lower ? 1 : 0;
        tooth.rotation.y = angle * side * 0.86;
      }
    });
  }
  const tonguePoint: Surface = (u, v, p) => {
    const t = u, a = v * TAU;
    const open = pose.opening;
    const reach = pose.tongueReach * smooth(open, 0.03, 0.4);
    const lift = pose.tongueLift * smooth(open, 0, 0.4);
    const tipZ = 0.28 + reach * 1.13 - lift * 0.46;
    const width = 0.59 * (1 - 0.18 * t) * Math.sqrt(Math.max(0, 1 - t ** 8));
    const x = Math.cos(a) * width;
    const baseY = -0.22 - open * 0.58;
    const centerAt = (position: number) => {
      const bend = Math.pow(smooth(position, 0.3, 1), 1.55);
      return baseY + 0.27 * Math.sin(position * Math.PI) + lift * (0.50 - baseY) * bend + reach * (1 - lift) * 0.13 * bend;
    };
    const centerY = centerAt(t);
    const tangentY = (centerAt(Math.min(1, t + 0.001)) - centerAt(Math.max(0, t - 0.001))) / (t === 0 || t === 1 ? 0.001 : 0.002);
    const tangentZ = tipZ + 1.26;
    const tangentLength = Math.hypot(tangentY, tangentZ);
    const thickness = (0.26 - t * 0.14) * Math.sqrt(Math.max(0, 1 - t ** 8));
    const groove = 0.027 * Math.exp(-Math.pow(x / 0.065, 2)) * Math.sin(t * Math.PI) * Math.max(0, Math.sin(a));
    const offset = Math.sin(a) * thickness;
    p.set(x, centerY + offset * tangentZ / tangentLength - groove, mix(-1.26, tipZ, t) - offset * tangentY / tangentLength);
  };
  const tongue = surface(76, 48, tonguePoint);
  const tongueMesh = add(tongue.geometry, tongueMaterial);
  tongueMesh.castShadow = false;
  const tongueColors: number[] = [];
  for (let row = 0; row <= 48; row++) {
    for (let column = 0; column <= 76; column++) {
      const color = new THREE.Color(0x984b5a).lerp(new THREE.Color(0xca828b), Math.max(0, Math.sin(row / 48 * TAU)) * 0.8);
      const speckle = 0.96 + 0.04 * Math.sin(column * 19.7 + row * 51.3);
      color.multiplyScalar(speckle);
      tongueColors.push(color.r, color.g, color.b);
    }
  }
  tongueMaterial.color.set(0xffffff);
  tongueMaterial.vertexColors = true;
  tongue.geometry.setAttribute("color", new THREE.Float32BufferAttribute(tongueColors, 3));
  const tongueSectionPoint: Surface = (u, v, p) => {
    tonguePoint(u, 0.25, p);
    const top = p.y;
    const topZ = p.z;
    tonguePoint(u, 0.75, p);
    p.set(0.002, mix(p.y, top, v), mix(p.z, topZ, v));
  };
  const tongueCap = surface(76, 14, tongueSectionPoint);
  const tongueSection = add(tongueCap.geometry, sectionMaterial);
  tongueSection.visible = false;
  const roofSection = add(surface(64, 1, (u, v, p) => {
    roofPoint(0.5, u, p);
    p.x = 0.002;
    p.y += v * 0.095;
  }).geometry, sectionMaterial);
  roofSection.visible = false;
  const gumSections: THREE.Mesh[] = [];
  for (const lower of [false, true]) {
    const mesh = add(new THREE.CircleGeometry(1, 48), sectionMaterial, lower ? jaw : group);
    mesh.rotation.y = Math.PI / 2;
    mesh.scale.set(0.17, lower ? 0.21 : 0.25, 1);
    mesh.position.set(0.003, lower ? -0.43 : 0.55, lower ? 1.7 : 0.7);
    mesh.visible = false;
    gumSections.push(mesh);
  }
  const update = (next: MouthPose, cutaway: boolean, showFace: boolean) => {
    pose = next;
    lipSurface.update((u, v, p) => lipPoint(u * TAU, v, p));
    face.update(facePoint);
    oralWall.update(wallPoint);
    jaw.rotation.x = pose.opening * 0.46;
    tongue.update(tonguePoint);
    tongueCap.update(tongueSectionPoint);
    faceMesh.visible = showFace && !cutaway;
    lipMesh.visible = showFace;
    wallMesh.visible = !cutaway && showFace;
    throatMesh.visible = !cutaway && showFace;
    tongueSection.visible = roofSection.visible = cutaway;
    gumSections.forEach((mesh) => { mesh.visible = cutaway; });
    const showInterior = cutaway || !showFace || pose.opening > 0.06;
    for (const child of group.children) {
      if (child === faceMesh || child === lipMesh || child === wallMesh || child === throatMesh || child === tongueSection || child === roofSection || gumSections.includes(child as THREE.Mesh)) continue;
      child.visible = showInterior;
    }
    for (const mat of materials) {
      if (mat === sectionMaterial) continue;
      if (Boolean(mat.clippingPlanes?.length) !== cutaway) {
        mat.clippingPlanes = cutaway ? [clippingPlane] : null;
        mat.needsUpdate = true;
      }
    }
  };
  return {
    group, tongueMesh, lipMesh, faceMesh, update,
    landmarks: () => {
      const tip = new THREE.Vector3();
      tonguePoint(0.91, 0.25, tip);
      return { tongue: tip, palate: new THREE.Vector3(0, 0.73, -0.15), teeth: new THREE.Vector3(-0.43, 0.22, 0.7) };
    },
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((mat) => mat.dispose());
      texture.dispose();
    },
  };
}
