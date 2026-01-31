import React from "react";
import { AbsoluteFill } from "remotion";

export const TestScene: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0D0D10",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: "48px",
        fontWeight: "bold",
      }}
    >
      TEST: If you see this, rendering works!
    </AbsoluteFill>
  );
};
