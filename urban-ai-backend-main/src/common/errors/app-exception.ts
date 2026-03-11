export enum ErrorCode {
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    CUSTOMER_CREATION_FAILED = 'CUSTOMER_CREATION_FAILED',
    AUTH_REGISTRATION_FAILED = 'AUTH_REGISTRATION_FAILED',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
export class AppException extends Error {
    constructor(
        public code: ErrorCode,
        public message: string,
        public status: number = 400
    ) {
        super(message);
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            status: this.status,
        };
    }
}
