import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Match = {
    name: string;
    value: string;
    dummyValue: string;
};

type ModalProps = {
    originalText: string;
    matches: Match[];
    onDecision: (decision: { action: string; text?: string }) => void;
};

export const RedactionModal: React.FC<ModalProps> = ({ originalText, matches, onDecision }) => {
    // We no longer need an `open` state from a Dialog, but we'll use a `visible` state
    // in case we want to add animations later. For now, it's always visible on mount.
    const [isVisible, setIsVisible] = useState(true);

    const [redactionState, setRedactionState] = useState<Record<number, boolean>>(
        () => matches.reduce((acc, _, index) => ({ ...acc, [index]: true }), {})
    );

    // This function now handles all ways of closing the modal
    const handleClose = (decision: { action: string; text?: string }) => {
        setIsVisible(false); // Can be used for a fade-out animation
        onDecision(decision);
    };

    const handleRedactionToggle = (index: number, checked: boolean) => {
        setRedactionState(prev => ({ ...prev, [index]: checked }));
    };

    const handlePasteModified = () => {
        let modifiedText = originalText;
        matches.forEach((match, index) => {
            if (redactionState[index]) {
                const escapedValue = match.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                modifiedText = modifiedText.replace(new RegExp(escapedValue, 'g'), match.dummyValue);
            }
        });
        handleClose({ action: 'pasteModified', text: modifiedText });
    };

    const handlePasteOriginal = () => {
        handleClose({ action: 'pasteOriginal', text: originalText });
    };

    if (!isVisible) {
        return null; // Don't render anything if not visible
    }

    // This is NOT a Dialog. It's a simple div positioned over the page.
    // There is NO full-screen overlay.
    return (
        <div className="fixed top-5 right-5 z-[2147483647] w-[400px]">
            <Card className="bg-slate-900 border-slate-700 text-white shadow-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="h-5 w-5 text-red-400" />
                        <h2 className="text-lg font-semibold">Sensitive Data Detected</h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white"
                        onClick={() => handleClose({ action: 'cancel' })}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>
                <CardContent className="py-2 max-h-[60vh] overflow-y-auto pr-3 space-y-2">
                     {matches.map((match, index) => (
                        <div key={index} className="bg-slate-800/80 border border-slate-700 rounded-md p-3 flex justify-between items-center">
                            <div className="overflow-hidden mr-4">
                                <p className="font-semibold text-sm text-slate-200">{match.name}</p>
                                <code className="text-xs text-slate-400 bg-slate-900/70 p-1 rounded block truncate">
                                    {match.value}
                                </code>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                <Label htmlFor={`redact-${index}`} className="text-red-400 font-bold text-xs cursor-pointer">
                                    REDACT
                                </Label>
                                <Switch
                                    id={`redact-${index}`}
                                    checked={redactionState[index]}
                                    onCheckedChange={(checked) => handleRedactionToggle(index, checked)}
                                    className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-slate-600"
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
                <CardFooter className="flex justify-between pt-4">
                    <Button
                        variant="outline"
                        className="border-amber-500/50 text-amber-400 hover:bg-amber-900/50 hover:text-amber-300"
                        onClick={handlePasteOriginal}
                    >
                        Paste Original
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            className="hover:bg-slate-800"
                            onClick={() => handleClose({ action: 'cancel' })}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={handlePasteModified}
                        >
                            Paste Redacted
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};