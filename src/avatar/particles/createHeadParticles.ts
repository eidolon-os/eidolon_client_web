import * as THREE from "three";

/**
 * 程序化生成「抽象头部能量体」的点云几何。
 *
 * 思路：
 *  1. Fibonacci 球 → 单位球面上均匀分布的方向，避免极点聚集；
 *  2. 形变成头部椭球（竖向拉长、下半收窄成下巴、后脑略压扁）；
 *  3. 正面半球用解析高斯场轻微雕刻眼/鼻/嘴，并打 aRegion 标记
 *     （高度抽象，不追求精确五官，只为让轮廓"读起来像个头"且口型有锚点）。
 *
 * 写入的 attributes：
 *  - position  基准位置 aBase（shader 里所有运动都相对它叠加）
 *  - aSeed     每粒子随机相位 0..1
 *  - aRegion   0=脸/头, 1=嘴, 2=眼
 *  - aNormal   外向法线（speaking 时沿法线外扩用）
 */
export function createHeadGeometry(count = 40000): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const regions = new Float32Array(count);

  // 椭球半径：竖向最大，深度最小
  const RX = 0.78;
  const RY = 1.0;
  const RZ = 0.72;

  // 黄金角
  const GA = Math.PI * (3 - Math.sqrt(5));

  // 简单可复现的伪随机（避免 Math.random 在不同帧/SSR 抖动；这里只在建几何时用一次）
  let s = 1234.5678;
  const rand = () => {
    s = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  const n = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    // --- 1. Fibonacci 球：均匀方向 ---
    const t = (i + 0.5) / count;
    const y = 1 - 2 * t; // [-1, 1]
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * GA;
    let dx = Math.cos(phi) * r;
    let dy = y;
    let dz = Math.sin(phi) * r;

    // --- 2. 形变成头部 ---
    let px = dx * RX;
    let py = dy * RY;
    let pz = dz * RZ;

    // 下半收窄成下巴（dy<0 越往下越窄）
    if (dy < 0) {
      const taper = 1 + dy * 0.32; // dy=-1 → 0.68
      px *= taper;
      pz *= taper;
    }
    // 后脑略压扁（dz<0）
    if (dz < 0) {
      pz *= 1 - 0.18 * -dz;
    }
    // 正面略前凸（更像脸盘）
    if (dz > 0) {
      pz *= 1 + 0.06 * dz;
    }

    let region = 0;

    // --- 3. 正面雕刻（仅 dz>0 半球，用脸平面坐标 px/py） ---
    if (dz > 0.15) {
      // 眼睛：两个高斯凹陷
      const eyeY = 0.16;
      const eyeX = 0.3;
      const deL = Math.hypot(px + eyeX, (py - eyeY) * 1.4);
      const deR = Math.hypot(px - eyeX, (py - eyeY) * 1.4);
      const eye = Math.exp(-(deL * deL) / 0.012) + Math.exp(-(deR * deR) / 0.012);
      if (eye > 0.35) {
        pz -= 0.05 * eye; // 内凹眼窝
        region = 2;
      }

      // 鼻梁：x≈0 的竖直前凸
      const nose = Math.exp(-(px * px) / 0.01) * Math.exp(-((py + 0.02) * (py + 0.02)) / 0.05);
      pz += 0.06 * nose;

      // 嘴：水平窄椭圆
      const mdx = px / 0.24;
      const mdy = (py + 0.42) / 0.08;
      const mouth = mdx * mdx + mdy * mdy;
      if (mouth < 1.0) {
        pz -= 0.03 * (1 - mouth); // 轻微内凹的嘴缝
        region = 1;
      }
    }

    positions[i * 3] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    // 外向法线：椭球梯度方向 ~ normalize(p / R^2)
    n.set(px / (RX * RX), py / (RY * RY), pz / (RZ * RZ)).normalize();
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;

    seeds[i] = rand();
    regions[i] = region;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aNormal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aRegion", new THREE.BufferAttribute(regions, 1));
  geometry.setAttribute("aLum", new THREE.BufferAttribute(new Float32Array(count).fill(1.0), 1));
  geometry.computeBoundingSphere();
  return geometry;
}
