import {
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { NUACOM_BASE_URL } from '../../constants';

/**
 * Read a node parameter and return it as a trimmed string. Parameters bound to
 * expressions can resolve to null or a number, so the value is coerced to a
 * string before trimming to avoid runtime errors.
 */
function getTrimmedParam(ctx: IWebhookFunctions, name: string): string {
	const value = ctx.getNodeParameter(name, '');

	return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * Parse the extension out of a NUACOM channel string.
 *
 * Mirrors the backend's CallEventHookHelper::getExtensionFromChannel: the
 * channel is hyphen-delimited (e.g. "svrX-coreY-36-00000abc") and the third
 * segment is the extension, accepted only when it is a 2–4 digit value.
 */
function extensionFromChannel(channel: string): string {
	const segment = channel.split('-')[2] ?? '';

	if (segment !== '' && segment !== '0' && segment.length >= 2 && segment.length <= 4) {
		return segment;
	}

	return '';
}

/**
 * Collect every extension that can identify the agent on a call event.
 *
 * The backend does not expose a single canonical field: inbound answered calls
 * carry the agent in `call_answered_by`, some events use `call_initiated_by`,
 * and outbound calls only expose the extension inside `call_channel_local`
 * (which is why the backend's CallEventHookHelper parses the channel for
 * outbound). Matching only `call_answered_by`/`call_initiated_by` silently drops
 * events for an extension on outbound calls, so gather all candidates here.
 */
function collectCallExtensions(body: Record<string, unknown>): Set<string> {
	const candidates = new Set<string>();

	for (const value of [body.call_answered_by, body.call_initiated_by]) {
		const extension = String(value ?? '').trim();
		if (extension !== '' && extension !== '0') {
			candidates.add(extension);
		}
	}

	const channelExtension = extensionFromChannel(String(body.call_channel_local ?? ''));
	if (channelExtension !== '') {
		candidates.add(channelExtension);
	}

	return candidates;
}

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
		subtitle: '={{$parameter["event"]}}',
		defaults: { name: 'NUACOM Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
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
				displayName: 'Queue Name or ID',
				name: 'queue',
				type: 'options',
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'getQueues' },
				displayOptions: { show: { event: CALL_EVENTS } },
			},
			{
				displayName: 'Extension Name or ID',
				name: 'extension',
				type: 'options',
				default: '',
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'getExtensions' },
				displayOptions: { show: { event: CALL_EVENTS } },
			},
			// Call Updated filters
			{
				displayName: 'Direction',
				name: 'callUpdatedDirection',
				type: 'options',
				default: '',
				description: 'Only trigger for calls in this direction. Leave as "Any" to receive all.',
				displayOptions: { show: { event: ['call_updated'] } },
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Inbound', value: 'inbound' },
					{ name: 'Outbound', value: 'outbound' },
				],
			},
			{
				displayName: 'Event Type',
				name: 'callUpdatedType',
				type: 'options',
				default: '',
				description: 'Only trigger for a specific update type. Leave as "Any" to receive all.',
				displayOptions: { show: { event: ['call_updated'] } },
				options: [
					{ name: 'AI Analysis', value: 'ai_analysis' },
					{ name: 'Any', value: '' },
					{ name: 'Notes', value: 'notes' },
					{ name: 'Tags', value: 'tags' },
				],
			},
			// IVR filter
			{
				displayName: 'IVR',
				name: 'ivr',
				type: 'string',
				default: '',
				placeholder: 'e.g. Main Menu',
				description: 'Only trigger for a specific IVR. Leave empty for all IVRs.',
				displayOptions: { show: { event: ['ivr_option_selected'] } },
			},
			// Voicemail filter
			{
				displayName: 'Voicemail Box',
				name: 'voicemailBox',
				type: 'string',
				default: '',
				placeholder: 'e.g. Sales',
				description: 'Only trigger for a specific voicemail box. Leave empty for all boxes.',
				displayOptions: { show: { event: ['voicemail_received'] } },
			},
			// Message filters
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'options',
				default: '',
				description: 'Only trigger for messages on this channel',
				displayOptions: { show: { event: MESSAGE_EVENTS } },
				options: [
					{ name: 'Any', value: '' },
					{ name: 'SMS', value: 'sms' },
					{ name: 'WhatsApp', value: 'whatsapp' },
				],
			},
			{
				displayName: 'Message Contains',
				name: 'messageContains',
				type: 'string',
				default: '',
				placeholder: 'e.g. hello',
				description: 'Only trigger if the message content contains this text (case-insensitive). Leave empty for all messages.',
				displayOptions: { show: { event: MESSAGE_EVENTS } },
			},
		],
		usableAsTool: true,
	};

	methods = {
		loadOptions: {
			async getQueues(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
					method: 'GET',
					url: `${NUACOM_BASE_URL}/v2/queues`,
					json: true,
				});
				const queues = (response as Array<{ number: string; name: string }>) ?? [];
				return [
					{ name: 'Any Queue', value: '' },
					...queues.map((q) => ({ name: `${q.number} — ${q.name}`, value: q.number })),
				];
			},

			async getExtensions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
					method: 'GET',
					url: `${NUACOM_BASE_URL}/v2/extensions`,
					json: true,
				});
				const extensions = (response as Array<{ number: number; name: string }>) ?? [];
				return [
					{ name: 'Any Extension', value: '' },
					...extensions.map((e) => ({ name: `${e.number} — ${e.name}`, value: String(e.number) })),
				];
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) {
					return false;
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
					method: 'GET',
					url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions`,
					json: true,
				});

				const subscriptions: Array<{ id: number; type: string }> =
					(response as { data: Array<{ id: number; type: string }> }).data ?? [];

				return subscriptions.some((s) => s.id === webhookData.webhookId);
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const event = this.getNodeParameter('event') as string;

				const comingSoon = ['voicemail_received', 'ivr_option_selected'];
				if (comingSoon.includes(event)) {
					throw new NodeOperationError(
						this.getNode(),
						`The "${event}" event is not yet available. Coming soon.`,
					);
				}

				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
					method: 'POST',
					url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions`,
					body: { type: event, url: webhookUrl },
					json: true,
				});

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

				try {
					await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
						method: 'DELETE',
						url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions/${webhookData.webhookId}`,
						json: true,
					});
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as JsonObject);
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
			const queue = getTrimmedParam(this, 'queue');
			const extension = getTrimmedParam(this, 'extension');

			if (direction && bodyData.call_direction !== direction) {
				return {};
			}
			if (queue) {
				const callInQueue = String(bodyData.call_in_queue ?? '');
				const escaped = queue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				if (!new RegExp(`\\b${escaped}\\b`).test(callInQueue)) {
					return {};
				}
			}
			if (extension) {
				const candidates = collectCallExtensions(bodyData);
				if (!candidates.has(extension)) {
					return {};
				}
			}
		}

		// "Call Completed" subscribes to the generic call_event, which the backend
		// fires on every state change (initiated, answered, terminated). Only emit
		// once the call has actually ended.
		if (event === 'call_event' && String(bodyData.call_terminated ?? '') !== '1') {
			return {};
		}

		if (event === 'call_updated') {
			const direction = this.getNodeParameter('callUpdatedDirection', '') as string;
			const updateType = this.getNodeParameter('callUpdatedType', '') as string;

			if (direction && bodyData.call_direction !== direction) {
				return {};
			}
			if (updateType && bodyData.update_type !== updateType) {
				return {};
			}
		}

		if (MESSAGE_EVENTS.includes(event)) {
			const channel = this.getNodeParameter('channel', '') as string;
			const messageContains = getTrimmedParam(this, 'messageContains').toLowerCase();
			if (channel && bodyData.channel !== channel) {
				return {};
			}
			if (messageContains && !String(bodyData.content ?? '').toLowerCase().includes(messageContains)) {
				return {};
			}
		}

		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
