import type { SafeErrorType } from '../types/Error.ts';

// ensure that errors returned to a client do not reveal more information than is intended (e.g., do not let a user confirm that another user exists)
export class SafeError extends Error implements SafeErrorType {
    name: string;
    safeMessage: string;
    safeProps: { name: string; message: string; safeError: true };
    unsafeMessage?: string;

    constructor(name: string, messages: { safe: string; unsafe?: string }) {
        super(messages.safe);
        this.name = name;
        this.safeMessage = messages.safe;
        this.safeProps = {
            name: this.name,
            message: this.safeMessage,
            safeError: true,
        };
        this.unsafeMessage = messages.unsafe;
    }
}
