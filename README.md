# Overview
An Oauth 2.0 `Authorization Server` that verifies identity by sending users a out-of-band challenge via Signal message before authentication. This is designed to support an app where a user's Signal identity is their username. 

The server implements the OAuth 2.0 Authorization Code Grant with PKCE as defined in:

- RFC 6749 (OAuth 2.0)

- RFC 7636 (PKCE for Public Clients)

It also provides an OpenID Connect (OIDC) discovery endpoint and a JSON Web Key Sets (JWKS) endpoint that lists the public half of key pairs which may be used to sign/verify an authorization code or access token. 

## Out-of-Band Challenge for Resource Owner Authentication
Before issuing an authorization code in response to a valid authorization request, the server authenticates the resource owner using a challenge code delivered over Signal message.

This step augments the standard resource owner authentication flow and ensures that only authorized users, with access to the out-of-band channel, may complete the flow.

## Flow Integration
This challenge step occurs between the receipt of the Authorization Request and the issuance of the Authorization Code:

1. The client (SPA) initiates the Authorization Code flow by redirecting to `/authorize` on the auth server, with the URL including:

   - client_id

   - redirect_uri

   - response_type=code

   - code_challenge and code_challenge_method

   - scope

   - state

2. The authorization server identifies the resource owner and sends a challenge code to the owner via Signal message.

3. The authorization server displays a form for the resource owner to submit the challenge code.

4. Upon submitting a valid correct challenge code, the resource owner is redirected to the `redirect_uri` that was included in the request to `/authorize`. This should be a callback route on the client. The redirect will include `state` and `code` as query parameters -- the client should use `state` to look up the `code_verifier` that relates to the `code_challenge`, ideally stored in session storage. `code` is the authorization code. 

5. The client sends a request to the `/oauth/token` on the authorization server, including the `code_verifier` and `code` values. If valid, the authorization server sets an access token (and optionally ID Token and refresh token) via httpOnly headers.

# Security Considerations
- The challenge code is delivered only to the verified contact channel of the resource owner.

- A short expiration window is enforced for challenge codes.

- No authorization code is issued until the challenge is successfully completed.

# Sending Signal Messages

This server expects to be able to send HTTP requests to a running instance of [signal-cli-rest-api](https://github.com/bbernhard/signal-cli-rest-api). Set the environment variable `SIGNAL_SERVICE_BASE_URL` to the url of this service.  

# TODO: Limiting the set of Authorized Users

This server expects to be able to send HTTP requests to the resource server at `/TODO: route??` to verify if the identity of a user who is requesting an authorization_code is valid.

# How to Build and Run

Build

```
docker build -t oaswi .
```

Run

```
docker run --name oaswi --mount type=bind,src=$(PWD)/.env,dst=/app/.env,ro --publish 8119:8119 --rm oaswi
```

(you may use `--env-file .env` instead, but be aware that it has different quote escaping behavior than the node stdlib env parser)
