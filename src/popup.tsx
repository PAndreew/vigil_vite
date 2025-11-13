import React from 'react';
import ReactDOM from 'react-dom/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
// import './index.css';

const Popup = () => {
    const [dlpEnabled, setDlpEnabled] = React.useState(true);
    const [whitelistedDomains, setWhitelistedDomains] = React.useState<string[]>([]);
    const [newDomain, setNewDomain] = React.useState('');
    const [currentTabDomain, setCurrentTabDomain] = React.useState('');

    React.useEffect(() => {
        chrome.storage.local.get(['dlpEnabled', 'whitelistedDomains'], (result) => {
            setDlpEnabled(result.dlpEnabled !== false);
            setWhitelistedDomains(result.whitelistedDomains || []);
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
        <div className="w-96 p-4 bg-slate-900 text-white">
            <h1 className="text-2xl font-bold mb-4">DLP Protection</h1>
            <Card className="bg-slate-800 border-slate-700 mb-4">
                <CardHeader>
                    <CardTitle>Protection Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="enabledToggle">Enable Protection</Label>
                        <Switch id="enabledToggle" checked={dlpEnabled} onCheckedChange={handleToggle} />
                    </div>
                </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle>Domain Whitelist</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-4">
                        <Input
                            type="text"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            placeholder={currentTabDomain || "e.g., example.com"}
                            className="bg-slate-700 border-slate-600"
                        />
                        <Button onClick={handleAddDomain}>Add</Button>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                        {whitelistedDomains.length > 0 ? (
                            whitelistedDomains.map(domain => (
                                <div key={domain} className="flex justify-between items-center p-2 bg-slate-700 rounded mb-1">
                                    <span>{domain}</span>
                                    <Button variant="destructive" size="sm" onClick={() => handleRemoveDomain(domain)}>Remove</Button>
                                </div>
                            ))
                        ) : (
                            <p className="text-slate-400 text-center">No domains whitelisted.</p>
                        )}
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