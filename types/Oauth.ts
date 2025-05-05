import type { SignalUserType } from './Signal.ts';

// naming conventions are from https://www.digitalocean.com/community/tutorials/an-introduction-to-oauth-2#grant-type-authorization-code

export type JWKSResponse = {
  keys: JsonWebKey[];
}

export type OpenIDConfigurationResponse = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint: string,
  jwks_uri: string,
  claims_supported: ['sub', 'signal_username', 'phone'],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
}

export type UserAuthorizationRequest = {
  response_type: "code"
  client_id: string
  redirect_uri: string
  scope: string;
  state: string;
  code_challenge: string;
  code_challenge_method: "S256"
}

export type AccessTokenRequest = {
  grant_type: "authorization_code"
  code: string;
  redirect_uri: string
  client_id: string
  code_verifier: string
}

export type AccessTokenResponse = {
  signalUser: SignalUserType;
  maxAge: number;
  redirectTo: string
}
