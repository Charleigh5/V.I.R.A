import React, { useState, useMemo } from 'react';

interface EmailTranscriptViewProps {
  rawContent: string;
}

interface Email {
    from: string;
    to: string;
    date: string;
    subject: string;
    body: string;
}

// A more robust parser that handles multi-line headers.
const parseEmailContent = (content: string): Email[] => {
    return content.split('\n---\n')
        .map(block => block.trim())
        .filter(block => block.length > 0)
        .map(block => {
            const lines = block.split('\n');
            const headers: { [key: string]: string } = {};
            let bodyStartIndex = 0;
            let inHeader = true;
            let lastHeaderKey = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (inHeader) {
                    if (line.trim() === '') {
                        inHeader = false;
                        bodyStartIndex = i + 1;
                        continue;
                    }
                    const match = line.match(/^([a-zA-Z-]+):\s*(.*)/);
                    if (match) {
                        const key = match[1].toLowerCase();
                        const value = match[2];
                        headers[key] = value;
                        lastHeaderKey = key;
                    } else if (lastHeaderKey && (line.startsWith(' ') || line.startsWith('\t'))) {
                        // This is a continuation of the previous header (e.g., multi-line subject)
                        headers[lastHeaderKey] = (headers[lastHeaderKey] || '') + ' ' + line.trim();
                    } else {
                        // Line doesn't look like a header or continuation, assume headers ended.
                        inHeader = false;
                        bodyStartIndex = i;
                    }
                }
            }

            const body = lines.slice(bodyStartIndex).join('\n').trim();
            
            return {
                from: headers['from'] || 'N/A',
                to: headers['to'] || 'N/A',
                date: headers['date'] || 'N/A',
                subject: headers['subject'] || 'N/A',
                body
            };
        })
        .filter(email => email.body || (email.subject && email.subject !== 'N/A'));
};

const EmailTranscriptView: React.FC<EmailTranscriptViewProps> = ({ rawContent }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const allEmails = useMemo(() => parseEmailContent(rawContent), [rawContent]);

    const filteredEmails = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) {
            return allEmails;
        }
        return allEmails.filter(email =>
            email.from.toLowerCase().includes(query) ||
            email.to.toLowerCase().includes(query) ||
            email.subject.toLowerCase().includes(query) ||
            email.body.toLowerCase().includes(query)
        );
    }, [allEmails, searchQuery]);

    const highlightText = (text: string, query: string) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return text;

        const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        const parts = text.split(regex);

        return (
            <>
                {parts.map((part, i) =>
                    i % 2 === 1 ? (
                        <mark key={i} className="bg-yellow-200 text-black rounded px-0.5">
                            {part}
                        </mark>
                    ) : (
                        part
                    )
                )}
            </>
        );
    };

    return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow-md p-6">
            <div className="relative mb-4 flex-shrink-0">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    placeholder="Search transcript by sender, subject, or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-neutral-300 rounded-md shadow-sm focus:ring-primary-blue focus:border-primary-blue"
                />
                {searchQuery && (
                    <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 focus:outline-none"
                        aria-label="Clear search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </button>
                )}
            </div>
            <div className="flex-grow overflow-y-auto pr-2">
                <div className="space-y-4">
                    {filteredEmails.map((email, index) => (
                        <div key={index} className="p-3 bg-neutral-100 rounded-md border border-neutral-200">
                            <div className="flex justify-between items-baseline text-xs text-neutral-500">
                                <p className="font-semibold text-neutral-700 truncate">From: {email.from}</p>
                                <p className="flex-shrink-0 ml-2">{email.date}</p>
                            </div>
                            <p className="text-xs text-neutral-500 truncate">To: {email.to}</p>
                            <p className="font-semibold text-sm mt-1">{email.subject}</p>
                            <p className="text-sm text-neutral-600 mt-2 whitespace-pre-wrap">{highlightText(email.body, searchQuery)}</p>
                        </div>
                    ))}
                    {filteredEmails.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-neutral-500">
                                {allEmails.length > 0 ? 'No emails match your search.' : 'Could not parse email content.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmailTranscriptView;