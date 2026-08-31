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
    return <div className="w-14 h-8" />;
  }

  return (
    <motion.button
      layout
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}
      whileTap={{ scale: 0.92 }}
      className={`relative w-14 h-8 p-1 rounded-full border flex items-center cursor-pointer transition-colors duration-300 shadow-inner ${
        isDark
          ? 'bg-slate-900/90 border-slate-700/80 shadow-black/40'
          : 'bg-indigo-50/90 border-indigo-200/80 shadow-indigo-100/50'
      } ${className}`}
      style={{ justifyContent: isDark ? 'flex-end' : 'flex-start' }}
    >
      {/* Background faint track icons */}
      <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] pointer-events-none select-none">
        <Sun
          className={`w-3.5 h-3.5 transition-opacity duration-300 ${
            !isDark ? 'opacity-0' : 'opacity-40 text-amber-400'
          }`}
        />
        <Moon
          className={`w-3.5 h-3.5 transition-opacity duration-300 ${
            isDark ? 'opacity-0' : 'opacity-40 text-indigo-500'
          }`}
        />
      </div>

      {/* Animated sliding knob with spring physics */}
      <motion.div
        layout
        transition={{
          type: 'spring',
          stiffness: 700,
          damping: 30,
        }}
        className={`w-6 h-6 rounded-full flex items-center justify-center shadow-md relative z-10 ${
          isDark
            ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-indigo-500/30'
            : 'bg-white text-amber-500 shadow-slate-300/80 border border-slate-200/60'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ rotate: isDark ? -90 : 90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: isDark ? 90 : -90, scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            {isDark ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <Sun className="w-3.5 h-3.5" />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.button>
  );
}
