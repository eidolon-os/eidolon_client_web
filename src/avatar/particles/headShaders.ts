/**
 * 全息粒子头部的 GLSL（ShaderMaterial，GLSL ES 1.00，WebGL1/2 通用）。
 *
 * 状态码（uStateFrom / uStateTo）：0=idle 1=listening 2=thinking 3=speaking
 * 顶点对 from / to 两态各算一遍位移与能量，按 uStateMix 插值 → 切换永远平滑。
 * 任意状态都叠加了与 uTime 相关的持续微动，所以绝不静止。
 */

// Ashima simplex 3D noise（webgl-noise，公有领域）+ curl noise
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 snoiseVec3(vec3 x){
  return vec3(
    snoise(x),
    snoise(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2)),
    snoise(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4))
  );
}

vec3 curlNoise(vec3 p){
  const float e = 0.1;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 px0 = snoiseVec3(p - dx); vec3 px1 = snoiseVec3(p + dx);
  vec3 py0 = snoiseVec3(p - dy); vec3 py1 = snoiseVec3(p + dy);
  vec3 pz0 = snoiseVec3(p - dz); vec3 pz1 = snoiseVec3(p + dz);
  float x = py1.z - py0.z - pz1.y + pz0.y;
  float y = pz1.x - pz0.x - px1.z + px0.z;
  float z = px1.y - px0.y - py1.x + py0.x;
  return normalize(vec3(x, y, z) / (2.0 * e));
}
`;

export const vertexShader = /* glsl */ `
attribute vec3 aNormal;
attribute float aSeed;
attribute float aRegion;
attribute float aLum;

uniform float uTime;
uniform float uVolume;
uniform float uStateFrom;
uniform float uStateTo;
uniform float uStateMix;
uniform float uPointSize;
uniform float uPixelRatio;

varying float vEnergy;
varying float vDepth;
varying float vRegion;
varying float vScan;
varying float vFacing;
varying float vLum;

${NOISE_GLSL}

// 单一状态的运动位移；energy 经 out 返回
vec3 motion(float state, vec3 base, vec3 nrm, float seed, float region, out float energy){
  float t = uTime;
  float ph = seed * 6.2831853;
  vec3 offset = vec3(0.0);
  energy = 0.0;

  float r = length(base.xy);                                   // 肖像平面内到中心的半径
  // 状态通过"光/能量"(energy)表达，几乎不移动几何 → 轮廓始终清晰
  // 仅保留极轻微的整体呼吸，营造"活着"的感觉(位移极小，不糊轮廓)
  offset += nrm * sin(t * 0.8 + ph) * 0.004;

  if (state < 0.5) {
    // IDLE —— 柔和整体呼吸光
    energy = 0.34 + 0.10 * sin(t * 0.8 + ph * 0.3);
  } else if (state < 1.5) {
    // LISTENING —— 从中心向外扩散的亮环(能量涟漪，形状不动)
    float ring = 0.5 + 0.5 * sin(r * 9.0 - t * 3.5);
    energy = 0.34 + 0.55 * ring * ring;
  } else if (state < 2.5) {
    // THINKING —— 自下而上循环的扫描亮线(全息扫描，形状不动) + 轻微闪烁
    float scanY = fract(t * 0.16) * 2.4 - 1.2;
    float band = exp(-pow((base.y - scanY) * 4.0, 2.0));
    energy = (0.30 + 0.95 * band) * (0.92 + 0.08 * sin(t * 8.0 + ph));
  } else {
    // SPEAKING —— 随音量整体亮度脉动 + 嘴部高亮(可选极轻微前凸)
    float vol = uVolume;
    energy = 0.38 + vol * 0.95;
    if (region > 0.5 && region < 1.5) energy += vol * 0.8;
    offset += nrm * vol * 0.03;
  }
  return offset;
}

void main(){
  float eFrom; float eTo;
  vec3 oFrom = motion(uStateFrom, position, aNormal, aSeed, aRegion, eFrom);
  vec3 oTo   = motion(uStateTo,   position, aNormal, aSeed, aRegion, eTo);
  vec3 pos = position + mix(oFrom, oTo, uStateMix);
  float energy = mix(eFrom, eTo, uStateMix);

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uPointSize * uPixelRatio / max(0.001, -mvPosition.z) * (0.6 + energy) * (0.7 + aLum * 0.5);

  // 朝向(fresnel)：正对相机=1，背对=0；用于减弱后脑穿透、突出正面 → 轮廓更清晰
  vec3 vn = normalize(normalMatrix * aNormal);
  vec3 vd = normalize(-mvPosition.xyz);
  vFacing = clamp(dot(vn, vd), 0.0, 1.0);

  vEnergy = energy;
  vDepth = pos.z;
  vRegion = aRegion;
  vScan = pos.y;
  vLum = aLum;
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorAccent;
uniform float uTime;

varying float vEnergy;
varying float vDepth;
varying float vRegion;
varying float vScan;
varying float vFacing;
varying float vLum;

void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;

  float alpha = smoothstep(0.5, 0.0, d);
  float core = smoothstep(0.22, 0.0, d);

  float depthMix = clamp(vDepth * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uColorA, uColorB, depthMix);
  col = mix(col, uColorAccent, clamp(vEnergy * 0.5, 0.0, 0.8));
  // 特征区（眼/嘴）提亮
  col = mix(col, uColorAccent, step(0.5, vRegion) * 0.3);
  // 图片亮度 → 颜色明暗（暗部偏深青、亮部偏亮青白）→ 呈现肖像明暗结构
  // 提高明暗对比：暗部更暗(背景更干净)、亮部更实(五官/轮廓更锐)
  float lumC = pow(clamp(vLum, 0.0, 1.0), 1.45);
  col *= (0.26 + 0.95 * lumC);
  // 全息扫描线
  float scan = 0.85 + 0.15 * sin(vScan * 40.0 - uTime * 4.0);
  col *= scan;
  col += core * 0.3 * uColorAccent * lumC;

  // 朝向淡出：背对相机的点压暗（3D 模型用）；平面肖像法线朝前 → 不受影响
  float facingFade = mix(0.14, 1.0, smoothstep(0.0, 0.55, vFacing));
  // 高对比亮度 → 不透明度：暗部稀疏、亮部密实 → 轮廓清晰
  float a = alpha * (0.30 + 0.40 * depthMix) * (0.5 + vEnergy * 0.5) * facingFade * (0.14 + 1.0 * lumC);
  gl_FragColor = vec4(col, a);
}
`;
