import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import LiveMonitor from './components/LiveMonitor';
import AudioQueue from './components/AudioQueue';
import ControlPanel from './components/ControlPanel';
import SettingsModal from './components/SettingsModal';
import MatchSearchModal from './components/MatchSearchModal';
import StartOverlay from './components/StartOverlay';
import { AudioItem, AudioSource, AudioStatus, SystemStatus, AppSettings, MatchDetails } from './types';

const App: React.FC = () => {
  // Application State
  const [isStarted, setIsStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  // Settings with LocalStorage Persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('ai_livestream_settings');
    return saved ? JSON.parse(saved) : {
        n8nUrl: 'https://n8n.srv1142799.hstgr.cloud/webhook/ai-director',
        matchId: '',
        persona: 'Funny, energetic commentator like a friend watching the game.',
        dataProvider: 'api-football',
        apiFootballKey: '',
        sportmonksKey: '',
        elevenLabsKey: '',
        openRouterKey: '',
        autoPlay: true,
        pollInterval: 3000,
        liveMatchUrl: ''
    };
  });

  const [status, setStatus] = useState<SystemStatus>({
    n8nConnection: false,
    tunnelStatus: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pythonEngine: false,
  });

  const [queue, setQueue] = useState<AudioItem[]>([]);
  const [volume, setVolume] = useState(80);
  const [isSendingChat, setIsSendingChat] = useState(false);
  
  // References for Audio Engine
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastEventRef = useRef<string>(''); // Track last event ID
  const lastStatsRef = useRef<any>(null); // Track last match stats
  const pollCountRef = useRef<number>(0); // Track polling cycles for smart mode
  const settingsRef = useRef(settings); // Ref to access latest settings in poll loop without re-triggering

  // Update settings ref whenever settings change
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Initialize Audio Context on user start
  const handleStart = () => {
    setIsStarted(true);
    setStatus(prev => ({ 
        ...prev, 
        pythonEngine: true, // Browser Audio Engine Ready
        n8nConnection: !!settings.n8nUrl, 
    }));
    
    // Create Audio Element
    if (!audioRef.current) {
        audioRef.current = new Audio();
        // Add event listener for when audio finishes
        audioRef.current.onended = handleAudioEnded;
    }
  };

  const saveSettings = (newSettings: AppSettings) => {
    if (newSettings.matchId !== settings.matchId) {
        console.log("Match ID changed, resetting history...");
        lastEventRef.current = ''; // Reset event tracking
        lastStatsRef.current = null; // Reset stats tracking
        setQueue([]); // Clear audio queue from previous match
    }
    setSettings(newSettings);
    localStorage.setItem('ai_livestream_settings', JSON.stringify(newSettings));
    setShowSettings(false);
    setStatus(prev => ({ ...prev, n8nConnection: !!newSettings.n8nUrl }));
  };

  // -------------------------------------------------------------------------
  // AUDIO ENGINE: PLAYBACK LOGIC
  // -------------------------------------------------------------------------
  const handleAudioEnded = () => {
    setQueue(prev => {
        const currentPlayingIndex = prev.findIndex(i => i.status === AudioStatus.PLAYING);
        if (currentPlayingIndex === -1) return prev;

        const newQueue = [...prev];
        // Mark current as completed
        newQueue[currentPlayingIndex] = { ...newQueue[currentPlayingIndex], status: AudioStatus.COMPLETED };
        
        // Remove completed items to keep queue clean
        newQueue.splice(currentPlayingIndex, 1);

        // Find next item to play
        if (newQueue.length > 0 && settings.autoPlay) {
             newQueue[0].status = AudioStatus.PLAYING;
        }
        
        return newQueue;
    });
  };

  // Watch for changes in the queue to trigger playback
  useEffect(() => {
    if (!audioRef.current || !isStarted) return;

    const currentItem = queue.find(i => i.status === AudioStatus.PLAYING);
    
    if (currentItem && currentItem.audioUrl) {
        // If the audio source is different or paused, play it
        if (!audioRef.current.src.includes(currentItem.audioUrl) && audioRef.current.src !== currentItem.audioUrl) {
            audioRef.current.src = currentItem.audioUrl;
            audioRef.current.volume = volume / 100;
            
            // ADDED DELAY: 500ms pause between records for natural feel
            const playDelay = setTimeout(() => {
                audioRef.current?.play().catch(e => console.error("Playback failed:", e));
            }, 500);
            
            return () => clearTimeout(playDelay);

        } else if (audioRef.current.paused && settings.autoPlay) {
             // Resume if paused and autoplay is on
             audioRef.current.play().catch(e => console.error("Playback failed:", e));
        }
    } else {

        // Nothing playing, ensure audio is paused
        if (!audioRef.current.paused) {
             // audioRef.current.pause(); 
        }
    }
  }, [queue, isStarted, volume, settings.autoPlay]);

  // Update volume in real-time
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume / 100;
    }
  }, [volume]);


  // Monitor Network Status
  useEffect(() => {
      const handleOnline = () => setStatus(prev => ({ ...prev, tunnelStatus: true }));
      const handleOffline = () => setStatus(prev => ({ ...prev, tunnelStatus: false }));

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);


  // -------------------------------------------------------------------------
  // N8N POLLING LOOP: FETCHING NEW EVENTS
  // -------------------------------------------------------------------------
  useEffect(() => {
      if (!isStarted) return;
      
      let isMounted = true;
      let timeoutId: NodeJS.Timeout;

      const pollN8N = async () => {
          const currentSettings = settingsRef.current;
          
          if (!currentSettings.n8nUrl || !currentSettings.matchId) {
              // Retry in 1s if settings are missing/incomplete
              if (isMounted) timeoutId = setTimeout(pollN8N, 1000);
              return;
          }

          // Increment Poll Count
          pollCountRef.current += 1;
          
          // Logic: Call API-Football/Sportmonks every 5 polls (5s) OR if it's the very first poll
          // Increased frequency for better "Live" feel, but skip external API mostly
          const shouldCallApi = pollCountRef.current % 5 === 0 || pollCountRef.current === 1;
          
          // console.log(`Poll #${pollCountRef.current} - Call API: ${shouldCallApi}`);

          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 8000); // 8s Timeout

          try {
              // Real API Call to your N8N
              const response = await fetch(currentSettings.n8nUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      matchId: currentSettings.matchId,
                      type: 'POLL', // Explicitly differentiate poll from chat
                      lastEventId: lastEventRef.current,
                      lastStats: lastStatsRef.current,
                      persona: currentSettings.persona,
                      skipApi: !shouldCallApi, // Tell N8N to skip API call if filler time
                      dataProvider: currentSettings.dataProvider || 'api-football',
                      keys: {
                          football: currentSettings.apiFootballKey,
                          sportmonks: currentSettings.sportmonksKey,
                          elevenLabs: currentSettings.elevenLabsKey,
                          openRouter: currentSettings.openRouterKey
                      }
                  }),
                  signal: controller.signal
              });
              
              clearTimeout(fetchTimeout);

              if (!response.ok) {
                  const errText = await response.text();
                  console.error(`N8N Server Error (${response.status}):`, errText);
                  throw new Error(`N8N Error: ${response.status} ${response.statusText}`);
              }

              const data = await response.json();
              // console.log("N8N Response:", data);

              if (isMounted) {
                  // Update Stats History
                  if (data.currentStats) {
                      lastStatsRef.current = data.currentStats;
                  }
                  
                  // Process new events from N8N
                  if (data.events && Array.isArray(data.events) && data.events.length > 0) {
                     const newItems: AudioItem[] = [];
                     
                     data.events.forEach((event: any) => {
                         // Prevent duplicates
                         if (event.id === lastEventRef.current) return;
                         lastEventRef.current = event.id;
                         
                         try {
                            // Convert Base64 audio to Blob URL
                            let audioUrl = '';
                            if (event.audioBase64) {
                                const byteCharacters = atob(event.audioBase64);
                                const byteNumbers = new Array(byteCharacters.length);
                                for (let i = 0; i < byteCharacters.length; i++) {
                                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                                }
                                const byteArray = new Uint8Array(byteNumbers);
                                const blob = new Blob([byteArray], { type: 'audio/mpeg' });
                                audioUrl = URL.createObjectURL(blob);
                            }
                            
                            newItems.push({
                                id: event.id,
                                filename: `ai_commentary_${event.id}.mp3`,
                                source: AudioSource.AI,
                                duration: 'Unknown',
                                timestamp: new Date(),
                                status: AudioStatus.QUEUED,
                                description: event.description || event.text || 'New Event',
                                audioUrl: audioUrl
                            });
                         } catch (e) {
                             console.error("Failed to process audio for event", event.id, e);
                         }
                     });
    
                     if (newItems.length > 0) {
                        setQueue(prev => {
                            const playing = prev.find(i => i.status === AudioStatus.PLAYING);
                            const waiting = prev.filter(i => i.status !== AudioStatus.PLAYING);
                            
                            // Priority Logic
                            const importantKeywords = ['Goal', 'Penalty', 'Red Card', 'Yellow Card', 'VAR'];
                            const priorityItems = newItems.filter(i => importantKeywords.some(k => i.description?.includes(k)));
                            const normalItems = newItems.filter(i => !importantKeywords.some(k => i.description?.includes(k)));
                            
                            let updatedQueue = [...prev];
                            const playingIndex = updatedQueue.findIndex(i => i.status === AudioStatus.PLAYING);
                            
                            if (priorityItems.length > 0) {
                                 if (!currentSettings.autoPlay) {
                                    const newSettings = { ...currentSettings, autoPlay: true };
                                    setSettings(newSettings);
                                    localStorage.setItem('ai_livestream_settings', JSON.stringify(newSettings));
                                 }
                                 
                                 if (playingIndex !== -1) {
                                     updatedQueue.splice(playingIndex + 1, 0, ...priorityItems);
                                 } else {
                                     priorityItems[0].status = AudioStatus.PLAYING;
                                     updatedQueue = [...priorityItems, ...updatedQueue];
                                 }
                                 updatedQueue = [...updatedQueue, ...normalItems];
                            } else {
                                 updatedQueue = [...updatedQueue, ...newItems];
                            }
    
                            const isPlayingNow = updatedQueue.some(i => i.status === AudioStatus.PLAYING);
                            if (!isPlayingNow && currentSettings.autoPlay) {
                                const nextToPlay = updatedQueue.find(i => i.status === AudioStatus.QUEUED);
                                if (nextToPlay) {
                                    nextToPlay.status = AudioStatus.PLAYING;
                                }
                            }
                            return updatedQueue;
                        });
                     }
                  }
                  
                  setStatus(prev => ({ ...prev, n8nConnection: true }));
                  
                  // Attempt to update Match Time if available in response (Fix for "Not Realtime")
                  // Assuming n8n returns 'timeElapsed' at root or inside stats
                  const newTime = data.timeElapsed;
                  if (typeof newTime === 'number' && currentSettings.matchDetails) {
                       if (currentSettings.matchDetails.status.elapsed !== newTime) {
                            setSettings(prev => ({
                                ...prev,
                                matchDetails: {
                                    ...prev.matchDetails!,
                                    status: {
                                        ...prev.matchDetails!.status,
                                        elapsed: newTime
                                    }
                                }
                            }));
                       }
                  }
              }
    
          } catch (error: any) {
              if (error.name !== 'AbortError') {
                   console.error("N8N Poll Connection Failed:", error);
                   if (isMounted) setStatus(prev => ({ ...prev, n8nConnection: false }));
              }
          } finally {
              if (isMounted) {
                  // Poll again in 1 second (Faster polling)
                  timeoutId = setTimeout(pollN8N, 1000);
              }
          }
      };

      pollN8N();

      return () => {
          isMounted = false;
          clearTimeout(timeoutId);
      };
  }, [isStarted]); // Only restart if started state changes

  // -------------------------------------------------------------------------
  // MANUAL OVERRIDE (Drag & Drop)
  // -------------------------------------------------------------------------
  const handleManualUpload = useCallback((file: File) => {
    // Create a local URL for the uploaded file to play it
    const objectUrl = URL.createObjectURL(file);

    const newItem: AudioItem = {
        id: `manual_${Date.now()}`,
        filename: file.name,
        source: AudioSource.MANUAL,
        duration: 'Unknown',
        timestamp: new Date(),
        status: AudioStatus.QUEUED,
        description: `Manual Override: ${file.name}`,
        audioUrl: objectUrl
    };
    
    // Enable AutoPlay on manual upload to ensure it plays
    if (!settings.autoPlay) {
         const newSettings = { ...settings, autoPlay: true };
         setSettings(newSettings);
         localStorage.setItem('ai_livestream_settings', JSON.stringify(newSettings));
    }

    setQueue(prev => {
        const playing = prev.find(i => i.status === AudioStatus.PLAYING);
        const waiting = prev.filter(i => i.status !== AudioStatus.PLAYING);
        
        // Priority Insert: Manual goes to the TOP of the waiting list
        const newQueue = playing ? [playing, newItem, ...waiting] : [newItem, ...waiting];
        
        if (!playing) { // Force play if nothing is playing
             newQueue[0].status = AudioStatus.PLAYING;
        }
        
        return newQueue;
    });
  }, [settings.autoPlay, settings]);

  const currentPlaying = queue.find(i => i.status === AudioStatus.PLAYING) || null;

  const handleSkip = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    // Enable autoplay if disabled, to ensure next item plays
    if (!settings.autoPlay) {
         const newSettings = { ...settings, autoPlay: true };
         setSettings(newSettings);
         localStorage.setItem('ai_livestream_settings', JSON.stringify(newSettings));
    }
    handleAudioEnded();
  };

  const handleStop = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    // Stop playback: Mark current as COMPLETED and Disable AutoPlay
    setQueue(prev => prev.map(item => 
        item.status === AudioStatus.PLAYING 
            ? { ...item, status: AudioStatus.COMPLETED } 
            : item
    ));
    
    const newSettings = { ...settings, autoPlay: false };
    setSettings(newSettings);
    localStorage.setItem('ai_livestream_settings', JSON.stringify(newSettings));
  };

  const handleClear = () => {
    setQueue(prev => prev.filter(item => item.status === AudioStatus.PLAYING));
  };

  const handleRemoveItem = (id: string) => {
    setQueue(prev => {
        const itemToRemove = prev.find(i => i.id === id);
        // If removing the playing item, stop audio
        if (itemToRemove?.status === AudioStatus.PLAYING) {
             if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
             }
        }
        
        const newQueue = prev.filter(i => i.id !== id);
        
        // If we removed the playing item, and autoplay is on, start next
        const playing = newQueue.find(i => i.status === AudioStatus.PLAYING);
        if (!playing && settings.autoPlay && newQueue.length > 0) {
             newQueue[0].status = AudioStatus.PLAYING;
        }
        return newQueue;
    });
  };

  const handleManualPlay = (id: string) => {
     setQueue(prev => {
         const itemToPlay = prev.find(i => i.id === id);
         if (!itemToPlay) return prev;

         // If currently playing something else, stop it
         if (audioRef.current && !audioRef.current.paused) {
             audioRef.current.pause();
             audioRef.current.currentTime = 0;
         }
         
         // Reorder: Move item to top and set to PLAYING
         // Reset others to QUEUED or leave COMPLETED as is (if re-playing history)
         const otherItems = prev.filter(i => i.id !== id).map(i => ({
             ...i,
             status: i.status === AudioStatus.PLAYING ? AudioStatus.QUEUED : i.status
         }));

         // Force AutoPlay ON so it continues after this track
         if (!settings.autoPlay) {
            const newSettings = { ...settings, autoPlay: true };
            setSettings(newSettings);
            localStorage.setItem('ai_livestream_settings', JSON.stringify(newSettings));
         }

         return [{ ...itemToPlay, status: AudioStatus.PLAYING }, ...otherItems];
     });
  };

  const handleManualStopItem = (id: string) => {
      setQueue(prev => {
          const item = prev.find(i => i.id === id);
          if (item && item.status === AudioStatus.PLAYING) {
              if (audioRef.current) {
                  audioRef.current.pause();
                  audioRef.current.currentTime = 0;
              }
              // Mark as COMPLETED
              return prev.map(i => i.id === id ? { ...i, status: AudioStatus.COMPLETED } : i);
          }
          return prev;
      });
  };

  const handleReorder = (newQueue: AudioItem[]) => {
     setQueue(newQueue);
  };


  const handleSelectMatch = (match: any) => {
    // Auto-set AIScore URL to main page (User can navigate to match)
    const autoUrl = "https://www.aiscore.com/";

    const details: MatchDetails = {
        fixtureId: match.fixture.id,
        teams: match.teams,
        goals: match.goals,
        league: { name: match.league.name },
        status: match.fixture.status
    };

    const newSettings = { 
        ...settings, 
        matchId: match.fixture.id.toString(),
        liveMatchUrl: autoUrl,
        matchDetails: details,
        // Remove override so it respects current settings (or provider passed via match context if we added that to Match)
        // BUT: Since MatchSearchModal knows the provider, and App settings knows it, we don't need to force it here.
        // The user already selected provider in settings to SEE the modal with correct data.
    };
    saveSettings(newSettings);
    setShowSearch(false);
  };

  const handleResetMatch = () => {
      // Reset match specific settings but keep global keys
      const newSettings = {
          ...settings,
          matchId: '', // Clear match ID
          liveMatchUrl: '', // Clear live URL
          matchDetails: undefined
      };
      setSettings(newSettings);
      localStorage.setItem('ai_livestream_settings', JSON.stringify(newSettings));
      
      // Clear Queue and History
      setQueue([]);
      lastEventRef.current = '';
      lastStatsRef.current = null;
      
      // Optionally show search modal again to pick new match
      setShowSearch(true);
  };

  const handleChatSubmit = async (message: string) => {
    if (!settings.n8nUrl) return;
    setIsSendingChat(true);

    try {
        const payload = {
            matchId: settings.matchId,
            lastEventId: lastEventRef.current,
            lastStats: lastStatsRef.current,
            persona: settings.persona,
            skipApi: true,
            type: 'CHAT',
            userMessage: message,
            dataProvider: settings.dataProvider || 'api-football',
            matchInfo: settings.matchDetails ? 
                `${settings.matchDetails.teams.home.name} ${settings.matchDetails.goals.home}-${settings.matchDetails.goals.away} ${settings.matchDetails.teams.away.name} (${settings.matchDetails.status.elapsed}')` 
                : "General Football Chat",
            keys: {
                football: settings.apiFootballKey,
                sportmonks: settings.sportmonksKey,
                elevenLabs: settings.elevenLabsKey,
                openRouter: settings.openRouterKey
            }
        };

        const response = await fetch(settings.n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
             throw new Error(`N8N Error: ${response.status}`);
        }

        const data = await response.json();
        console.log("N8N Chat Response:", data);

        if (data.events && Array.isArray(data.events) && data.events.length > 0) {
             const newItems: AudioItem[] = [];
             
             data.events.forEach((event: any) => {
                 try {
                    let audioUrl = '';
                    if (event.audioBase64) {
                        const byteCharacters = atob(event.audioBase64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                            byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: 'audio/mpeg' });
                        audioUrl = URL.createObjectURL(blob);
                    }
                    
                    newItems.push({
                        id: event.id || `chat_${Date.now()}`,
                        filename: `ai_chat_${event.id}.mp3`,
                        source: AudioSource.AI,
                        duration: 'Unknown',
                        timestamp: new Date(),
                        status: AudioStatus.QUEUED,
                        description: event.description || event.text || 'Chat Response',
                        audioUrl: audioUrl
                    });
                 } catch (e) {
                     console.error("Failed to process audio for event", event.id, e);
                 }
             });

             if (newItems.length > 0) {
                setQueue(prev => {
                    const playing = prev.find(i => i.status === AudioStatus.PLAYING);
                    const waiting = prev.filter(i => i.status !== AudioStatus.PLAYING);
                    
                    let updatedQueue: AudioItem[] = [];
                    
                    // Insert Chat Items at the very top
                    const newQueue = playing 
                        ? [playing, ...newItems, ...waiting]
                        : [...newItems, ...waiting];

                    // Force AutoPlay if disabled
                    if (!settings.autoPlay) {
                         const newSettings = { ...settings, autoPlay: true };
                         setSettings(newSettings);
                         localStorage.setItem('ai_livestream_settings', JSON.stringify(newSettings));
                    }
                    
                    if (!playing) {
                        newQueue[0].status = AudioStatus.PLAYING;
                    }
                    
                    return newQueue;
                });
             }
        }

    } catch (error) {
        console.error("Chat Injection Failed:", error);
    } finally {
        setIsSendingChat(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans selection:bg-primary-500 selection:text-white">
      {!isStarted && <StartOverlay onStart={handleStart} />}
      
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={saveSettings}
      />

      <MatchSearchModal 
        isOpen={showSearch} 
        onClose={() => setShowSearch(false)}
        onSelectMatch={handleSelectMatch}
        dataProvider={settings.dataProvider}
        apiKey={settings.apiFootballKey}
        sportmonksKey={settings.sportmonksKey}
      />

      <Header 
        status={status} 
        onOpenSettings={() => setShowSettings(true)} 
        onOpenSearch={() => setShowSearch(true)}
      />
      
      <main className="flex-1 p-6 overflow-hidden flex gap-6">
        <div className="w-[60%] flex flex-col gap-6">
            <div className="flex-1 min-h-0">
                <LiveMonitor 
                    currentAudio={currentPlaying} 
                    liveMatchUrl={settings.liveMatchUrl}
                    matchId={settings.matchId}
                    matchDetails={settings.matchDetails}
                    onReset={handleResetMatch}
                />
            </div>
            <div className="h-auto">
                <ControlPanel 
                    onUpload={handleManualUpload} 
                    volume={volume}
                    onVolumeChange={setVolume}
                    onSkip={handleSkip}
                    onStop={handleStop}
                    onClear={handleClear}
                    onChatSubmit={handleChatSubmit}
                    isSendingChat={isSendingChat}
                />
            </div>
        </div>

        <div className="w-[40%] flex flex-col">
            <AudioQueue 
                queue={queue} 
                onReorder={handleReorder}
                onRemove={handleRemoveItem}
                onPlay={handleManualPlay}
                onStop={handleManualStopItem}
            />
        </div>
      </main>
    </div>
  );
};

export default App;
