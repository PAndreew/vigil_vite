import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area"; 
import { ShieldCheck, Globe, Plus } from 'lucide-react';
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
        // OUTER CONTAINER: Fixed 600px height. overflow-hidden ensures no body scrollbars.
        <div className="w-[400px] h-[600px] bg-slate-950 text-white font-grotesque flex flex-col overflow-hidden">
            
            {/* HEADER: Rigid height (shrink-0) */}
            <div className="p-5 bg-slate-900/50 border-b border-slate-800 flex items-center gap-3 shrink-0">
                <LogoIcon className="h-8 w-8 text-amber-500" />
                <div>
                    <h1 className="text-xl font-bold tracking-wide text-slate-100">VIGIL DLP</h1>
                    <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Enterprise Protection</p>
                </div>
            </div>

            {/* MAIN CONTENT WRAPPER: Fills remaining space */}
            <div className="flex-1 flex flex-col min-h-0 p-5 space-y-4">
                
                {/* TOGGLE CARD: Rigid height */}
                <Card className="bg-slate-900 border-amber-500/30 rounded-none shadow-lg shrink-0">
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
                            className="data-[state=checked]:bg-amber-600 data-[state=unchecked]:bg-slate-700"
                        />
                    </CardContent>
                </Card>

                {/* LIST CARD: Flex-1 to grow. min-h-0 is CRITICAL for nested scrolling. */}
                <Card className="bg-slate-900/50 border-slate-800 rounded-none flex-1 flex flex-col min-h-0">
                    <CardHeader className="pb-3 pt-4 px-4 shrink-0">
                        <CardTitle className="flex items-center gap-2 text-base text-slate-300 font-grotesque">
                            <ShieldCheck className="h-4 w-4 text-amber-400" />
                            Monitored Environments
                        </CardTitle>
                        <CardDescription className="text-slate-500 text-xs">
                            DLP scanning is active on these domains.
                        </CardDescription>
                    </CardHeader>
                    
                    {/* CARD CONTENT: Must also be flex column with min-h-0 */}
                    <CardContent className="px-4 pb-4 flex-1 flex flex-col gap-3 min-h-0">
                        
                        {/* SCROLL CONTAINER 
                            1. flex-1: Take all space NOT used by the input at the bottom.
                            2. min-h-0: Allow shrinking if screen is small.
                            3. relative/overflow-hidden: Standard scroll container hygiene.
                        */}
                        <div className="flex-1 min-h-0 border border-slate-800/40 rounded-md bg-slate-950/30 overflow-hidden relative">
                            {/* ScrollArea gets h-full to fill the parent div */}
                            <ScrollArea className="h-full w-full">
                                <div className="p-2 space-y-2">
                                    {protectedDomains.length > 0 ? (
                                        protectedDomains.map(domain => (
                                            <div key={domain} className="flex justify-between items-center p-2.5 bg-slate-950 border border-slate-800/60 rounded-md group hover:border-amber-500/30 transition-colors">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Globe className="h-3 w-3 text-slate-600 flex-shrink-0" />
                                                    <span className="font-mono text-sm text-slate-300 truncate">{domain}</span>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="lg" 
                                                    className="h-6 w-6 p-0 text-slate-600 hover:text-red-400 hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity" 
                                                    onClick={() => handleRemoveDomain(domain)}
                                                >
                                                    &times;
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-32 flex flex-col items-center justify-center text-slate-600">
                                            <ShieldCheck className="h-8 w-8 opacity-20 mb-2" />
                                            <p className="text-sm">No sites protected</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* INPUT ROW: Rigid height (shrink-0) ensures it's never crushed */}
                        <div className="flex gap-2 pt-1 shrink-0">
                            <Input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                placeholder={currentTabDomain || "domain.com"}
                                className="bg-slate-950 border-slate-700 focus-visible:ring-amber-600/50 rounded-md font-mono text-sm placeholder:text-slate-600"
                            />
                            <Button 
                                onClick={handleAddDomain} 
                                className="bg-amber-600 hover:bg-amber-700 text-white rounded-md w-10 p-0 flex-shrink-0"
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