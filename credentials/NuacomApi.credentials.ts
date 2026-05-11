import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';
import { NUACOM_BASE_URL } from '../constants';

export class NuacomApi implements ICredentialType {
	name = 'nuacomApi';
	displayName = 'NUACOM API';
	documentationUrl = NUACOM_BASE_URL;
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-Auth-Token': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: NUACOM_BASE_URL,
			url: '/v3/webhook-subscriptions',
		},
	};
}
