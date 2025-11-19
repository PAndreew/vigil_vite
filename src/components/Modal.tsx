import { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import LogoIcon from '../assets/vigil_logo.svg?react'; 

// This is the key for style encapsulation: The component imports its own styles as a string.
import modalStyles from '../index.css?inline';

// --- Type Definitions ---
type Match = { name: string; value: string; dummyValue: string; };
type ModalProps = {
    originalText: string;
    matches: Match[];
    onDecision: (action: string, text?: string) => void;
};
// This defines the functions that the parent component can call on this component
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
        let modifiedText = originalText;
        matches.forEach((match, index) => {
            if (redactionState[index]) {
                const escapedValue = match.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                modifiedText = modifiedText.replace(new RegExp(escapedValue, 'g'), match.dummyValue);
            }
        });
        onDecision('pasteModified', modifiedText);
    }, [originalText, matches, redactionState, onDecision]);

    // --- THE FIX: Expose the callback functions to the parent component ---
    useImperativeHandle(ref, () => ({
        triggerPasteModified: handlePasteModified,
        triggerPasteOriginal: handlePasteOriginal,
        triggerCancel: handleClose
    }));


    // --- Render ---
    return (
        <div className="fixed top-5 right-5 w-[400px]">
            {/* Render the imported styles directly. This is the key to perfect encapsulation. */}
            <style>{modalStyles}</style>

            <Card className="bg-slate-950 border-purple-500/30 text-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-3">
                        <LogoIcon className="h-8 w-8 text-purple-400" />
                        <h2 className="text-lg font-semibold">Sensitive Data Detected</h2>
                    </div>
                    {/* The onClick handlers now correctly call the memoized callbacks */}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={handleClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </CardHeader>
                <CardContent className="py-2 max-h-[60vh] overflow-y-auto pr-3 space-y-2">
                     {matches.map((match, index) => (
                        <div key={index} className="bg-slate-900/60 border border-red-300/20 rounded-lg p-3 flex justify-between items-center">
                            <div className="overflow-hidden mr-4">
                                <p className="font-semibold text-sm text-slate-200 font-grotesque">{match.name}</p>
                                <code className="text-xs text-slate-400 bg-slate-950/70 p-1 rounded block truncate font-grotesque">{match.value}</code>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                                <Label htmlFor={`redact-${index}`} className="text-red-400 font-bold text-xs cursor-pointer font-grotesque">REDACT</Label>
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
                            <Button variant="outline" className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30 hover:text-purple-200 rounded-full px-6 font-grotesque" onClick={handlePasteOriginal}>
                                Paste Original
                            </Button>
                            <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-full px-6 font-grotesque" onClick={handlePasteModified}>
                                Paste Redacted
                            </Button>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>Hotkeys:</span>
                        <kbd className="font-sans px-1.5 py-0.5 text-xs font-semibold text-slate-300 bg-purple-900/40 border border-purple-500/30 rounded-md">Alt + R</kbd> <span>Redact,</span>
                        <kbd className="font-sans px-1.5 py-0.5 text-xs font-semibold text-slate-300 bg-purple-900/40 border border-purple-500/30 rounded-md">Alt + O</kbd> <span>Original</span>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
});