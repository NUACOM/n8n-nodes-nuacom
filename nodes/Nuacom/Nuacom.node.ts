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

/**
 * Fetch every page of a Laravel-paginated collection (data + meta.last_page),
 * so dropdowns list all records instead of silently stopping at the first
 * page. Capped at 20 pages (2,000 records at per_page=100) as a runaway guard
 * in case the API ever stops reporting last_page.
 */
async function fetchAllPages<T>(
	ctx: ILoadOptionsFunctions,
	url: string,
	qs: IDataObject,
): Promise<T[]> {
	const items: T[] = [];
	const maxPages = 20;
	let lastPage = 1;

	for (let page = 1; page <= Math.min(lastPage, maxPages); page++) {
		const response = (await ctx.helpers.httpRequestWithAuthentication.call(ctx, 'nuacomApi', {
			method: 'GET',
			url,
			qs: { ...qs, page },
			json: true,
		})) as { data?: T[]; meta?: { last_page?: number } };

		items.push(...(response.data ?? []));
		lastPage = response.meta?.last_page ?? 1;
	}

	return items;
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
				default: 'calls',
				options: [
					{ name: 'Auto Dialer', value: 'autoDialer' },
					{ name: 'Call', value: 'calls' },
					{ name: 'Contact', value: 'contacts' },
					{ name: 'Message', value: 'messages' },
					{ name: 'NUACOM AI', value: 'nuacomAi' },
				],
			},

			// ══ Calls ═══════════════════════════════════════════════════════════
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['calls'] } },
				default: 'getAll',
				options: [
					{ name: 'Add Note', value: 'addNote', action: 'Add a note to a call' },
					{ name: 'Add Tag', value: 'addTag', action: 'Add a tag to a call' },
					{ name: 'Dial a Team', value: 'dialTeam', action: 'Make a call to a queue' },
					{ name: 'Dial an Agent', value: 'dialAgent', action: 'Make a call to an agent' },
					{ name: 'Download Call Recording', value: 'downloadRecording', action: 'Download the recording of a completed call' },
					{ name: 'Get', value: 'get', action: 'Retrieve a specific call by ID' },
					{ name: 'Get Many', value: 'getAll', action: 'List and filter calls with pagination support' },
				],
			},
			{
				displayName: 'Call ID',
				name: 'callId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['calls'], operation: ['get', 'addNote', 'addTag', 'downloadRecording'] } },
			},
			// Calls — Get Many filters
			{
				displayName: 'Date From',
				name: 'callsDateFrom',
				type: 'string',
				default: '',
				placeholder: 'YYYY-MM-DD or YYYY-MM-DD HH:MM:SS',
				description: 'Return calls on or after this point. A bare date (YYYY-MM-DD) is treated as the start of that day; a full datetime is honored as-is.',
				displayOptions: { show: { resource: ['calls'], operation: ['getAll'] } },
			},
			{
				displayName: 'Date To',
				name: 'callsDateTo',
				type: 'string',
				default: '',
				placeholder: 'YYYY-MM-DD or YYYY-MM-DD HH:MM:SS',
				description: 'Return calls on or before this point. A bare date (YYYY-MM-DD) is treated as the end of that day; a full datetime is honored as-is.',
				displayOptions: { show: { resource: ['calls'], operation: ['getAll'] } },
			},
			{
				displayName: 'Type',
				name: 'callsType',
				type: 'options',
				default: '',
				description: 'Filter by call type',
				displayOptions: { show: { resource: ['calls'], operation: ['getAll'] } },
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
				name: 'callsExtension',
				type: 'string',
				default: '',
				description: 'Filter by extension number. Leave empty for all.',
				displayOptions: { show: { resource: ['calls'], operation: ['getAll'] } },
			},
			{
				displayName: 'Queue',
				name: 'callsQueue',
				type: 'string',
				default: '',
				description: 'Filter by queue name or number. Leave empty for all.',
				displayOptions: { show: { resource: ['calls'], operation: ['getAll'] } },
			},
			{
				displayName: 'Number',
				name: 'callsNumber',
				type: 'string',
				default: '',
				description: 'Filter by phone number (caller or callee). Leave empty for all.',
				displayOptions: { show: { resource: ['calls'], operation: ['getAll'] } },
			},
			{
				displayName: 'Page',
				name: 'callsPage',
				type: 'number',
				default: 1,
				displayOptions: { show: { resource: ['calls'], operation: ['getAll'] } },
			},
			{
				displayName: 'Per Page',
				name: 'callsPerPage',
				type: 'number',
				default: 25,
				displayOptions: { show: { resource: ['calls'], operation: ['getAll'] } },
			},
			// Calls — Add Note
			{
				displayName: 'Note',
				name: 'callNote',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				description: 'Note text to add to the call',
				displayOptions: { show: { resource: ['calls'], operation: ['addNote'] } },
			},
			// Calls — Add Tag
			{
				displayName: 'Tag Name or ID',
				name: 'callTagId',
				type: 'options',
				default: '',
				required: true,
				description: 'Tag to add to the call. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getCallTags' },
				displayOptions: { show: { resource: ['calls'], operation: ['addTag'] } },
			},
			// Calls — Dial an Agent / Dial a Team
			{
				displayName: 'Extension',
				name: 'dialExtension',
				type: 'string',
				default: '',
				required: true,
				description: "Agent's extension number to initiate the call from",
				displayOptions: { show: { resource: ['calls'], operation: ['dialAgent'] } },
			},
			{
				displayName: 'Queue Number',
				name: 'dialQueue',
				type: 'string',
				default: '',
				required: true,
				description: 'Queue number to initiate the call from',
				displayOptions: { show: { resource: ['calls'], operation: ['dialTeam'] } },
			},
			{
				displayName: 'Destination Number',
				name: 'dstNumber',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				description: "Customer's phone number to call, in E.164 format",
				displayOptions: { show: { resource: ['calls'], operation: ['dialAgent', 'dialTeam'] } },
			},

			// ══ Messages ════════════════════════════════════════════════════════
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['messages'] } },
				default: 'send',
				options: [
					{ name: 'Add or Update a Conversation Assignee', value: 'assignConversation', action: 'Add or update a conversation assignee' },
					{ name: 'Get', value: 'get', action: 'Retrieve a specific SMS by ID' },
					{ name: 'Get Conversation', value: 'getConversation', action: 'Retrieve all messages from a customer conversation' },
					{ name: 'Get Many', value: 'getAll', action: 'List and filter messages' },
					{ name: 'Send', value: 'send', action: 'Send an SMS message' },
					{ name: 'Send WhatsApp Message', value: 'sendWhatsappMessage', action: 'Send a whats app free form message' },
					{ name: 'Send WhatsApp Template', value: 'sendWhatsapp', action: 'Send a whats app template message' },
				],
			},
			// Messages — Send (SMS)
			{
				displayName: 'From Name or ID',
				name: 'smsFrom',
				type: 'options',
				default: '',
				required: true,
				description: 'Sender name or number to send from (must be an approved sender on your account). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getSmsSenders' },
				displayOptions: { show: { resource: ['messages'], operation: ['send'] } },
			},
			{
				displayName: 'To',
				name: 'smsTo',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				displayOptions: { show: { resource: ['messages'], operation: ['send'] } },
			},
			{
				displayName: 'Template Name or ID',
				name: 'smsTemplate',
				type: 'options',
				default: '',
				description: 'Approved 10DLC campaign template. Required to deliver to USA numbers — US carriers reject A2P SMS without an approved 10DLC campaign (toll-free senders are exempt). Leave as "None" for non-US destinations. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getSmsTemplates' },
				displayOptions: { show: { resource: ['messages'], operation: ['send'] } },
			},
			// The Message field appears as required until a template is selected,
			// then as optional (empty → the template's text is sent). n8n cannot
			// toggle `required` on one field, so two variants are shown/hidden on
			// the smsTemplate value; the execute path picks whichever is active.
			{
				displayName: 'Message',
				name: 'smsMessage',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'The text that is sent',
				displayOptions: { show: { resource: ['messages'], operation: ['send'], smsTemplate: [''] } },
			},
			{
				displayName: 'Message',
				name: 'smsMessageWithTemplate',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: "Leave empty to send the selected template's text",
				displayOptions: {
					show: { resource: ['messages'], operation: ['send'] },
					hide: { smsTemplate: [''] },
				},
			},
			// Messages — Send WhatsApp (shared between template and free-form)
			{
				displayName: 'To',
				name: 'messageTo',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				description: 'Recipient phone number',
				displayOptions: { show: { resource: ['messages'], operation: ['sendWhatsapp', 'sendWhatsappMessage'] } },
			},
			{
				displayName: 'Sender Name or ID',
				name: 'whatsappSender',
				type: 'options',
				default: '',
				required: true,
				description: 'WhatsApp sender number to send from. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getWhatsappSenders' },
				displayOptions: { show: { resource: ['messages'], operation: ['sendWhatsapp', 'sendWhatsappMessage'] } },
			},
			// Messages — Send WhatsApp Template
			{
				displayName: 'Template Name or ID',
				name: 'whatsappTemplate',
				type: 'options',
				default: '',
				required: true,
				description: 'Approved WhatsApp template to send. Templates are required outside the 24-hour Customer Service Window. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getWhatsappTemplates' },
				displayOptions: { show: { resource: ['messages'], operation: ['sendWhatsapp'] } },
			},
			{
				displayName: 'Template Variables',
				name: 'whatsappTemplateVariables',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				default: {},
				placeholder: 'Add Variable',
				description: 'Values for the template placeholders. The Key must match the placeholder in the template body — numeric ({{1}}, {{2}}) or named ({{first_name}}). Leave empty if the template has none.',
				displayOptions: { show: { resource: ['messages'], operation: ['sendWhatsapp'] } },
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
			// Messages — Send WhatsApp Message (free-form)
			{
				displayName: 'Message',
				name: 'whatsappMessageText',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: "Free-form text to send. Required unless a Media URL option is set — leave empty to send the media without a caption. WhatsApp only delivers free-form messages while the 24-hour Customer Service Window is open (the customer wrote within the last 24 hours) — outside it, use the Send WhatsApp Template operation.",
				displayOptions: { show: { resource: ['messages'], operation: ['sendWhatsappMessage'] } },
			},
			{
				displayName: 'Options',
				name: 'whatsappMessageOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { resource: ['messages'], operation: ['sendWhatsappMessage'] } },
				options: [
					{
						displayName: 'Location Label',
						name: 'locationLabel',
						type: 'string',
						default: '',
						description: 'Optional name shown on the location pin (e.g. the venue name)',
					},
					{
						displayName: 'Location Latitude',
						name: 'locationLatitude',
						type: 'number',
						default: 0,
						typeOptions: { numberPrecision: 7, minValue: -90, maxValue: 90 },
						description: 'Latitude of a location pin to attach. Requires Location Longitude as well.',
					},
					{
						displayName: 'Location Longitude',
						name: 'locationLongitude',
						type: 'number',
						default: 0,
						typeOptions: { numberPrecision: 7, minValue: -180, maxValue: 180 },
						description: 'Longitude of a location pin to attach. Requires Location Latitude as well.',
					},
					{
						displayName: 'Media URL',
						name: 'mediaUrl',
						type: 'string',
						default: '',
						description: 'Public URL of an image, video, audio file or document to attach (jpeg, png, mp4, mp3, pdf, docx, …)',
					},
				],
			},
			// Messages — Add or Update a Conversation Assignee
			{
				displayName: 'ID Type',
				name: 'assignIdType',
				type: 'options',
				options: [
					{ name: 'Conversation ID', value: 'conversation' },
					{ name: 'Message ID', value: 'message' },
				],
				default: 'conversation',
				description: "Whether the ID below is a conversation ID or a message ID (the message's conversation is resolved automatically)",
				displayOptions: { show: { resource: ['messages'], operation: ['assignConversation'] } },
			},
			{
				displayName: 'Conversation ID',
				name: 'assignConversationId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['messages'], operation: ['assignConversation'], assignIdType: ['conversation'] } },
			},
			{
				displayName: 'Message ID',
				name: 'assignMessageId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['messages'], operation: ['assignConversation'], assignIdType: ['message'] } },
			},
			{
				displayName: 'Assignee Name or ID',
				name: 'conversationAssignee',
				type: 'options',
				default: '',
				required: true,
				description: 'User or group to assign the conversation to — handy to hand a conversation over to a human. Requires an account-admin API token. As an expression, use the form user:123, group:5 or unassign. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				typeOptions: { loadOptionsMethod: 'getConversationAssignees' },
				displayOptions: { show: { resource: ['messages'], operation: ['assignConversation'] } },
			},
			// Messages — Get
			{
				displayName: 'Message ID',
				name: 'messageId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['messages'], operation: ['get'] } },
			},
			// Messages — Get Conversation
			{
				displayName: 'Conversation ID',
				name: 'conversationId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['messages'], operation: ['getConversation'] } },
			},
			// Messages — Get Many
			{
				displayName: 'Search',
				name: 'messagesFilter',
				type: 'string',
				default: '',
				placeholder: 'e.g. text or a phone number',
				description: 'Filter messages by content or number. Leave empty for all.',
				displayOptions: { show: { resource: ['messages'], operation: ['getAll'] } },
			},
			{
				displayName: 'Page',
				name: 'messagesPage',
				type: 'number',
				default: 1,
				displayOptions: { show: { resource: ['messages'], operation: ['getAll'] } },
			},
			{
				displayName: 'Per Page',
				name: 'messagesPageSize',
				type: 'number',
				default: 25,
				displayOptions: { show: { resource: ['messages'], operation: ['getAll'] } },
			},

			// ══ Contacts ════════════════════════════════════════════════════════
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['contacts'] } },
				default: 'getAll',
				options: [
					{ name: 'Create', value: 'create', action: 'Create a new contact' },
					{ name: 'Get', value: 'get', action: 'Retrieve a specific contact' },
					{ name: 'Get Many', value: 'getAll', action: 'List and filter contacts' },
					{ name: 'Update', value: 'update', action: 'Update an existing contact' },
				],
			},
			{
				displayName: 'Contact ID',
				name: 'contactId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['contacts'], operation: ['get', 'update'] } },
			},
			{
				displayName: 'First Name',
				name: 'firstName',
				type: 'string',
				default: '',
				description: 'At least one of First Name or Last Name is required',
				displayOptions: { show: { resource: ['contacts'], operation: ['create', 'update'] } },
			},
			{
				displayName: 'Last Name',
				name: 'lastName',
				type: 'string',
				default: '',
				description: 'At least one of First Name or Last Name is required',
				displayOptions: { show: { resource: ['contacts'], operation: ['create', 'update'] } },
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['contacts'], operation: ['create', 'update'] } },
			},
			{
				displayName: 'Email',
				name: 'email',
				type: 'string',
				placeholder: 'name@email.com',
				default: '',
				displayOptions: { show: { resource: ['contacts'], operation: ['create', 'update'] } },
			},
			{
				displayName: 'Per Page',
				name: 'perPage',
				type: 'options',
				default: 50,
				description: 'Number of results per page',
				displayOptions: { show: { resource: ['contacts'], operation: ['getAll'] } },
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
				displayOptions: { show: { resource: ['contacts'], operation: ['getAll'] } },
			},
			{
				displayName: 'Phone',
				name: 'contactPhone',
				type: 'string',
				default: '',
				placeholder: 'e.g. 353861234567',
				description: 'Filter by phone number (any type — mobile or landline), matched as a substring of the stored digits. Formatting like +, spaces, or a leading 00 is ignored. Leave empty for all.',
				displayOptions: { show: { resource: ['contacts'], operation: ['getAll'] } },
			},
			{
				displayName: 'Contact IDs',
				name: 'contactFilterIds',
				type: 'string',
				default: '',
				placeholder: 'e.g. 1,2,3',
				description: 'Filter by one or more contact IDs, comma-separated. Leave empty for all.',
				displayOptions: { show: { resource: ['contacts'], operation: ['getAll'] } },
			},
			{
				displayName: 'Name',
				name: 'contactSearch',
				type: 'string',
				default: '',
				placeholder: 'e.g. John',
				description: 'Filter contacts by name. Leave empty for all.',
				displayOptions: { show: { resource: ['contacts'], operation: ['getAll'] } },
			},

			// ══ Auto Dialer ═════════════════════════════════════════════════════
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['autoDialer'] } },
				default: 'getCampaigns',
				options: [
					{ name: 'Add Contact to Campaign', value: 'addCampaignContact', action: 'Add a contact to an auto dialer campaign' },
					{ name: 'Get a Campaign', value: 'getCampaign', action: 'Get a specific auto dialer campaign by ID' },
					{ name: 'List All Calls', value: 'getCalls', action: 'List all auto dialer calls' },
					{ name: 'List All Campaigns', value: 'getCampaigns', action: 'List all auto dialer campaigns' },
					{ name: 'List Campaign Contacts', value: 'getCampaignContacts', action: 'List contacts in an auto dialer campaign' },
				],
			},
			// Auto Dialer — List All Calls filters
			{
				displayName: 'Campaign ID',
				name: 'adCallsCampaignId',
				type: 'string',
				default: '',
				description: 'Filter calls by campaign ID. Leave empty for all campaigns.',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCalls'] } },
			},
			{
				displayName: 'Agent Extension',
				name: 'adCallsAgent',
				type: 'string',
				default: '',
				description: "Filter by the campaign's assigned agent extension. Leave empty for all.",
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCalls'] } },
			},
			{
				displayName: 'Status',
				name: 'adCallsStatus',
				type: 'options',
				default: '',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCalls'] } },
				options: [
					{ name: 'Answered', value: 'answered' },
					{ name: 'Any', value: '' },
					{ name: 'In Progress', value: 'in_progress' },
					{ name: 'Initial', value: 'initial' },
					{ name: 'Not Answered', value: 'not_answered' },
					{ name: 'Voicemail', value: 'voicemail' },
				],
			},
			{
				displayName: 'Date From',
				name: 'adCallsDateFrom',
				type: 'string',
				default: '',
				placeholder: 'YYYY-MM-DD or YYYY-MM-DD HH:MM:SS',
				description: 'A bare date is treated as the start of that day; a full datetime is honored as-is',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCalls'] } },
			},
			{
				displayName: 'Date To',
				name: 'adCallsDateTo',
				type: 'string',
				default: '',
				placeholder: 'YYYY-MM-DD or YYYY-MM-DD HH:MM:SS',
				description: 'A bare date is treated as the end of that day; a full datetime is honored as-is',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCalls'] } },
			},
			{
				displayName: 'Per Page',
				name: 'adCallsPerPage',
				type: 'number',
				default: 50,
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCalls'] } },
			},
			// Auto Dialer — List All Campaigns (status filter)
			{
				displayName: 'Status',
				name: 'adCampaignStatus',
				type: 'options',
				default: '',
				description: 'Filter campaigns by status. Leave as "Any" to receive all. (The field also accepts an expression if your account uses a custom status.)',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCampaigns'] } },
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Done', value: 'done' },
					{ name: 'Initial', value: 'initial' },
					{ name: 'Not Running', value: 'not-running' },
					{ name: 'Running', value: 'running' },
				],
			},
			{
				displayName: 'Page',
				name: 'adCampaignsPage',
				type: 'number',
				default: 1,
				displayOptions: { show: { resource: ['autoDialer'], operation: ['getCampaigns'] } },
			},
			// Auto Dialer — campaign id (get / contacts / add contact)
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
			// Auto Dialer — Add Contact to Campaign
			{
				displayName: 'Add By',
				name: 'addContactBy',
				type: 'options',
				default: 'number',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['addCampaignContact'] } },
				options: [
					{ name: 'Contact ID', value: 'contactId' },
					{ name: 'Phone Number', value: 'number' },
				],
			},
			{
				displayName: 'Contact Number',
				name: 'contactNumber',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+353871234567',
				description: 'Phone number in E.164 format',
				displayOptions: { show: { resource: ['autoDialer'], operation: ['addCampaignContact'], addContactBy: ['number'] } },
			},
			{
				displayName: 'Contact ID',
				name: 'addContactId',
				type: 'string',
				default: '',
				required: true,
				description: "An existing contact; its phone number is resolved and added to the campaign",
				displayOptions: { show: { resource: ['autoDialer'], operation: ['addCampaignContact'], addContactBy: ['contactId'] } },
			},

			// ══ NUACOM AI ═══════════════════════════════════════════════════════
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['nuacomAi'] } },
				default: 'getCallAiData',
				options: [
					{ name: 'Get Call AI Data', value: 'getCallAiData', action: 'Get an AI generated analysis for a specific call' },
					{ name: 'List Calls AI Data', value: 'listCallsAiData', action: 'List AI generated analysis for calls' },
				],
			},
			{
				displayName: 'Call ID',
				name: 'aiCallId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['nuacomAi'], operation: ['getCallAiData'] } },
			},
			{
				displayName: 'Date From',
				name: 'aiDateFrom',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'YYYY-MM-DD HH:MM:SS',
				description: 'Start of the period, as a datetime (e.g. 2026-06-01 00:00:00). The range may not exceed 31 days.',
				displayOptions: { show: { resource: ['nuacomAi'], operation: ['listCallsAiData'] } },
			},
			{
				displayName: 'Date To',
				name: 'aiDateTo',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'YYYY-MM-DD HH:MM:SS',
				description: 'End of the period, as a datetime (e.g. 2026-06-30 23:59:59). The range may not exceed 31 days.',
				displayOptions: { show: { resource: ['nuacomAi'], operation: ['listCallsAiData'] } },
			},
			{
				displayName: 'Page',
				name: 'aiPage',
				type: 'number',
				default: 1,
				displayOptions: { show: { resource: ['nuacomAi'], operation: ['listCallsAiData'] } },
			},
			{
				displayName: 'Per Page',
				name: 'aiPerPage',
				type: 'number',
				default: 25,
				displayOptions: { show: { resource: ['nuacomAi'], operation: ['listCallsAiData'] } },
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
				return tags.map((t) => ({ name: t.name, value: t.id }));
			},

			async getWhatsappTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// status=1 → only Approved templates; WhatsApp rejects sending non-approved ones
				const templates = await fetchAllPages<{ id: number; name: string; language?: string }>(
					this,
					`${NUACOM_BASE_URL}/v2/integrations/whatsapp/templates`,
					{ status: 1, per_page: 100 },
				);
				return templates.map((t) => ({
					name: t.language ? `${t.name} (${t.language})` : t.name,
					value: t.id,
				}));
			},

			async getSmsTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Same endpoint the web portal uses. Its filters default to
				// channel=SMS and status=Approved, so WhatsApp and unapproved
				// templates are excluded without extra parameters.
				const templates = await fetchAllPages<{ id: number; name: string }>(
					this,
					`${NUACOM_BASE_URL}/v2/sms-templates`,
					{ sort: 'name', per_page: 100 },
				);
				return [
					{ name: 'None', value: '' },
					...templates.map((t) => ({ name: t.name, value: t.id })),
				];
			},

			async getSmsSenders(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Returns the account's approved SMS sender names/numbers — the
				// same set the send endpoint validates `from` against. Endpoint
				// responds with a plain array, not a paginated wrapper.
				const response = await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
					method: 'GET',
					url: `${NUACOM_BASE_URL}/v2/sms/sender_names`,
					qs: { 'filter[channel]': 'sms' },
					json: true,
				});
				const senders = (Array.isArray(response) ? response : []) as Array<{ sender_name: string; is_default?: boolean }>;
				return senders.map((s) => ({
					name: s.is_default ? `${s.sender_name} (default)` : s.sender_name,
					value: s.sender_name,
				}));
			},

			async getConversationAssignees(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Groups are departments on the API side. Both endpoints return the
				// full set in one response (no pagination).
				const [usersResponse, departmentsResponse] = await Promise.all([
					this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
						method: 'GET',
						url: `${NUACOM_BASE_URL}/v2/users_list`,
						json: true,
					}),
					this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
						method: 'GET',
						url: `${NUACOM_BASE_URL}/v2/departments`,
						json: true,
					}),
				]);
				const users = (Array.isArray(usersResponse) ? usersResponse : []) as Array<{ user_id: string; user_name: string }>;
				const rawDepartments = (departmentsResponse as { data?: unknown }).data ?? departmentsResponse;
				const departments = (Array.isArray(rawDepartments) ? rawDepartments : []) as Array<{ id: number; name: string }>;
				const byName = (a: INodePropertyOptions, b: INodePropertyOptions) => a.name.localeCompare(b.name);
				return [
					{ name: 'Unassign', value: 'unassign' },
					...departments.map((d) => ({ name: `Group: ${d.name}`, value: `group:${d.id}` })).sort(byName),
					...users.map((u) => ({ name: `User: ${u.user_name}`, value: `user:${u.user_id}` })).sort(byName),
				];
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
				if (resource === 'calls') {
					responseData = await handleCalls.call(this, operation, i);
				} else if (resource === 'messages') {
					responseData = await handleMessages.call(this, operation, i);
				} else if (resource === 'contacts') {
					responseData = await handleContacts.call(this, operation, i);
				} else if (resource === 'autoDialer') {
					responseData = await handleAutoDialer.call(this, operation, i);
				} else if (resource === 'nuacomAi') {
					responseData = await handleNuacomAi.call(this, operation, i);
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

async function handleCalls(this: IExecuteFunctions, operation: string, i: number): Promise<unknown> {
	if (operation === 'getAll') {
		const qs: IDataObject = {
			page: this.getNodeParameter('callsPage', i) as number,
			per_page: this.getNodeParameter('callsPerPage', i) as number,
		};
		const dateFrom = getTrimmedParam(this, 'callsDateFrom', i);
		const dateTo = getTrimmedParam(this, 'callsDateTo', i);
		const callType = this.getNodeParameter('callsType', i) as string;
		const extension = getTrimmedParam(this, 'callsExtension', i);
		const queue = getTrimmedParam(this, 'callsQueue', i);
		const number = getTrimmedParam(this, 'callsNumber', i);
		if (dateFrom) qs.from_date = dateFrom;
		if (dateTo) qs.to_date = dateTo;
		if (callType) qs.type = callType;
		if (extension) qs.extensions = extension;
		if (queue) qs.queues = queue;
		if (number) qs.number = number;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/call-log`,
			qs,
			json: true,
		});
	}

	if (operation === 'get') {
		const callId = this.getNodeParameter('callId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/call-logs/${callId}`,
			json: true,
		});
	}

	if (operation === 'downloadRecording') {
		const callId = this.getNodeParameter('callId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/call-recording/${callId}`,
		});
	}

	if (operation === 'addNote') {
		const callId = this.getNodeParameter('callId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'POST',
			url: `${NUACOM_BASE_URL}/v2/call-notes`,
			body: { callId, note: this.getNodeParameter('callNote', i) as string },
			json: true,
		});
	}

	if (operation === 'addTag') {
		const callId = this.getNodeParameter('callId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'POST',
			url: `${NUACOM_BASE_URL}/v2/add-call-tag`,
			body: { call_id: callId, tag_info_id: Number(this.getNodeParameter('callTagId', i)) },
			json: true,
		});
	}

	if (operation === 'dialAgent' || operation === 'dialTeam') {
		// Coerce to string — the API requires from_number/dst_number as strings,
		// but expressions can resolve to a number (e.g. extension 40).
		const fromNumber = operation === 'dialAgent'
			? getTrimmedParam(this, 'dialExtension', i)
			: getTrimmedParam(this, 'dialQueue', i);
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'POST',
			url: `${NUACOM_BASE_URL}/v2/request-callback`,
			body: {
				method: operation === 'dialAgent' ? 'extension' : 'queue',
				from_number: fromNumber,
				dst_number: getTrimmedParam(this, 'dstNumber', i),
			},
			json: true,
		});
	}

	throw new NodeOperationError(this.getNode(), `Unknown Calls operation: ${operation}`, { itemIndex: i });
}

async function handleMessages(this: IExecuteFunctions, operation: string, i: number): Promise<unknown> {
	if (operation === 'send') {
		// Approved 10DLC campaign template — required for USA recipients.
		const smsTemplate = this.getNodeParameter('smsTemplate', i, '');
		const templateId =
			smsTemplate === '' || smsTemplate === null || smsTemplate === undefined
				? null
				: Number(smsTemplate);

		// Two Message field variants exist: required (no template) and optional
		// (template selected, empty → send the template's text).
		let message =
			templateId === null
				? getTrimmedParam(this, 'smsMessage', i)
				: getTrimmedParam(this, 'smsMessageWithTemplate', i);

		if (templateId !== null && message === '') {
			const template = (await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
				method: 'GET',
				url: `${NUACOM_BASE_URL}/v2/sms-templates/${templateId}`,
				json: true,
			})) as { message_text?: string; data?: { message_text?: string } };
			message = String(template.message_text ?? template.data?.message_text ?? '').trim();

			if (message === '') {
				throw new NodeOperationError(
					this.getNode(),
					'The selected template has no text — enter a message.',
					{ itemIndex: i },
				);
			}
			if (/\{\{[^}]*\}\}/.test(message)) {
				throw new NodeOperationError(
					this.getNode(),
					'The selected template contains placeholders (e.g. {{name}}), so its text cannot be sent as-is — enter the message with the placeholders filled in.',
					{ itemIndex: i },
				);
			}
		}

		if (message === '') {
			throw new NodeOperationError(this.getNode(), 'Message is required.', { itemIndex: i });
		}

		const body: { from: string; to: Array<{ number: string }>; message: string; template_id?: number } = {
			from: this.getNodeParameter('smsFrom', i) as string,
			to: [{ number: this.getNodeParameter('smsTo', i) as string }],
			message,
		};
		if (templateId !== null) {
			body.template_id = templateId;
		}
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'POST',
			url: `${NUACOM_BASE_URL}/v2/sms/send`,
			body,
			json: true,
		});
	}

	if (operation === 'sendWhatsapp') {
		const metadata: { template_id: number; template_variables?: Record<string, string> } = {
			template_id: this.getNodeParameter('whatsappTemplate', i) as number,
		};
		const variablesInput = this.getNodeParameter('whatsappTemplateVariables.variable', i, []) as Array<{ key: string; value: string }>;
		if (variablesInput.length > 0) {
			// Twilio Content API expects ContentVariables keyed by the template
			// placeholder ({{1}} or {{name}}), so map each Key → Value.
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
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'POST',
			url: `${NUACOM_BASE_URL}/v2/conversations`,
			body: {
				channel_type: 2, // WhatsApp
				sender_id: this.getNodeParameter('whatsappSender', i) as string,
				participants: [
					{
						participant_type: 'phone_number',
						participant_id: getTrimmedParam(this, 'messageTo', i),
					},
				],
				message: { metadata },
			},
			json: true,
		});
	}

	if (operation === 'sendWhatsappMessage') {
		const options = this.getNodeParameter('whatsappMessageOptions', i, {}) as {
			mediaUrl?: string;
			locationLatitude?: number;
			locationLongitude?: number;
			locationLabel?: string;
		};
		const content = getTrimmedParam(this, 'whatsappMessageText', i);
		const mediaUrl = String(options.mediaUrl ?? '').trim();
		if (content === '' && mediaUrl === '') {
			throw new NodeOperationError(
				this.getNode(),
				'Enter a Message, set a Media URL option, or both.',
				{ itemIndex: i },
			);
		}
		const message: IDataObject = {};
		if (content !== '') {
			message.content = content;
		}
		if (mediaUrl !== '') {
			message.content_url = mediaUrl;
		}
		const hasLatitude = options.locationLatitude !== undefined;
		const hasLongitude = options.locationLongitude !== undefined;
		if (hasLatitude !== hasLongitude) {
			throw new NodeOperationError(
				this.getNode(),
				'A location needs both Location Latitude and Location Longitude.',
				{ itemIndex: i },
			);
		}
		if (hasLatitude && hasLongitude) {
			const location: IDataObject = {
				latitude: options.locationLatitude,
				longitude: options.locationLongitude,
			};
			const label = String(options.locationLabel ?? '').trim();
			if (label !== '') {
				location.label = label;
			}
			message.metadata = { location };
		}
		try {
			return await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
				method: 'POST',
				url: `${NUACOM_BASE_URL}/v2/conversations`,
				body: {
					channel_type: 2, // WhatsApp
					sender_id: this.getNodeParameter('whatsappSender', i) as string,
					participants: [
						{
							participant_type: 'phone_number',
							participant_id: getTrimmedParam(this, 'messageTo', i),
						},
					],
					message,
				},
				json: true,
			});
		} catch (error) {
			// The API rejects free-form messages outside WhatsApp's 24-hour
			// Customer Service Window — surface that as a clear, actionable error.
			const errorBody = (error as { response?: { body?: unknown } }).response?.body ?? error;
			if (JSON.stringify(errorBody ?? '').includes('WHATSAPP_CSW_CLOSED')) {
				throw new NodeOperationError(
					this.getNode(),
					"The 24-hour Customer Service Window is closed for this recipient — WhatsApp only accepts free-form messages within 24 hours of the customer's last message. Use the Send WhatsApp Template operation instead.",
					{ itemIndex: i },
				);
			}
			throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
		}
	}

	if (operation === 'assignConversation') {
		const idType = this.getNodeParameter('assignIdType', i) as string;
		let conversationId: string;
		if (idType === 'message') {
			const assignMessageId = getTrimmedParam(this, 'assignMessageId', i);
			const info = (await this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
				method: 'GET',
				url: `${NUACOM_BASE_URL}/v2/conversations/messages/${assignMessageId}`,
				json: true,
			})) as { conversation_id?: number | string; data?: { conversation_id?: number | string } };
			const resolved = info.conversation_id ?? info.data?.conversation_id;
			if (resolved === undefined || resolved === null || String(resolved) === '') {
				throw new NodeOperationError(
					this.getNode(),
					`Could not resolve the conversation for message ${assignMessageId}.`,
					{ itemIndex: i },
				);
			}
			conversationId = String(resolved);
		} else {
			conversationId = getTrimmedParam(this, 'assignConversationId', i);
		}

		const assignee = getTrimmedParam(this, 'conversationAssignee', i);
		const body: { user_id: number | null; department_id: number | null } = {
			user_id: null,
			department_id: null,
		};
		if (assignee.startsWith('user:')) {
			body.user_id = Number(assignee.slice('user:'.length));
		} else if (assignee.startsWith('group:')) {
			body.department_id = Number(assignee.slice('group:'.length));
		} else if (assignee !== 'unassign') {
			throw new NodeOperationError(
				this.getNode(),
				`Unrecognized assignee "${assignee}" — use user:<ID>, group:<ID> or unassign.`,
				{ itemIndex: i },
			);
		}
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'PATCH',
			url: `${NUACOM_BASE_URL}/v2/conversations/${conversationId}/assign`,
			body,
			json: true,
		});
	}

	if (operation === 'get') {
		const messageId = this.getNodeParameter('messageId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/conversations/messages/${messageId}`,
			json: true,
		});
	}

	if (operation === 'getConversation') {
		const conversationId = this.getNodeParameter('conversationId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/conversations/${conversationId}`,
			json: true,
		});
	}

	if (operation === 'getAll') {
		const qs: IDataObject = {
			page: this.getNodeParameter('messagesPage', i) as number,
			pageSize: this.getNodeParameter('messagesPageSize', i) as number,
		};
		const filter = getTrimmedParam(this, 'messagesFilter', i);
		if (filter) qs.filter = filter;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/sms`,
			qs,
			json: true,
		});
	}

	throw new NodeOperationError(this.getNode(), `Unknown Messages operation: ${operation}`, { itemIndex: i });
}

async function handleContacts(this: IExecuteFunctions, operation: string, i: number): Promise<unknown> {
	if (operation === 'getAll') {
		const perPage = this.getNodeParameter('perPage', i) as number;
		const page = this.getNodeParameter('page', i) as number;
		const phone = getTrimmedParam(this, 'contactPhone', i);
		const contactFilterIds = getTrimmedParam(this, 'contactFilterIds', i);
		const contactSearch = getTrimmedParam(this, 'contactSearch', i);
		const qs: Record<string, string | number> = { page, perPage };
		if (phone) qs['filter[phone]'] = phone;
		if (contactFilterIds) {
			contactFilterIds
				.split(',')
				.map((id) => id.trim())
				.filter((id) => id !== '')
				.forEach((id, idx) => {
					qs[`filter[contact_ids][${idx}]`] = id;
				});
		}
		if (contactSearch) qs['filter[search]'] = contactSearch;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/contacts`,
			qs,
			json: true,
		});
	}

	if (operation === 'get') {
		const contactId = this.getNodeParameter('contactId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/contacts/${contactId}`,
			json: true,
		});
	}

	if (operation === 'create' || operation === 'update') {
		const firstName = getTrimmedParam(this, 'firstName', i);
		const lastName = getTrimmedParam(this, 'lastName', i);
		const phone = getTrimmedParam(this, 'phone', i);
		const email = getTrimmedParam(this, 'email', i);
		const body: Record<string, unknown> = {};
		if (firstName) body.first_name = firstName;
		if (lastName) body.last_name = lastName;
		if (phone) body.phones = [phone];
		if (email) body.email = email;

		if (operation === 'create') {
			return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
				method: 'POST',
				url: `${NUACOM_BASE_URL}/v2/contacts`,
				body,
				json: true,
			});
		}

		const contactId = this.getNodeParameter('contactId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'PUT',
			url: `${NUACOM_BASE_URL}/v2/contacts/${contactId}`,
			body,
			json: true,
		});
	}

	throw new NodeOperationError(this.getNode(), `Unknown Contacts operation: ${operation}`, { itemIndex: i });
}

async function handleAutoDialer(this: IExecuteFunctions, operation: string, i: number): Promise<unknown> {
	if (operation === 'getCalls') {
		const qs: IDataObject = { per_page: this.getNodeParameter('adCallsPerPage', i) as number };
		const campaignId = getTrimmedParam(this, 'adCallsCampaignId', i);
		const agent = getTrimmedParam(this, 'adCallsAgent', i);
		const status = this.getNodeParameter('adCallsStatus', i) as string;
		const dateFrom = getTrimmedParam(this, 'adCallsDateFrom', i);
		const dateTo = getTrimmedParam(this, 'adCallsDateTo', i);
		if (campaignId) qs.campaign_id = campaignId;
		if (agent) qs.agent = agent;
		if (status) qs.status = status;
		if (dateFrom) qs.date_from = dateFrom;
		if (dateTo) qs.date_to = dateTo;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/auto-dialer/calls`,
			qs,
			json: true,
		});
	}

	if (operation === 'getCampaigns') {
		const qs: IDataObject = { page: this.getNodeParameter('adCampaignsPage', i) as number };
		const status = getTrimmedParam(this, 'adCampaignStatus', i);
		if (status) qs.status = status;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaigns`,
			qs,
			json: true,
		});
	}

	if (operation === 'getCampaign') {
		const campaignId = this.getNodeParameter('campaignId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaigns/${campaignId}`,
			json: true,
		});
	}

	if (operation === 'getCampaignContacts') {
		const campaignId = this.getNodeParameter('campaignId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaign/${campaignId}/numbers`,
			json: true,
		});
	}

	if (operation === 'addCampaignContact') {
		const campaignId = this.getNodeParameter('campaignId', i) as string;
		const addBy = this.getNodeParameter('addContactBy', i) as string;
		const body: Record<string, unknown> = addBy === 'contactId'
			? { contact_id: Number(getTrimmedParam(this, 'addContactId', i)) }
			: { number: getTrimmedParam(this, 'contactNumber', i) };
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'POST',
			url: `${NUACOM_BASE_URL}/v2/auto-dialer/campaign/${campaignId}/numbers`,
			body,
			json: true,
		});
	}

	throw new NodeOperationError(this.getNode(), `Unknown Auto Dialer operation: ${operation}`, { itemIndex: i });
}

async function handleNuacomAi(this: IExecuteFunctions, operation: string, i: number): Promise<unknown> {
	if (operation === 'getCallAiData') {
		const callId = this.getNodeParameter('aiCallId', i) as string;
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/calls/${callId}/ai-data`,
			json: true,
		});
	}

	if (operation === 'listCallsAiData') {
		return this.helpers.httpRequestWithAuthentication.call(this, 'nuacomApi', {
			method: 'GET',
			url: `${NUACOM_BASE_URL}/v2/calls/ai-data`,
			qs: {
				date_from: getTrimmedParam(this, 'aiDateFrom', i),
				date_to: getTrimmedParam(this, 'aiDateTo', i),
				page: this.getNodeParameter('aiPage', i) as number,
				per_page: this.getNodeParameter('aiPerPage', i) as number,
			},
			json: true,
		});
	}

	throw new NodeOperationError(this.getNode(), `Unknown NUACOM AI operation: ${operation}`, { itemIndex: i });
}
