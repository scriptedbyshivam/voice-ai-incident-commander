'use client';

import React from 'react';

interface AudioVisualizerProps {
  isSpeaking: boolean;
  isMuted?: boolean;
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isSpeaking,
  isMuted = false,
  barCount = 4,
}) => {
  if (isMuted) {
    return (
      <div className="flex items-center gap-0.5 h-3">
        {Array.from({ length: barCount }).map((_, i) => (
          <div key={i} className="w-0.5 h-1 bg-red-500/40 rounded-full" />
        ))}
      </div>
    );
  }

  if (!isSpeaking) {
    return (
      <div className="flex items-center gap-0.5 h-3">
        {Array.from({ length: barCount }).map((_, i) => (
          <div key={i} className="w-0.5 h-1.5 bg-white/20 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 h-3">
      {Array.from({ length: barCount }).map((_, i) => {
        const heights = ['h-3', 'h-2', 'h-3.5', 'h-2.5'];
        const anims = ['animate-pulse', 'animate-bounce', 'animate-pulse', 'animate-bounce'];
        return (
          <div
            key={i}
            className={`w-0.5 bg-[#33d1ff] rounded-full ${heights[i % heights.length]} ${anims[i % anims.length]}`}
            style={{ animationDelay: `${i * 120}ms` }}
          />
        );
      })}
    </div>
  );
};

export default AudioVisualizer;
