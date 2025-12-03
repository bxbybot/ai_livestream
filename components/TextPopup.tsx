import React, { useEffect, useRef } from 'react';
import { X, MessageSquare } from 'lucide-react';

interface TextPopupProps {
  title?: string; // The short description (e.g., "Goal - Team A")
  text: string;   // The long AI commentary
  isVisible: boolean;
  onClose: () => void;
}

const TextPopup: React.FC<TextPopupProps> = ({ title, text, isVisible, onClose }) => {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play notification sound when popup appears
  useEffect(() => {
    if (isVisible) {
      playNotificationSound();
    }
  }, [isVisible]);

  const playNotificationSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1); // Drop to A4
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Failed to play notification sound", e);
    }
  };

  if (!isVisible) return null;

  return (
    // Changed container to remove full screen backdrop and allow click-through on outside areas
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-end justify-center pointer-events-none w-full max-w-4xl px-4">
      
      {/* Popup Content - Floating, Semi-transparent */}
      <div className="pointer-events-auto relative bg-gray-900/90 backdrop-blur-md border border-gray-700/50 rounded-2xl shadow-2xl w-full p-6 transform transition-all animate-in slide-in-from-bottom-4 fade-in duration-300">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full p-1.5 shadow-lg border border-gray-700 transition-all"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 bg-primary-500/20 p-3 rounded-xl hidden sm:block">
            <MessageSquare size={32} className="text-primary-400" />
          </div>
          
          {/* Text Content */}
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary-400 uppercase tracking-wider">
                {title || "Live Commentary"}
              </h3>
              <span className="text-[10px] text-gray-500 font-mono">AI ANALYST</span>
            </div>
            <p className="text-lg md:text-xl font-medium text-white leading-relaxed drop-shadow-sm mt-1">
              {text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextPopup;
