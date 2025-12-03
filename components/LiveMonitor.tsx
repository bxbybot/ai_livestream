import React, { useEffect, useState, useRef } from 'react';
import { Activity, Maximize, Minimize, Move, X } from './Icons';
import { AudioItem, AudioStatus, MatchDetails } from '../types';

interface LiveMonitorProps {
  currentAudio: AudioItem | null;
  liveMatchUrl?: string;
  matchId: string;
  matchDetails?: MatchDetails;
  onReset: () => void;
}

const LiveMonitor: React.FC<LiveMonitorProps> = ({ currentAudio, liveMatchUrl, matchId, matchDetails, onReset }) => {
  const [visualizerBars, setVisualizerBars] = useState<number[]>(new Array(20).fill(10));

  // Preview Window State
  const [isFloating, setIsFloating] = useState(false);
  const [previewPos, setPreviewPos] = useState({ x: 20, y: 20 }); // Relative to viewport when floating
  const [previewSize, setPreviewSize] = useState({ width: 320, height: 180 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Match Finished State
  const [showResult, setShowResult] = useState(false);

  // Check if match is finished
  useEffect(() => {
    if (matchDetails?.status.short === 'FT' || matchDetails?.status.short === 'AET' || matchDetails?.status.short === 'PEN') {
        setShowResult(true);
    }
  }, [matchDetails?.status.short]);

  // ... visualizer effect ... (keep existing)
  useEffect(() => {
    if (currentAudio?.status === AudioStatus.PLAYING) {
      const interval = setInterval(() => {
        setVisualizerBars(prev => prev.map(() => Math.floor(Math.random() * 90) + 10));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setVisualizerBars(new Array(20).fill(5));
    }
  }, [currentAudio]);

  // Drag & Resize Logic
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isDragging) {
              setPreviewPos({
                  x: e.clientX - dragOffset.current.x,
                  y: e.clientY - dragOffset.current.y
              });
          } else if (isResizing) {
              const newWidth = Math.max(240, resizeStart.current.width + (e.clientX - resizeStart.current.x));
              const newHeight = Math.max(135, resizeStart.current.height + (e.clientY - resizeStart.current.y));
              setPreviewSize({ width: newWidth, height: newHeight });
          }
      };
      const handleMouseUp = () => {
          setIsDragging(false);
          setIsResizing(false);
      };

      if (isDragging || isResizing) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging, isResizing]);

  const startDrag = (e: React.MouseEvent) => {
      if (!isFloating) return; // Only drag when floating
      // Only drag if clicking header
      setIsDragging(true);
      dragOffset.current = {
          x: e.clientX - previewPos.x,
          y: e.clientY - previewPos.y
      };
  };

  const startResize = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      resizeStart.current = {
          x: e.clientX,
          y: e.clientY,
          width: previewSize.width,
          height: previewSize.height
      };
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-800 overflow-hidden relative group">
        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none">
        {matchDetails ? (
            <div className="flex items-start justify-between w-full pointer-events-auto">
                {/* Left: Live Status */}
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                    <span className="text-white font-bold tracking-widest text-xs shadow-sm">LIVE</span>
                    <div className="bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50 flex items-center gap-2">
                        <span className="text-accent-500 text-xs font-bold">{matchDetails.status.short}</span>
                        <span className="text-gray-300 text-xs font-mono border-l border-gray-600 pl-2">
                            {matchDetails.status.elapsed}'
                        </span>
                    </div>
                </div>

                {/* Center: Match Score */}
                <div className="flex flex-col items-center absolute left-1/2 top-4 -translate-x-1/2">
                    <div className="flex items-center gap-6 bg-black/40 backdrop-blur-md px-6 py-2 rounded-2xl border border-white/10 shadow-lg">
                        <div className="flex items-center gap-3">
                            <img src={matchDetails.teams.home.logo} alt={matchDetails.teams.home.name} className="w-8 h-8 object-contain" />
                            <span className="text-white font-bold hidden md:inline text-sm uppercase tracking-tight">{matchDetails.teams.home.name}</span>
                        </div>
                        <div className="flex flex-col items-center px-2">
                            <span className="text-accent-500 font-mono text-2xl font-bold leading-none drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                                {matchDetails.goals.home} - {matchDetails.goals.away}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-white font-bold hidden md:inline text-sm uppercase tracking-tight text-right">{matchDetails.teams.away.name}</span>
                            <img src={matchDetails.teams.away.logo} alt={matchDetails.teams.away.name} className="w-8 h-8 object-contain" />
                        </div>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1 font-medium tracking-wider">{matchDetails.league.name}</span>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-3">
                     <div className="text-right opacity-50">
                        <div className="text-gray-400 text-[10px] font-mono">ID: {matchId}</div>
                     </div>
                     <button 
                        onClick={onReset}
                        className="p-1.5 bg-gray-800/50 hover:bg-red-500/20 text-gray-400 hover:text-red-500 border border-gray-700 rounded transition-all"
                        title="Exit Match"
                     >
                        <X className="w-4 h-4" />
                     </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-between items-start w-full pointer-events-auto">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-600" />
                    <span className="text-gray-400 font-bold tracking-widest text-sm shadow-sm">OFFLINE</span>
                </div>
                
                {/* Hide ID if empty */}
                {matchId && (
                    <div className="text-right">
                        <div className="text-gray-300 text-xs font-mono">MATCH ID</div>
                        <div className="text-white font-mono font-bold text-lg">#{matchId}</div>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Main Visual Content (Audio Visualizer & Status) */}
      <div className="flex-1 relative bg-gray-950 flex items-center justify-center overflow-hidden">
        
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-10" 
             style={{ 
               backgroundImage: 'linear-gradient(#374151 1px, transparent 1px), linear-gradient(90deg, #374151 1px, transparent 1px)', 
               backgroundSize: '40px 40px' 
             }} 
        />
        
        {/* Center Content: Visualizer / Status */}
        <div className="relative z-0 w-full max-w-md px-6 transition-all duration-500">
            {matchId ? (
                currentAudio ? (
                    <div className="text-center">
                        <div className="relative w-32 h-32 mx-auto mb-6 flex items-center justify-center">
                            <div className="absolute inset-0 bg-accent-500/20 rounded-full animate-pulse"></div>
                             {/* Keep simple activity icon or custom anim */}
                            <Activity className="w-16 h-16 text-accent-500" />
                        </div>
                        
                        <div className="bg-gray-900/80 backdrop-blur-md border border-gray-800 rounded-xl p-6 shadow-2xl transform transition-all">
                            <p className="text-accent-500 text-xs font-bold mb-2 uppercase tracking-wider animate-pulse">On Air • AI Commentary</p>
                            <p className="text-white text-lg font-semibold leading-relaxed mb-4 line-clamp-3">
                                {currentAudio.description || "Processing Event..."}
                            </p>
                            <div className="flex gap-1 justify-center items-end h-12">
                                {visualizerBars.map((height, i) => (
                                    <div 
                                        key={i} 
                                        className="w-1.5 bg-accent-500 rounded-t-sm transition-all duration-75"
                                        style={{ height: `${height}%` }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center opacity-60">
                        <div className="w-24 h-24 border-2 border-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Activity className="w-10 h-10 text-gray-500" />
                        </div>
                        <h2 className="text-gray-400 font-light text-lg">WAITING FOR EVENTS</h2>
                        <p className="text-xs text-gray-600 mt-2 font-mono">Listening to match {matchId}...</p>
                    </div>
                )
            ) : (
                <div className="text-center opacity-40">
                    <div className="w-24 h-24 border-2 border-dashed border-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity className="w-10 h-10 text-gray-600" />
                    </div>
                    <h2 className="text-gray-500 font-light text-lg">NO MATCH SELECTED</h2>
                    <p className="text-xs text-gray-600 mt-2">Select a match to start monitoring</p>
                </div>
            )}
        </div>

        {/* Preview Window (Draggable/Docked) - HIDE IF MATCH FINISHED (showResult is true) */}
        {liveMatchUrl && !showResult && (
             <div 
                className={`
                    bg-black border border-gray-700 shadow-2xl rounded-lg overflow-hidden flex flex-col transition-all duration-200
                    ${isFloating ? 'fixed z-50 shadow-purple-500/20' : 'absolute bottom-4 right-4 z-20'}
                `}
                style={isFloating ? { 
                    left: previewPos.x, 
                    top: previewPos.y, 
                    width: `${previewSize.width}px`, 
                    height: `${previewSize.height}px`,
                    cursor: isDragging ? 'grabbing' : 'auto'
                } : {
                    width: '240px',
                    height: '135px'
                }}
             >
                {/* Header / Drag Handle */}
                <div 
                    className={`
                        h-6 bg-gray-800 flex items-center justify-between px-2 select-none
                        ${isFloating ? 'cursor-move hover:bg-gray-700' : ''}
                    `}
                    onMouseDown={startDrag}
                >
                    <div className="flex items-center gap-1">
                        {isFloating && <Move className="w-3 h-3 text-gray-500" />}
                        <span className="text-[10px] text-gray-400 font-bold">LIVE PREVIEW</span>
                    </div>
                    <button 
                        onClick={() => setIsFloating(!isFloating)}
                        className="text-gray-400 hover:text-white transition-colors"
                        title={isFloating ? "Dock" : "Pop out"}
                    >
                        {isFloating ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
                    </button>
                </div>
                
                {/* Iframe Content */}
                <div className="flex-1 relative bg-black group-hover/preview">
                    <iframe 
                        src={liveMatchUrl} 
                        className="absolute inset-0 w-full h-full border-0"
                        title="Live Match Preview"
                        allow="autoplay; encrypted-media"
                    />
                    {/* Invisible overlay while dragging/resizing */}
                    {(isDragging || isResizing) && <div className="absolute inset-0 bg-transparent z-10" />}
                    
                    {/* Resize Handle - Only when floating */}
                    {isFloating && (
                        <div 
                            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20 flex items-end justify-end p-0.5 hover:bg-white/10 rounded-tl transition-colors"
                            onMouseDown={startResize}
                        >
                            <div className="w-2 h-2 border-r-2 border-b-2 border-gray-400/50"></div>
                        </div>
                    )}
                </div>
             </div>
        )}

        {/* MATCH RESULT OVERLAY (Right Side) */}
        {showResult && matchDetails && (
            <div className="absolute right-0 top-16 bottom-10 w-64 bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 shadow-2xl transform transition-transform duration-500 slide-in-from-right z-30 flex flex-col">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-800/50">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent-500"></span>
                        FULL TIME
                    </h3>
                    <button onClick={() => { setShowResult(false); onReset(); }} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex-1 p-6 flex flex-col items-center justify-center gap-6 overflow-y-auto">
                     {/* Score Big */}
                     <div className="text-center">
                        <div className="text-4xl font-bold text-white font-mono tracking-tight mb-2">
                            {matchDetails.goals.home} - {matchDetails.goals.away}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">FINAL SCORE</div>
                     </div>

                     {/* Teams */}
                     <div className="w-full space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                             <div className="flex items-center gap-3">
                                <img src={matchDetails.teams.home.logo} className="w-8 h-8 object-contain" alt="Home" />
                                <span className="font-bold text-sm text-gray-200">{matchDetails.teams.home.name}</span>
                             </div>
                             <span className="text-xl font-mono font-bold text-white">{matchDetails.goals.home}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                             <div className="flex items-center gap-3">
                                <img src={matchDetails.teams.away.logo} className="w-8 h-8 object-contain" alt="Away" />
                                <span className="font-bold text-sm text-gray-200">{matchDetails.teams.away.name}</span>
                             </div>
                             <span className="text-xl font-mono font-bold text-white">{matchDetails.goals.away}</span>
                        </div>
                     </div>

                     <div className="mt-auto w-full pt-4 border-t border-gray-800/50">
                        <button 
                            onClick={onReset}
                            className="w-full py-2 bg-accent-500 hover:bg-accent-600 text-white text-xs font-bold rounded uppercase tracking-wider transition-colors shadow-lg shadow-accent-500/20"
                        >
                            Close & Reset
                        </button>
                     </div>
                </div>
            </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="h-10 bg-gray-900 border-t border-gray-800 flex items-center px-4 justify-between text-xs text-gray-500">
        <span>SOURCE: API-FOOTBALL via N8N</span>
        <span>ENGINE: ONLINE</span>
      </div>
    </div>
  );
};

export default LiveMonitor;