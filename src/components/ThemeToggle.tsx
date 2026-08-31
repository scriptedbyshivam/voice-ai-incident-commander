'use client';

import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, isDark, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return <div className="w-16 h-8 rounded-full bg-slate-300 dark:bg-slate-800 opacity-50" />;
  }

  return (
    <motion.button
      layout
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} industrial chassis mode`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Industrial Theme`}
      whileTap={{ scale: 0.94 }}
      className={`relative w-16 h-8 p-1 rounded-full flex items-center cursor-pointer transition-all duration-300 shadow-industrial-recessed select-none ${
        isDark ? 'bg-[#0e1017]' : 'bg-[#d1d9e6]'
      } ${className}`}
      style={{ justifyContent: isDark ? 'flex-end' : 'flex-start' }}
    >
      {/* Background track indicator markers */}
      <div className="absolute inset-0 flex items-center justify-between px-2.5 text-[9px] pointer-events-none select-none font-mono font-bold">
        <span className={`transition-opacity duration-300 ${!isDark ? 'opacity-0' : 'opacity-40 text-amber-400'}`}>
          <Sun className="w-3.5 h-3.5" />
        </span>
        <span className={`transition-opacity duration-300 ${isDark ? 'opacity-0' : 'opacity-40 text-slate-700'}`}>
          <Moon className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Tactile Machined Toggle Knob */}
      <motion.div
        layout
        transition={{
          type: 'spring',
          stiffness: 650,
          damping: 28,
        }}
        className={`w-6 h-6 rounded-full flex items-center justify-center relative z-10 transition-colors shadow-industrial-sharp ${
          isDark
            ? 'bg-[#232a3a] text-amber-400 border border-[#2f384c]'
            : 'bg-[#f0f2f5] text-[#2d3436] border border-white'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ rotate: isDark ? -90 : 90, scale: 0.35, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: isDark ? 90 : -90, scale: 0.35, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-center"
          >
            {isDark ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.button>
  );
}
