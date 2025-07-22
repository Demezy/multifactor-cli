import { FcmRegistration } from "@aracna/fcm";

export interface FcmCredentials {
  apiKey: string;
  projectId: string;
  appId: string;
}

export interface FcmRegistrationEce {
  ece: {
    authSecret: Uint8Array<ArrayBufferLike>;
    privateKey: Buffer;
    publicKey: Buffer;
  };
}

export type FcmRegistrationFull = FcmRegistration & FcmRegistrationEce;
