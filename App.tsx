import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import LiveMonitor from './components/LiveMonitor';
import AudioQueue from './components/AudioQueue';
import ControlPanel from './components/ControlPanel';
import SettingsModal from './components/SettingsModal';
import MatchSearchModal from './components/MatchSearchModal';
import StartOverlay from './components/StartOverlay';
import TextPopup from './components/TextPopup';
import { AudioItem, AudioSource, AudioStatus, SystemStatus, AppSettings, MatchDetails } from './types';

const App: React.FC = () => {
  // Application State
  const [isStarted, setIsStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  
  // Settings with LocalStorage Persistence
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('ai_livestream_settings');
    if (saved) {
        // Merge saved settings with default in case of missing keys
        const parsed = JSON.parse(saved);
        return {
            ...parsed,
            // Ensure n8nUrl is correct if empty or old default
            n8nUrl: parsed.n8nUrl || 'https://n8n.srv1142799.hstgr.cloud/webhook/ai-director'
        };
    }
    // Default Settings for First Load
    return {
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
    // Auto-connect status if n8n URL is present
    if (settings.n8nUrl && isStarted) {
        setStatus(prev => ({ ...prev, n8nConnection: true }));
    }
  }, [settings, isStarted]);

  // Initialize Audio Context on user start
  const handleStart = () => {
    setIsStarted(true);
    setStatus(prev => ({ 
        ...prev, 
        pythonEngine: true, // Browser Audio Engine Ready
        n8nConnection: !!settings.n8nUrl, 
    }));
    
    // Create Audio Element (Keeping it for manual plays or legacy, though we use Popup primarily now)
    if (!audioRef.current) {
        audioRef.current = new Audio();
        // We remove the onended handler since we are using manual close for the popup
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
  // QUEUE MANAGEMENT: ADVANCE TO NEXT ITEM
  // -------------------------------------------------------------------------
  const handleItemFinished = () => {
    setQueue(prev => {
        const currentPlayingIndex = prev.findIndex(i => i.status === AudioStatus.PLAYING);
        if (currentPlayingIndex === -1) return prev;

        const newQueue = [...prev];
        // Mark current as completed
        newQueue[currentPlayingIndex] = { ...newQueue[currentPlayingIndex], status: AudioStatus.COMPLETED };
        
        // Remove completed items to keep queue clean (optional, but good for performance)
        newQueue.splice(currentPlayingIndex, 1);

        // Find next item to play
        if (newQueue.length > 0 && settings.autoPlay) {
             newQueue[0].status = AudioStatus.PLAYING;
        }
        
        return newQueue;
    });
  };

  // Watch for changes in the queue - handles Manual Playback vs Text Popup logic
  useEffect(() => {
    if (!isStarted || !audioRef.current) return;

    const currentItem = queue.find(i => i.status === AudioStatus.PLAYING);
    
    if (currentItem) {
        if (currentItem.source === AudioSource.MANUAL && currentItem.audioUrl) {
            // Play Manual Audio
            if (!audioRef.current.src.includes(currentItem.audioUrl) && audioRef.current.src !== currentItem.audioUrl) {
                audioRef.current.src = currentItem.audioUrl;
                audioRef.current.volume = volume / 100;
                audioRef.current.play().catch(e => console.error("Playback failed:", e));
            }
             // Ensure onended handles it
             audioRef.current.onended = handleItemFinished;
        } else {
             // AI Text Popup Mode
             console.log("Now presenting:", currentItem.description);
             // Ensure audio is paused/cleared if it was playing
             if (!audioRef.current.paused) {
                 audioRef.current.pause();
             }
             // Remove onended because the popup close button handles it
             audioRef.current.onended = null;
        }
    } else {
        // Nothing playing
        if (!audioRef.current.paused) {
             audioRef.current.pause(); 
        }
    }
  }, [queue, isStarted, settings.autoPlay, volume]);

  // Update volume in real-time (If we still use audio for manual override)
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
  // DIRECT DATA POLLING: REALTIME SCORE & TIME (Bypassing N8N for UI speed)
  // -------------------------------------------------------------------------
  useEffect(() => {
      if (!isStarted || !settings.matchId) return;

      const fetchRealtimeStatus = async () => {
          const currentSettings = settingsRef.current;
          if (!currentSettings.apiFootballKey && !currentSettings.sportmonksKey) return;

          try {
              let newDetails: MatchDetails | null = null;

              if (currentSettings.dataProvider === 'sportmonks' && currentSettings.sportmonksKey) {
                  // Sportmonks V3
                  const res = await fetch(`https://api.sportmonks.com/v3/football/fixtures/${currentSettings.matchId}?api_token=${currentSettings.sportmonksKey}&include=participants;state;scores`);
                  if (res.ok) {
                      const data = await res.json();
                      const m = data.data;
                      if (m) {
                           // Parse similar to MatchSearchModal
                           const home = m.participants.find((p: any) => p.meta?.location === 'home') || m.participants[0];
                           const away = m.participants.find((p: any) => p.meta?.location === 'away') || m.participants[1];
                           
                           // Better score parsing
                           let hGoals = 0, aGoals = 0;
                           if (m.scores && m.scores.length > 0) {
                                const homeScoreObj = m.scores.find((s: any) => s.score.participant === 'home' && s.description === 'CURRENT');
                                const awayScoreObj = m.scores.find((s: any) => s.score.participant === 'away' && s.description === 'CURRENT');
                                if (homeScoreObj) hGoals = homeScoreObj.score.goals;
                                if (awayScoreObj) aGoals = awayScoreObj.score.goals;
                           }

                           newDetails = {
                               fixtureId: m.id,
                               teams: {
                                   home: { name: home?.name || 'Home', logo: home?.image_path || '' },
                                   away: { name: away?.name || 'Away', logo: away?.image_path || '' }
                               },
                               goals: { home: hGoals, away: aGoals },
                               league: { name: currentSettings.matchDetails?.league.name || 'Unknown' },
                               status: {
                                   elapsed: m.state?.id === 5 ? 90 : (m.state?.minute || 0),
                                   short: m.state?.short_code || 'NS'
                               }
                           };
                      }
                  }
              } else if (currentSettings.apiFootballKey) {
                  // API-Football
                  const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${currentSettings.matchId}`, {
                      headers: {
                          "x-rapidapi-key": currentSettings.apiFootballKey,
                          "x-rapidapi-host": "v3.football.api-sports.io"
                      }
                  });
                  if (res.ok) {
                      const data = await res.json();
                      if (data.response && data.response.length > 0) {
                          const m = data.response[0];
                          newDetails = {
                              fixtureId: m.fixture.id,
                              teams: m.teams,
                              goals: m.goals,
                              league: { name: m.league.name },
                              status: m.fixture.status
                          };
                      }
                  }
              }

              // Update State if changed (avoid unnecessary re-renders)
              if (newDetails) {
                  setSettings(prev => {
                      const prevStatus = prev.matchDetails?.status;
                      const prevGoals = prev.matchDetails?.goals;
                      
                      const timeChanged = prevStatus?.elapsed !== newDetails!.status.elapsed;
                      const statusChanged = prevStatus?.short !== newDetails!.status.short;
                      const scoreChanged = prevGoals?.home !== newDetails!.goals.home || prevGoals?.away !== newDetails!.goals.away;

                      if (timeChanged || statusChanged || scoreChanged) {
                          return { ...prev, matchDetails: newDetails! };
                      }
                      return prev;
                  });
              }

          } catch (error) {
              console.error("Realtime Status Poll Failed:", error);
          }
      };

      // Poll every 15 seconds for UI updates (Balance between Realtime and API Limits)
      const interval = setInterval(fetchRealtimeStatus, 15000);
      fetchRealtimeStatus(); // Initial call

      return () => clearInterval(interval);
  }, [isStarted, settings.matchId]); // Re-run if match changes

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
                      skipAudio: true, // NEW: Tell N8N to skip audio generation
                      dataProvider: currentSettings.dataProvider || 'api-football',
                      keys: {
                          football: currentSettings.apiFootballKey,
                          sportmonks: currentSettings.sportmonksKey,
                          // elevenLabs: currentSettings.elevenLabsKey, // Don't send if we don't want it, or send empty
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
              console.log("N8N Response:", JSON.stringify(data, null, 2));

              if (isMounted) {
                  // Update Stats History
                  if (data.currentStats) {
                      lastStatsRef.current = data.currentStats;
                  }
                  
                  // Process new events from N8N
                  if (data.events && Array.isArray(data.events) && data.events.length > 0) {
                     setQueue(prev => {
                         const newItems: AudioItem[] = [];
                         
                         // Deduplicate against current queue
                         const existingIds = new Set(prev.map(i => i.id));

                         data.events.forEach((event: any) => {
                             // Prevent duplicates (Strict Check)
                             if (existingIds.has(event.id)) return;
                             if (event.id === lastEventRef.current) return;
                             
                             console.log("📢 New Event:", event.id, "Text:", event.text?.substring(0, 100), "...");
                             
                             lastEventRef.current = event.id;
                             
                             newItems.push({
                                 id: event.id,
                                 filename: `text_event_${event.id}`,
                                 source: AudioSource.AI,
                                 duration: 'Text',
                                 timestamp: new Date(),
                                 status: AudioStatus.QUEUED,
                                 description: event.description || 'New Event',
                                 text: event.text || '', // Capture full commentary text
                                 audioUrl: '' // No audio URL needed
                             });
                         });
        
                         if (newItems.length > 0) {
                            // Priority Logic
                            const importantKeywords = ['Goal', 'Penalty', 'Red Card', 'Yellow Card', 'VAR'];
                            const priorityItems = newItems.filter(i => importantKeywords.some(k => i.description?.includes(k)));
                            const normalItems = newItems.filter(i => !importantKeywords.some(k => i.description?.includes(k)));
                            
                            let updatedQueue = [...prev];
                            const playingIndex = updatedQueue.findIndex(i => i.status === AudioStatus.PLAYING);
                            
                            if (priorityItems.length > 0) {
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
                         }
                         return prev;
                     });
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
    handleItemFinished();
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
    };
    saveSettings(newSettings);
    setShowSearch(false);

    // FORCE IMMEDIATE POLL TRIGGER
    pollCountRef.current = 0; 
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
            skipAudio: true, // NEW: Tell N8N to skip audio generation
            type: 'CHAT',
            userMessage: message,
            dataProvider: settings.dataProvider || 'api-football',
            matchInfo: settings.matchDetails ? 
                `${settings.matchDetails.teams.home.name} ${settings.matchDetails.goals.home}-${settings.matchDetails.goals.away} ${settings.matchDetails.teams.away.name} (${settings.matchDetails.status.elapsed}')` 
                : "General Football Chat",
            keys: {
                football: settings.apiFootballKey,
                sportmonks: settings.sportmonksKey,
                // elevenLabs: settings.elevenLabsKey,
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
                    newItems.push({
                        id: event.id || `chat_${Date.now()}`,
                        filename: `chat_text_${event.id}`,
                        source: AudioSource.AI,
                        duration: 'Text',
                        timestamp: new Date(),
                        status: AudioStatus.QUEUED,
                        description: event.description || 'Chat Response',
                        text: event.text, // Capture full commentary text
                        audioUrl: ''
                    });
                 } catch (e) {
                     console.error("Failed to process text for event", event.id, e);
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
      
      {/* New Text Popup Component */}
      <TextPopup 
        title={currentPlaying?.description}
        text={currentPlaying?.text || ''}
        isVisible={!!currentPlaying && currentPlaying.source === AudioSource.AI}
        onClose={handleItemFinished}
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
