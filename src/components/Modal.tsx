import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import LogoIcon from '../assets/vigil_logo.svg?react'; 

import modalStyles from '../index.css?inline';

// --- Type Definitions ---
type Match = { 
    name: string; 
    value: string; 
    dummyValue: string;
    index: number;   // <-- Add this
    length: number;  // <-- Add this
};
type ModalProps = {
    originalText: string;
    matches: Match[];
    onDecision: (action: string, text?: string) => void;
};
export type RedactionModalRef = {
    triggerPasteModified: () => void;
    triggerPasteOriginal: () => void;
    triggerCancel: () => void;
};

// Wrap the component in forwardRef to accept a ref from its parent
export const RedactionModal = forwardRef<RedactionModalRef, ModalProps>(
    ({ originalText, matches, onDecision }, ref) => {
    
    const [redactionState, setRedactionState] = useState<Record<number, boolean>>(
         () => matches.reduce((acc, _, index) => ({ ...acc, [index]: true }), {})
    );

    // --- Callbacks ---
    const handleClose = useCallback(() => onDecision('cancel'), [onDecision]);
    const handlePasteOriginal = useCallback(() => onDecision('pasteOriginal', originalText), [originalText, onDecision]);
    const handlePasteModified = useCallback(() => {
        // 1. Convert string to character array for easy manipulation by index
        const chars = originalText.split('');
        
        // 2. Iterate through the matches
        // We don't need to sort anymore because the background script guarantees no overlaps.
        matches.forEach((match, index) => {
            // 3. Check the toggle state using the loop index directly
            if (redactionState[index]) {
                // 4. Overwrite the characters at the specific position
                // Since Structural Redaction preserves length, this is safe and simple.
                for (let k = 0; k < match.length; k++) {
                    // Ensure we don't go out of bounds (safety check)
                    if (match.index + k < chars.length) {
                        chars[match.index + k] = match.dummyValue[k];
                    }
                }
            }
        });

        // 5. Join back into a string
        onDecision('pasteModified', chars.join(''));
    }, [originalText, matches, redactionState, onDecision]);

    useImperativeHandle(ref, () => ({
        triggerPasteModified: handlePasteModified,
        triggerPasteOriginal: handlePasteOriginal,
        triggerCancel: handleClose
    }));


    return (
        <div className="fixed top-5 right-5 w-[400px]">
            <style>{modalStyles}</style>

            <Card className="bg-slate-950 border-amber-500/30 text-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 rounded-none">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                        <LogoIcon className="h-8 w-8 text-amber-400" />
                        <h2 className="text-2xl font-semibold font-grotesque">Sensitive Data Detected</h2>
                    </div>
                    {/* The onClick handlers now correctly call the memoized callbacks */}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={handleClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>
                <CardContent className="py-2 max-h-[60vh] overflow-y-auto pr-3 space-y-2">
                    {matches.map((match, index) => (
                    <div key={index} className="bg-slate-900/60 border border-red-300/20 rounded-lg p-3 flex justify-between items-center">
                        <div className="overflow-hidden mr-4 flex-1"> {/* Added flex-1 to take available space */}
                            
                            {/* CHANGE 1: text-sm -> text-base, font-semibold -> font-bold, added mb-1 for spacing */}
                            <p className="font-bold text-base text-slate-100 font-grotesque mb-1">{match.name}</p>
                            <code className="text-sm text-amber-200 bg-slate-950/80 px-2 py-1 rounded block truncate font-mono">
                                {match.value}
                            </code>

                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                            <Label htmlFor={`redact-${index}`} className="text-red-400 font-bold text-sm cursor-pointer font-grotesque">REDACT</Label>
                            <Switch id={`redact-${index}`} checked={redactionState[index]} onCheckedChange={(checked) => setRedactionState(prev => ({...prev, [index]: checked}))} className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-slate-600"/>
                        </div>
                    </div>
                    ))}
                </CardContent>
                <CardFooter className="flex-col items-start gap-4 pt-4">
                    <div className="flex justify-between w-full">
                        <Button variant="ghost" className="hover:bg-slate-800 rounded-full px-4 font-grotesque" onClick={handleClose}>
                            Cancel
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" className="border-amber-500/50 text-amber-300 hover:bg-amber-900/30 hover:text-amber-200 rounded-full px-6 font-grotesque" onClick={handlePasteOriginal}>
                                Paste Original
                            </Button>
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-6 font-grotesque" onClick={handlePasteModified}>
                                Paste Redacted
                            </Button>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2 font-grotesque">
                        <span>Hotkeys:</span>
                        <kbd className="font-sans px-1.5 py-0.5 text-xs font-semibold text-slate-300 bg-amber-900/40 border border-amber-500/30 rounded-md font-grotesque">Alt + R</kbd> <span>Redact</span>
                        <kbd className="font-sans px-1.5 py-0.5 text-xs font-semibold text-slate-300 bg-amber-900/40 border border-amber-500/30 rounded-md font-grotesque">Alt + O</kbd> <span>Original</span>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
});