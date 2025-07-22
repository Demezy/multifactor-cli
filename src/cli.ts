#!/usr/bin/env node
import chalk from "chalk";
import prompts from "prompts";
import { DiskStorage } from "./utils/diskStorage.js";
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

function extractRequestId(activationLink: string): string | null {
  try {
    const url = new URL(activationLink);
    return url.searchParams.get("ru_apir");
  } catch (error) {
    return null;
  }
}

function printHeader() {
  console.log("\n" + chalk.bold.green("🔐 Multifactor CLI") + "\n");
}

function printRegistrationInstructions() {
  console.log(chalk.bold("Registration Instructions:"));
  console.log("1. Open the Multifactor Console");
  console.log('2. Press "Add new Device"');
  console.log(
    "3. Copy the activation link (format: multifactor://resolve?ru_apir=XXXXX)"
  );
  console.log();
}

function printAuthRequestDetails(request: MultifactorApproveRequest) {
  console.log(chalk.bold("🔐 Authentication Request:"));
  console.log(`Account: ${request.Name}`);
  console.log(`Message: ${request.Message}`);
  console.log();
}

async function handleRegistration(): Promise<MultifactorRegistration> {
  printRegistrationInstructions();

  const { activationLink } = await prompts({
    type: "text",
    name: "activationLink",
    message: "Paste the activation link:",
    validate: (value: string) => {
      if (!value.includes("multifactor://resolve?ru_apir=")) {
        return 'Invalid link format. It should contain "multifactor://resolve?ru_apir="';
      }
      const requestId = extractRequestId(value);
      if (!requestId) {
        return "Could not extract request ID from the link";
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
    const fcmRegistration = await registerFcm(FCM_CREDENTIALS);

    const pushedRegistration = await registerMultipushed(fcmRegistration);

    const multifactorRegistration = await registerMultifactor(
      requestId,
      pushedRegistration
    );

    await DiskStorage.set("multifactor", multifactorRegistration);

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
        `✗ Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
  }
}

async function main() {
  printHeader();

  process.on("SIGINT", () => {
    console.log(chalk.yellow("\nExiting Multifactor CLI..."));
    process.exit(0);
  });

  try {
    let multifactorRegistration: MultifactorRegistration;
    let fcmRegistration: FcmRegistrationFull;

    if (await DiskStorage.has("multifactor")) {
      multifactorRegistration = (await DiskStorage.get(
        "multifactor"
      )) as MultifactorRegistration;
      console.log(chalk.green("✓ Found existing device registration"));

      if (await DiskStorage.has("fcm")) {
        fcmRegistration = (await DiskStorage.get("fcm")) as FcmRegistrationFull;
      } else {
        throw new Error(
          "FCM registration not found. Please restart the application."
        );
      }
    } else {
      console.log(
        chalk.yellow("No registration found. Please register a new device.")
      );
      multifactorRegistration = await handleRegistration();
      fcmRegistration = (await DiskStorage.get("fcm")) as FcmRegistrationFull;
    }

    console.log(
      chalk.cyan(
        "👂 Listening for authentication requests. Press Ctrl+C to exit."
      )
    );

    const disconnect = await listen(fcmRegistration, async (data: any) => {
      const authRequest = data as MultifactorApproveRequest;
      console.log(
        chalk.bold.green("\n🔔 New authentication request received!")
      );

      await handleAuthRequest(authRequest, multifactorRegistration);

      console.log(
        chalk.cyan(
          "\n👂 Listening for authentication requests. Press Ctrl+C to exit."
        )
      );
    });

    process.stdin.resume();

    process.on("exit", () => {
      if (disconnect) disconnect();
    });
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
  console.error(
    chalk.red(
      `Fatal error: ${error instanceof Error ? error.message : String(error)}`
    )
  );
  process.exit(1);
});
