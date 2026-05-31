import React from "react";
import styles from "../styles/companion.module.css";

/**
 * 全息科技背景：深青黑底 + 中心辉光 + 透视网格地平线 + 漂移星点 + 扫描线 + 暗角。
 * 纯 CSS/SVG 驱动，无额外依赖。
 */
export function AmbientBackground() {
  return (
    <div className={styles.ambient} aria-hidden>
      <div className={styles.ambientGlow} />
      <div className={styles.ambientGrid} />
      <div className={styles.ambientStars} />
      <div className={styles.ambientScan} />
      <div className={styles.ambientGrain} />
      <div className={styles.ambientVignette} />
    </div>
  );
}
