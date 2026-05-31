import * as THREE from "three";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * 从一张肖像图生成粒子点云（2.5D）。
 * 清晰度 = 图片分辨率；亮度 → 深度位移做出立体浮雕；亮度也驱动点的亮度/不透明度。
 *
 * 输出 attribute：position / aNormal / aSeed / aRegion / aLum
 *  - aLum 让画面按图片明暗呈现 → 五官/轮廓清晰
 *  - aRegion：粗略标记嘴(下中)/眼(中上两侧)，给 speaking 口型一个锚点
 */
export async function createImageParticles(url: string, targetCount = 70000): Promise<THREE.BufferGeometry> {
  const img = await loadImage(url);

  // 按目标点数推算工作分辨率（约 55% 像素会通过遮罩/阈值）
  const need = targetCount / 0.55;
  const scaleDown = Math.min(1, Math.sqrt(need / (img.width * img.height)));
  const W = Math.max(8, Math.round(img.width * scaleDown));
  const H = Math.max(8, Math.round(img.height * scaleDown));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;

  const aspect = W / H;
  const positions: number[] = [];
  const normals: number[] = [];
  const seeds: number[] = [];
  const regions: number[] = [];
  const lums: number[] = [];

  // 可复现伪随机
  let s = 9871.23;
  const rand = () => {
    s = Math.sin(s * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      if (data[i + 3] < 128) continue; // 透明像素跳过
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      const nx = px / W - 0.5;   // [-0.5, 0.5]
      const ny = 0.5 - py / H;   // [-0.5, 0.5]，y 翻转

      // 椭圆遮罩：去掉四角背景，得到干净的头像构图
      if ((nx / 0.5) * (nx / 0.5) + (ny / 0.5) * (ny / 0.5) > 1.0) continue;
      // 亮度阈值：去暗背景（偏暗像素小概率保留，避免轮廓硬切）
      if (lum < 0.13 && rand() > 0.12) continue;

      const x = nx * 2 * aspect;
      const y = ny * 2;
      const z = (lum - 0.5) * 0.55 + (rand() - 0.5) * 0.03; // 亮 → 靠前（浮雕感）

      positions.push(x, y, z);
      normals.push(0, 0, 1);
      seeds.push(rand());

      let region = 0;
      if (ny > -0.34 && ny < -0.14 && Math.abs(nx) < 0.16) region = 1;            // 嘴
      else if (ny > 0.02 && ny < 0.22 && Math.abs(Math.abs(nx) - 0.17) < 0.09) region = 2; // 眼
      regions.push(region);
      lums.push(lum);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("aNormal", new THREE.BufferAttribute(new Float32Array(normals), 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(seeds), 1));
  geo.setAttribute("aRegion", new THREE.BufferAttribute(new Float32Array(regions), 1));
  geo.setAttribute("aLum", new THREE.BufferAttribute(new Float32Array(lums), 1));
  geo.computeBoundingSphere();
  return geo;
}
