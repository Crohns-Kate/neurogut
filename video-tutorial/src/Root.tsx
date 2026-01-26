/**
 * Remotion Root - Entry point for video compositions
 */

import { Composition } from "remotion";
import { PlacementTutorial } from "./PlacementTutorial";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PlacementTutorial"
        component={PlacementTutorial}
        durationInFrames={27 * 30} // 27 seconds at 30fps
        fps={30}
        width={1080}
        height={1920}
      />

      {/* Square format for web */}
      <Composition
        id="PlacementTutorialSquare"
        component={PlacementTutorial}
        durationInFrames={27 * 30}
        fps={30}
        width={1080}
        height={1080}
      />

      {/* Landscape for desktop */}
      <Composition
        id="PlacementTutorialLandscape"
        component={PlacementTutorial}
        durationInFrames={27 * 30}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
