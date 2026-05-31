import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { createHeadGeometry } from "./createHeadParticles";
import { vertexShader, fragmentShader } from "./headShaders";
import { HOLO_COLORS } from "../constants";
import { AvatarState } from "../types";

const STATE_CODE: Record<AvatarState, number> = {
  idle: 0,
  listening: 1,
  thinking: 2,
  speaking: 3,
};

const TRANSITION_SEC = 0.6;

/**
 * 命令式封装的全息粒子头部。框架无关：
 *   const head = new ParticleHead(container);
 *   head.setState("thinking");
 *   head.update(volume, dt);  // 每帧
 *   head.resize(); head.dispose();
 */
export class ParticleHead {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;

  private time = 0;
  private vol = 0;
  private fromCode = 0;
  private toCode = 0;
  private mix = 1;
  private spin = 0;
  private flat = false;

  constructor(
    container: HTMLElement,
    opts: { geometry?: THREE.BufferGeometry; count?: number; bloom?: boolean; flat?: boolean } = {}
  ) {
    this.flat = opts.flat ?? false;
    this.container = container;
    const { clientWidth: w, clientHeight: h } = container;
    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
    const count = opts.count ?? (isMobile ? 18000 : 40000);
    const useBloom = opts.bloom ?? true;

    // --- renderer：透明背景，露出 CSS 全息背景 ---
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w || 1, h || 1);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, (w || 1) / (h || 1), 0.1, 100);
    this.camera.position.set(0, 0.06, 3.0);
    this.camera.lookAt(0, 0.02, 0);

    // --- 粒子（优先用传入的采样几何，否则程序化兜底） ---
    this.geometry = opts.geometry ?? createHeadGeometry(count);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uVolume: { value: 0 },
        uStateFrom: { value: 0 },
        uStateTo: { value: 0 },
        uStateMix: { value: 1 },
        uPointSize: { value: 3.2 },
        uPixelRatio: { value: this.renderer.getPixelRatio() },
        uColorA: { value: new THREE.Color(HOLO_COLORS.colorA) },
        uColorB: { value: new THREE.Color(HOLO_COLORS.colorB) },
        uColorAccent: { value: new THREE.Color(HOLO_COLORS.colorAccent) },
      },
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.points);

    // --- 辉光 ---
    if (useBloom) {
      try {
        const composer = new EffectComposer(this.renderer);
        composer.addPass(new RenderPass(this.scene, this.camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(w || 1, h || 1), 0.45, 0.32, 0.28);
        composer.addPass(bloom);
        composer.addPass(new OutputPass());
        this.composer = composer;
        this.bloomPass = bloom;
      } catch {
        // 辉光初始化失败 → 回退到直接渲染（仍有片元 additive 辉光）
        this.composer = null;
      }
    }

    // 立刻渲染一帧，保证挂载后即可见（不依赖 rAF —— 后台标签页/首帧前不会黑屏）
    this.update(0, 0);
  }

  /** 切换状态，0.6s 平滑过渡 */
  setState(state: AvatarState) {
    const code = STATE_CODE[state];
    if (code === this.toCode) return;
    // 若上一次过渡未完成，直接以当前目标作为新的起点
    this.fromCode = this.toCode;
    this.toCode = code;
    this.mix = 0;
  }

  /** 每帧调用。volume: 0..1 实时音量；dt: 秒 */
  update(volume: number, dt: number) {
    const d = Math.min(0.1, Math.max(0, dt)); // 防止切后台后 dt 爆炸
    this.time += d;

    // 音量缓动
    this.vol += (volume - this.vol) * Math.min(1, d * 8);

    // 状态过渡推进
    if (this.mix < 1) {
      this.mix = Math.min(1, this.mix + d / TRANSITION_SEC);
      if (this.mix >= 1) this.fromCode = this.toCode;
    }

    // 旋转：3D 模型缓慢自转；平面肖像只做轻微摆动(不能转到侧面)
    const spinSpeed = this.toCode === 2 ? 0.5 : 0.16;
    this.spin += d * spinSpeed;
    if (this.flat) {
      this.points.rotation.y = Math.sin(this.spin * 0.6) * 0.16;
      this.points.rotation.x = Math.sin(this.spin * 0.4) * 0.05;
    } else {
      this.points.rotation.y = Math.sin(this.spin) * 0.5 + this.spin * 0.1;
    }

    const u = this.material.uniforms;
    u.uTime.value = this.time;
    u.uVolume.value = this.vol;
    u.uStateFrom.value = this.fromCode;
    u.uStateTo.value = this.toCode;
    u.uStateMix.value = this.mix;

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.material.uniforms.uPixelRatio.value = this.renderer.getPixelRatio();
    this.composer?.setSize(w, h);
    this.bloomPass?.setSize(w, h);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    // 彻底释放 WebGL 上下文，避免反复 remount 累积到浏览器上限（~16）后新 renderer 静默失败
    try { this.renderer.forceContextLoss(); } catch { /* noop */ }
    const el = this.renderer.domElement;
    if (el.parentNode) el.parentNode.removeChild(el);
  }
}
