import React, { useRef, useState } from 'react';
import { Upload, Volume2, Zap, SkipForward, MessageSquare, Send } from './Icons';

interface ControlPanelProps {
  onUpload: (file: File) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  onSkip: () => void;
  onStop: () => void;
  onClear: () => void;
  onChatSubmit: (message: string) => void;
  isSendingChat: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ 
    onUpload, 
    volume, 
    onVolumeChange, 
    onSkip, 
    onStop, 
    onClear,
    onChatSubmit,
    isSendingChat
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chatMessage, setChatMessage] = useState('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files[0]);
    }
  };

  const handleSendChat = () => {
    if (!chatMessage.trim() || isSendingChat) return;
    onChatSubmit(chatMessage);
    setChatMessage('');
  };

  return (
    <div className="flex flex-col gap-4 mt-4">
        {/* AI Chat Inject - Full Width Top */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col relative group w-full min-h-[8rem]">
             <div className="flex justify-between items-center mb-2">
                <h4 className="text-gray-400 text-xs font-bold tracking-widest flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> AI CHAT INJECT
                </h4>
                {isSendingChat && <span className="text-[10px] text-primary-400 animate-pulse">Thinking...</span>}
             </div>
             
             <div className="relative flex-1 flex">
                <textarea 
                    className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-3 pr-12 text-sm text-gray-200 resize-none focus:outline-none focus:border-primary-500/50 focus:bg-gray-950/80 transition-all placeholder:text-gray-600"
                    placeholder="Type commentary instructions... (e.g. 'Talk about the recent foul' or 'Analyze the possession stats')"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChat();
                        }
                    }}
                />
                
                <button 
                    onClick={handleSendChat}
                    disabled={!chatMessage.trim() || isSendingChat}
                    className="absolute bottom-3 right-3 bg-primary-500 text-white p-2 rounded-full hover:bg-primary-400 disabled:opacity-30 disabled:hover:bg-primary-500 transition-all shadow-lg z-10"
                >
                    <Send className="w-4 h-4" />
                </button>
             </div>
        </div>

        {/* Bottom Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[12rem]">
            {/* Master Controls */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex flex-col justify-center">
                <h4 className="text-gray-400 text-xs font-bold tracking-widest mb-6">MASTER OUTPUT</h4>
                
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Volume2 className="text-gray-400 w-5 h-5" />
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={volume}
                            onChange={(e) => onVolumeChange(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-500"
                        />
                        <span className="text-gray-300 font-mono w-8 text-right">{volume}%</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <button 
                            onClick={onSkip}
                            className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black border border-yellow-500/30 transition-colors py-2 rounded text-xs font-bold tracking-wide flex items-center justify-center gap-1"
                        >
                            <SkipForward className="w-3 h-3" /> SKIP
                        </button>
                        <button 
                            onClick={onStop}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/30 transition-colors py-2 rounded text-xs font-bold tracking-wide"
                        >
                            STOP
                        </button>
                        <button 
                            onClick={onClear}
                            className="bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 transition-colors py-2 rounded text-xs font-bold tracking-wide"
                        >
                            CLEAR
                        </button>
                    </div>
                </div>
            </div>

            {/* Manual Override Zone */}
            <div 
                className={`
                    relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 transition-all cursor-pointer
                    ${isDragging 
                        ? 'border-accent-500 bg-accent-500/10' 
                        : 'border-gray-700 bg-gray-900/50 hover:border-gray-500 hover:bg-gray-800/50'}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="audio/*"
                    onChange={handleFileChange}
                />
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className={`w-6 h-6 ${isDragging ? 'text-accent-500' : 'text-gray-400'}`} />
                </div>
                <h4 className="text-gray-200 font-semibold text-sm">MANUAL OVERRIDE</h4>
                <p className="text-gray-500 text-xs mt-1 text-center">Drag audio file here or click to inject immediately</p>
                <div className="absolute top-3 right-3">
                    <Zap className="w-4 h-4 text-yellow-500 opacity-50" />
                </div>
            </div>
        </div>
    </div>
  );
};

export default ControlPanel;