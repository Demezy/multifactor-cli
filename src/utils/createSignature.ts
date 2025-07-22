import { MultifactorCallbackPayload } from "../models/multifactorModel.js";
import crypto from "crypto";

export function createSignature(
  payload: MultifactorCallbackPayload,
  signingKey: string,
  salt: string
): string {
  const saltedPayloadString = `${payload.AccountIdentity.AccountId}:${payload.Action}:${payload.AccountIdentity.DeviceId}:${payload.RequestId}:${salt}`;

  const hmac = crypto.createHmac("sha256", Buffer.from(signingKey, "base64"));

  hmac.update(saltedPayloadString);
  return hmac.digest("base64");
}
