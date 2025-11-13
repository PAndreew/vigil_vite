console.log('[DLP Background] Generic Detection Engine starting up.');

const DETECTION_CONFIG = {
    minLength: 8,
    requiresNumber: true,
    requiresLetter: true,
    requiresSpecialChar: false,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'analyzeForRedaction') {
        handleAnalysis(message, sender)
            .then(sendResponse)
            .catch((error) => {
                console.error('[DLP Background] CRITICAL ERROR in handleAnalysis:', error);
                sendResponse({ matches: [] });
            });
        return true;
    }
});

async function handleAnalysis(message: any, sender: chrome.runtime.MessageSender) {
    if (!message.data || typeof message.data !== 'string') { return { matches: [] }; }
    const settings = await chrome.storage.local.get(['dlpEnabled', 'whitelistedDomains']);
    if (settings.dlpEnabled === false) { return { matches: [] }; }
    if (sender.tab?.url) {
        try {
            const url = new URL(sender.tab.url);
            const whitelistedDomains = settings.whitelistedDomains || [];
            if (whitelistedDomains.includes(url.hostname)) {
                return { matches: [] };
            }
        } catch (e) {}
    }
    if (message.data.length > 100000) { return { matches: [] }; }

    const findings = findGenericSensitiveData(message.data);
    return { matches: findings };
}

function sanitizeValue(value: string): string {
    return value
        .replace(/[a-zA-Z]/g, 'A')
        .replace(/[0-9]/g, '0');
}

function findGenericSensitiveData(text: string) {
    const findings: { name: string; value: string; dummyValue: string }[] = [];
    const uniqueMatches = new Set<string>();
    const words = text.split(/[\s\n\r\t,;()\[\]{}'"]+/);

    for (const word of words) {
        if (word.length < DETECTION_CONFIG.minLength) {
            continue;
        }

        const hasNumber = /[0-9]/.test(word);
        const hasLetter = /[a-zA-Z]/.test(word);
        const hasSpecialChar = /[^a-zA-Z0-9]/.test(word);

        let isSuspicious = false;
        if (DETECTION_CONFIG.requiresNumber && hasNumber) {
            if (DETECTION_CONFIG.requiresLetter && hasLetter) {
                isSuspicious = true;
            }
            if (DETECTION_CONFIG.requiresSpecialChar && hasSpecialChar) {
                isSuspicious = true;
            }
        }
        if (hasNumber && hasLetter) {
            isSuspicious = true;
        }
        if (hasNumber && hasSpecialChar && hasLetter === false) {
            isSuspicious = true;
        }

        if (isSuspicious) {
            if (!uniqueMatches.has(word)) {
                findings.push({
                    name: 'Potential Sensitive Data',
                    value: word,
                    dummyValue: sanitizeValue(word)
                });
                uniqueMatches.add(word);
            }
        }
    }
    return findings;
}