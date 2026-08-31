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
          <div
            key={i}
            className="w-0.5 h-1 bg-rose-500/40 rounded-full"
          />
        ))}
      </div>
    );
  }

  if (!isSpeaking) {
    return (
      <div className="flex items-center gap-0.5 h-3">
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className="w-0.5 h-1.5 bg-slate-700 rounded-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 h-3">
      {Array.from({ length: barCount }).map((_, i) => {
        const heightClasses = [
          'h-3 animate-pulse',
          'h-2 animate-bounce',
          'h-3.5 animate-pulse',
          'h-2.5 animate-bounce',
        ];
        return (
          <div
            key={i}
            className={`w-0.5 bg-emerald-400 rounded-full transition-all duration-150 ${
              heightClasses[i % heightClasses.length]
            }`}
            style={{
              animationDelay: `${i * 120}ms`,
            }}
          />
        );
      })}
    </div>
  );
};

export default AudioVisualizer;
