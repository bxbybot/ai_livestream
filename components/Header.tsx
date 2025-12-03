import React from 'react';
import { Cloud, Radio, Server, Activity, SettingsIcon, Search } from './Icons';
import { SystemStatus } from '../types';

interface HeaderProps {
  status: SystemStatus;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
}

const Header: React.FC<HeaderProps> = ({ status, onOpenSettings, onOpenSearch }) => {
  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center">
          <Radio className="text-white w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-100 leading-tight tracking-wide">AI_LIVESTREAM</h1>
          <p className="text-xs text-gray-400">DIRECTOR CONSOLE</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <StatusIndicator 
          icon={<Cloud className="w-4 h-4" />}
          label="N8N CLOUD"
          active={status.n8nConnection}
        />
        <div className="h-4 w-px bg-gray-800" />
        <StatusIndicator 
          icon={<Server className="w-4 h-4" />}
          label="AUDIO ENGINE"
          active={status.pythonEngine}
        />
        <div className="h-4 w-px bg-gray-800" />
        <StatusIndicator 
          icon={<Activity className="w-4 h-4" />}
          label="NETWORK"
          active={status.tunnelStatus}
        />
        
        <div className="h-8 w-px bg-gray-800 mx-2" />
        
        <button 
          onClick={onOpenSearch}
          className="p-2 text-gray-400 hover:text-accent-500 hover:bg-gray-800 rounded-lg transition-colors"
          title="Search Live Matches"
        >
            <Search className="w-5 h-5" />
        </button>

        <button 
          onClick={onOpenSettings}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Settings"
        >
            <SettingsIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

const StatusIndicator: React.FC<{ icon: React.ReactNode, label: string, active: boolean }> = ({ icon, label, active }) => (
  <div className={`flex items-center gap-2 ${active ? 'text-accent-500' : 'text-red-500'}`}>
    {icon}
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold tracking-wider opacity-70">{label}</span>
      <span className="text-xs font-bold leading-none">{active ? 'ONLINE' : 'OFFLINE'}</span>
    </div>
  </div>
);

export default Header;