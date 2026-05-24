import React from "react";
import { AvatarStageProps } from "./types";

export function AvatarStage({ controller, className }: AvatarStageProps) {
  return (
    <div
      className={className}
      data-avatar-state={controller.state}
      data-avatar-volume={controller.volume.toFixed(3)}
    />
  );
}
