import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { NUACOM_BASE_URL } from '../../constants';

/**
 * Read a node parameter and return it as a trimmed string. Parameters bound to
 * expressions (e.g. a field from a trigger) can resolve to null or a number, so
 * the value is coerced to a string before trimming to avoid runtime errors.
 */
function getTrimmedParam(ctx: IExecuteFunctions, name: string, index: number): string {
	const value = ctx.getNodeParameter(name, index, '');

	return value === null || value === undefined ? '' : String(value).trim();
}

export class Nuacom implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NUACOM',
		name: 'nuacom',
		icon: 'file:nuacom.svg',
		group: ['transform'],
		version: 1,
		description: 'Interact with the NUACOM public API',
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		defaults: { name: 'NUACOM' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
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
					{ name: 'Callback', value: 'callback' },
					{ name: 'Contact', value: 'contact' },
					{ name: 'Extension', value: 'extension' },
					{ name: 'Message', value: 'message' },
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
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				default: '',
				description: 'At least one of First Name or Last Name is required',
				displayOptions: {
					show: { resource: ['contact'], operation: ['create', 'update'] },
				},
			},
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				default: '',
				description: 'At least one of First Name or Last Name is required',
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
				placeholder: 'name@email.com',
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
					{ name: '100', value: 100 },
					{ name: '15', value: 15 },
					{ name: '50', value: 50 },
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
			{
				displayName: 'Phone',
				name: 'contactPhone',
				type: 'string',
				default: '',
				placeholder: 'e.g. 353861234567',
				description: 'Filter by phone number (any type — mobile or landline), matched as a substring of the stored digits. Formatting like +, spaces, or a leading 00 is ignored. Leave empty for all.',
				displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
			},
			{
				displayName: 'Contact IDs',
				name: 'contactFilterIds',
				type: 'string',
				default: '',
				placeholder: 'e.g. 1,2,3',
				description: 'Filter by one or more contact IDs, comma-separated. Leave empty for all.',
				displayOptions: { show: { resource: ['contact'], operation: ['getAll'] } },
			},
			{
				displayName: 'Name',
				name: 'contactSearch',
				type: 'string',
				default: '',
				placeholder: 'e.g. John',
				description: 'Filter contacts by name. Leave empty for all.',
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
					{ name: 'Add Call Tag', value: 'addCallTag', action: 'Add a tag to a call' },
					{ name: 'Add Note', value: 'addNote', action: 'Add a note to a call' },
					{ name: 'Download Recording', value: 'downloadRecording', action: 'Download a call recording' },
					{ name: 'Get', value: 'get', action: 'Get a call log by ID' },
					{ name: 'Get AI Data', value: 'getCallAiData', action: 'Get AI data for a call' },
					{ name: 'Get Many', value: 'getAll', action: 'Get call logs' },
				],
			},
			// Call Log — Get Many filters
			{
				displayName: 'Date From',
				name: 'callLogDateFrom',
				type: 'string',
				default: '',
				placeholder: 'YYYY-MM-DD',
				description: 'Return calls on or after this date',
				displayOptions: { show: { resource: ['callLog'], operation: ['getAll'] } },
			},
			{
				displayName: 'Date To',
				name: 'callLogDateTo',
				type: 'string',
				default: '',
				placeholder: 'YYYY-MM-DD',
				description: 'Return calls on or before this date',
				displayOptions: { show: { resource: ['callLog'], operation: ['getAll'] } },
			},
			{
				displayName: 'Type',
				name: 'callLogType',
				type: 'options',
				default: '',
				description: 'Filter by call type',
				displayOptions: { show: { resource: ['callLog'], operation: ['getAll'] } },
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Incoming', value: 'incoming' },
					{ name: 'Missed', value: 'missed' },
					{ name: 'Outgoing', value: 'outgoing' },
					{ name: 'Unanswered', value: 'unanswered' },
				],
			},
			{
				displayName: 'Extension',
				name: 'callLogExtension',
				type: 'string',
				default: '',
				description: 'Filter by extension number. Leave empty for all.',
				displayOptions: { show: { resource: ['callLog'], operation: ['getAll'] } },
			},
			{
				displayName: 'Queue',
				name: 'callLogQueue',
				type: 'string',
				default: '',
				description: 'Filter by queue name or number. Leave empty for all.',
				displayOptions: { show: { resource: ['callLog'], operation: ['getAll'] } },
			},
			{
				displayName: 'Number',
				name: 'callLogNumber',
				type: 'string',
				default: '',
				description: 'Filter by phone number (caller or callee). Leave empty for all.',
				displayOptions: { show: { resource: ['callLog'], operation: ['getAll'] } },
			},
			{
				displayName: 'Page',
				name: 'callLogPage',
				type: 'number',
				default: 1,
				displayOptions: { show: { resource: ['callLog'], operation: ['getAll'] } },
			},
			{
				displayName: 'Per Page',
				name: 'callLogPerPage',
				type: 'number',
				default: 25,
				displayOptions: { show: { resource: ['callLog'], operation: ['getAll'] } },
			},
			{
				displayName: 'Call ID',
				name: 'callId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['callLog'],
						operation: ['get', 'downloadRecording', 'getCallAiData', 'addNote', 'addCallTag'],
					},
				},
			},
			{
				displayName: 'Extension',
				name: 'callbackExtension',
				type: 'string',
				default: '',
				required: true,
				description: "Agent's extension number to initiate the callback from",
				displayOptions: { show: { resource: ['callback'], operation: ['dialAgent'] } },
			},
			{
				displayName: 'Queue Number',
				name: 'callbackQueue',
				type: 'string',
				default: '',
				required: true,
				description: 'Queue number to initiate the callback from',
				displayOptions: { show: { resource: ['callback'], operation: ['dialTeam'] } },
			},
			{
				displayName: 'Destination Number',
				name: 'dstNumber',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				description: "Customer's phone number to call back, in E.164 format",
				displayOptions: { show: { resource: ['callback'] } },
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
				displayName: 'Tag Name or ID',
				name: 'callTagId',
				type: 'options',
				default: '',
				required: true,
				description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: { loadOptionsMethod: 'getCallTags' },
				displayOptions: { show: { resource: ['callLog'], operation: ['addCallTag'] } },
			},

			// ── Callback ──────────────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['callback'] } },
				default: 'dialAgent',
				options: [
					{ name: 'Dial Agent', value: 'dialAgent', action: 'Request a callback to an agent extension' },
					{ name: 'Dial Team', value: 'dialTeam', action: 'Request a callback to a team queue' },
				],
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
					{ name: 'Call Initiated', value: 'call_initiated' },
					{ name: 'Call IVR Option Selected (Coming Soon)', value: 'ivr_option_selected' },
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
					{ name: 'Send WhatsApp', value: 'sendWhatsapp', action: 'Send a whats app message' },
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
				displayName: 'Sender Name or ID',
				name: 'whatsappSender',
				type: 'options',
				default: '',
				required: true,
				description: 'WhatsApp sender number to send from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getWhatsappSenders' },
				displayOptions: { show: { resource: ['message'], operation: ['sendWhatsapp'] } },
			},
			{
				displayName: 'Template Name or ID',
				name: 'whatsappTemplate',
				type: 'options',
				default: '',
				required: true,
				description: 'Approved WhatsApp template to send. WhatsApp does not allow free-form messages. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getWhatsappTemplates' },
				displayOptions: { show: { resource: ['message'], operation: ['sendWhatsapp'] } },
			},
			{
				displayName: 'Template Variables',
				name: 'whatsappTemplateVariables',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				default: {},
				placeholder: 'Add Variable',
				description: 'Values for the template placeholders. The Key must match the placeholder in the template body — numeric ({{1}}, {{2}}) or named ({{first_name}}). Leave empty if the template has none.',
				displayOptions: { show: { resource: ['message'], operation: ['sendWhatsapp'] } },
				options: [
					{
						name: 'variable',
						displayName: 'Variable',
						values: [
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								placeholder: 'e.g. 1 or first_name',
								description: 'Placeholder key as it appears between {{ }} in the template',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
							},
						],
					},
				],
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
					{ name: 'Get Campaign Contacts', value: 'getCampaignContacts', action: 'Get contacts in a campaign' },
					{ name: 'Get Campaign Stats', value: 'getCampaignStats', action: 'Get stats for a campaign' },
					{ name: 'Get Many Campaigns', value: 'getCampaigns', action: 'Get all campaigns' },
				],
			},
			{
				displayName: 'Page',
				name: 'campaignsPage',
				type: 'number',
				default: 1,
				description: 'Page number to retrieve (15 campaigns per page)',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCampaigns'] } },
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
						operation: ['getCampaignContacts', 'getCampaignStats', 'addCampaignContact'],
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

		],
		usableAsTool: true,
	};

	methods = {
		loadOptions: {
			async getCallTags(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
					method: 'GET',
					url: `${NUACOM_BASE_URL}/v3/call-tags/all-parent-child`,
					
					json: true,
				});
				const tags = (Array.isArray(response) ? response : []) as Array<{ id: number; name: string }>;
				return (tags as Array<{ id: number; name: string }>).map((t) => ({ name: t.name, value: t.id }));
			},

			async getWhatsappTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// status=1 → only Approved templates; WhatsApp rejects sending non-approved ones
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
					method: 'GET',
					url: `${NUACOM_BASE_URL}/v2/integrations/whatsapp/templates`,
					qs: { status: 1, per_page: 100 },
					json: true,
				});
				const templates = (response as { data?: Array<{ id: number; name: string; language?: string }> }).data ?? [];
				return templates.map((t) => ({
					name: t.language ? `${t.name} (${t.language})` : t.name,
					value: t.id,
				}));
			},

			async getWhatsappSenders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
					method: 'GET',
					url: `${NUACOM_BASE_URL}/v2/integrations/whatsapp`,
					json: true,
				});
				const numbers = (response as { data?: { phone_numbers?: Array<{ phone_number: string; display_name?: string; status?: string }> } }).data?.phone_numbers ?? [];
				return numbers
					.filter((n) => n.status === 'Approved')
					.map((n) => ({
						name: n.display_name ? `${n.phone_number} (${n.display_name})` : n.phone_number,
						value: n.phone_number,
					}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const resource = this.getNodeParameter('resource', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;

			let responseData: unknown;

			try {
				if (resource === 'contact') {
					if (operation === 'getAll') {
						const perPage = this.getNodeParameter('perPage', i) as number;
						const page = this.getNodeParameter('page', i) as number;
						const phone = getTrimmedParam(this, 'contactPhone', i);
						const contactFilterIds = getTrimmedParam(this, 'contactFilterIds', i);
						const contactSearch = getTrimmedParam(this, 'contactSearch', i);
						const qs: Record<string, string | number> = { page, perPage };
						if (phone) qs['filter[phone]'] = phone;
						if (contactFilterIds) {
							// API expects contact_ids as an array, so send each id as an indexed key
							contactFilterIds
								.split(',')
								.map((id) => id.trim())
								.filter((id) => id !== '')
								.forEach((id, idx) => {
									qs[`filter[contact_ids][${idx}]`] = id;
								});
						}
						if (contactSearch) qs['filter[search]'] = contactSearch;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/contacts`,
							qs,
							json: true,
						});
					} else if (operation === 'get') {
						const contactId = this.getNodeParameter('contactId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/contacts/${contactId}`,
							json: true,
						});
					} else if (operation === 'create') {
						const firstName = getTrimmedParam(this, 'firstName', i);
						const lastName = getTrimmedParam(this, 'lastName', i);
						const phone = getTrimmedParam(this, 'phone', i);
						const email = getTrimmedParam(this, 'email', i);
						const body: Record<string, unknown> = {};
						if (firstName) body.first_name = firstName;
						if (lastName) body.last_name = lastName;
						if (phone) body.phones = [phone];
						if (email) body.email = email;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/contacts`,
							body,
							json: true,
						});
					} else if (operation === 'update') {
						const contactId = this.getNodeParameter('contactId', i) as string;
						const firstName = getTrimmedParam(this, 'firstName', i);
						const lastName = getTrimmedParam(this, 'lastName', i);
						const phone = getTrimmedParam(this, 'phone', i);
						const email = getTrimmedParam(this, 'email', i);
						const body: Record<string, unknown> = {};
						if (firstName) body.first_name = firstName;
						if (lastName) body.last_name = lastName;
						if (phone) body.phones = [phone];
						if (email) body.email = email;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'PUT',
							url: `${NUACOM_BASE_URL}/v2/contacts/${contactId}`,
							body,
							json: true,
						});
					} else if (operation === 'delete') {
						const contactId = this.getNodeParameter('contactId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'DELETE',
							url: `${NUACOM_BASE_URL}/v2/contacts/${contactId}`,
							json: true,
						});
					}
				} else if (resource === 'callLog') {
					if (operation === 'getAll') {
						const qs: IDataObject = {
							page: this.getNodeParameter('callLogPage', i) as number,
							per_page: this.getNodeParameter('callLogPerPage', i) as number,
						};
						const dateFrom = getTrimmedParam(this, 'callLogDateFrom', i);
						const dateTo = getTrimmedParam(this, 'callLogDateTo', i);
						const callType = this.getNodeParameter('callLogType', i) as string;
						const extension = getTrimmedParam(this, 'callLogExtension', i);
						const queue = getTrimmedParam(this, 'callLogQueue', i);
						const number = getTrimmedParam(this, 'callLogNumber', i);
						if (dateFrom) qs.from_date = dateFrom;
						if (dateTo) qs.to_date = dateTo;
						if (callType) qs.type = callType;
						if (extension) qs.extensions = extension;
						if (queue) qs.queues = queue;
						if (number) qs.number = number;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/call-log`,
							qs,
							json: true,
						});
					} else if (operation === 'get') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/call-logs/${callId}`,
							json: true,
						});
					} else if (operation === 'downloadRecording') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/call-recording/${callId}`,
						});
					} else if (operation === 'addNote') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/call-notes`,
							body: {
								callId,
								note: this.getNodeParameter('noteText', i) as string,
							},
							json: true,
						});
					} else if (operation === 'addCallTag') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/add-call-tag`,
							body: {
								call_id: callId,
								tag_info_id: this.getNodeParameter('callTagId', i) as number,
							},
							json: true,
						});
					} else if (operation === 'getCallAiData') {
						const callId = this.getNodeParameter('callId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/calls/${callId}/ai-data`,
							json: true,
						});
					}
				} else if (resource === 'callback') {
					// Coerce to string — the API requires from_number/dst_number as strings,
					// but trigger expressions can resolve to a number (e.g. extension 40).
					const fromNumber = operation === 'dialAgent'
						? getTrimmedParam(this, 'callbackExtension', i)
						: getTrimmedParam(this, 'callbackQueue', i);
					responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
						method: 'POST',
						url: `${NUACOM_BASE_URL}/v2/request-callback`,
						body: {
							method: operation === 'dialAgent' ? 'extension' : 'queue',
							from_number: fromNumber,
							dst_number: getTrimmedParam(this, 'dstNumber', i),
						},
						json: true,
					});
				} else if (resource === 'extension') {
					responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
						method: 'GET',
						url: `${NUACOM_BASE_URL}/v2/extensions`,
						json: true,
					});
				} else if (resource === 'sms') {
					const body = {
						from: this.getNodeParameter('smsFrom', i) as string,
						to: [{ number: this.getNodeParameter('smsTo', i) as string }],
						message: this.getNodeParameter('smsMessage', i) as string,
					};
					responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
						method: 'POST',
						url: `${NUACOM_BASE_URL}/v2/sms/send`,
						body,
						json: true,
					});
				} else if (resource === 'webhookSubscription') {
					if (operation === 'getAll') {
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions`,
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
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions`,
							body: {
								type: webhookType,
								url: this.getNodeParameter('webhookUrl', i) as string,
							},
							json: true,
						});
					} else if (operation === 'delete') {
						const subscriptionId = this.getNodeParameter('subscriptionId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'DELETE',
							url: `${NUACOM_BASE_URL}/v2/webhook-subscriptions/${subscriptionId}`,
							json: true,
						});
					}
				} else if (resource === 'message') {
					if (operation === 'sendWhatsapp') {
						const metadata: { template_id: number; template_variables?: Record<string, string> } = {
							template_id: this.getNodeParameter('whatsappTemplate', i) as number,
						};
						const variablesInput = this.getNodeParameter(
							'whatsappTemplateVariables.variable',
							i,
							[],
						) as Array<{ key: string; value: string }>;
						if (variablesInput.length > 0) {
							// Twilio Content API expects ContentVariables as an object keyed by the
							// template placeholder ({{1}} or {{name}}), so map each Key → Value.
							const templateVariables: Record<string, string> = {};
							variablesInput.forEach((v) => {
								const key = String(v.key ?? '').trim();
								if (key !== '') {
									templateVariables[key] = String(v.value ?? '');
								}
							});
							if (Object.keys(templateVariables).length > 0) {
								metadata.template_variables = templateVariables;
							}
						}
						const body = {
							channel_type: 2, // WhatsApp
							sender_id: this.getNodeParameter('whatsappSender', i) as string,
							participants: [
								{
									participant_type: 'phone_number',
									participant_id: getTrimmedParam(this, 'messageTo', i),
								},
							],
							message: { metadata },
						};
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/conversations`,
							body,
							json: true,
						});
					} else if (operation === 'get') {
						const messageId = this.getNodeParameter('messageId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/conversations/messages/${messageId}`,
							json: true,
						});
					} else if (operation === 'getConversation') {
						const conversationId = this.getNodeParameter('conversationId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/conversations/${conversationId}`,
							json: true,
						});
					}
				} else if (resource === 'autoDialer') {
					if (operation === 'getCampaigns') {
						// Endpoint is paginated at a fixed 15/page (per_page is ignored).
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaigns`,
							qs: { page: this.getNodeParameter('campaignsPage', i) as number },
							json: true,
						});
					} else if (operation === 'getCampaignStats') {
						const campaignId = this.getNodeParameter('campaignId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaigns/${campaignId}/stats`,
							json: true,
						});
					} else if (operation === 'getCampaignContacts') {
						const campaignId = this.getNodeParameter('campaignId', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'GET',
							url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaign/${campaignId}/numbers`,
							json: true,
						});
					} else if (operation === 'addCampaignContact') {
						const campaignId = this.getNodeParameter('campaignId', i) as string;
						const contactNumber = this.getNodeParameter('contactNumber', i) as string;
						responseData = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
							method: 'POST',
							url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaign/${campaignId}/numbers`,
							body: { number: contactNumber },
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
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}

			const rawItems = Array.isArray(responseData)
				? responseData
				: ((responseData as { data?: unknown }).data ?? responseData);
			const items2: unknown[] = Array.isArray(rawItems) ? rawItems : [rawItems];

			returnData.push(
				...items2.map((item) => ({ json: item as IDataObject, pairedItem: i })),
			);
		}

		return [returnData];
	}
}
