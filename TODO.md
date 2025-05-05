# TODOs

1. Implement a method of verifying that a user *may* request an authorization code (request to an API server that holds user info, read-only connection to same database, or some other method)
2. Implement a `/revoke` route
3. Key pairs in JWKS are created on startup, so restarts may interrupt auth flows. Implement a method of persisting keys
4. `client_id` is ignored since the current implementation has only one client. Make this fully-featured
5. `authorizationCodeCache` is per-process. Make this horizontally-scalable
