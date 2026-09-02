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
    return <div className="w-14 h-7 rounded-full bg-white/10 opacity-50" />;
  }

  return (
    <motion.button
      layout
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      whileTap={{ scale: 0.94 }}
      className={`relative w-14 h-7 p-0.5 rounded-full flex items-center cursor-pointer bg-white/10 border border-white/10 select-none ${className}`}
      style={{ justifyContent: isDark ? 'flex-end' : 'flex-start' }}
    >
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        <Sun className={`w-3 h-3 transition-opacity ${!isDark ? 'opacity-0' : 'opacity-40 text-yellow-400'}`} />
        <Moon className={`w-3 h-3 transition-opacity ${isDark ? 'opacity-0' : 'opacity-40 text-white/60'}`} />
      </div>
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 650, damping: 28 }}
        className="w-6 h-6 rounded-full flex items-center justify-center bg-white shadow-sm relative z-10"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ rotate: isDark ? -90 : 90, scale: 0.35, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: isDark ? 90 : -90, scale: 0.35, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {isDark ? <Moon className="w-3 h-3 text-black" /> : <Sun className="w-3 h-3 text-amber-500" />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.button>
  );
}
