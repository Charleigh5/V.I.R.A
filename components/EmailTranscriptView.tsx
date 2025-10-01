import React from 'react';

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
    const emails = parseEmailContent(rawContent);

  return (
    <div className="h-full overflow-y-auto bg-white rounded-lg shadow-md p-6">
        <div className="space-y-4">
            {emails.map((email, index) => (
                <div key={index} className="p-3 bg-neutral-100 rounded-md border border-neutral-200">
                    <div className="flex justify-between items-baseline text-xs text-neutral-500">
                        <p className="font-semibold text-neutral-700 truncate">From: {email.from}</p>
                        <p className="flex-shrink-0 ml-2">{email.date}</p>
                    </div>
                    <p className="text-xs text-neutral-500 truncate">To: {email.to}</p>
                    <p className="font-semibold text-sm mt-1">{email.subject}</p>
                    <p className="text-sm text-neutral-600 mt-2 whitespace-pre-wrap">{email.body}</p>
                </div>
            ))}
             {emails.length === 0 && <p className="text-neutral-500">Could not parse email content.</p>}
        </div>
    </div>
  );
};

export default EmailTranscriptView;