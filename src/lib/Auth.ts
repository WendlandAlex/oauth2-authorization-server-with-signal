import { SafeError } from '../Error.ts';
import { SignalUser } from './Signal.ts';
import type { JWKSResponse } from '../../types/Oauth.ts';

const { subtle } = globalThis.crypto;
import crypto, { type JsonWebKey, type KeyObject } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.ts';

export class Oauth2ValidationError extends SafeError {
  name = 'oauth2_validation_error';

  constructor(messages: { safe: string; unsafe?: string }) {
    super('oauth2_validation_error', messages);
    this.safeMessage = messages.safe;
    this.unsafeMessage = messages.unsafe;
  }
}

export class Auth {
  static keyPairs: Record<
    string,
    {
      JsonWebKey: { private: JsonWebKey; public: JsonWebKey };
      KeyObject: { private: KeyObject; public: KeyObject };
    }
  > = {};

  static getJWKS() {
    const response: JWKSResponse = {
      keys: Object.values(Auth.keyPairs).map((i) => i.JsonWebKey.private),
    };
    return response;
  }

  static getPrivateKey(kid: string) {
    const keyPair = Auth.keyPairs[kid];
    if (!keyPair) {
      throw new Error(`no keypair with kid ${kid}`);
    }
    return keyPair.KeyObject.private;
  }

  static getPublicKey(kid: string) {
    const keyPair = Auth.keyPairs[kid];
    if (!keyPair) {
      throw new Error(`no keypair with kid ${kid}`);
    }
    return keyPair.KeyObject.public;
  }

  static async generateJWKwithKID(kid: string = crypto.randomUUID()) {
    const { publicKey: pub, privateKey: priv } = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );

    const publicKey = { ...(await subtle.exportKey('jwk', pub)), kid };
    const privateKey = { ...(await subtle.exportKey('jwk', priv)), kid };

    Auth.keyPairs[kid] = {
      JsonWebKey: { public: publicKey, private: privateKey },
      KeyObject: {
        public: crypto.createPublicKey({ key: publicKey, format: 'jwk' }),
        private: crypto.createPrivateKey({ key: privateKey, format: 'jwk' }),
      },
    };

    return kid;
  }

  // bundle of data about the client that sent a request (code_challenge can be used to verify that 2 requests came from the same client)
  static authorizationCodeCache: Record<
    string,
    {
      kid: string;
      signalUser: SignalUser;
      client_id: string;
      redirect_uri: URL;
      state: string;
      code_challenge: string;
      challenge_code: string;
    }
  > = {};

  // map from code to key of authorizationCodeCache
  static authorizationCodePointers: Record<string, string> = {};

  static async generateBase64urlEncodedHashOfCodeVerifier (code_verifier: string) {
    return Buffer.from(
        await subtle.digest({ name: 'SHA-256' }, Buffer.from(code_verifier)),
    ).toString('base64url');
  }

  static generateAuthorizationCode(
    signalUser: SignalUser,
    kid: string,
  ): string {
    const privateKey = Auth.getPrivateKey(kid);
    const sign = crypto.createSign('SHA256');
    sign.update(Buffer.from(signalUser.identifier));
    sign.end();
    return sign.sign(privateKey, 'hex');
  }

  static verifyAuthorizationCode(
    signalUser: SignalUser,
    kid: string,
    authorizationCode: string,
  ) {
    const publicKey = this.getPublicKey(kid);
    if (publicKey) {
      try {
        const verify = crypto.createVerify('SHA256');
        verify.update(Buffer.from(signalUser.identifier));
        verify.end();
        return verify.verify(publicKey, authorizationCode, 'hex');
      } catch (err) {
        console.log(err);
      }
    } else {
      throw new Error('No public key found for kid');
    }
  }

  static sign(signalUser: SignalUser, kid: string) {
    const privateKey = this.getPrivateKey(kid);
    return jwt.sign(
      {
        // claims
        signal_username: signalUser.username,
        phone: signalUser.phone,
      },
      privateKey,
      {
        algorithm: 'ES256',
        expiresIn: '4h',
        jwtid: crypto.randomUUID(),
        audience: config.resource_server.base_url.toString(),
        issuer: config.authorization_server.base_url.toString(),
        subject: signalUser.identifier,
        keyid: kid,
      },
    );
  }
}
