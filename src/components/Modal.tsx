import React, { useState, useEffect, useCallback } from 'react'; // Import useEffect and useCallback
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
    onDecision: (decision: { action:string; text?: string }) => void;
};

export const RedactionModal: React.FC<ModalProps> = ({ originalText, matches, onDecision }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [redactionState, setRedactionState] = useState<Record<number, boolean>>(
        () => matches.reduce((acc, _, index) => ({ ...acc, [index]: true }), {})
    );

    // --- Action Handlers ---

    // This function now handles all ways of closing the modal
    const handleClose = useCallback((decision: { action: string; text?: string }) => {
        setIsVisible(false);
        onDecision(decision);
    }, [onDecision]);

    const handlePasteModified = useCallback(() => {
        let modifiedText = originalText;
        matches.forEach((match, index) => {
            if (redactionState[index]) {
                const escapedValue = match.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                modifiedText = modifiedText.replace(new RegExp(escapedValue, 'g'), match.dummyValue);
            }
        });
        handleClose({ action: 'pasteModified', text: modifiedText });
    }, [originalText, matches, redactionState, handleClose]);

    const handlePasteOriginal = useCallback(() => {
        handleClose({ action: 'pasteOriginal', text: originalText });
    }, [originalText, handleClose]);


    // --- Hotkey Logic using useEffect ---

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Only proceed if the Alt key is pressed to avoid conflicts
            if (!event.altKey) {
                return;
            }

            // Check which key was pressed alongside Alt
            switch (event.key.toLowerCase()) {
                case 'r':
                    event.preventDefault(); // Stop the browser's default action (e.g., refresh)
                    handlePasteModified();
                    break;
                case 'o':
                    event.preventDefault(); // Stop the browser's default action
                    handlePasteOriginal();
                    break;
                // Add an Escape key handler for convenience
                case 'escape':
                     event.preventDefault();
                     handleClose({ action: 'cancel' });
                     break;
            }
        };

        // Add the event listener when the modal is mounted
        document.addEventListener('keydown', handleKeyDown);

        // This is the cleanup function: remove the listener when the modal is unmounted
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handlePasteModified, handlePasteOriginal, handleClose]); // Dependencies ensure the latest functions are used


    const handleRedactionToggle = (index: number, checked: boolean) => {
        setRedactionState(prev => ({ ...prev, [index]: checked }));
    };

    if (!isVisible) {
        return null;
    }

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
                <CardFooter className="flex-col items-start gap-4 pt-4">
                    <div className="flex justify-between w-full">
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
                    </div>
                    {/* Hotkey Hint UI */}
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>Hotkeys:</span>
                        <kbd className="font-sans px-1.5 py-0.5 text-xs font-semibold text-slate-300 bg-slate-700/80 border border-slate-600 rounded">Alt + R</kbd>
                        <span>Redact,</span>
                        <kbd className="font-sans px-1.5 py-0.5 text-xs font-semibold text-slate-300 bg-slate-700/80 border border-slate-600 rounded">Alt + O</kbd>
                        <span>Original</span>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};