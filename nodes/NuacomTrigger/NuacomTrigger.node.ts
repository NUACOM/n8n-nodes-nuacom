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
	{ name: 'Call Answered', value: 'call_answered' },
	{ name: 'Call Completed', value: 'call_event' },
	{ name: 'Call IVR Option Selected (Coming Soon)', value: 'ivr_option_selected' },
	{ name: 'Call Initiated', value: 'call_initiated' },
	{ name: 'Call Missed', value: 'call_missed' },
	{ name: 'Call Updated', value: 'call_updated' },
	{ name: 'Incoming Call', value: 'inbound_call_event' },
	{ name: 'Message Received', value: 'message_received' },
	{ name: 'Message Sent', value: 'message_sent' },
	{ name: 'Note Added', value: 'note_added' },
	{ name: 'Note Removed (Coming Soon)', value: 'note_removed' },
	{ name: 'Note Updated (Coming Soon)', value: 'note_updated' },
	{ name: 'SMS Delivery Status', value: 'sms_delivery_status' },
	{ name: 'Tag Added', value: 'tag_added' },
	{ name: 'Tag Removed', value: 'tag_removed' },
	{ name: 'Voicemail Received (Coming Soon)', value: 'voicemail_received' },
];

const CALL_EVENTS_WITH_DIRECTION_FILTER = ['call_answered', 'call_completed', 'call_event', 'call_initiated', 'call_missed'];

const CALL_EVENTS = [...CALL_EVENTS_WITH_DIRECTION_FILTER, 'inbound_call_event'];

const MESSAGE_EVENTS = ['message_received', 'message_sent'];

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
			// Call filters
			{
				displayName: 'Direction',
				name: 'direction',
				type: 'options',
				default: '',
				description: 'Only trigger for calls in this direction. Leave as "Any" to receive all.',
				displayOptions: { show: { event: CALL_EVENTS_WITH_DIRECTION_FILTER } },
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Inbound', value: 'inbound' },
					{ name: 'Outbound', value: 'outbound' },
				],
			},
			{
				displayName: 'Queue',
				name: 'queue',
				type: 'string',
				default: '',
				description: 'Only trigger for calls in this queue. Leave empty for all queues.',
				displayOptions: { show: { event: CALL_EVENTS } },
			},
			{
				displayName: 'Extension',
				name: 'extension',
				type: 'string',
				default: '',
				description: 'Only trigger for calls involving this extension number. Leave empty for all extensions.',
				displayOptions: { show: { event: CALL_EVENTS } },
			},
			// Message filters
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'string',
				default: '',
				placeholder: 'e.g. sms, whatsapp',
				description: 'Only trigger for messages on this channel. Leave empty for all channels.',
				displayOptions: { show: { event: MESSAGE_EVENTS } },
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

				const comingSoon = ['voicemail_received', 'ivr_option_selected', 'note_removed', 'note_updated'];
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
		const bodyData = this.getBodyData() as Record<string, unknown> & import('n8n-workflow').IDataObject;
		const event = this.getNodeParameter('event') as string;

		if (CALL_EVENTS.includes(event)) {
			const direction = this.getNodeParameter('direction', '') as string;
			const queue = (this.getNodeParameter('queue', '') as string).trim();
			const extension = (this.getNodeParameter('extension', '') as string).trim();

			if (direction && bodyData.call_direction !== direction) {
				return {};
			}
			if (queue && bodyData.call_in_queue !== queue) {
				return {};
			}
			if (extension) {
				const localCaller = String(bodyData.call_caller_number_local ?? '');
				const localCallee = String(bodyData.call_callee_number_local ?? '');
				if (localCaller !== extension && localCallee !== extension) {
					return {};
				}
			}
		}

		if (MESSAGE_EVENTS.includes(event)) {
			const channel = (this.getNodeParameter('channel', '') as string).trim();
			if (channel && bodyData.channel !== channel) {
				return {};
			}
		}

		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
