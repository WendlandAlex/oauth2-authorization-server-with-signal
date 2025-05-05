import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import pino from 'pino-http';
import sendMessage from './sendMessage.ts';
import { Auth, Oauth2ValidationError } from './lib/Auth.ts';
import { SignalUser, SignalUserValidationError } from './lib/Signal.ts';
import { randomInt } from 'node:crypto';

import ms from 'ms';
import { config } from './config.ts';
import type {
    UserAuthorizationRequest,
    AccessTokenRequest,
    AccessTokenResponse,
    OpenIDConfigurationResponse,
} from '../types/Oauth.ts';

const router = express.Router();
const app = express()
    .use(express.urlencoded({ extended: true }))
    .use(bodyParser.json())
    .use(cookieParser())
    .use(
        cors({
            origin: config.client.getCleanBaseURL(),
            credentials: true,
        }),
    )
    .use(pino())
    .use('/', router);

// ensure at least 1 key pair is available to sign JWTs
await Auth.generateJWKwithKID();

// JWKS endpoint (allow client to fetch public key and verify a JWT presented to it)
router.get('/.well-known/jwks.json', (req, res) => {
    res.status(200).json(Auth.getJWKS());
});

// OIDC discovery endpoint (https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfigurationResponse)
router.get('/.well-known/openid-configuration', (req, res) => {
    const response: OpenIDConfigurationResponse = {
        issuer: config.authorization_server.getCleanBaseURL(),
        authorization_endpoint: config.authorization_server.getCleanBaseURL() + '/authorize',
        token_endpoint: config.authorization_server.getCleanBaseURL() + '/oauth/token',
        userinfo_endpoint: config.resource_server.getCleanBaseURL() + '/userinfo',
        end_session_endpoint: config.authorization_server.getCleanBaseURL() + '/revoke',
        jwks_uri: config.authorization_server.getCleanBaseURL() + '/.well-known/jwks.json',
        claims_supported: ['sub', 'signal_username', 'phone'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
    }
    res.status(200).json(response);
});

// Resource (client) redirects user to issuer (authorization server). Issuer generates a challenge code and provides it to user (in this case, via Signal message)
// When user receives challenge code, they submit it to /verify-challenge and are redirected back to the client, with the authorization_code appended to the query params
// (client can then request an oauth token from /oauth/token using this code)
router.get('/authorize', async (req, res) => {
    try {
        // oauth2 specification
        const {
            response_type,
            client_id,
            redirect_uri,
            scope,
            state,
            code_challenge,
            code_challenge_method,
        } = req.query as UserAuthorizationRequest;

        if (response_type !== 'code') {
            throw new Oauth2ValidationError({ safe: 'response_type must be "code"' });
        }
        if (code_challenge_method !== 'S256') {
            throw new Oauth2ValidationError({
                safe: 'code_challenge_method must be "S256"',
            });
        }


        // smart constructor - enforce valid phone|username formatting
        const { signal_username, phone, kid } = JSON.parse(scope as string);
        const signalUser = new SignalUser({ username: signal_username, phone });

        // store the state of this request
        // the key should be unique while having enough entropy: user + uuid
        const cacheKey = `${signalUser.identifier}::${state}`;
        if (Auth.authorizationCodeCache[cacheKey]) {
            res.status(400).send('Invalid request')
        }


        // send a message with a challenge code over Signal transport
        const challenge_code = Array.from({length: config.challenge_code_length}, () => randomInt(10)).join('')

        Auth.authorizationCodeCache[cacheKey] = {
            kid,
            signalUser: structuredClone(signalUser),
            client_id,
            redirect_uri: new URL(redirect_uri),
            state,
            code_challenge,
            challenge_code
        };

        await sendMessage(challenge_code, [signalUser.identifier]);

        // generate a form the user can use to submit the challenge code
        res
            .status(200)
            .set('Content-Type', 'text/html')
            .send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Enter Verification Code</title>
  <style>
    body {
      font-family: sans-serif;
      max-width: 480px;
      margin: 2rem auto;
      padding: 1rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    input[type="text"] {
      font-size: 1rem;
      padding: 0.5rem;
    }
    input[type="submit"] {
      padding: 0.5rem;
      font-size: 1rem;
      background: blue;
      color: white;
      border: none;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>Verify Your Identity</h1>
  <p>We sent a ${config.challenge_code_length}-digit code to your Signal account.</p>
  <form method="POST" action="/verify-challenge">
    <label>
      Challenge Code:
      <input type="text" name="challenge_code" required maxlength="${config.challenge_code_length}" />
    </label>

    <!-- Hidden context fields -->
    <input type="hidden" name="identifier" value="${signalUser.identifier}" />
    <input type="hidden" name="state" value="${state}" />
    <input type="submit" value="Verify and Continue" />
  </form>
</body>
</html>
`);
    } catch (err) {
        if (err instanceof Oauth2ValidationError) {
            res.status(400).send(err.safeProps);
        } else if (err instanceof SignalUserValidationError) {
            res.status(500).json(err.safeProps);
        } else {
            res.sendStatus(500);
        }
    }
});

//
router.post('/verify-challenge', async (req, res) => {
    const { identifier, state, challenge_code } = req.body;
    const cacheKey = `${identifier}::${state}`;
    const cacheEntry = Auth.authorizationCodeCache[cacheKey];
    if (!cacheEntry || !(challenge_code === cacheEntry.challenge_code)) {
        res.status(400).send('Invalid session')
    } else {
        const { signalUser, kid, redirect_uri } =  cacheEntry;
        const authorization_code =  Auth.generateAuthorizationCode(signalUser, kid);
        Auth.authorizationCodePointers[authorization_code] = cacheKey;
        const redirectURI = new URL(redirect_uri);
        redirectURI.searchParams.set('code', authorization_code);
        redirectURI.searchParams.set('state', cacheEntry.state);
        res.redirect(redirectURI.toString());
    }
})

// issuer (authorization server) validates authorization code, responds with access_token (and refresh_token, eventually)
router.post('/oauth/token', async (req, res) => {
    try {
        const { grant_type, code, redirect_uri, client_id, code_verifier } = req.body as AccessTokenRequest;

        if (grant_type !== 'authorization_code') {
            throw new Oauth2ValidationError({
                safe: 'grant_type must be "authorization_code"',
            });
        }

        const cacheKey = Auth.authorizationCodePointers[code];
        const cacheEntry = Auth.authorizationCodeCache[cacheKey];
        if (!cacheEntry) {
            res.sendStatus(404);
        }

        // verify that the client that sent the authorization code request is the same as this client
        if (cacheEntry.code_challenge !== await Auth.generateBase64urlEncodedHashOfCodeVerifier(code_verifier)) {
            throw new Oauth2ValidationError({
                safe: 'code_challenge did not match code_verifier',
            })
        }

        // verify that the authorization code was signed with the same KID that was specified in the authorization code request
        if (!Auth.verifyAuthorizationCode(cacheEntry.signalUser, cacheEntry.kid, code)) {
            throw new Oauth2ValidationError({
                safe: 'invalid authorization_code',
            })
        }

        const jwt = Auth.sign(
            cacheEntry.signalUser,
            cacheEntry.kid,
        );

        res.cookie(`${client_id}_at`, jwt, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: ms('4h'),
        });
        delete Auth.authorizationCodeCache[cacheKey];
        delete Auth.authorizationCodePointers[code];

        const accessTokenResponse: AccessTokenResponse = {
            signalUser: cacheEntry.signalUser,
            maxAge: ms('4h'),
            redirectTo: redirect_uri,
        }
        res.status(200).json(accessTokenResponse);
    } catch (err: any) {
        if (err instanceof Oauth2ValidationError) {
            res.status(400).json(err.safeProps);
        } else {
            console.error(err);
            res.sendStatus(500);
        }
    }
});

router.post('/revoke', async (req, res) => {
    // TODO: implement
    // TODO: add this token to a blacklist
    res.sendStatus(200);
});

app.listen(config.port, () => {
    console.log(`Server started on port ${config.port}`);
});
