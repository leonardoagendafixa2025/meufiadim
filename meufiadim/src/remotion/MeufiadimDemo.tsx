"use client";

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

function SceneFiadoCard() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const barWidth = interpolate(frame, [10, 45], [0, 48], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="bg-[#0B1117] flex flex-col items-center justify-center p-8 text-white">
      <div
        style={{ transform: `scale(${scale})` }}
        className="w-full bg-white text-gray-900 rounded-[28px] p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase">
              Caderninho Digital
            </p>
            <h3 className="text-xl font-extrabold mt-0.5">João Silva</h3>
          </div>
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-lg">
            Vence hoje
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-red-600">R$ 145,00</span>
          <span className="text-xs text-gray-400">Limite R$ 300</span>
        </div>

        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            style={{ width: `${barWidth}%` }}
            className="h-full bg-emerald-500 rounded-full"
          />
        </div>

        <div className="bg-gray-900 text-white text-center py-3 rounded-2xl text-sm font-bold">
          ⏰ Disparando lembrete no Zap...
        </div>
      </div>
    </AbsoluteFill>
  );
}

function SceneWhatsAppPix() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const msg1Y = spring({ frame, fps, config: { damping: 15 } });
  const msg2Y = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 15 },
  });
  const msg2Opacity = interpolate(frame, [18, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="bg-[#0B141A] flex flex-col justify-center p-6 gap-3 text-white">
      <div className="text-center mb-2">
        <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full">
          WhatsApp Automático • MeuFiadim
        </span>
      </div>

      <div
        style={{
          transform: `translateY(${(1 - msg1Y) * 30}px)`,
          opacity: msg1Y,
        }}
        className="bg-[#005C4B] rounded-2xl rounded-tr-none p-4 text-sm leading-relaxed shadow-lg self-end max-w-[92%]"
      >
        <p className="font-bold">Olá, João! Tudo bem?</p>
        <p className="mt-1 text-emerald-100">
          Lembrete do seu fiado na <strong>Doces da Maria</strong>:
        </p>
        <p className="mt-2 font-bold">💰 Valor: R$ 145,00</p>
        <p className="text-xs text-emerald-200 mt-1">
          Toque em Copiar código Pix abaixo 👇
        </p>
      </div>

      <div
        style={{
          transform: `translateY(${(1 - msg2Y) * 30}px)`,
          opacity: msg2Opacity,
        }}
        className="bg-[#005C4B] rounded-2xl rounded-tr-none overflow-hidden shadow-lg self-end max-w-[92%]"
      >
        <div className="p-3.5 text-xs font-mono text-emerald-200 break-all">
          00020126580014br.gov.bcb.pix0136doces-da-maria-pix5204000053039865406145.005802BR...
        </div>
        <div className="border-t border-emerald-700/70 py-3 text-center text-sm font-bold text-emerald-300 bg-[#004D3F]">
          📋 Copiar código Pix
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ScenePaidSuccess() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });

  return (
    <AbsoluteFill className="bg-gradient-to-br from-emerald-600 to-emerald-900 flex flex-col items-center justify-center p-8 text-white text-center">
      <div
        style={{ transform: `scale(${pop})` }}
        className="w-20 h-20 rounded-full bg-white text-emerald-600 flex items-center justify-center text-4xl font-extrabold shadow-2xl mb-5"
      >
        ✓
      </div>
      <h2 className="text-2xl font-extrabold">Pix Recebido!</h2>
      <p className="text-emerald-100 text-sm mt-2">
        R$ 145,00 direto na conta do lojista.
      </p>
      <div className="mt-6 bg-white/15 backdrop-blur px-4 py-2 rounded-full text-xs font-bold">
        meufiadim • Sem mensalidade
      </div>
    </AbsoluteFill>
  );
}

export const MeufiadimDemo: React.FC = () => {
  return (
    <AbsoluteFill className="font-sans">
      <Sequence from={0} durationInFrames={80}>
        <SceneFiadoCard />
      </Sequence>
      <Sequence from={80} durationInFrames={95}>
        <SceneWhatsAppPix />
      </Sequence>
      <Sequence from={175} durationInFrames={65}>
        <ScenePaidSuccess />
      </Sequence>
    </AbsoluteFill>
  );
};
