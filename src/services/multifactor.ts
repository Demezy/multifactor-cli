import fetch from "node-fetch";
import {
  MultifactorRegistration,
  MultifactorResponse,
  MultifactorRegisterRequest,
  MultifactorCallbackRequest,
  MultifactorCallbackPayload,
  MultifactorCallbackResponse,
} from "../models/multifactorModel.js";
import { PushedRegistration } from "../models/pushedModel.js";
import { DEVICE_DATA } from "../utils/multifactorDeviceData.js";
import { createSignature } from "../utils/createSignature.js";

export async function registerMultifactor(
  requestId: string,
  pushedRegistration: PushedRegistration
): Promise<MultifactorRegistration> {
  const request: MultifactorRegisterRequest = {
    RequestId: requestId,
    ClientToken: pushedRegistration.clientToken,
    ...DEVICE_DATA,
  };

  try {
    const response = await fetch(
      "https://api.multifactor.ru/v2/mobileapp/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    const multifactorResult = (await response.json()) as MultifactorResponse;

    if (!multifactorResult.success) {
      throw new Error("Failed to register with multifactor");
    }

    return multifactorResult.model;
  } catch (error) {
    throw error;
  }
}

export async function callbackRequest(
  requestId: string,
  action: "Approve" | "Reject",
  multifactorRegistration: MultifactorRegistration
): Promise<MultifactorCallbackResponse> {
  const payload: MultifactorCallbackPayload = {
    RequestId: requestId,
    AccountIdentity: {
      DeviceId: multifactorRegistration.deviceId,
      AccountId: multifactorRegistration.accountId,
    },
    Action: action,
  };

  const salt = new Date().toISOString();

  const sign = createSignature(
    payload,
    multifactorRegistration.signingKey,
    salt
  );

  const request: MultifactorCallbackRequest = {
    Salt: salt,
    Sign: sign,
    Payload: payload,
  };

  try {
    const response = await fetch(
      "https://api.multifactor.ru/v2/mobileapp/callback",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }
    );

    return (await response.json()) as MultifactorCallbackResponse;
  } catch (error) {
    throw error;
  }
}
