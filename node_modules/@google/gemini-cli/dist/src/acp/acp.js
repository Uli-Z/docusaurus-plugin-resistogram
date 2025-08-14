/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
export class ClientConnection {
    #connection;
    constructor(agent, input, output) {
        this.#connection = new Connection(agent(this), input, output);
    }
    /**
     * Streams part of an assistant response to the client
     */
    async streamAssistantMessageChunk(params) {
        await this.#connection.sendRequest('streamAssistantMessageChunk', params);
    }
    /**
     * Request confirmation before running a tool
     *
     * When allowed, the client returns a [`ToolCallId`] which can be used
     * to update the tool call's `status` and `content` as it runs.
     */
    requestToolCallConfirmation(params) {
        return this.#connection.sendRequest('requestToolCallConfirmation', params);
    }
    /**
     * pushToolCall allows the agent to start a tool call
     * when it does not need to request permission to do so.
     *
     * The returned id can be used to update the UI for the tool
     * call as needed.
     */
    pushToolCall(params) {
        return this.#connection.sendRequest('pushToolCall', params);
    }
    /**
     * updateToolCall allows the agent to update the content and status of the tool call.
     *
     * The new content replaces what is currently displayed in the UI.
     *
     * The [`ToolCallId`] is included in the response of
     * `pushToolCall` or `requestToolCallConfirmation` respectively.
     */
    async updateToolCall(params) {
        await this.#connection.sendRequest('updateToolCall', params);
    }
}
class Connection {
    #pendingResponses = new Map();
    #nextRequestId = 0;
    #delegate;
    #peerInput;
    #writeQueue = Promise.resolve();
    #textEncoder;
    constructor(delegate, peerInput, peerOutput) {
        this.#peerInput = peerInput;
        this.#textEncoder = new TextEncoder();
        this.#delegate = delegate;
        this.#receive(peerOutput);
    }
    async #receive(output) {
        let content = '';
        const decoder = new TextDecoder();
        for await (const chunk of output) {
            content += decoder.decode(chunk, { stream: true });
            const lines = content.split('\n');
            content = lines.pop() || '';
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine) {
                    const message = JSON.parse(trimmedLine);
                    this.#processMessage(message);
                }
            }
        }
    }
    async #processMessage(message) {
        if ('method' in message) {
            const response = await this.#tryCallDelegateMethod(message.method, message.params);
            await this.#sendMessage({
                jsonrpc: '2.0',
                id: message.id,
                ...response,
            });
        }
        else {
            this.#handleResponse(message);
        }
    }
    async #tryCallDelegateMethod(method, params) {
        const methodName = method;
        if (typeof this.#delegate[methodName] !== 'function') {
            return RequestError.methodNotFound(method).toResult();
        }
        try {
            const result = await this.#delegate[methodName](params);
            return { result: result ?? null };
        }
        catch (error) {
            if (error instanceof RequestError) {
                return error.toResult();
            }
            let details;
            if (error instanceof Error) {
                details = error.message;
            }
            else if (typeof error === 'object' &&
                error != null &&
                'message' in error &&
                typeof error.message === 'string') {
                details = error.message;
            }
            return RequestError.internalError(details).toResult();
        }
    }
    #handleResponse(response) {
        const pendingResponse = this.#pendingResponses.get(response.id);
        if (pendingResponse) {
            if ('result' in response) {
                pendingResponse.resolve(response.result);
            }
            else if ('error' in response) {
                pendingResponse.reject(response.error);
            }
            this.#pendingResponses.delete(response.id);
        }
    }
    async sendRequest(method, params) {
        const id = this.#nextRequestId++;
        const responsePromise = new Promise((resolve, reject) => {
            this.#pendingResponses.set(id, { resolve, reject });
        });
        await this.#sendMessage({ jsonrpc: '2.0', id, method, params });
        return responsePromise;
    }
    async #sendMessage(json) {
        const content = JSON.stringify(json) + '\n';
        this.#writeQueue = this.#writeQueue
            .then(async () => {
            const writer = this.#peerInput.getWriter();
            try {
                await writer.write(this.#textEncoder.encode(content));
            }
            finally {
                writer.releaseLock();
            }
        })
            .catch((error) => {
            // Continue processing writes on error
            console.error('ACP write error:', error);
        });
        return this.#writeQueue;
    }
}
export class RequestError extends Error {
    code;
    data;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.name = 'RequestError';
        if (details) {
            this.data = { details };
        }
    }
    static parseError(details) {
        return new RequestError(-32700, 'Parse error', details);
    }
    static invalidRequest(details) {
        return new RequestError(-32600, 'Invalid request', details);
    }
    static methodNotFound(details) {
        return new RequestError(-32601, 'Method not found', details);
    }
    static invalidParams(details) {
        return new RequestError(-32602, 'Invalid params', details);
    }
    static internalError(details) {
        return new RequestError(-32603, 'Internal error', details);
    }
    toResult() {
        return {
            error: {
                code: this.code,
                message: this.message,
                data: this.data,
            },
        };
    }
}
// Protocol types
export const LATEST_PROTOCOL_VERSION = '0.0.9';
//# sourceMappingURL=acp.js.map