import React from "react";
import { Composition } from "remotion";
import { NeurogutDemo } from "./NeurogutDemo";
import { AppWalkthrough, WALKTHROUGH_DURATION_SECONDS } from "./AppWalkthrough";
import "./index.css";

import { TestScene } from "./scenes/TestScene";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Test composition to verify rendering */}
      <Composition
        id="Test"
        component={TestScene}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      <Composition
        id="NeurogutDemo"
        component={NeurogutDemo}
        durationInFrames={2550} // 85 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
      {/* App Walkthrough Demo - Explainer video */}
      <Composition
        id="AppWalkthrough"
        component={AppWalkthrough}
        durationInFrames={WALKTHROUGH_DURATION_SECONDS * 30} // 98 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
