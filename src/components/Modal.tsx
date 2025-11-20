import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import LogoIcon from '../assets/vigil_logo.svg?react'; 

// This is the key for style encapsulation: The component imports its own styles as a string.
import modalStyles from '../index.css?inline';

// --- Type Definitions ---
type Match = { 
    name: string; 
    value: string; 
    dummyValue: string;
    index: number;
    length: number;
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
        matches.forEach((match, index) => {
            // 3. Check the toggle state using the loop index directly
            if (redactionState[index]) {
                // 4. Overwrite the characters at the specific position
                for (let k = 0; k < match.length; k++) {
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


    // --- Render ---
    return (
        <div className="fixed top-5 right-5 w-[400px] z-[2147483647] font-grotesque">
            {/* Render the imported styles directly for Shadow DOM encapsulation */}
            <style>{modalStyles}</style>

            {/* 
               CARD LAYOUT FIXES:
               1. flex flex-col: Enables the flex architecture.
               2. max-h-[85vh]: Prevents it from being taller than the viewport.
               3. overflow-hidden: Keeps corners rounded.
            */}
            <Card className="bg-slate-950 border-amber-500/30 text-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 rounded-none flex flex-col max-h-[85vh] overflow-hidden">
                
                {/* HEADER: shrink-0 ensures it never collapses */}
                <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-5 bg-slate-900/50 shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <LogoIcon className="h-7 w-7 text-amber-400" />
                        <h2 className="text-xl font-bold font-grotesque tracking-wide">Sensitive Data Detected</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={handleClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>

                {/* 
                    CONTENT AREA:
                    1. flex-1: Takes up all available space.
                    2. min-h-0: Crucial. Allows the container to shrink so ScrollArea works.
                    3. p-0: Remove default padding so ScrollArea hits the edges.
                */}
                <CardContent className="flex-1 min-h-0 p-0 relative bg-slate-950">
                    <ScrollArea className="h-full w-full">
                        <div className="p-4 space-y-3">
                            {matches.map((match, index) => (
                                <div key={index} className="bg-slate-900/40 border border-red-500/20 rounded-md p-3 flex justify-between items-center group hover:border-red-500/40 transition-colors">
                                    <div className="overflow-hidden mr-4 flex-1"> 
                                        <p className="font-bold text-sm text-slate-200 font-grotesque mb-1">{match.name}</p>
                                        <code className="text-xs text-amber-200/90 bg-slate-950 border border-slate-800 px-2 py-1 rounded block truncate font-mono">
                                            {match.value}
                                        </code>
                                    </div>
                                    <div className="flex items-center space-x-3 flex-shrink-0">
                                        <Label 
                                            htmlFor={`redact-${index}`} 
                                            className="text-red-400 font-bold text-xs cursor-pointer tracking-wider hover:text-red-300 transition-colors"
                                        >
                                            REDACT
                                        </Label>
                                        <Switch 
                                            id={`redact-${index}`} 
                                            checked={redactionState[index]} 
                                            onCheckedChange={(checked) => setRedactionState(prev => ({...prev, [index]: checked}))} 
                                            className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-slate-700"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>

                {/* FOOTER: shrink-0 ensures buttons are always visible */}
                <CardFooter className="flex-col items-start gap-4 pt-4 pb-5 bg-slate-900/30 shrink-0 border-t border-slate-800">
                    <div className="flex justify-between w-full gap-3">
                        <Button variant="ghost" className="hover:bg-slate-800 rounded-md px-4 font-grotesque text-slate-400 hover:text-white" onClick={handleClose}>
                            Cancel
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" className="border-amber-500/50 text-amber-300 hover:bg-amber-900/30 hover:text-amber-200 rounded-md px-4 font-grotesque" onClick={handlePasteOriginal}>
                                Paste Original
                            </Button>
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-md px-4 font-grotesque shadow-[0_0_10px_rgba(245,158,11,0.3)]" onClick={handlePasteModified}>
                                Paste Redacted
                            </Button>
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2 font-grotesque w-full justify-center opacity-70">
                        <span>Hotkeys:</span>
                        <div className="flex items-center gap-1">
                            <kbd className="font-mono px-1.5 py-0.5 text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded">Alt+R</kbd> <span>Redact</span>
                        </div>
                        <span className="text-slate-700">|</span>
                        <div className="flex items-center gap-1">
                            <kbd className="font-mono px-1.5 py-0.5 text-[10px] font-bold text-slate-300 bg-slate-800 border border-slate-700 rounded">Alt+O</kbd> <span>Original</span>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
});