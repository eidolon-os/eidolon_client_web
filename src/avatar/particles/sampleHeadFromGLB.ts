import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

interface MeshEntry {
  mesh: THREE.Mesh;
  region: number; // 0=脸/头/发, 1=嘴(牙), 2=眼
  area: number;
}

function regionForName(name: string): number | null {
  const n = name.toLowerCase();
  if (/teeth|tongue|mouth/.test(n)) return 1;
  if (/eye/.test(n)) return 2;
  if (/head|face|hair|beard|brow|nose|skin/.test(n)) return 0;
  return null;
}

/**
 * 从 GLB 头模表面均匀采样点云（快速、主线程友好）。
 * 输出 attribute：position / aNormal / aSeed / aRegion。
 * 轮廓清晰度的提升放在渲染层（着色器的朝向 fresnel 淡出），而非加权采样——
 * 因为多数角色模型面数有限、细节在贴图里，加权采样收益小且耗时高。
 */
export async function sampleHeadGeometry(url: string, count = 80000): Promise<THREE.BufferGeometry> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);

  let entries: MeshEntry[] = [];
  const allMeshes: THREE.Mesh[] = [];
  gltf.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as unknown as { isMesh?: boolean }).isMesh || !mesh.geometry) return;
    allMeshes.push(mesh);
    const region = regionForName(mesh.name);
    if (region === null) return;
    mesh.geometry.computeBoundingBox();
    const s = new THREE.Vector3();
    mesh.geometry.boundingBox!.getSize(s);
    entries.push({ mesh, region, area: Math.max(1e-4, s.x * s.y + s.y * s.z + s.x * s.z) });
  });

  let cropToTop = false;
  if (entries.length === 0) {
    entries = allMeshes.map((mesh) => {
      mesh.geometry.computeBoundingBox();
      const s = new THREE.Vector3();
      mesh.geometry.boundingBox!.getSize(s);
      return { mesh, region: 0, area: Math.max(1e-4, s.x * s.y + s.y * s.z + s.x * s.z) };
    });
    cropToTop = true;
  }

  const totalArea = entries.reduce((s, m) => s + m.area, 0);

  const positions: number[] = [];
  const normals: number[] = [];
  const seeds: number[] = [];
  const regions: number[] = [];

  const tPos = new THREE.Vector3();
  const tNorm = new THREE.Vector3();
  const nMat = new THREE.Matrix3();

  for (const entry of entries) {
    const n = Math.max(0, Math.round(count * (entry.area / totalArea)));
    if (n === 0) continue;
    const sampler = new MeshSurfaceSampler(entry.mesh).build();
    const world = entry.mesh.matrixWorld;
    nMat.getNormalMatrix(world);
    for (let i = 0; i < n; i++) {
      sampler.sample(tPos, tNorm);
      tPos.applyMatrix4(world);
      tNorm.applyMatrix3(nMat).normalize();
      positions.push(tPos.x, tPos.y, tPos.z);
      normals.push(tNorm.x, tNorm.y, tNorm.z);
      seeds.push(Math.random());
      regions.push(entry.region);
    }
  }

  let posArr = new Float32Array(positions);
  let nrmArr = new Float32Array(normals);
  let seedArr = new Float32Array(seeds);
  let regArr = new Float32Array(regions);

  // 回退路径：仅当是「全身/高瘦」模型时才裁到头部
  if (cropToTop) {
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < posArr.length; i += 3) {
      minX = Math.min(minX, posArr[i]); maxX = Math.max(maxX, posArr[i]);
      minY = Math.min(minY, posArr[i + 1]); maxY = Math.max(maxY, posArr[i + 1]);
      minZ = Math.min(minZ, posArr[i + 2]); maxZ = Math.max(maxZ, posArr[i + 2]);
    }
    if (!((maxY - minY) > Math.max(maxX - minX, maxZ - minZ) * 1.8)) cropToTop = false;
    if (cropToTop) {
      const thr = maxY - (maxY - minY) * 0.28;
      const p: number[] = [], nn: number[] = [], s: number[] = [], r: number[] = [];
      for (let i = 0; i < posArr.length; i += 3) {
        if (posArr[i + 1] < thr) continue;
        p.push(posArr[i], posArr[i + 1], posArr[i + 2]);
        nn.push(nrmArr[i], nrmArr[i + 1], nrmArr[i + 2]);
        s.push(seedArr[i / 3]); r.push(regArr[i / 3]);
      }
      posArr = new Float32Array(p); nrmArr = new Float32Array(nn);
      seedArr = new Float32Array(s); regArr = new Float32Array(r);
    }
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  out.setAttribute("aNormal", new THREE.BufferAttribute(nrmArr, 3));
  out.setAttribute("aSeed", new THREE.BufferAttribute(seedArr, 1));
  out.setAttribute("aRegion", new THREE.BufferAttribute(regArr, 1));
  const lum = new Float32Array(posArr.length / 3).fill(1.0); // 3D 路径无图片亮度，恒为 1
  out.setAttribute("aLum", new THREE.BufferAttribute(lum, 1));

  // 居中 + 归一化到高度 ~2
  out.computeBoundingBox();
  const bb = out.boundingBox!;
  const center = new THREE.Vector3();
  bb.getCenter(center);
  const size = new THREE.Vector3();
  bb.getSize(size);
  const scale = 2.0 / (Math.max(size.x, size.y, size.z) || 1);
  for (let i = 0; i < posArr.length; i += 3) {
    posArr[i] = (posArr[i] - center.x) * scale;
    posArr[i + 1] = (posArr[i + 1] - center.y) * scale;
    posArr[i + 2] = (posArr[i + 2] - center.z) * scale;
  }
  out.attributes.position.needsUpdate = true;
  out.computeBoundingSphere();
  return out;
}
