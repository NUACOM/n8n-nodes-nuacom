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
	icon = 'file:nuacom.svg' as const;
	documentationUrl = 'https://nuacom.com/developers';
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
				'X-Nuacom-Token': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: NUACOM_BASE_URL,
			url: '/v2/webhook-subscriptions',
		},
	};
}
