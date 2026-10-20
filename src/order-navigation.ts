interface SavedDetails {
	eventType?: string;
	eventDate?: string;
	eventTime?: string;
	eventCity?: string;
	guestCount?: number;
	budget?: number;
}

interface SavedLocation {
	id?: number;
	city?: string;
	guests?: number;
	capacity?: number;
	price?: number;
}

function readSaved(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) || 'null') as unknown;
	} catch {
		return null;
	}
}

export function initOrderNavigation(): void {
	const steps = document.querySelector<HTMLElement>('.order__steps');
	if (!steps) return;

	const currentStep = Number(steps.dataset.currentStep);
	const details = readSaved('evently-event-details') as SavedDetails | null;
	const place = readSaved('evently-selected-location') as SavedLocation | null;


	const hasDetails = Boolean(
		details?.eventType &&
		details.eventDate &&
		details.eventTime &&
		details.eventCity &&
		Number.isInteger(Number(details.guestCount)) &&
		Number(details.guestCount) >= 1 &&
		Number(details.guestCount) <= 1000 &&
		Number(details.budget) >= 10000
	);

	const capacity = Number(place?.guests ?? place?.capacity);
	const hasLocation = Boolean(
		hasDetails &&
		place &&
		typeof place.id === 'number' &&
		place.city === details?.eventCity &&
		capacity >= Number(details?.guestCount)
	);
		const servicesCompleted =
	localStorage.getItem('evently-services-completed') === 'true' &&
	hasLocation;
	const completed = [hasDetails, hasLocation, hasLocation && servicesCompleted, false];
	const accessible = [true, hasDetails, hasLocation, hasLocation && servicesCompleted];
	const allRequiredDone =
	hasDetails &&
	hasLocation &&
	servicesCompleted;

	steps.classList.toggle('order__steps--all-ready', allRequiredDone);

	steps.querySelectorAll<HTMLElement>('[data-order-step]').forEach(element => {
		const target = Number(element.dataset.orderStep);
		if (!Number.isInteger(target) || target < 1 || target > 4) return;

		const isCurrent = target === currentStep;
		const isAllowed = accessible[target - 1];
		const isCompleted = completed[target - 1];

		element.classList.remove(
			'order__step-number--locked',
			'order__step-number--completed',
			'order__step-number--started'
		);

		if (target === 4) {
			element.textContent = allRequiredDone ? '?' : '4';
		} else if (isCurrent) {
			element.textContent = String(target);
		} else if (isCompleted) {
			element.textContent = '✓';
		} else {
			element.textContent = String(target);
		}

		if (element instanceof HTMLAnchorElement) {
			if (!isAllowed) {
				element.removeAttribute('href');
				element.setAttribute('aria-disabled', 'true');
				element.classList.add('order__step-number--locked');
			} else {
				element.removeAttribute('aria-disabled');
			}
		}

		if (isCompleted && !isCurrent) {
			element.classList.add('order__step-number--completed');
		} else if (isAllowed && !isCurrent) {
			element.classList.add('order__step-number--started');
		}
	});
}
