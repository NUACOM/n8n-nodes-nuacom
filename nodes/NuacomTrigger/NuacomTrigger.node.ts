import {
	IHookFunctions,
	IHttpRequestOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeOperationError,
} from 'n8n-workflow';
import { NUACOM_BASE_URL } from '../../constants';

const EVENT_TYPES = [
	{ name: 'Call Answered', value: 'outbound_answered_call_event' },
	{ name: 'Call Completed', value: 'call_event' },
	{ name: 'Call Initiated (Coming Soon)', value: 'call_initiated' },
	{ name: 'Call Missed', value: 'inbound_missed_call_event' },
	{ name: 'Call Updated (Coming Soon)', value: 'call_updated' },
	{ name: 'Contact Created (Coming Soon)', value: 'contact_created' },
	{ name: 'Contact Deleted (Coming Soon)', value: 'contact_deleted' },
	{ name: 'Contact Updated (Coming Soon)', value: 'contact_updated' },
	{ name: 'Incoming Call', value: 'inbound_call_event' },
	{ name: 'IVR Option Selected (Coming Soon)', value: 'ivr_option_selected' },
	{ name: 'Message Received', value: 'message_received' },
	{ name: 'Message Sent', value: 'message_sent' },
	{ name: 'Note Added', value: 'note_added' },
	{ name: 'Note Removed', value: 'note_removed' },
	{ name: 'Note Updated', value: 'note_updated' },
	{ name: 'SMS Delivery Status', value: 'sms_delivery_status' },
	{ name: 'Tag Added', value: 'tag_added' },
	{ name: 'Tag Removed', value: 'tag_removed' },
	{ name: 'Voicemail Received (Coming Soon)', value: 'voicemail_received' },
];

export class NuacomTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NUACOM Trigger',
		name: 'nuacomTrigger',
		icon: 'file:nuacom.svg',
		group: ['trigger'],
		version: 1,
		description: 'Triggers a workflow when a NUACOM event occurs',
		defaults: { name: 'NUACOM Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'nuacomApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				default: 'call_event',
				options: EVENT_TYPES,
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) {
					return false;
				}

				const credentials = await this.getCredentials('nuacomApi');
				const response = await this.helpers.httpRequest({
					method: 'GET',
					url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions`,
					headers: { 'X-Nuacom-Token': credentials.apiKey as string },
					json: true,
				} as IHttpRequestOptions);

				const subscriptions: Array<{ id: number; type: string }> =
					(response as { data: Array<{ id: number; type: string }> }).data ?? [];

				return subscriptions.some((s) => s.id === webhookData.webhookId);
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const event = this.getNodeParameter('event') as string;

				const comingSoon = ['voicemail_received', 'ivr_option_selected', 'contact_created', 'contact_updated', 'contact_deleted', 'call_initiated', 'call_updated'];
				if (comingSoon.includes(event)) {
					throw new NodeOperationError(
						this.getNode(),
						`The "${event}" event is not yet available. Coming soon.`,
					);
				}

				const credentials = await this.getCredentials('nuacomApi');

				const body = { type: event, url: webhookUrl };

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions`,
					headers: {
						'X-Nuacom-Token': credentials.apiKey as string,
						'Content-Type': 'application/json',
					},
					body,
					json: true,
				} as IHttpRequestOptions);

				const id = (response as { id: number }).id;
				if (!id) {
					throw new NodeOperationError(
						this.getNode(),
						'NUACOM webhook subscription did not return an ID',
					);
				}

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = id;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) {
					return true;
				}

				const credentials = await this.getCredentials('nuacomApi');

				try {
					await this.helpers.httpRequest({
						method: 'DELETE',
						url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions/${webhookData.webhookId}`,
						headers: { 'X-Nuacom-Token': credentials.apiKey as string },
						json: true,
					} as IHttpRequestOptions);
				} catch {
					return false;
				}

				delete webhookData.webhookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();

		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
