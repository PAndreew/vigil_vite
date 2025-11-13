import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    const [open, setOpen] = useState(true);
    const [redactionState, setRedactionState] = useState<Record<number, boolean>>(
        matches.reduce((acc, _, index) => ({ ...acc, [index]: true }), {})
    );

    useEffect(() => {
        if (!open) {
            onDecision({ action: 'cancel' });
        }
    }, [open]);

    const handleRedactionToggle = (index: number, checked: boolean) => {
        setRedactionState(prev => ({ ...prev, [index]: checked }));
    };

    const handlePasteModified = () => {
        let modifiedText = originalText;
        matches.forEach((match, index) => {
            if (redactionState[index]) {
                modifiedText = modifiedText.replace(new RegExp(escapeRegExp(match.value), 'g'), match.dummyValue);
            }
        });
        onDecision({ action: 'pasteModified', text: modifiedText });
        setOpen(false);
    };

    const handlePasteOriginal = () => {
        onDecision({ action: 'pasteOriginal', text: originalText });
        setOpen(false);
    };

    const escapeRegExp = (string: string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700 text-white">
                <DialogHeader>
                    <DialogTitle>Sensitive Data Detected</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-96 overflow-y-auto">
                    {matches.map((match, index) => (
                        <Card key={index} className="bg-slate-800 border-slate-700">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-bold">{match.name}</p>
                                        <code className="text-xs text-slate-400 bg-slate-900 p-1 rounded break-all">{match.value}</code>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Label htmlFor={`redact-${index}`}>Redact</Label>
                                        <Switch
                                            id={`redact-${index}`}
                                            checked={redactionState[index]}
                                            onCheckedChange={(checked) => handleRedactionToggle(index, checked)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button variant="secondary" onClick={handlePasteOriginal}>Paste Original</Button>
                    <Button onClick={handlePasteModified}>Paste Redacted</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};