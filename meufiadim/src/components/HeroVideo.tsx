"use client";

import { Player } from "@remotion/player";
import { MeufiadimDemo } from "@/remotion/MeufiadimDemo";

export function HeroVideo() {
  return (
    <div className="relative mx-auto w-[300px] sm:w-[320px] rounded-[42px] p-2.5 bg-gray-900 shadow-2xl shadow-emerald-900/20 ring-1 ring-gray-800">
      <div className="overflow-hidden rounded-[34px] bg-black">
        <Player
          component={MeufiadimDemo}
          durationInFrames={240}
          compositionWidth={420}
          compositionHeight={740}
          fps={30}
          autoPlay
          loop
          controls={false}
          style={{ width: "100%", display: "block" }}
        />
      </div>
    </div>
  );
}
