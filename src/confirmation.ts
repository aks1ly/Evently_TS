import type { EventDetails } from './order';

type Location = { id: number; name: string; price: number; guests: number; address: string; image: string; city: string };
type Service = { id: string; name: string; price: number; image: string; category: 'host' | 'photographer' | 'catering' };
const URL = 'https://api.jsonbin.io/v3/b/6ad74d7bffd5d160537babd3/latest';
const money = (n: number): string => `${new Intl.NumberFormat('uk-UA').format(n)} грн`;
const read = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) || 'null') as unknown; } catch { return null; } };
const element = (tag: string, className: string, content?: string): HTMLElement => {
	const node = document.createElement(tag);
	node.className = className;
	if (content !== undefined) node.textContent = content;
	return node;
};
const image = (src: string, alt: string, className: string): HTMLImageElement => {
	const node = document.createElement('img');
	node.src = src; node.alt = alt; node.className = className;
	return node;
};
const set = (id: string, value: string): void => { const node = document.getElementById(id); if (node) node.textContent = value; };

export async function initConfirmation(): Promise<void> {
	const root = document.querySelector<HTMLElement>('.order-confirmation');
	if (!root) return;
	const details = read('evently-event-details') as EventDetails | null;
	const location = read('evently-selected-location') as Location | null;
	const ids = read('evently-selected-services');
	const locationBox = document.getElementById('confirmLocation');
	const servicesBox = document.getElementById('confirmServices');
	const form = document.getElementById('confirmationForm') as HTMLFormElement | null;
	if (!details || !location || !locationBox || !servicesBox || !form || !Number.isFinite(location.price)) {
		root.insertAdjacentElement('afterbegin', element('p', 'order-confirmation__notice', 'Замовлення неповне. Поверніться до попередніх етапів.'));
		if (form) form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = true;
		return;
	}
	const eventTypes: Record<string, string> = { birthday: 'День народження', wedding: 'Весілля', corporate: 'Корпоратив', meeting: 'Зустріч із близькими', other: 'Інше' };
	const cities: Record<string, string> = { kyiv: 'Київ', lviv: 'Львів', odesa: 'Одеса', dnipro: 'Дніпро', kharkiv: 'Харків' };
	set('confirmEventType', eventTypes[details.eventType] || details.eventType);
	const date = new Date(`${details.eventDate}T${details.eventTime}`);
	set('confirmDateTime', Number.isNaN(date.getTime()) ? '—' : `${new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}, ${details.eventTime}`);
	set('confirmCity', `м. ${cities[details.eventCity] || details.eventCity}`);
	set('confirmGuests', String(details.guestCount));
	set('confirmBudget', money(details.budget));
	locationBox.replaceChildren();
	locationBox.append(image(location.image, location.name, 'order-confirmation__location-image'));
	const info = element('div', 'order-confirmation__location-info');
	info.append(element('h4', '', location.name));
	const meta = element('div', 'order-confirmation__location-meta');
	for (const [icon, value] of [['/images/map-pin.png', `${cities[location.city] || location.city}, ${location.address}`], ['/images/users.png', `До ${location.guests} гостей`]]) {
		const item = element('div', 'order-confirmation__meta-item');
		item.append(image(icon, '', ''), element('span', '', value));
		meta.append(item);
	}
	info.append(meta); locationBox.append(info);
	let selected: Service[] = [];
	try {
		const response = await fetch(URL, { headers: { Accept: 'application/json' } });
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const json = await response.json() as { record?: { services?: Service[] } };
		if (!Array.isArray(json.record?.services)) throw new Error('Неправильний формат JSON');
		const chosenIds = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
		selected = chosenIds.map(id => json.record!.services!.find(service => service.id === id)).filter((service): service is Service => !!service && Number.isFinite(service.price));
		if (selected.length !== chosenIds.length) throw new Error('Не всі обрані послуги знайдено');
	} catch (error) {
		console.error('Evently: послуги недоступні', error);
		servicesBox.textContent = 'Не вдалося отримати обрані послуги. Перевірте JSONBin та оновіть сторінку.';
		form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = true;
		return;
	}
	servicesBox.replaceChildren();
	const roles: Record<Service['category'], string> = { host: 'Ведучий', photographer: 'Фотограф', catering: 'Кейтеринг' };
	if (!selected.length) servicesBox.append(element('p', 'order-confirmation__empty', 'Додаткові послуги не обрано.'));
	for (const service of selected) {
		const row = element('div', 'order-confirmation__service');
		row.append(image(service.image, service.name, ''));
		const text = element('div', 'order-confirmation__service-info');
		text.append(element('h4', '', service.name), element('span', '', roles[service.category] || service.category));
		row.append(text, element('strong', '', money(service.price)));
		servicesBox.append(row);
	}
	const servicesPrice = selected.reduce((sum, service) => sum + service.price, 0);
	const total = location.price + servicesPrice;
	set('confirmLocationPrice', money(location.price));
	set('confirmServicesPrice', money(servicesPrice));
	set('confirmTotal', money(total));
	const email = document.getElementById('confirmationEmail') as HTMLInputElement;
	const phone = document.getElementById('confirmationPhone') as HTMLInputElement;
	const contact = read('evently-contact') as { email?: string; phone?: string } | null;
	if (contact) { email.value = contact.email || ''; phone.value = contact.phone || ''; }
	phone.setAttribute('pattern', '\\+380[0-9]{9}');
	phone.setAttribute('title', 'Введіть номер у форматі +380XXXXXXXXX');
	const modal = document.getElementById('confirmBudgetModal') as HTMLElement;
	const close = document.getElementById('confirmModalClose') as HTMLButtonElement;
	const dismiss = (): void => { modal.hidden = true; close.blur(); };
	close.addEventListener('click', dismiss);
	modal.addEventListener('click', event => { if (event.target === modal) dismiss(); });
	modal.addEventListener('keydown', event => { if (event.key === 'Escape') dismiss(); });
	form.addEventListener('submit', event => {
		event.preventDefault();
		phone.value = phone.value.replace(/[\s()-]/g, '');
		if (!form.reportValidity()) return;
		localStorage.setItem('evently-contact', JSON.stringify({ email: email.value.trim(), phone: phone.value }));
		if (total > details.budget) {
			set('confirmBudgetMessage', `Загальна вартість ${money(total)} перевищує ваш бюджет на ${money(total - details.budget)}. Ви можете змінити бюджет або переглянути вибрані послуги.`);
			modal.hidden = false;
			close.focus();
			return;
		}
		localStorage.setItem('evently-confirmed-order', JSON.stringify({ details, location, services: selected, total, email: email.value.trim(), phone: phone.value }));
		// Очистити чернетку після успішного підтвердження.
		for (const key of ['evently-event-details', 'evently-selected-location', 'evently-selected-services', 'evently-contact']) {
			localStorage.removeItem(key);
		}
		window.location.hash = 'order-success';
	});
}
