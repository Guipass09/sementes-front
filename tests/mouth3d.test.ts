import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createMouthModel } from "../src/features/mouth3d/createMouthModel.ts";

test("two complete arches with 14 individually shaped crowns each", () => {
  const model = createMouthModel();
  try {
    const teeth: THREE.Object3D[] = [];
    model.group.traverse((object) => { if (object.name.includes("-tooth-")) teeth.push(object); });
    assert.equal(teeth.filter((tooth) => tooth.name.startsWith("upper")).length, 14);
    assert.equal(teeth.filter((tooth) => tooth.name.startsWith("lower")).length, 14);
    assert.ok(new Set(teeth.map((tooth) => tooth.position.z)).size >= 7);
  } finally { model.dispose(); }
});

test("geometry remains finite at every combination of movement limits", () => {
  const model = createMouthModel();
  try {
    for (const opening of [0, 0.05, 0.5, 1]) {
      for (const tongueLift of [0, 0.5, 1]) {
        for (const tongueReach of [0, 0.5, 1]) {
          model.update({ opening, tongueLift, tongueReach }, false, true);
          model.group.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            for (const key of ["position", "normal"]) {
              assert.ok(Array.from(object.geometry.getAttribute(key).array).every(Number.isFinite));
            }
            assert.ok(Number.isFinite(object.geometry.boundingSphere?.radius ?? 0));
          });
        }
      }
    }
  } finally { model.dispose(); }
});

test("tongue elevates and advances independently, without rigid translation", () => {
  const model = createMouthModel();
  try {
    model.update({ opening: 0.85, tongueLift: 0, tongueReach: 0 }, false, true);
    const neutral = model.landmarks().tongue;
    const root = new THREE.Vector3().fromBufferAttribute(model.tongueMesh.geometry.attributes.position, 0);
    model.update({ opening: 0.85, tongueLift: 1, tongueReach: 0 }, false, true);
    assert.ok(model.landmarks().tongue.y > neutral.y + 0.5);
    model.update({ opening: 0.85, tongueLift: 0, tongueReach: 1 }, false, true);
    assert.ok(model.landmarks().tongue.z > neutral.z + 0.7);
    const movedRoot = new THREE.Vector3().fromBufferAttribute(model.tongueMesh.geometry.attributes.position, 0);
    assert.ok(root.distanceTo(movedRoot) < 0.001);
  } finally { model.dispose(); }
});

test("closed lips hide the interior and the anatomy toggle restores it", () => {
  const model = createMouthModel();
  try {
    const pose = { opening: 0, tongueLift: 1, tongueReach: 1 };
    model.update(pose, false, true);
    assert.equal(model.tongueMesh.visible, false);
    assert.equal(model.faceMesh.visible, true);
    model.update(pose, false, false);
    assert.equal(model.tongueMesh.visible, true);
    assert.equal(model.faceMesh.visible, false);
    assert.equal(model.lipMesh.visible, false);
  } finally { model.dispose(); }
});

test("cutaway and frontal views can be switched repeatedly", () => {
  const model = createMouthModel();
  try {
    const pose = { opening: 0.85, tongueLift: 0.2, tongueReach: 0.2 };
    for (const cutaway of [true, false, true, false]) {
      model.update(pose, cutaway, true);
      const material = model.tongueMesh.material as THREE.MeshPhysicalMaterial;
      assert.equal(Boolean(material.clippingPlanes?.length), cutaway);
      assert.equal(model.faceMesh.visible, !cutaway);
    }
  } finally { model.dispose(); }
});

test("all mesh buffers, materials and the shared tissue texture are disposed", () => {
  const model = createMouthModel();
  const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
  model.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    resources.add(object.geometry);
    const material = object.material as THREE.MeshPhysicalMaterial;
    resources.add(material);
    if (material.bumpMap) resources.add(material.bumpMap);
  });
  let disposed = 0;
  for (const resource of resources) resource.addEventListener("dispose", () => { disposed++; });
  model.dispose();
  assert.equal(disposed, resources.size);
});
