export type Config = {
    port: number;
    authorization_server: {
        base_url: URL;
        getCleanBaseURL: () => string;
    };
    resource_server: {
        base_url: URL;
        getCleanBaseURL: () => string;
    };
    client: {
        base_url: URL;
        getCleanBaseURL: () => string;
    };
    signal_service: {
        base_url: URL;
    };
    from_number: string;
    device_name: string;
    challenge_code_length: number;
};
