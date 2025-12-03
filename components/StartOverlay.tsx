import React from 'react';
import { Lock, Play } from './Icons';

interface StartOverlayProps {
  onStart: () => void;
}

const StartOverlay: React.FC<StartOverlayProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-900/40 rounded-full blur-[100px] animate-pulse-slow"></div>
        </div>

        <div className="relative z-10 text-center space-y-8 p-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gray-900 border border-gray-800 shadow-2xl mb-4">
                <Lock className="w-8 h-8 text-gray-400" />
            </div>
            
            <div className="space-y-2">
                <h1 className="text-4xl font-black text-white tracking-tight">
                    AI_LIVESTREAM <span className="text-primary-500">DIRECTOR</span>
                </h1>
                <p className="text-gray-400 max-w-md mx-auto">
                    Console initialized. System is in standby mode. 
                    User interaction is required to activate audio engine and establish secure connection.
                </p>
            </div>

            <button 
                onClick={onStart}
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-gray-950 rounded-full font-bold text-lg tracking-wide hover:scale-105 transition-all duration-200 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)]"
            >
                <Play className="w-5 h-5 fill-current" />
                INITIALIZE SYSTEM
            </button>
            
            <div className="text-xs text-gray-600 font-mono mt-8">
                VERSION 1.0.4 • HOSTED MODE
            </div>
        </div>
    </div>
  );
};

export default StartOverlay;