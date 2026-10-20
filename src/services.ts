interface Service {
	id: string;
	category: 'host' | 'photographer' | 'catering';
	name: string;
	price: number;
	image: string;
	description: string;
	rating?: string | number;
	reviewCount?: number;
}
const SERVICES_URL = 'https://api.jsonbin.io/v3/b/6ad74d7bffd5d160537babd3/latest';
const STORAGE_KEY = 'evently-selected-services';
const format = (n: number) => new Intl.NumberFormat('uk-UA').format(n);
const demoReviews: Record<string, { rating: string; count: number }> = {
	'host-dmytro': { rating: '4.7', count: 67 },
	'host-mariia': { rating: '4.8', count: 101 },
	'host-oleksandr': { rating: '4.9', count: 124 },
	'photo-veronika': { rating: '4.9', count: 82 },
	'photo-andrii': { rating: '4.8', count: 53 },
	'photo-sofiia': { rating: '4.9', count: 41 }
};
const roles: Record<Service['category'], string> = {
	host: 'Ведучий', photographer: 'Фотограф', catering: 'Кейтеринг'
};
export async function initServices(): Promise<void> {
	const root = document.querySelector<HTMLElement>('.order-services');
	if (!root) return;
	const catalog = root.querySelector<HTMLElement>('#servicesCatalog');
	const selectedList = root.querySelector<HTMLElement>('#servicesSelectedList');
	const selectedTitle = root.querySelector<HTMLElement>('#servicesSelectedTitle');
	const totalElement = root.querySelector<HTMLElement>('#servicesTotal');
	const status = root.querySelector<HTMLElement>('#servicesStatus');
	if (!catalog || !selectedList || !selectedTitle || !totalElement || !status) return;
	let category: Service['category'] = 'host';
	let all: Service[] = [];
	let selectedIds: string[] = [];
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
		if (Array.isArray(raw)) selectedIds = raw.filter((x): x is string => typeof x === 'string');
	} catch { selectedIds = []; }
	try {
		const response = await fetch(SERVICES_URL, { headers: { Accept: 'application/json' } });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const data: unknown = await response.json();
		const entries = (data as { record?: { services?: unknown } }).record?.services;
		if (!Array.isArray(entries)) throw new Error('Неправильний формат JSON');
		all = entries.filter((x: unknown): x is Service => {
			if (!x || typeof x !== 'object') return false;
			const s = x as Partial<Service>;
			return typeof s.id === 'string' && typeof s.name === 'string'
				&& typeof s.price === 'number' && Number.isFinite(s.price) && s.price >= 0
				&& (s.category === 'host' || s.category === 'photographer' || s.category === 'catering')
				&& typeof s.image === 'string' && typeof s.description === 'string';
		});
		if (!all.length) throw new Error('Список послуг порожній');
		status.hidden = true;
	} catch (error) {
		console.error('Не вдалося завантажити послуги:', error);
		status.textContent = 'Не вдалося завантажити послуги. Перевір публічний доступ до JSONBin.';
		return;
	}
	selectedIds = selectedIds.filter(id => all.some(s => s.id === id));
	for (const single of ['host', 'catering'] as const) {
		const matching = selectedIds.filter(id => all.some(s => s.id === id && s.category === single));
		if (matching.length > 1) selectedIds = selectedIds.filter(id => !matching.slice(1).includes(id));
	}
	function persist(): void {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds));
	}
	function getOrderAmounts(): { budget: number; location: number } | null {
		try {
			const details = JSON.parse(localStorage.getItem('evently-event-details') || 'null') as { budget?: unknown } | null;
			const place = JSON.parse(localStorage.getItem('evently-selected-location') || 'null') as { price?: unknown } | null;
			if (typeof details?.budget !== 'number' || !Number.isFinite(details.budget) ||
				typeof place?.price !== 'number' || !Number.isFinite(place.price)) return null;
			return { budget: details.budget, location: place.price };
		} catch { return null; }
	}
	let lastFocused: HTMLElement | null = null;
	const overlay = document.createElement('div');
	overlay.className = 'evently-budget-modal';
	overlay.hidden = true;
	overlay.innerHTML = `
		<div class="evently-budget-modal__panel" role="dialog" aria-modal="true" aria-labelledby="eventlyBudgetTitle" aria-describedby="eventlyBudgetMessage">
			<div class="evently-budget-modal__symbol" aria-hidden="true">!</div>
			<h2 id="eventlyBudgetTitle">Бюджет перевищено!</h2>
			<p id="eventlyBudgetMessage"></p>
			<div class="evently-budget-modal__actions">
				<button type="button" class="evently-budget-modal__dismiss">Зрозуміло</button>
				<a class="evently-budget-modal__change" href="/order.html">Змінити бюджет</a>
			</div>
		</div>`;
	document.body.append(overlay);
	const closeModal = (): void => {
		overlay.hidden = true;
		document.body.classList.remove('evently-budget-modal-open');
		lastFocused?.focus();
	};
	overlay.querySelector<HTMLButtonElement>('.evently-budget-modal__dismiss')?.addEventListener('click', closeModal);
	overlay.addEventListener('click', event => { if (event.target === overlay) closeModal(); });
	overlay.addEventListener('keydown', event => {
		if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
		if (event.key === 'Tab') {
			const controls = Array.from(overlay.querySelectorAll<HTMLElement>('button, a[href]'));
			if (!controls.length) return;
			const first = controls[0];
			const last = controls[controls.length - 1];
			if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
			else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
		}
	});
	function warnIfExceeded(): void {
		const amounts = getOrderAmounts();
		if (!amounts) return;
		const servicesCost = selectedIds.reduce((sum, id) => sum + (all.find(s => s.id === id)?.price ?? 0), 0);
		const over = amounts.location + servicesCost - amounts.budget;
		if (over <= 0) return;
		const message = overlay.querySelector<HTMLElement>('#eventlyBudgetMessage');
		if (message) message.textContent = `Загальна вартість замовлення перевищує ваш бюджет на ${format(over)} грн. Ви можете залишити обрані послуги або змінити бюджет.`;
		lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		overlay.hidden = false;
		document.body.classList.add('evently-budget-modal-open');
		overlay.querySelector<HTMLButtonElement>('.evently-budget-modal__dismiss')?.focus();
	}
	function toggle(service: Service): void {
		if (selectedIds.includes(service.id)) {
			selectedIds = selectedIds.filter(id => id !== service.id);
		} else {
			if (service.category !== 'photographer') {
				selectedIds = selectedIds.filter(id => !all.some(s => s.id === id && s.category === service.category));
			}
			selectedIds.push(service.id);
		}
		localStorage.removeItem('evently-services-completed');
		persist();
		render();
	}
	function image(src: string, name: string, className: string): HTMLImageElement {
		const img = document.createElement('img');
		img.className = className;
		img.src = src;
		img.alt = name;
		img.onerror = () => { img.onerror = null; img.src = '/images/host-mariia.png'; };
		return img;
	}
	function render(): void {
		root!.querySelectorAll<HTMLButtonElement>('[data-service-tab]').forEach(button => {
			const active = button.dataset.serviceTab === category;
			button.classList.toggle('order-services__category--active', active);
			button.setAttribute('aria-pressed', String(active));
			const icon = button.querySelector<HTMLImageElement>('img[data-icon-default]');
			if (icon) {
				icon.src = active ? (icon.dataset.iconActive || icon.dataset.iconDefault || '') : (icon.dataset.iconDefault || '');
			}
		});
		catalog!.replaceChildren();
		for (const service of all.filter(s => s.category === category)) {
			const card = document.createElement('article');
			card.className = 'order-services__card';
			card.append(image(service.image, service.name, 'order-services__photo'));
			const person = document.createElement('div');
			person.className = 'order-services__person';
			const name = document.createElement('h3');
			name.className = 'order-services__name';
			name.textContent = service.name;
			person.append(name);
			const review = demoReviews[service.id];
			const ratingValue = service.rating ?? review?.rating;
			const reviewCount = service.reviewCount ?? review?.count;
			if (ratingValue !== undefined) {
				const separator = document.createElement('span');
				separator.className = 'order-services__separator';
				const star = document.createElement('span');
				star.className = 'order-services__star';
				star.textContent = '★';
				star.setAttribute('aria-hidden', 'true');
				const rating = document.createElement('span');
				rating.className = 'order-services__rating';
				rating.textContent = `${ratingValue}${reviewCount !== undefined ? ` (${reviewCount})` : ''}`;
				person.append(separator, star, rating);
			}
			
const description = document.createElement('p');
			description.className = 'order-services__description';
			description.textContent = service.description;
			const bottom = document.createElement('div');
			bottom.className = 'order-services__card-bottom';
			const price = document.createElement('div');
			price.className = 'order-services__price';
			const amount = document.createElement('strong');
			amount.textContent = `${format(service.price)} грн`;
			const note = document.createElement('span');
			note.textContent = 'за захід';
			price.append(amount, note);
			const add = document.createElement('button');
			add.type = 'button';
			add.className = 'order-services__add';
			const isSelected = selectedIds.includes(service.id);
			add.classList.toggle('order-services__add--selected', isSelected);
			add.textContent = isSelected ? 'Додано' : 'Додати';
			add.setAttribute('aria-pressed', String(isSelected));
			add.addEventListener('click', () => toggle(service));
			bottom.append(price, add);
			card.append(person, description, bottom);
			catalog!.append(card);
		}
		selectedList!.replaceChildren();
		const chosen = selectedIds.map(id => all.find(s => s.id === id)).filter((s): s is Service => !!s);
		selectedTitle!.textContent = `Обрані послуги (${chosen.length})`;
		if (!chosen.length) {
			const empty = document.createElement('p');
			empty.className = 'order-services__empty';
			empty.textContent = 'Послуги поки не обрано. Можна перейти далі без них.';
			selectedList!.append(empty);
		}
		for (const service of chosen) {
			const item = document.createElement('div');
			item.className = 'order-services__selected-item';
			item.append(image(service.image, service.name, 'order-services__selected-image'));
			const info = document.createElement('div');
			info.className = 'order-services__selected-info';
			const title = document.createElement('h3');
			title.textContent = service.name;
			const role = document.createElement('span');
			role.textContent = roles[service.category];
			info.append(title, role);
			const cost = document.createElement('strong');
			cost.className = 'order-services__selected-price';
			cost.textContent = `${format(service.price)} грн`;
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'order-services__remove';
			remove.textContent = '×';
			remove.setAttribute('aria-label', `Видалити ${service.name}`);
			remove.addEventListener('click', () => toggle(service));
			item.append(info, cost, remove);
			selectedList!.append(item);
		}
		totalElement!.textContent = `${format(chosen.reduce((sum, s) => sum + s.price, 0))} грн`;
	}
	const nextButton = root.querySelector<HTMLAnchorElement>('.order-services__next');
	nextButton?.addEventListener('click', event => {
		const amounts = getOrderAmounts();
		if (!amounts) {
			event.preventDefault();
			status.hidden = false;
			status.textContent = 'Не знайдено бюджет або обрану локацію. Поверніться до попередніх етапів замовлення.';
			return;
		}
		const servicesCost = selectedIds.reduce((sum, id) => sum + (all.find(service => service.id === id)?.price ?? 0), 0);
		if (amounts.location + servicesCost > amounts.budget) {
			event.preventDefault();
			warnIfExceeded();
			return;
		}
		localStorage.setItem('evently-services-completed', 'true');
	});
	root.querySelectorAll<HTMLButtonElement>('[data-service-tab]').forEach(button => {
		button.addEventListener('click', () => {
			const next = button.dataset.serviceTab;
			if (next === 'host' || next === 'photographer' || next === 'catering') {
				category = next;
				render();
			}
		});
	});
	persist();
	render();
}
