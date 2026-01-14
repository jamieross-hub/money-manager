export interface OpenAIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
            role: string;
        };
        finish_reason: string;
    }>;
}
