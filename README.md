# @nuacom/n8n-nodes-nuacom

[![npm version](https://img.shields.io/npm/v/@nuacom/n8n-nodes-nuacom)](https://www.npmjs.com/package/@nuacom/n8n-nodes-nuacom)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An n8n community node package that provides seamless integration with the [NUACOM](https://nuacom.com) API, enabling you to automate calls, SMS, contact management, and webhook subscriptions within your n8n workflows.

## Features

This package includes two main nodes:

### 1. NUACOM Node

A comprehensive node for interacting with the NUACOM API, supporting the following resources:

#### 📞 **Call Log**
- **Get Many** — Retrieve call logs with optional filters: date range, call type (incoming/outgoing/missed/unanswered), extension, queue, phone number, and pagination
- **Get** — Retrieve a specific call log by ID
- **Get AI Data** — Retrieve AI analysis data for a call
- **Download Recording** — Download the recording file for a call
- **Add Note** — Add a text note to a call
- **Add Tag by ID** — Tag a call using a tag definition ID
- **Add Tag by Name** — Tag a call by name (creates the tag automatically if it does not exist)

#### 📲 **Callback**
- **Dial Agent** — Request a callback to a customer via an agent extension
- **Dial Team** — Request a callback to a customer via a team queue

#### 👤 **Contact**
- **Get Many** — List contacts with pagination (15 / 50 / 100 / All per page)
- **Get** — Retrieve a specific contact by ID
- **Create** — Create a new contact with name, phone, and email
- **Update** — Update an existing contact
- **Delete** — Delete a contact

#### 🤖 **Auto Dialer**
- **Get Many Campaigns** — List all auto dialer campaigns
- **Get Campaign Stats** — Retrieve statistics for a specific campaign
- **Get Campaign Contacts** — List contacts (numbers) in a campaign
- **Add Contact to Campaign** — Add a phone number to an existing campaign

#### 🔌 **Extension**
- **Get Many** — List all extensions on the account

#### 💬 **Message**
- **Send WhatsApp** — Send a WhatsApp message to a phone number
- **Get** — Retrieve a message by ID
- **Get Conversation** — Retrieve a conversation by ID

#### 📱 **SMS**
- **Send** — Send an SMS message from a registered sender

#### 🔔 **Webhook Subscription**
- **Get Many** — List all active webhook subscriptions
- **Create** — Register a new webhook subscription for an event type
- **Delete** — Remove an existing webhook subscription

---

### 2. NUACOM Trigger Node

A webhook trigger node that automatically starts workflows when NUACOM events occur. Each event type exposes relevant filters so workflows only fire for the calls or messages you care about.

| Event | Available Filters |
|-------|-------------------|
| **Call Answered** | Direction, Queue, Extension |
| **Call Completed** | Direction, Queue, Extension |
| **Call Initiated** | Direction, Queue, Extension |
| **Call Missed** | Direction, Queue, Extension |
| **Call Updated** | Direction, Event Type (AI Analysis / Notes / Tags) |
| **Incoming Call** | Queue, Extension |
| **Message Received** | Channel (SMS / WhatsApp), Message Contains |
| **Message Sent** | Channel (SMS / WhatsApp), Message Contains |
| **Call IVR Option Selected** | *(coming soon)* |
| **Voicemail Received** | *(coming soon)* |

---

## Installation

### For n8n Cloud Users

This node is available in the n8n community nodes catalog. You can install it directly from the n8n interface:

1. Go to **Settings** → **Community Nodes**
2. Search for `@nuacom/n8n-nodes-nuacom`
3. Click **Install**

### For Self-Hosted n8n

If you're running a self-hosted instance of n8n, install this package in your n8n installation directory:

```bash
npm install @nuacom/n8n-nodes-nuacom
```

Or if you're using n8n via Docker:

```bash
docker exec -it <container-name> npm install @nuacom/n8n-nodes-nuacom
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
4. Map the form fields to **First Name**, **Last Name**, **Phone**, and **Email**

### Example 2: Trigger a Workflow on Incoming Call

Run a workflow whenever a missed call occurs on a specific extension:

1. Add a **NUACOM Trigger** node
2. Select **Call Missed**
3. Set **Extension** to the extension number you want to monitor
4. Add subsequent nodes to send a Slack notification or create a follow-up task

### Example 3: Send an SMS Notification

Send an SMS when a specific event happens in another system:

1. Add any trigger node
2. Add a **NUACOM** node
3. Select **SMS** → **Send**
4. Set the **From** field to your registered sender name or number
5. Set **To** and **Message** using expressions from the trigger data

### Example 4: Tag a Call After AI Analysis

Automatically tag a call once its AI analysis is ready:

1. Add a **NUACOM Trigger** node, select **Call Updated**, set **Event Type** to **AI Analysis**
2. Add a **NUACOM** node, select **Call Log** → **Add Tag by Name**
3. Map **Call ID** from the trigger and set your tag name

### Example 5: Request a Callback When a Lead Submits a Form

Trigger an outbound callback to a customer the moment they fill in a contact form:

1. Add a Webhook trigger node
2. Add a **NUACOM** node, select **Callback** → **Dial Agent**
3. Set **Extension** to the agent's extension and **Destination Number** to the customer's phone number from the form

## Development

### Prerequisites

- Node.js v18+
- npm
- TypeScript

### Setup

1. Clone the repository:

```bash
git clone https://github.com/NUACOM/@nuacom/n8n-nodes-nuacom.git
cd @nuacom/n8n-nodes-nuacom
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
@nuacom/n8n-nodes-nuacom/
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

- **GitHub Issues**: [https://github.com/NUACOM/@nuacom/n8n-nodes-nuacom/issues](https://github.com/NUACOM/@nuacom/n8n-nodes-nuacom/issues)
- **NUACOM Website**: [https://nuacom.com](https://nuacom.com)
- **Email**: support@nuacom.com

---

Made with ❤️ by the NUACOM team.
