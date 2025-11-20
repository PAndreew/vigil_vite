import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Globe, Plus } from 'lucide-react'; // Added Globe/Plus for better UI
import LogoIcon from './assets/vigil_logo.svg?react'; 
import './index.css';

const Popup = () => {
    const [dlpEnabled, setDlpEnabled] = useState(true);
    const [protectedDomains, setProtectedDomains] = useState<string[]>([]);
    const [newDomain, setNewDomain] = useState('');
    const [currentTabDomain, setCurrentTabDomain] = useState('');

    useEffect(() => {
        chrome.storage.local.get(['dlpEnabled', 'protectedDomains'], (result) => {
            setDlpEnabled(result.dlpEnabled !== false);
            setProtectedDomains(result.protectedDomains || []);
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                try {
                    const url = new URL(tabs[0].url);
                    setCurrentTabDomain(url.hostname);
                } catch (e) {
                    console.error("Invalid URL:", tabs[0].url);
                }
            }
        });
    }, []);

    const handleToggle = (checked: boolean) => {
        setDlpEnabled(checked);
        chrome.storage.local.set({ dlpEnabled: checked });
    };

    const sanitizeDomain = (input: string): string | null => {
        const trimmed = input.trim().toLowerCase();
        if (!trimmed) return null;
        try {
            const urlStr = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
            return new URL(urlStr).hostname;
        } catch (e) {
            return trimmed;
        }
    };

    const handleAddDomain = () => {
        const rawInput = newDomain.trim() || currentTabDomain;
        const cleanDomain = sanitizeDomain(rawInput);

        if (cleanDomain && !protectedDomains.includes(cleanDomain)) {
            const updatedDomains = [...protectedDomains, cleanDomain].sort();
            setProtectedDomains(updatedDomains);
            chrome.storage.local.set({ protectedDomains: updatedDomains });
            setNewDomain('');
        }
    };

    const handleRemoveDomain = (domainToRemove: string) => {
        const updatedDomains = protectedDomains.filter(d => d !== domainToRemove);
        setProtectedDomains(updatedDomains);
        chrome.storage.local.set({ protectedDomains: updatedDomains });
    };

    return (
        // Width increased to 400px to match the Modal size
        <div className="w-[400px] bg-slate-950 text-white font-grotesque min-h-[450px] flex flex-col">
            
            {/* HEADER */}
            <div className="p-5 bg-slate-900/50 border-b border-slate-800 flex items-center gap-3">
                <LogoIcon className="h-8 w-8 text-purple-500" />
                <div>
                    <h1 className="text-xl font-bold tracking-wide text-slate-100">VIGIL DLP</h1>
                    <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Enterprise Protection</p>
                </div>
            </div>

            <div className="p-5 space-y-5 flex-1">
                
                {/* STATUS CARD */}
                <Card className="bg-slate-900 border-purple-500/30 rounded-none shadow-lg">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <Label htmlFor="enabledToggle" className="font-bold text-lg text-slate-200 font-grotesque">Global Protection</Label>
                            <span className={`text-xs font-mono mt-1 ${dlpEnabled ? 'text-green-400' : 'text-slate-500'}`}>
                                {dlpEnabled ? '● SYSTEM ACTIVE' : '○ SYSTEM PAUSED'}
                            </span>
                        </div>
                        <Switch 
                            id="enabledToggle" 
                            checked={dlpEnabled} 
                            onCheckedChange={handleToggle} 
                            className="data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-slate-700"
                        />
                    </CardContent>
                </Card>

                {/* DOMAIN LIST CARD */}
                <Card className="bg-slate-900/50 border-slate-800 rounded-none flex-1 flex flex-col">
                    <CardHeader className="pb-3 pt-4 px-4">
                        <CardTitle className="flex items-center gap-2 text-base text-slate-300 font-grotesque">
                            <ShieldCheck className="h-4 w-4 text-purple-400" />
                            Monitored Environments
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-xs">
                            DLP scanning is active on these domains.
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="px-4 pb-4 flex-1 flex flex-col gap-3">
                        {/* SCROLLABLE LIST */}
                        <div className="flex-1 max-h-[180px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                            {protectedDomains.length > 0 ? (
                                protectedDomains.map(domain => (
                                    <div key={domain} className="flex justify-between items-center p-2.5 bg-slate-950 border border-slate-800/60 rounded-md group hover:border-purple-500/30 transition-colors">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Globe className="h-3 w-3 text-slate-600 flex-shrink-0" />
                                            {/* Using Font Mono for URLs is standard practice */}
                                            <span className="font-mono text-sm text-slate-300 truncate">{domain}</span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-6 w-6 p-0 text-slate-600 hover:text-red-400 hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity" 
                                            onClick={() => handleRemoveDomain(domain)}
                                        >
                                            &times;
                                        </Button>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 py-8 border border-dashed border-slate-800 rounded-md">
                                    <ShieldCheck className="h-8 w-8 opacity-20 mb-2" />
                                    <p className="text-sm">No sites protected</p>
                                </div>
                            )}
                        </div>

                        {/* INPUT AREA */}
                        <div className="flex gap-2 pt-2">
                            <Input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                placeholder={currentTabDomain || "domain.com"}
                                // Monospace input for URLs looks better
                                className="bg-slate-950 border-slate-700 focus-visible:ring-purple-500/50 rounded-md font-mono text-sm placeholder:text-slate-600"
                            />
                            <Button 
                                onClick={handleAddDomain} 
                                className="bg-purple-600 hover:bg-purple-700 text-white rounded-md w-10 p-0 flex-shrink-0"
                            >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);