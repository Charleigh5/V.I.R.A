import React, { useEffect, useRef } from 'react';

export interface ChatMessage {
  sender: 'user' | 'ai' | 'system';
  text: string;
}

interface ChatHistoryProps {
  messages: ChatMessage[];
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages]);


    const getMessageStyle = (sender: ChatMessage['sender']) => {
        switch (sender) {
            case 'user':
                return 'bg-primary-blue text-white self-end';
            case 'ai':
                return 'bg-neutral-200 text-neutral-800 self-start';
            case 'system':
                return 'bg-yellow-100 text-accent-yellow text-sm self-center italic';
            default:
                return 'bg-gray-200 self-start';
        }
    };
    
    return (
        <div className="flex-grow overflow-y-auto pr-2">
            <div className="flex flex-col space-y-4 p-4">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`max-w-lg rounded-lg px-4 py-2 shadow ${getMessageStyle(msg.sender)}`}
                    >
                        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                    </div>
                ))}
                <div ref={endOfMessagesRef} />
            </div>
        </div>
    );
};

export default ChatHistory;