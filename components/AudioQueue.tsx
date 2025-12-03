import React, { useState } from 'react';
import { AudioItem, AudioSource, AudioStatus } from '../types';
import { Clock, Zap, Cloud, X, Play, Pause } from './Icons';

interface AudioQueueProps {
  queue: AudioItem[];
  onReorder: (newQueue: AudioItem[]) => void;
  onRemove: (id: string) => void;
  onPlay: (id: string) => void;
  onStop: (id: string) => void;
}

const AudioQueue: React.FC<AudioQueueProps> = ({ queue, onReorder, onRemove, onPlay, onStop }) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {

    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newQueue = [...queue];
    const [movedItem] = newQueue.splice(draggedIndex, 1);
    newQueue.splice(dropIndex, 0, movedItem);

    onReorder(newQueue);
    setDraggedIndex(null);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800 bg-gray-850/50 flex justify-between items-center">
        <h3 className="text-gray-100 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            BROADCAST QUEUE
        </h3>
        <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">{queue.length} ITEMS</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {queue.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-600">
                <p>Queue is empty</p>
                <p className="text-xs mt-1">Waiting for N8N triggers...</p>
            </div>
        ) : (
            queue.map((item, index) => (
            <div 
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`
                    relative p-3 rounded-lg border transition-all duration-200 group cursor-move
                    ${item.status === AudioStatus.PLAYING 
                        ? 'bg-primary-900/10 border-primary-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                        : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'}
                    ${draggedIndex === index ? 'opacity-50 border-dashed border-gray-500' : ''}
                `}
            >
                {/* Remove Button - Visible on Hover */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id);
                    }}
                    className="absolute top-2 right-2 p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Remove from queue"
                >
                    <X className="w-3 h-3" />
                </button>

                {/* Playing Indicator */}
                {item.status === AudioStatus.PLAYING && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 rounded-l-lg animate-pulse"></div>
                )}

                <div className="flex justify-between items-start mb-1 pl-2 pr-4">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                        item.source === AudioSource.MANUAL 
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                        {item.source === AudioSource.MANUAL ? 'MANUAL' : 'AI GEN'}
                    </span>
                    <span className="text-gray-500 text-[10px] flex items-center gap-1 font-mono">
                         <Clock className="w-3 h-3" />
                         {item.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                </div>

                <div className="pl-2 pr-8 relative">
                    {/* Play/Stop Controls */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       {item.status !== AudioStatus.PLAYING ? (
                           <button 
                              onClick={(e) => { e.stopPropagation(); onPlay(item.id); }}
                              className="p-1.5 bg-primary-500/10 text-primary-400 hover:bg-primary-500 hover:text-white rounded-full transition-colors"
                              title="Play Now"
                           >
                              <Play className="w-3 h-3" />
                           </button>
                       ) : (
                           <button 
                              onClick={(e) => { e.stopPropagation(); onStop(item.id); }}
                              className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-full transition-colors"
                              title="Stop"
                           >
                              <Pause className="w-3 h-3" />
                           </button>
                       )}
                    </div>

                    <h4 className={`text-sm font-medium leading-snug mb-1 pr-8 ${item.status === AudioStatus.PLAYING ? 'text-primary-100' : 'text-gray-200'}`}>
                        {item.description || item.filename}
                    </h4>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                           {item.source === AudioSource.MANUAL ? <Zap className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                           {item.duration}
                        </span>
                        <span>
                            {item.status === AudioStatus.PLAYING ? 'Broadcasting...' : 'Waiting'}
                        </span>
                    </div>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default AudioQueue;