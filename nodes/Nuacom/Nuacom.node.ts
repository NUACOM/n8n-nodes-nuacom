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
					{ name: 'Call Log', value: 'callLog' },
					{ name: 'Contact', value: 'contact' },
					{ name: 'Extension', value: 'extension' },
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

			// ── Call Log ──────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['callLog'] } },
				default: 'getAll',
				options: [
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
				displayOptions: { show: { resource: ['callLog'], operation: ['get'] } },
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
					{ name: 'Call Answered (Outbound)', value: 'outbound_answered_call_event' },
					{ name: 'Call Completed (Any)', value: 'call_event' },
					{ name: 'Call IVR Option Selected (Coming Soon)', value: 'ivr_option_selected' },
					{ name: 'Call Initiated (Coming Soon)', value: 'call_initiated' },
					{ name: 'Call Missed (Inbound)', value: 'inbound_missed_call_event' },
					{ name: 'Call Updated (Coming Soon)', value: 'call_updated' },
					{ name: 'Contact Created (Coming Soon)', value: 'contact_created' },
					{ name: 'Contact Deleted (Coming Soon)', value: 'contact_deleted' },
					{ name: 'Contact Updated (Coming Soon)', value: 'contact_updated' },
					{ name: 'Incoming Call (Inbound)', value: 'inbound_call_event' },
					{ name: 'Message Received', value: 'message_received' },
					{ name: 'Message Sent', value: 'message_sent' },
					{ name: 'Note Added', value: 'note_added' },
					{ name: 'Note Removed (Coming Soon)', value: 'note_removed' },
					{ name: 'Note Updated (Coming Soon)', value: 'note_updated' },
					{ name: 'SMS Delivery Status', value: 'sms_delivery_status' },
					{ name: 'Tag Added', value: 'tag_added' },
					{ name: 'Tag Removed', value: 'tag_removed' },
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
						responseData = await this.helpers.httpRequest({
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/contacts`,
							headers,
							json: true,
						});
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
						const comingSoon = ['voicemail_received', 'ivr_option_selected', 'contact_created', 'contact_updated', 'contact_deleted', 'call_initiated', 'call_updated', 'note_removed', 'note_updated'];
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
