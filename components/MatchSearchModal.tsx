import React, { useState, useEffect } from 'react';
import { Activity, Search, Clock } from './Icons';

interface Match {
  fixture: {
    id: number;
    status: { elapsed: number; short: string };
    date: string;
  };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
  goals: {
    home: number;
    away: number;
  };
  league: {
    name: string;
    country: string;
    flag: string;
    logo: string;
  };
}

interface MatchSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMatch: (match: Match) => void;
  dataProvider: 'api-football' | 'sportmonks';
  apiKey: string;
  sportmonksKey: string;
}

const MatchSearchModal: React.FC<MatchSearchModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelectMatch, 
  dataProvider, 
  apiKey, 
  sportmonksKey 
}) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'live' | 'time'>('live');

  useEffect(() => {
    if (isOpen) {
        setMatches([]);
        if (dataProvider === 'sportmonks') {
            if (sportmonksKey) {
                fetchSportmonksMatches();
            } else {
                setError("Sportmonks API Key Missing. Please check Settings.");
            }
        } else {
            if (apiKey) {
                fetchLiveMatches();
            } else {
                setError("API-Football Key Missing. Please check Settings.");
            }
        }
    }
  }, [isOpen, apiKey, sportmonksKey, dataProvider]);

  const fetchLiveMatches = async () => {
    setLoading(true);
    setError('');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        // Use Local Date to ensure we get today's matches for the user
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateString}`, {
            headers: {
                "x-rapidapi-key": apiKey,
                "x-rapidapi-host": "v3.football.api-sports.io"
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        
        const data = await res.json();
        
        if (data.errors && Object.keys(data.errors).length > 0) {
             // Handle specific API errors gracefully
             const errorMsg = Object.values(data.errors).join(', ');
             throw new Error(errorMsg || "API Error");
        }
        
        let fetchedMatches: Match[] = data.response || [];
        setMatches(fetchedMatches);
        
    } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error(err);
            setError(err.message || "Failed to fetch matches from API-Football");
        } else {
            setError("Request timed out. Please check your connection.");
        }
    } finally {
        setLoading(false);
    }
  };

  const fetchSportmonksMatches = async () => {
    setLoading(true);
    setError('');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
        // Use Local Date
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        // Sportmonks V3
        const res = await fetch(`https://api.sportmonks.com/v3/football/fixtures/date/${dateString}?api_token=${sportmonksKey}&include=participants;league.country;state;scores`, {
             signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Sportmonks API Error: ${res.status}`);
        
        const data = await res.json();
        const rawMatches = data.data || [];

        const fetchedMatches: Match[] = rawMatches.map((m: any) => {
            // Determine Home/Away
            const home = m.participants.find((p: any) => p.meta?.location === 'home') || m.participants[0];
            const away = m.participants.find((p: any) => p.meta?.location === 'away') || m.participants[1];
            
            // Determine Scores
            // Sportmonks scores can be complex. Look for 'current' score.
            const currentScore = m.scores?.find((s: any) => s.description === 'CURRENT') 
                              || m.scores?.find((s: any) => s.description === '2ND_HALF')
                              || m.scores?.find((s: any) => s.description === '1ST_HALF');
            
            const homeGoals = currentScore?.score?.participant === 'home' ? currentScore.score.goals : (
                m.scores?.filter((s: any) => s.score.participant === 'home').reduce((sum: number, s: any) => sum + s.score.goals, 0) || 0
            );
            // This parsing is simplified. For better accuracy we'd parse formatted score string if available.
            // But Sportmonks provides `scores` array. 
            // Let's fallback to 0-0 if uncertain.
            
            // Better approach for scores if 'CURRENT' exists:
            let hGoals = 0;
            let aGoals = 0;
            if (m.scores && m.scores.length > 0) {
                 const homeScoreObj = m.scores.find((s: any) => s.score.participant === 'home' && s.description === 'CURRENT');
                 const awayScoreObj = m.scores.find((s: any) => s.score.participant === 'away' && s.description === 'CURRENT');
                 if (homeScoreObj) hGoals = homeScoreObj.score.goals;
                 if (awayScoreObj) aGoals = awayScoreObj.score.goals;
            }

            return {
                fixture: {
                    id: m.id,
                    status: {
                        elapsed: m.state?.id === 5 ? 90 : (m.state?.minute || 0), // id 5 = FT roughly?
                        short: m.state?.short_code || 'NS'
                    },
                    date: m.starting_at
                },
                teams: {
                    home: { name: home?.name || 'Home', logo: home?.image_path || '' },
                    away: { name: away?.name || 'Away', logo: away?.image_path || '' }
                },
                goals: {
                    home: hGoals,
                    away: aGoals
                },
                league: {
                    name: m.league?.name || 'Unknown League',
                    country: m.league?.country?.name || 'World',
                    flag: m.league?.country?.image_path || '',
                    logo: m.league?.image_path || ''
                }
            };
        });

        setMatches(fetchedMatches);

    } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error(err);
            setError(err.message || "Failed to fetch matches from Sportmonks");
        } else {
             setError("Request timed out. Please check your connection.");
        }
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getStatusPriority = (status: string) => {
      const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE', 'INT', 'ABD', 'AWD', 'WO', 'IP', 'BREAK']; // Add generic live codes
      const finishedStatuses = ['FT', 'AET', 'PEN'];
      const scheduledStatuses = ['NS', 'TBD', 'PST', 'POSTP'];
      
      if (liveStatuses.includes(status)) return 0;
      if (scheduledStatuses.includes(status)) return 1;
      return 2; 
  };

  // 1. Group matches by League
  const groupedMatches = matches.reduce((acc, match) => {
     const leagueKey = `${match.league.country} - ${match.league.name}`;
     if (!acc[leagueKey]) {
         acc[leagueKey] = [];
     }
     acc[leagueKey].push(match);
     return acc;
  }, {} as Record<string, Match[]>);

  // 2. Filter logic
  const getFilteredGroupedMatches = () => {
      const result: Record<string, Match[]> = {};
      
      Object.keys(groupedMatches).forEach(leagueKey => {
          const matchesInLeague = groupedMatches[leagueKey];
          
          // Search Filter (Case Insensitive & more permissive)
          let filtered = matchesInLeague;
          if (search) {
              const lowerSearch = search.toLowerCase();
              filtered = filtered.filter(m => 
                m.teams.home.name.toLowerCase().includes(lowerSearch) || 
                m.teams.away.name.toLowerCase().includes(lowerSearch) ||
                m.league.name.toLowerCase().includes(lowerSearch) ||
                m.league.country.toLowerCase().includes(lowerSearch)
              );
          }

          // Sort Logic
          filtered.sort((a, b) => {
            if (sortBy === 'live') {
                const priorityA = getStatusPriority(a.fixture.status.short);
                const priorityB = getStatusPriority(b.fixture.status.short);
                if (priorityA !== priorityB) return priorityA - priorityB;
            }
            // Secondary sort: Time
            return new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime();
          });
          
          if (filtered.length > 0) {
              result[leagueKey] = filtered;
          }
      });
      
      return result;
  };

  const finalGroupedMatches = getFilteredGroupedMatches();
  
  // Sort leagues
  const sortedLeagues = Object.keys(finalGroupedMatches).sort((a, b) => {
      const matchesA = finalGroupedMatches[a];
      const matchesB = finalGroupedMatches[b];
      
      if (sortBy === 'live') {
          const liveStatuses = ['1H', '2H', 'HT', 'ET', 'P', 'BT', 'LIVE', 'INT', 'ABD', 'AWD', 'WO', 'IP'];
          const hasLiveA = matchesA.some(m => liveStatuses.includes(m.fixture.status.short));
          const hasLiveB = matchesB.some(m => liveStatuses.includes(m.fixture.status.short));
          
          if (hasLiveA && !hasLiveB) return -1;
          if (!hasLiveA && hasLiveB) return 1;
      }
      
      return a.localeCompare(b);
  });

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
            <div className="flex items-center gap-2 text-white font-bold">
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`}></div>
                {dataProvider === 'sportmonks' ? 'SPORTMONKS' : 'API-FOOTBALL'} MATCHES ({matches.length})
                <button 
                    onClick={() => dataProvider === 'sportmonks' ? fetchSportmonksMatches() : fetchLiveMatches()}
                    className="ml-2 p-1 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    title="Refresh Matches"
                >
                    <Search className="w-3 h-3" />
                </button>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-gray-800 flex gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search team, league, country..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-primary-500 focus:outline-none"
                />
            </div>
            
            {/* Sort Toggle */}
            <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-800">
                <button 
                    onClick={() => setSortBy('live')}
                    className={`px-3 py-1 text-xs font-bold rounded ${sortBy === 'live' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    LIVE FIRST
                </button>
                <button 
                    onClick={() => setSortBy('time')}
                    className={`px-3 py-1 text-xs font-bold rounded ${sortBy === 'time' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    TIME
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
            {loading ? (
                <div className="text-center py-10 text-gray-500 flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading matches from {dataProvider === 'sportmonks' ? 'Sportmonks' : 'API-Football'}...
                </div>
            ) : error ? (
                <div className="text-center py-10 text-red-400">
                    <p className="font-bold mb-1">Error loading matches</p>
                    <p className="text-xs opacity-70">{error}</p>
                </div>
            ) : Object.keys(finalGroupedMatches).length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                    No matches found matching your search.
                </div>
            ) : (
                sortedLeagues.map(leagueKey => {
                    const matchesInLeague = finalGroupedMatches[leagueKey];
                    const firstMatch = matchesInLeague[0];
                    
                    return (
                    <div key={leagueKey} className="space-y-2">
                        {/* League Header */}
                        <div className="flex items-center gap-2 sticky top-0 bg-gray-900/95 backdrop-blur py-2 z-10 border-b border-gray-800">
                            <img 
                                src={firstMatch.league.flag || firstMatch.league.logo} 
                                alt={firstMatch.league.country}
                                className="w-5 h-5 object-contain"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider">
                                {firstMatch.league.country}: {firstMatch.league.name}
                            </h3>
                        </div>

                        <div className="grid gap-2">
                            {matchesInLeague.map(match => {
                                const matchTime = new Date(match.fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const isLive = ['1H','2H','HT','ET','P','BT','INT','ABD','AWD','WO','IP','BREAK'].includes(match.fixture.status.short);
                                
                                return (
                                    <button 
                                        key={match.fixture.id}
                                        onClick={() => onSelectMatch(match)}
                                        className="flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-primary-500/50 rounded-lg p-3 transition-all group text-left"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="flex flex-col items-center min-w-[60px] text-xs text-gray-400">
                                                <span className={`font-bold ${isLive ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>
                                                    {isLive ? (match.fixture.status.elapsed || 0) + "'" : match.fixture.status.short}
                                                </span>
                                                <span className="text-[10px] opacity-70">{matchTime}</span>
                                            </div>
                                            
                                            <div className="flex-1">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <img src={match.teams.home.logo} alt={match.teams.home.name} className="w-6 h-6 object-contain" />
                                                            <span className="text-gray-200 font-semibold">{match.teams.home.name}</span>
                                                        </div>
                                                        <span className="text-primary-400 font-bold text-lg">{match.goals.home}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <img src={match.teams.away.logo} alt={match.teams.away.name} className="w-6 h-6 object-contain" />
                                                            <span className="text-gray-200 font-semibold">{match.teams.away.name}</span>
                                                        </div>
                                                        <span className="text-primary-400 font-bold text-lg">{match.goals.away}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="px-3 py-1 bg-primary-600 text-white text-xs rounded-full font-bold">SELECT</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )})
            )}
        </div>
      </div>
    </div>
  );
};

export default MatchSearchModal;
