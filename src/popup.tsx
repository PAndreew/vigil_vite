import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Shield, ShieldCheck } from 'lucide-react';
import './index.css';

const Popup = () => {
    const [dlpEnabled, setDlpEnabled] = useState(true);
    const [protectedDomains, setProtectedDomains] = useState<string[]>([]); // Renamed state
    const [newDomain, setNewDomain] = useState('');
    const [currentTabDomain, setCurrentTabDomain] = useState('');

    useEffect(() => {
        // Fetch settings from storage, now looking for 'protectedDomains'
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

    const handleAddDomain = () => {
        const domainToAdd = newDomain.trim() || currentTabDomain;
        if (domainToAdd && !protectedDomains.includes(domainToAdd)) {
            const updatedDomains = [...protectedDomains, domainToAdd].sort();
            setProtectedDomains(updatedDomains);
            // Save to storage under the key 'protectedDomains'
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
        <div className="w-96 p-4 bg-slate-900 text-white font-sans">
            <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-blue-400" />
                <h1 className="text-xl font-bold">DLP Protection</h1>
            </div>
            <Card className="bg-slate-800 border-slate-700 mb-4">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="enabledToggle" className="font-semibold">Protection Status</Label>
                        <Switch id="enabledToggle" checked={dlpEnabled} onCheckedChange={handleToggle} />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-slate-400" />
                        Protected Site List
                    </CardTitle>
                    <CardDescription>Protection is ONLY active on these sites.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-h-40 overflow-y-auto mb-4 border border-slate-700 rounded-lg p-2 space-y-1">
                        {protectedDomains.length > 0 ? (
                            protectedDomains.map(domain => (
                                <div key={domain} className="flex justify-between items-center p-1.5 bg-slate-700/50 rounded text-sm">
                                    <span>{domain}</span>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-white" onClick={() => handleRemoveDomain(domain)}>
                                        &times;
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-500 text-center text-sm py-4">No sites on the protection list.</p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder={currentTabDomain || "e.g., example.com"}
                            className="bg-slate-700 border-slate-600 focus:ring-blue-500 focus:ring-1"
                        />
                        <Button onClick={handleAddDomain} className="bg-blue-600 hover:bg-blue-700 text-white">Add Site</Button>
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