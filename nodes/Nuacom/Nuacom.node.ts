import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import { NUACOM_BASE_URL } from '../../constants';

export class Nuacom implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NUACOM',
		name: 'nuacom',
		icon: 'file:nuacom.svg',
		group: ['transform'],
		version: 1,
		description: 'Interact with the NUACOM public API',
		defaults: { name: 'NUACOM' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'nuacomApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'contact',
				options: [
					{ name: 'Auto Dialer', value: 'autoDialer' },
					{ name: 'Call Log', value: 'callLog' },
					{ name: 'Contact', value: 'contact' },
					{ name: 'Extension', value: 'extension' },
					{ name: 'Message', value: 'message' },
					{ name: 'NUACOM AI', value: 'nuacomAi' },
					{ name: 'SMS', value: 'sms' },
					{ name: 'Webhook Subscription', value: 'webhookSubscription' },
				],
			},

			// ── Contact ──────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['contact'] } },
				default: 'getAll',
				options: [
					{ name: 'Create', value: 'create', action: 'Create a contact' },
					{ name: 'Delete', value: 'delete', action: 'Delete a contact' },
					{ name: 'Get', value: 'get', action: 'Get a contact' },
					{ name: 'Get Many', value: 'getAll', action: 'Get many contacts' },
					{ name: 'Update', value: 'update', action: 'Update a contact' },
				],
			},
			{
				displayName: 'Contact ID',
				name: 'contactId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['contact'], operation: ['get', 'update', 'delete'] },
				},
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['contact'], operation: ['create', 'update'] },
				},
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['contact'], operation: ['create', 'update'] },
				},
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				default: '',
				displayOptions: {
					show: { resource: ['contact'], operation: ['create', 'update'] },
				},
			},
			{
				displayName: 'Per Page',
				name: 'perPage',
				type: 'options',
				default: 50,
				description: 'Number of results per page',
				displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
				options: [
					{ name: '15', value: 15 },
					{ name: '50', value: 50 },
					{ name: '100', value: 100 },
					{ name: 'All', value: -1 },
				],
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				description: 'Page number to retrieve',
				displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
			},

			// ── Call Log ──────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['callLog'] } },
				default: 'getAll',
				options: [
					{ name: 'Add Note', value: 'addNote', action: 'Add a note to a call' },
					{ name: 'Add Tag by ID', value: 'addTag', action: 'Add a tag to a call by tag info ID' },
					{ name: 'Add Tag by Name', value: 'addTagByName', action: 'Add a tag to a call by name' },
					{ name: 'Dial Agent', value: 'dialAgent', action: 'Dial an agent extension' },
					{ name: 'Dial Team', value: 'dialTeam', action: 'Dial a team queue' },
					{ name: 'Download Recording', value: 'downloadRecording', action: 'Download a call recording' },
					{ name: 'Get Many', value: 'getAll', action: 'Get call logs' },
					{ name: 'Get', value: 'get', action: 'Get a call log by ID' },
				],
			},
			{
				displayName: 'Call ID',
				name: 'callId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['callLog', 'nuacomAi'],
						operation: ['get', 'downloadRecording', 'getCallAiData', 'addNote', 'addTag', 'addTagByName'],
					},
				},
			},
			{
				displayName: 'From Number',
				name: 'fromNumber',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				description: 'Number to call from (E.164 format)',
				displayOptions: { show: { resource: ['callLog'], operation: ['dialAgent', 'dialTeam'] } },
			},
			{
				displayName: 'Destination Number',
				name: 'dstNumber',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				description: 'Extension or queue number to dial (E.164 format)',
				displayOptions: { show: { resource: ['callLog'], operation: ['dialAgent', 'dialTeam'] } },
			},
			{
				displayName: 'Note',
				name: 'noteText',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				description: 'Note text to add to the call',
				displayOptions: { show: { resource: ['callLog'], operation: ['addNote'] } },
			},
			{
				displayName: 'Tag Info ID',
				name: 'tagInfoId',
				type: 'number',
				default: 0,
				required: true,
				description: 'ID of the tag definition to apply',
				displayOptions: { show: { resource: ['callLog'], operation: ['addTag'] } },
			},
			{
				displayName: 'Tag Name',
				name: 'tagName',
				type: 'string',
				default: '',
				required: true,
				description: 'Name of the tag to apply (created automatically if it does not exist)',
				displayOptions: { show: { resource: ['callLog'], operation: ['addTagByName'] } },
			},

			// ── Extension ──────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['extension'] } },
				default: 'getAll',
				options: [
					{ name: 'Get Many', value: 'getAll', action: 'Get extensions' },
				],
			},

			// ── SMS ──────────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['sms'] } },
				default: 'send',
				options: [
					{ name: 'Send', value: 'send', action: 'Send an SMS' },
				],
			},
			{
				displayName: 'From',
				name: 'smsFrom',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'NUACOM',
				description: 'Sender name or number (must be registered on your account)',
				displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
			},
			{
				displayName: 'To',
				name: 'smsTo',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
			},
			{
				displayName: 'Message',
				name: 'smsMessage',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['sms'], operation: ['send'] } },
			},

			// ── Webhook Subscription ──────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['webhookSubscription'] } },
				default: 'getAll',
				options: [
					{ name: 'Create', value: 'create', action: 'Create a subscription' },
					{ name: 'Delete', value: 'delete', action: 'Delete a subscription' },
					{ name: 'Get Many', value: 'getAll', action: 'List subscriptions' },
				],
			},
			{
				displayName: 'Event Type',
				name: 'webhookType',
				type: 'options',
				required: true,
				default: 'call_event',
				displayOptions: { show: { resource: ['webhookSubscription'], operation: ['create'] } },
				options: [
					{ name: 'Call Answered', value: 'call_answered' },
					{ name: 'Call Completed', value: 'call_event' },
					{ name: 'Call IVR Option Selected (Coming Soon)', value: 'ivr_option_selected' },
					{ name: 'Call Initiated', value: 'call_initiated' },
					{ name: 'Call Missed', value: 'call_missed' },
					{ name: 'Call Updated', value: 'call_updated' },
					{ name: 'Incoming Call', value: 'inbound_call_event' },
					{ name: 'Message Received', value: 'message_received' },
					{ name: 'Message Sent', value: 'message_sent' },
					{ name: 'Voicemail Received (Coming Soon)', value: 'voicemail_received' },
				],
			},
			{
				displayName: 'Webhook URL',
				name: 'webhookUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/webhook',
				displayOptions: { show: { resource: ['webhookSubscription'], operation: ['create'] } },
			},
			{
				displayName: 'Subscription ID',
				name: 'subscriptionId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { resource: ['webhookSubscription'], operation: ['delete'] } },
			},

			// ── Message ──────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['message'] } },
				default: 'sendWhatsapp',
				options: [
					{ name: 'Get', value: 'get', action: 'Get a message by ID' },
					{ name: 'Get Conversation', value: 'getConversation', action: 'Get a conversation by ID' },
					{ name: 'Send WhatsApp', value: 'sendWhatsapp', action: 'Send a WhatsApp message' },
				],
			},
			{
				displayName: 'To',
				name: 'messageTo',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				description: 'Recipient phone number',
				displayOptions: { show: { resource: ['message'], operation: ['sendWhatsapp'] } },
			},
			{
				displayName: 'Content',
				name: 'messageContent',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'Message text to send',
				displayOptions: { show: { resource: ['message'], operation: ['sendWhatsapp'] } },
			},
			{
				displayName: 'Message ID',
				name: 'messageId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['get'] } },
			},
			{
				displayName: 'Conversation ID',
				name: 'conversationId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['getConversation'] } },
			},

			// ── Auto Dialer ───────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['autoDialer'] } },
				default: 'getCampaigns',
				options: [
					{ name: 'Add Contact to Campaign', value: 'addCampaignContact', action: 'Add a contact to a campaign' },
					{ name: 'Get Campaign', value: 'getCampaign', action: 'Get a campaign by ID' },
					{ name: 'Get Campaign Contacts', value: 'getCampaignContacts', action: 'Get contacts in a campaign' },
					{ name: 'Get Many Campaigns', value: 'getCampaigns', action: 'Get all campaigns' },
				],
			},
			{
				displayName: 'Campaign ID',
				name: 'campaignId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['autoDialer'],
						operation: ['getCampaign', 'getCampaignContacts', 'addCampaignContact'],
					},
				},
			},
			{
				displayName: 'Contact Number',
				name: 'contactNumber',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				description: 'Phone number in E.164 format',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['addCampaignContact'] } },
			},

			// ── NUACOM AI ─────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['nuacomAi'] } },
				default: 'getCallAiData',
				options: [
					{ name: 'Get Call AI Data', value: 'getCallAiData', action: 'Get AI data for a call' },
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('nuacomApi');
		const headers = { 'X-Nuacom-Token': credentials.apiKey as string };

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			let responseData: unknown;

			try {
				if (resource === 'contact') {
					if (operation === 'getAll') {
						const perPage = this.getNodeParameter('perPage', i) as number;
						const page = this.getNodeParameter('page', i) as number;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/contacts`,
							headers,
							qs: { page, perPage },
							json: true,
						} as IHttpRequestOptions);
					} else if (operation === 'get') {
						const contactId = this.getNodeParameter('contactId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/contacts/${contactId}`,
							headers,
							json: true,
						});
					} else if (operation === 'create') {
						const body = {
							name: this.getNodeParameter('name', i) as string,
							phone: this.getNodeParameter('phone', i) as string,
							email: this.getNodeParameter('email', i) as string,
						};
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/contacts`,
							headers,
							body,
							json: true,
						});
					} else if (operation === 'update') {
						const contactId = this.getNodeParameter('contactId', i) as string;
						const body = {
							name: this.getNodeParameter('name', i) as string,
							phone: this.getNodeParameter('phone', i) as string,
							email: this.getNodeParameter('email', i) as string,
						};
						responseData = await this.helpers.httpRequest({
							method: 'PUT',
							url: `${NUACOM_BASE_URL}/v2/contacts/${contactId}`,
							headers,
							body,
							json: true,
						});
					} else if (operation === 'delete') {
						const contactId = this.getNodeParameter('contactId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'DELETE',
							url: `${NUACOM_BASE_URL}/v2/contacts/${contactId}`,
							headers,
							json: true,
						});
					}
				} else if (resource === 'callLog') {
					if (operation === 'getAll') {
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/call-log`,
							headers,
							json: true,
						});
					} else if (operation === 'get') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/call-logs/${callId}`,
							headers,
							json: true,
						});
					} else if (operation === 'downloadRecording') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/call-recording/${callId}`,
							headers,
						});
					} else if (operation === 'dialAgent') {
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/request-callback`,
							headers,
							body: {
								method: 'extension',
								from_number: this.getNodeParameter('fromNumber', i) as string,
								dst_number: this.getNodeParameter('dstNumber', i) as string,
							},
							json: true,
						});
					} else if (operation === 'dialTeam') {
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/request-callback`,
							headers,
							body: {
								method: 'queue',
								from_number: this.getNodeParameter('fromNumber', i) as string,
								dst_number: this.getNodeParameter('dstNumber', i) as string,
							},
							json: true,
						});
					} else if (operation === 'addNote') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/call-notes`,
							headers,
							body: {
								callId,
								note: this.getNodeParameter('noteText', i) as string,
							},
							json: true,
						});
					} else if (operation === 'addTag') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/call-tags`,
							headers,
							body: {
								callId,
								tag_info_id: this.getNodeParameter('tagInfoId', i) as number,
							},
							json: true,
						});
					} else if (operation === 'addTagByName') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/call-tags/by-name`,
							headers,
							body: {
								callId,
								tag_name: this.getNodeParameter('tagName', i) as string,
							},
							json: true,
						});
					}
				} else if (resource === 'extension') {
					responseData = await this.helpers.httpRequest({
						method: 'GET',
						url: `${NUACOM_BASE_URL}/v2/extensions`,
						headers,
						json: true,
					});
				} else if (resource === 'sms') {
					const body = {
						from: this.getNodeParameter('smsFrom', i) as string,
						to: [{ number: this.getNodeParameter('smsTo', i) as string }],
						message: this.getNodeParameter('smsMessage', i) as string,
					};
					responseData = await this.helpers.httpRequest({
						method: 'POST',
						url: `${NUACOM_BASE_URL}/v2/sms/send`,
						headers,
						body,
						json: true,
					});
				} else if (resource === 'webhookSubscription') {
					if (operation === 'getAll') {
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions`,
							headers,
							json: true,
						});
					} else if (operation === 'create') {
						const webhookType = this.getNodeParameter('webhookType', i) as string;
						const comingSoon = ['voicemail_received', 'ivr_option_selected'];
						if (comingSoon.includes(webhookType)) {
							throw new NodeOperationError(
								this.getNode(),
								`The "${webhookType}" event is not yet available. Coming soon.`,
								{ itemIndex: i },
							);
						}
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions`,
							headers,
							body: {
								type: webhookType,
								url: this.getNodeParameter('webhookUrl', i) as string,
							},
							json: true,
						});
					} else if (operation === 'delete') {
						const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'DELETE',
							url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions/${subscriptionId}`,
							headers,
							json: true,
						});
					}
				} else if (resource === 'message') {
					if (operation === 'sendWhatsapp') {
						const body = {
							channel_type: 'whatsapp',
							to: this.getNodeParameter('messageTo', i) as string,
							content: this.getNodeParameter('messageContent', i) as string,
						};
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/conversations`,
							headers,
							body,
							json: true,
						});
					} else if (operation === 'get') {
						const messageId = this.getNodeParameter('messageId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/conversations/messages/${messageId}`,
							headers,
							json: true,
						});
					} else if (operation === 'getConversation') {
						const conversationId = this.getNodeParameter('conversationId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/conversations/${conversationId}`,
							headers,
							json: true,
						});
					}
				} else if (resource === 'autoDialer') {
					if (operation === 'getCampaigns') {
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaigns`,
							headers,
							json: true,
						});
					} else if (operation === 'getCampaign') {
						const campaignId = this.getNodeParameter('campaignId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaigns/${campaignId}`,
							headers,
							json: true,
						});
					} else if (operation === 'getCampaignContacts') {
						const campaignId = this.getNodeParameter('campaignId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaign/${campaignId}/numbers`,
							headers,
							json: true,
						});
					} else if (operation === 'addCampaignContact') {
						const campaignId = this.getNodeParameter('campaignId', i) as string;
						const contactNumber = this.getNodeParameter('contactNumber', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaign/${campaignId}/numbers`,
							headers,
							body: { number: contactNumber },
							json: true,
						});
					}
				} else if (resource === 'nuacomAi') {
					if (operation === 'getCallAiData') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/calls/${callId}/ai-data`,
							headers,
							json: true,
						});
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, { itemIndex: i });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
					continue;
				}
				throw error;
			}

			const items2: unknown[] = Array.isArray(responseData)
				? responseData
				: [(responseData as { data?: unknown }).data ?? responseData];

			returnData.push(
				...items2.map((item) => ({ json: item as IDataObject, pairedItem: i })),
			);
		}

		return [returnData];
	}
}
