import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { Cloud, Server, Zap, Lock } from './Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'general' | 'keys'>('general');

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-primary-500" />
              System Configuration
            </h2>
            <p className="text-xs text-gray-500 mt-1">Setup your N8N brain and API connections</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-6">
          <button 
            onClick={() => setActiveTab('general')}
            className={`py-3 text-sm font-medium mr-6 border-b-2 transition-colors ${activeTab === 'general' ? 'border-primary-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            General & Match
          </button>
          <button 
             onClick={() => setActiveTab('keys')}
             className={`py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'keys' ? 'border-accent-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            API Keys & Secrets
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {activeTab === 'general' && (
            <>
              <div className="bg-blue-900/10 border border-blue-500/20 p-4 rounded-lg">
                <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                  Data Provider
                </label>
                <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="radio" 
                            name="provider"
                            checked={formData.dataProvider === 'api-football'}
                            onChange={() => setFormData({...formData, dataProvider: 'api-football'})}
                            className="text-primary-500"
                        />
                        <span className="text-sm text-white">API-Football (RapidAPI)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="radio" 
                            name="provider"
                            checked={formData.dataProvider === 'sportmonks'}
                            onChange={() => setFormData({...formData, dataProvider: 'sportmonks'})}
                            className="text-primary-500"
                        />
                        <span className="text-sm text-white">Sportmonks API</span>
                    </label>
                </div>

                <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                  Target Match ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.matchId}
                    onChange={(e) => setFormData({ ...formData, matchId: e.target.value })}
                    className="flex-1 bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                    placeholder={formData.dataProvider === 'sportmonks' ? "e.g. 18532112 (Sportmonks ID)" : "e.g. 1056721 (API-Football ID)"}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  {formData.dataProvider === 'sportmonks' 
                    ? "Use the Fixture ID from Sportmonks." 
                    : "The ID from API-Football/Flashscore for the specific match."}
                </p>

                <div className="mt-3 pt-3 border-t border-blue-500/10">
                  <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">
                      Live Match URL (Preview)
                  </label>
                  <input
                      type="text"
                      value={formData.liveMatchUrl || ''}
                      onChange={(e) => setFormData({ ...formData, liveMatchUrl: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                      placeholder="https://www.aiscore.com/match-..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                   Commentary Persona (LLM Style)
                </label>
                <textarea
                  value={formData.persona}
                  onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none h-20"
                  placeholder="e.g. An energetic friend who loves cracking jokes. Use casual Thai language with slang."
                />
                <p className="text-[10px] text-gray-500 mt-1">This instruction is sent to the LLM to control the style of the commentary.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Cloud className="w-3 h-3" /> N8N Webhook Endpoint
                </label>
                <input
                  type="text"
                  value={formData.n8nUrl}
                  onChange={(e) => setFormData({ ...formData, n8nUrl: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:border-primary-500 focus:outline-none"
                  placeholder="https://srv1142799.hstgr.cloud/webhook/..."
                />
                <p className="text-[10px] text-gray-500 mt-1">This endpoint should return a JSON array of new audio events.</p>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-950 rounded border border-gray-800">
                <span className="text-sm text-gray-300">Auto-Play Incoming Audio</span>
                 <input 
                    type="checkbox"
                    checked={formData.autoPlay}
                    onChange={(e) => setFormData({ ...formData, autoPlay: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-primary-500"
                 />
              </div>
            </>
          )}

          {activeTab === 'keys' && (
            <div className="space-y-4">
               <div className="bg-yellow-900/10 border border-yellow-500/10 p-3 rounded text-[10px] text-yellow-500 mb-4">
                  <Lock className="w-3 h-3 inline mr-1" />
                  Security Note: These keys are stored in your browser's Local Storage. They are sent to your N8N instance when fetching data.
               </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  API-Football Key (RapidAPI)
                </label>
                <input
                  type="password"
                  value={formData.apiFootballKey}
                  onChange={(e) => setFormData({ ...formData, apiFootballKey: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:border-accent-500 focus:outline-none"
                  placeholder="For Data Provider: API-Football"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Sportmonks API Key
                </label>
                <input
                  type="password"
                  value={formData.sportmonksKey || ''}
                  onChange={(e) => setFormData({ ...formData, sportmonksKey: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:border-accent-500 focus:outline-none"
                  placeholder="For Data Provider: Sportmonks"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  OpenRouter API Key (LLM)
                </label>
                <input
                  type="password"
                  value={formData.openRouterKey || ''}
                  onChange={(e) => setFormData({ ...formData, openRouterKey: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:border-accent-500 focus:outline-none"
                  placeholder="sk-or-..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  ElevenLabs API Key
                </label>
                <input
                  type="password"
                  value={formData.elevenLabsKey}
                  onChange={(e) => setFormData({ ...formData, elevenLabsKey: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded px-3 py-2 text-sm text-white focus:border-accent-500 focus:outline-none"
                  placeholder="xi_api_..."
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/50">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(formData)}
            className="px-6 py-2 rounded bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-primary-500/20 transition-all"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
