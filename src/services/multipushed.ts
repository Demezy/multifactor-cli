import fetch from "node-fetch";
import {
  PushedRegistration,
  PushedResponse,
  DeviceSettings,
} from "../models/pushedModel.js";
import { FcmRegistrationFull } from "../models/fcmModel.js";

export async function register(
  fcmRegistration: FcmRegistrationFull
): Promise<PushedRegistration> {
  const deviceSettings: DeviceSettings[] = [
    {
      transportKind: "Fcm",
      deviceToken: fcmRegistration.token,
    },
  ];

  try {
    const response = await fetch("https://sub.multipushed.ru/v2/tokens", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientToken: "",
        deviceSettings,
      }),
    });

    const pushedResult = (await response.json()) as PushedResponse;

    if (!pushedResult.success) {
      throw new Error(
        `Failed to register with multipushed: ${
          pushedResult.message || pushedResult.errCode
        }`
      );
    }

    return pushedResult.model;
  } catch (error) {
    throw error;
  }
}
