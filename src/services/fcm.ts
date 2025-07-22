import {
  createFcmECDH,
  FcmClient,
  FcmRegistration,
  generateFcmAuthSecret,
  registerToFCM,
} from "@aracna/fcm";
import { FcmCredentials, FcmRegistrationFull } from "../models/fcmModel.js";
import { DiskStorage } from "../utils/diskStorage.js";
import { MultifactorRegisterRequest } from "../models/multifactorModel.js";

export async function register(
  credentials: FcmCredentials
): Promise<FcmRegistrationFull> {
  if (await DiskStorage.has("fcm")) {
    return (await DiskStorage.get("fcm")) as FcmRegistrationFull;
  }

  const authSecret = generateFcmAuthSecret();
  const ecdh = createFcmECDH();

  const registration = await registerToFCM({
    appID: credentials.appId,
    ece: {
      authSecret: authSecret,
      publicKey: ecdh.getPublicKey(),
    },
    firebase: {
      apiKey: credentials.apiKey,
      appID: credentials.appId,
      projectID: credentials.projectId,
    },
    vapidKey: "",
  });
  if (registration instanceof Error) throw registration;

  const fcmRegistrationFull: FcmRegistrationFull = {
    ece: {
      authSecret: authSecret,
      privateKey: ecdh.getPrivateKey(),
      publicKey: ecdh.getPublicKey(),
    },
    ...registration,
  };

  await DiskStorage.set("fcm", fcmRegistrationFull);

  return fcmRegistrationFull;
}

export async function listen(
  fcmRegistration: FcmRegistrationFull,
  dataCallback: (data: MultifactorRegisterRequest) => void
): Promise<() => void> {
  try {
    const client = new FcmClient({
      acg: {
        id: fcmRegistration.acg.id,
        securityToken: fcmRegistration.acg.securityToken,
      },
      ece: {
        authSecret: fcmRegistration.ece.authSecret,
        privateKey: fcmRegistration.ece.privateKey,
      },
      storage: {
        instance: DiskStorage,
      },
    });

    client.on("message-data", async (message) => {
      if (!message.data) return;

      const data = JSON.parse(message.data.data);
      dataCallback(data);
    });

    client.connect();

    return () => {
      client.disconnect();
    };
  } catch (error) {
    throw error;
  }
}
