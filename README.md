# Multifactor CLI

A command-line tool for bypassing multifactor authentication by integrating with Firebase Cloud Messaging and multifactor services.

## Installation

```bash
# Install globally
npm install -g @alexstrnik/multifactor-cli

# Or run directly with npx
npx @alexstrnik/multifactor-cli
```

### With nix

be sure to enable `experimental-features = nix-command flakes` in your `nix.conf`

```bash
# try it out
nix shell github:AlexStrNik/multifactor-cli 
multifactor-cli

# If repo cloned 
nix run .
```

## Features

- Device registration via activation links
- Persistent storage of registration data
- Real-time listening for authentication requests
- Interactive approval or rejection of authentication requests
- Clean and user-friendly terminal interface

## Usage

### Starting the CLI

```bash
multifactor-cli
```

### Registration

If you're running the CLI for the first time, you'll need to register your device:

1. Open the Multifactor Console
2. Press "Add new Device"
3. Copy the activation link (format: multifactor://resolve?ru_apir=XXXXX)
4. Paste the link when prompted by the CLI

### Authentication Requests

Once registered, the CLI will listen for incoming authentication requests. When a request is received:

1. The CLI will display the account and message details
2. You'll be prompted to approve or reject the request
3. Select your choice and the CLI will process the request

### Exiting

Press `Ctrl+C` at any time to exit the CLI.

## Data Storage

The CLI stores registration data in `~/.multifactor-cli` on your system.
