# n8n-nodes-nuacom

[![npm version](https://img.shields.io/npm/v/n8n-nodes-nuacom)](https://www.npmjs.com/package/n8n-nodes-nuacom)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An n8n community node package that provides seamless integration with the [NUACOM](https://nuacom.ie) API, enabling you to automate calls, SMS, contact management, and webhook subscriptions within your n8n workflows.

## Features

This package includes two main nodes:

### 1. NUACOM Node

A comprehensive node for interacting with the NUACOM API, supporting the following resources:

#### 👤 **Contact**
- **Get Many** — List and filter contacts with pagination support
- **Get** — Retrieve a specific contact by ID
- **Create** — Create a new contact
- **Update** — Update an existing contact
- **Delete** — Delete a contact

#### 📞 **Call Log**
- **Get Many** — Retrieve call logs
- **Get** — Retrieve a specific call log by ID

#### 🔌 **Extension**
- **Get Many** — List all extensions on the account

#### 💬 **SMS**
- **Send** — Send an SMS message from a registered sender

#### 🔔 **Webhook Subscription**
- **Get Many** — List all webhook subscriptions
- **Create** — Register a new webhook subscription for an event type
- **Delete** — Remove an existing webhook subscription

### 2. NUACOM Trigger Node

A webhook trigger node that automatically starts workflows when NUACOM events occur:

- **Call Event** — Triggered on inbound/outbound call activity
- **Contact Created** — Triggered when a new contact is created
- **Contact Updated** — Triggered when a contact is updated
- **Contact Deleted** — Triggered when a contact is deleted
- **IVR Option Selected** — Triggered when a caller selects an IVR menu option
- **Message Received** — Triggered when an inbound message is received
- **Message Sent** — Triggered when an outbound message is sent
- **Note Added** — Triggered when a call note is added
- **Note Updated** — Triggered when a call note is updated
- **Note Removed** — Triggered when a call note is removed
- **SMS Delivery Status** — Triggered on SMS delivery status updates
- **Tag Added** — Triggered when a tag is added to a call
- **Tag Removed** — Triggered when a tag is removed from a call
- **Voicemail Received** — Triggered when a voicemail is received

## Installation

### For n8n Cloud Users

This node is available in the n8n community nodes catalog. You can install it directly from the n8n interface:

1. Go to **Settings** → **Community Nodes**
2. Search for `n8n-nodes-nuacom`
3. Click **Install**

### For Self-Hosted n8n

If you're running a self-hosted instance of n8n, install this package in your n8n installation directory:

```bash
npm install n8n-nodes-nuacom
```

Or if you're using n8n via Docker:

```bash
docker exec -it <container-name> npm install n8n-nodes-nuacom
```

## Configuration

### API Credentials

Before using the NUACOM nodes, you need to configure your NUACOM API credentials:

1. In n8n, go to **Credentials** → **Add Credential**
2. Search for **NUACOM API**
3. Enter your NUACOM API token
   - You can find your API token in your NUACOM dashboard under **Settings** → **API**

## Usage Examples

### Example 1: Create a Contact on Form Submission

Automatically create a NUACOM contact when a form is filled in:

1. Add a trigger node (e.g. Webhook or Typeform)
2. Add a **NUACOM** node
3. Select **Contact** → **Create**
4. Map the form fields to `first_name`, `last_name`, `email`, and `phones`

### Example 2: Trigger a Workflow on Incoming Call

Run a workflow whenever a call event occurs on your account:

1. Add a **NUACOM Trigger** node
2. Select **Call Event**
3. Add subsequent nodes to log the call, notify a Slack channel, or update a CRM record

### Example 3: Send an SMS Notification

Send an SMS when a specific event happens in another system:

1. Add any trigger node
2. Add a **NUACOM** node
3. Select **SMS** → **Send**
4. Set the **From** field to your registered sender name or number
5. Set **To** and **Message** using expressions from the trigger data

### Example 4: Subscribe to Voicemail Events

Register a webhook to receive voicemail notifications:

1. Add a **NUACOM** node
2. Select **Webhook Subscription** → **Create**
3. Select **Voicemail Received** as the event type
4. Enter your webhook URL

## Development

### Prerequisites

- Node.js v18+
- npm
- TypeScript

### Setup

1. Clone the repository:

```bash
git clone https://github.com/NUACOM/n8n-nodes-nuacom.git
cd n8n-nodes-nuacom
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

### Available Scripts

- `npm run build` — Compile TypeScript to JavaScript and copy icons
- `npm run dev` — Watch mode for development
- `npm run lint` — Run ESLint
- `npm run prepublishOnly` — Build before publishing

### Project Structure

```
n8n-nodes-nuacom/
├── nodes/
│   ├── Nuacom/
│   │   ├── Nuacom.node.ts        # Main action node
│   │   └── nuacom.svg            # Node icon
│   └── NuacomTrigger/
│       ├── NuacomTrigger.node.ts # Trigger node
│       └── nuacom.svg            # Node icon
├── credentials/
│   └── NuacomApi.credentials.ts  # API credential definition
├── constants.ts                  # Base URL and shared constants
└── dist/                         # Compiled output
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and run linting (`npm run lint`)
4. Commit your changes
5. Push to the branch and open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

## Support

For issues or questions:

- **GitHub Issues**: [https://github.com/NUACOM/n8n-nodes-nuacom/issues](https://github.com/NUACOM/n8n-nodes-nuacom/issues)
- **NUACOM Website**: [https://nuacom.ie](https://nuacom.ie)
- **Email**: support@nuacom.ie

---

Made with ❤️ by the NUACOM team
