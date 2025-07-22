import { AsyncStorage, StorageItem, tcp } from "@aracna/core";
import { Stats } from "fs";
import { lstat, readFile, writeFile } from "fs/promises";
import { deserialize, serialize } from "v8";
import { join } from "path";
import { homedir } from "os";
import crypto from "crypto";

const PATH = join(homedir(), ".multifactor-cli");
const ENCRYPTION_ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const ENCRYPTION_MARKER = Buffer.from("ENCRYPTED_DATA_V1:");

function encryptData(data: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.scryptSync(password, salt, 32);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);

  return Buffer.concat([ENCRYPTION_MARKER, salt, iv, encryptedData]);
}

function decryptData(encryptedData: Buffer, password: string): Buffer | null {
  try {
    if (
      !encryptedData
        .slice(0, ENCRYPTION_MARKER.length)
        .equals(ENCRYPTION_MARKER)
    ) {
      return null;
    }

    let offset = ENCRYPTION_MARKER.length;
    const salt = encryptedData.slice(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;

    const iv = encryptedData.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const data = encryptedData.slice(offset);

    const key = crypto.scryptSync(password, salt, 32);

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);

    return Buffer.concat([decipher.update(data), decipher.final()]);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
}

async function readEncryptedFile(
  path: string,
  password: string
): Promise<Buffer> {
  try {
    const fileContent = await readFile(path);

    if (
      fileContent.length >= ENCRYPTION_MARKER.length &&
      fileContent.slice(0, ENCRYPTION_MARKER.length).equals(ENCRYPTION_MARKER)
    ) {
      const decryptedData = decryptData(fileContent, password);
      if (decryptedData) {
        return decryptedData;
      }
      throw new Error(
        "Failed to decrypt file. Invalid password or corrupted file."
      );
    }

    return fileContent;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Buffer.from(serialize({}));
    }
    throw error;
  }
}

async function writeEncryptedFile(
  path: string,
  data: Buffer,
  password: string
): Promise<void> {
  const encryptedData = encryptData(data, password);

  await writeFile(path, encryptedData);
}

export function SecureStorage(password: string): AsyncStorage {
  return new AsyncStorage(
    "SecureStorage",
    async () => {
      await writeEncryptedFile(PATH, serialize({}), password);
    },
    async (key: string) => {
      let path: string,
        stat: Stats | Error,
        file: Buffer,
        json: Record<string, any>,
        item: any;

      path = PATH;
      stat = await tcp(() => lstat(path), false);

      if (stat instanceof Error) {
        await writeEncryptedFile(path, serialize({}), password);
      }

      file = await readEncryptedFile(path, password);

      try {
        json = deserialize(file);
        item = json[key];

        if (item) {
          return item;
        }
      } catch (error) {
        console.error("Error deserializing data:", error);
      }

      return new Error(`The item does not exist.`);
    },
    async (key: string) => {
      let path: string,
        stat: Stats | Error,
        file: Buffer,
        json: Record<string, any>;

      path = PATH;
      stat = await tcp(() => lstat(path), false);

      if (stat instanceof Error) {
        await writeEncryptedFile(path, serialize({}), password);
      }

      file = await readEncryptedFile(path, password);

      try {
        json = deserialize(file);
        return Boolean(json[key]);
      } catch (error) {
        console.error("Error deserializing data:", error);
        return false;
      }
    },
    async (key: string) => {
      let path: string,
        stat: Stats | Error,
        file: Buffer,
        json: Record<string, any>;

      path = PATH;
      stat = await tcp(() => lstat(path), false);

      if (stat instanceof Error) {
        await writeEncryptedFile(path, serialize({}), password);
      }

      file = await readEncryptedFile(path, password);

      try {
        json = deserialize(file);

        if (json[key]) {
          delete json[key];
        }

        return writeEncryptedFile(path, serialize(json), password);
      } catch (error) {
        console.error("Error deserializing data:", error);
        throw error;
      }
    },
    async (key: string, item: StorageItem) => {
      let path: string,
        stat: Stats | Error,
        file: Buffer,
        json: Record<string, any>;

      path = PATH;
      stat = await tcp(() => lstat(path), false);

      if (stat instanceof Error) {
        await writeEncryptedFile(path, serialize({}), password);
      }

      file = await readEncryptedFile(path, password);

      try {
        json = deserialize(file);
        json[key] = item;

        return writeEncryptedFile(path, serialize(json), password);
      } catch (error) {
        console.error("Error deserializing data:", error);
        throw error;
      }
    }
  );
}

export async function isStorageEncrypted(): Promise<{
  exists: boolean;
  encrypted: boolean;
}> {
  try {
    try {
      await lstat(PATH);
    } catch (error) {
      return { exists: false, encrypted: false };
    }

    const fileContent = await readFile(PATH);

    const isEncrypted =
      fileContent.length >= ENCRYPTION_MARKER.length &&
      fileContent.slice(0, ENCRYPTION_MARKER.length).equals(ENCRYPTION_MARKER);

    return { exists: true, encrypted: isEncrypted };
  } catch (error) {
    console.error("Error checking storage encryption:", error);
    return { exists: false, encrypted: false };
  }
}

export async function encryptStorage(password: string): Promise<void> {
  writeEncryptedFile(PATH, await readEncryptedFile(PATH, ""), password);
}
