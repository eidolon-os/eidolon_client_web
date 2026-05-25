import React from "react";
import styles from "../styles/companion.module.css";

export function AmbientBackground() {
  return (
    <div className={styles.ambient} aria-hidden>
      <div className={`${styles.ambientBlob} ${styles.ambientBlob1}`} />
      <div className={`${styles.ambientBlob} ${styles.ambientBlob2}`} />
      <div className={`${styles.ambientBlob} ${styles.ambientBlob3}`} />
      <div className={styles.ambientGrain} />
    </div>
  );
}
