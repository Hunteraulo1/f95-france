export function autoCheckTriggerLabel(source: string): string {
	switch (source) {
		case 'cron':
			return 'Planificateur (cron)';
		case 'manual':
			return 'Manuel (panel dev)';
		case 'worker':
			return 'Arrière-plan';
		default:
			return source;
	}
}

export function autoCheckStatusLabel(status: string): string {
	switch (status) {
		case 'running':
			return 'En cours';
		case 'success':
			return 'Succès';
		case 'success_with_issues':
			return 'Succès avec alertes';
		case 'failed':
			return 'Échec';
		default:
			return status;
	}
}

export function autoCheckStatusBadgeClass(status: string): string {
	switch (status) {
		case 'running':
			return 'badge-info';
		case 'success':
			return 'badge-success';
		case 'success_with_issues':
			return 'badge-warning';
		case 'failed':
			return 'badge-error';
		default:
			return 'badge-neutral';
	}
}

export function autoCheckIssueStageLabel(stage: string | null | undefined): string {
	switch (stage) {
		case 'checker_fetch':
			return 'Checker F95 (réseau)';
		case 'checker_payload':
			return 'Checker F95 (réponse)';
		case 'scrape':
			return 'Scrape F95';
		case 'webhook_translators':
			return 'Webhook traducteurs';
		case 'webhook_proofreaders':
			return 'Webhook relecteurs';
		case 'webhook_updates':
			return 'Webhook mises à jour';
		case 'google_sheets':
			return 'Google Sheets';
		case 'run':
			return 'Exécution';
		default:
			return stage ?? '—';
	}
}
