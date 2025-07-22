#!/usr/bin/env node
import chalk from "chalk";
import prompts from "prompts";
import {
  SecureStorage,
  encryptStorage,
  isStorageEncrypted,
} from "./utils/secureStorage.js";
import { AsyncStorage } from "@aracna/core";
import { register as registerFcm, listen } from "./services/fcm.js";
import { register as registerMultipushed } from "./services/multipushed.js";
import {
  registerMultifactor,
  callbackRequest,
} from "./services/multifactor.js";
import {
  MultifactorRegistration,
  MultifactorApproveRequest,
} from "./models/multifactorModel.js";
import { FCM_CREDENTIALS } from "./utils/fcmCredentials.js";
import { FcmRegistrationFull } from "./models/fcmModel.js";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

function extractRequestId(activationLink: string): string | null {
  try {
    const url = new URL(activationLink);
    const requestId = url.searchParams.get("request_id");
    return requestId;
  } catch (error) {
    return null;
  }
}

function printRegistrationInstructions() {
  console.log(chalk.cyan("To register a new device, follow these steps:"));
  console.log(
    chalk.white("1. Open the Multifactor app and go to the 'Devices' tab")
  );
  console.log(chalk.white("2. Click 'Add Device'"));
  console.log(chalk.white("3. Scan the QR code or copy the activation link"));
  console.log(chalk.white("4. Paste the activation link below\n"));
}

function printAuthRequestDetails(request: MultifactorApproveRequest) {
  console.log(chalk.cyan("Authentication Request Details:"));
  console.log(chalk.white(`Account: ${request.Name || "Unknown"}`));
  console.log(chalk.white(`Message: ${request.Message || "No message"}`));
  console.log();
}

async function handleRegistration(
  storage: AsyncStorage
): Promise<MultifactorRegistration> {
  printRegistrationInstructions();

  const { activationLink } = await prompts({
    type: "text",
    name: "activationLink",
    message: "Enter the activation link:",
    validate: (value) => {
      if (!value) {
        return "Activation link is required";
      }

      const requestId = extractRequestId(value);
      if (!requestId) {
        return "Invalid activation link. Please make sure it contains a request_id parameter.";
      }
      return true;
    },
  });

  const requestId = extractRequestId(activationLink);
  if (!requestId) {
    throw new Error("Could not extract request ID from the link");
  }

  console.log(chalk.yellow("Registering device..."));

  try {
    const fcmRegistration = await registerFcm(FCM_CREDENTIALS, storage);

    const pushedRegistration = await registerMultipushed(fcmRegistration);

    const multifactorRegistration = await registerMultifactor(
      requestId,
      pushedRegistration
    );

    await storage.set("multifactor", multifactorRegistration);

    console.log(chalk.green("✓ Device registered successfully!"));
    return multifactorRegistration;
  } catch (error) {
    throw new Error(
      `Registration failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function handleAuthRequest(
  request: MultifactorApproveRequest,
  multifactorRegistration: MultifactorRegistration
): Promise<void> {
  printAuthRequestDetails(request);

  const { action } = await prompts({
    type: "select",
    name: "action",
    message: "Do you want to approve this authentication request?",
    choices: [
      { title: "Yes, approve it", value: "Approve" },
      { title: "No, reject it", value: "Reject" },
    ],
  });

  if (!action) {
    console.log(chalk.yellow("Request handling cancelled"));
    return;
  }

  console.log(chalk.yellow(`Processing ${action.toLowerCase()} action...`));

  try {
    const response = await callbackRequest(
      request.RequestId,
      action,
      multifactorRegistration
    );

    if (response.success) {
      console.log(
        chalk.green(
          `✓ Authentication request ${action.toLowerCase()}d successfully`
        )
      );
    } else {
      console.log(
        chalk.red(
          `✗ Failed to ${action.toLowerCase()} request: ${response.message}`
        )
      );
    }
  } catch (error) {
    console.log(
      chalk.red(
        `✗ Error processing request: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
  }
}

async function main() {
  console.log(chalk.bold.blue("🔐 Multifactor CLI"));

  process.on("SIGINT", () => {
    console.log(chalk.yellow("\nExiting Multifactor CLI..."));
    process.exit(0);
  });

  const { exists, encrypted } = await isStorageEncrypted();
  const isFirstRun = !exists || !encrypted;

  let password: string;
  let needToEncrypt = false;

  if (isFirstRun) {
    const { newPassword } = await prompts({
      type: "password",
      name: "newPassword",
      message: "Set a password to encrypt your data:",
      validate: (value) =>
        value.length >= 6 ? true : "Password must be at least 6 characters",
    });

    if (!newPassword) {
      console.log(chalk.red("Password setup cancelled. Exiting..."));
      process.exit(1);
    }

    const { confirmPassword } = await prompts({
      type: "password",
      name: "confirmPassword",
      message: "Confirm your password:",
      validate: (value) =>
        value === newPassword ? true : "Passwords do not match",
    });

    if (!confirmPassword) {
      console.log(chalk.red("Password confirmation cancelled. Exiting..."));
      process.exit(1);
    }

    password = newPassword;
    needToEncrypt = exists && !encrypted;
    console.log(chalk.green("✓ Password set successfully"));
  } else {
    const { existingPassword } = await prompts({
      type: "password",
      name: "existingPassword",
      message: "Enter your password:",
    });

    if (!existingPassword) {
      console.log(chalk.red("Password entry cancelled. Exiting..."));
      process.exit(1);
    }

    password = existingPassword;
  }

  const storage = SecureStorage(password);
  if (needToEncrypt) {
    await encryptStorage(password);
  }

  try {
    let multifactorRegistration: MultifactorRegistration;
    let fcmRegistration: FcmRegistrationFull;

    if (await storage.has("multifactor")) {
      try {
        multifactorRegistration = (await storage.get(
          "multifactor"
        )) as MultifactorRegistration;
        console.log(chalk.green("✓ Found existing device registration"));

        if (await storage.has("fcm")) {
          fcmRegistration = (await storage.get("fcm")) as FcmRegistrationFull;
        } else {
          throw new Error(
            "FCM registration not found. Please restart the application."
          );
        }
      } catch (error) {
        console.log(chalk.red("✗ Failed to decrypt data. Incorrect password?"));
        process.exit(1);
      }
    } else {
      console.log(
        chalk.yellow("No registration found. Please register a new device.")
      );
      multifactorRegistration = await handleRegistration(storage);
      fcmRegistration = (await storage.get("fcm")) as FcmRegistrationFull;
    }

    console.log(
      chalk.cyan(
        "👂 Listening for authentication requests. Press Ctrl+C to exit."
      )
    );

    const disconnect = await listen(
      fcmRegistration,
      async (data: any) => {
        const authRequest = data as MultifactorApproveRequest;
        console.log(
          chalk.bold.green("\n🔔 New authentication request received!")
        );

        await handleAuthRequest(authRequest, multifactorRegistration);

        console.log(
          chalk.cyan(
            "\n👂 Continuing to listen for authentication requests. Press Ctrl+C to exit."
          )
        );
      },
      storage
    );

    await new Promise(() => {});
  } catch (error) {
    console.log(
      chalk.red(
        `✗ Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.log(
    chalk.red(
      `✗ Fatal error: ${error instanceof Error ? error.message : String(error)}`
    )
  );
  process.exit(1);
});
