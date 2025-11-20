import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Import Tooltip
import LogoIcon from '../assets/vigil_logo.svg?react'; 

// Style encapsulation
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
        const chars = originalText.split('');
        matches.forEach((match, index) => {
            if (redactionState[index]) {
                for (let k = 0; k < match.length; k++) {
                    if (match.index + k < chars.length) {
                        chars[match.index + k] = match.dummyValue[k];
                    }
                }
            }
        });
        onDecision('pasteModified', chars.join(''));
    }, [originalText, matches, redactionState, onDecision]);

    useImperativeHandle(ref, () => ({
        triggerPasteModified: handlePasteModified,
        triggerPasteOriginal: handlePasteOriginal,
        triggerCancel: handleClose
    }));


    // --- Render ---
    return (
        <div className="fixed top-5 right-5 w-[400px] h-[600px] z-[2147483647] font-grotesque flex flex-col overflow-hidden rounded-lg shadow-2xl">
            <style>{modalStyles}</style>

            <Card className="h-full flex flex-col bg-slate-950 border-amber-500/30 text-white rounded-none">
                
                <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-5 bg-slate-900/50 shrink-0 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <LogoIcon className="h-7 w-7 text-amber-400" />
                        <h2 className="text-xl font-bold font-grotesque tracking-wide">Sensitive Data</h2>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={handleClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>

                <CardContent className="flex-1 min-h-0 p-0 bg-slate-950 relative">
                    <ScrollArea className="h-full w-full">
                        <div className="p-4 space-y-3">
                            {/* Wrap logic in TooltipProvider */}
                            <TooltipProvider delayDuration={100}>
                                {matches.map((match, index) => (
                                    <div key={index} className="bg-slate-900/40 border border-red-500/20 rounded-none p-3 flex justify-between items-center group hover:border-red-500/40 transition-colors w-full">
                                        
                                        {/* 
                                            FIX 1: min-w-0 
                                            This is the specific CSS fix. Without it, a flex child cannot shrink below its content size.
                                            min-w-0 allows the truncate to actually happen.
                                        */}
                                        <div className="flex-1 min-w-0 mr-3"> 
    
                                            {/* MATCH NAME */}
                                            <p className="font-bold text-sm text-slate-200 font-grotesque mb-1 truncate">
                                                {match.name}
                                            </p>
                                            
                                            {/* TOOLTIP LOGIC */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    {/* 
                                                    FIX: 
                                                    1. w-full: Tells the code block to fill the parent (which is constrained by min-w-0).
                                                    2. max-w-[220px]: A safety net. This forces the browser to stop expanding 
                                                        if flexbox calculation gets lazy.
                                                    */}
                                                    <code className="text-xs text-amber-200/90 bg-slate-950 border border-slate-800 px-2 py-1 rounded block truncate font-mono cursor-help hover:bg-slate-900 hover:border-amber-500/40 transition-colors w-full max-w-[220px]">
                                                        {match.value}
                                                    </code>
                                                </TooltipTrigger>
                                                <TooltipContent 
                                                    side="top" 
                                                    align="start"
                                                    // z-index ensures it floats above everything
                                                    className="bg-slate-900 border-slate-700 text-slate-200 font-mono text-xs max-w-[300px] break-all z-[2147483650] shadow-xl"
                                                >
                                                    {match.value}
                                                </TooltipContent>
                                            </Tooltip>

                                        </div>

                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                            <Label 
                                                htmlFor={`redact-${index}`} 
                                                className="text-red-400 font-bold text-[10px] cursor-pointer tracking-wider hover:text-red-300 transition-colors uppercase"
                                            >
                                                Redact
                                            </Label>
                                            <Switch 
                                                id={`redact-${index}`} 
                                                checked={redactionState[index]} 
                                                onCheckedChange={(checked) => setRedactionState(prev => ({...prev, [index]: checked}))} 
                                                className="data-[state=checked]:bg-red-600 data-[state=unchecked]:bg-slate-700 scale-90"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </TooltipProvider>
                        </div>
                    </ScrollArea>
                </CardContent>

                <CardFooter className="flex-col items-start gap-4 pt-4 pb-5 bg-slate-900/30 shrink-0 border-t border-slate-800">
                    <div className="flex justify-between w-full gap-2">
                        <Button variant="ghost" className="hover:bg-slate-800 rounded-none px-3 font-grotesque text-slate-400 hover:text-white" onClick={handleClose}>
                            Cancel
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" className="border-amber-500/50 text-amber-300 hover:bg-amber-900/30 hover:text-amber-200 rounded-none px-3 font-grotesque" onClick={handlePasteOriginal}>
                                Original
                            </Button>
                            <Button className="bg-amber-600 hover:bg-amber-700 text-white rounded-none px-4 font-grotesque shadow-[0_0_10px_rgba(245,158,11,0.3)]" onClick={handlePasteModified}>
                                Redact & Paste
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