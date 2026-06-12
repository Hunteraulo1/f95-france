import { json } from '@sveltejs/kit';

export const prerender = false;

export const GET = () => {
	return json(
		{
			status: 'ok',
			service: 'f95-france',
			uptime: process.uptime(),
			timestamp: new Date().toISOString()
		},
		{
			status: 200,
			headers: {
				'cache-control': 'no-store'
			}
		}
	);
};
