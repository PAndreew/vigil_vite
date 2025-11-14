import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Trash2 } from 'lucide-react';

// ✅ SAFE TO USE HERE: This is a standard page, so Vite handles this import correctly.
import './index.css';

const Popup = () => {
    const [dlpEnabled, setDlpEnabled] = useState(true);
    const [whitelistedDomains, setWhitelistedDomains] = useState<string[]>([]);
    const [newDomain, setNewDomain] = useState('');
    const [currentTabDomain, setCurrentTabDomain] = useState('');

    useEffect(() => {
        chrome.storage.local.get(['dlpEnabled', 'whitelistedDomains'], (result) => {
            setDlpEnabled(result.dlpEnabled !== false);
            setWhitelistedDomains(result.whitelistedDomains || []);
        });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.url) {
                try {
                    const url = new URL(tabs[0].url);
                    setCurrentTabDomain(url.hostname);
                } catch (e) {
                    // Ignore errors
                }
            }
        });
    }, []);

    const handleToggle = (checked: boolean) => {
        setDlpEnabled(checked);
        chrome.storage.local.set({ dlpEnabled: checked });
    };

    const handleAddDomain = () => {
        const domainToAdd = newDomain.trim() || currentTabDomain;
        if (domainToAdd && !whitelistedDomains.includes(domainToAdd)) {
            const updatedDomains = [...whitelistedDomains, domainToAdd].sort();
            setWhitelistedDomains(updatedDomains);
            chrome.storage.local.set({ whitelistedDomains: updatedDomains });
            setNewDomain('');
        }
    };

    const handleRemoveDomain = (domainToRemove: string) => {
        const updatedDomains = whitelistedDomains.filter(d => d !== domainToRemove);
        setWhitelistedDomains(updatedDomains);
        chrome.storage.local.set({ whitelistedDomains: updatedDomains });
    };

    return (
        <div className="w-96 min-h-screen bg-slate-950 text-slate-50 p-4 font-sans border-l border-slate-800">
            <header className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="p-2 bg-red-900/30 rounded-lg border border-red-500/20">
                    <ShieldCheck className="h-6 w-6 text-red-500" />
                </div>
                <div>
                    <h1 className="text-lg font-bold tracking-tight">Privacy Shield</h1>
                    <p className="text-xs text-slate-400">Data Loss Prevention</p>
                </div>
            </header>

            <Card className="bg-slate-900 border-slate-800 mb-4 shadow-lg">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-200">Global Protection</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="space-y-0.5">
                            <Label htmlFor="enabledToggle" className="text-slate-200 font-medium">Monitor Paste</Label>
                            <p className="text-xs text-slate-500">Scan clipboard content</p>
                        </div>
                        <Switch
                            id="enabledToggle"
                            checked={dlpEnabled}
                            onCheckedChange={handleToggle}
                            className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-slate-700"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 shadow-lg">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-slate-200">Whitelist</CardTitle>
                    <CardDescription className="text-xs text-slate-500">Skip scanning on these domains</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-3">
                        <Input
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder={currentTabDomain || "example.com"}
                            className="bg-slate-950 border-slate-800 focus-visible:ring-red-500/50 placeholder:text-slate-600 h-9 text-sm"
                        />
                        <Button 
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white h-9 px-3" 
                            onClick={handleAddDomain}
                        >
                            Add
                        </Button>
                    </div>
                    
                    <div className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
                        <div className="max-h-[140px] overflow-y-auto p-1 space-y-1 custom-scrollbar">
                            {whitelistedDomains.length > 0 ? (
                                whitelistedDomains.map(domain => (
                                    <div key={domain} className="group flex justify-between items-center text-sm px-3 py-2 rounded hover:bg-slate-900 transition-colors">
                                        <span className="text-slate-300 font-mono text-xs truncate max-w-[180px]">{domain}</span>
                                        <button 
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded"
                                            onClick={() => handleRemoveDomain(domain)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                                    <span className="text-xs italic">No domains whitelisted</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);