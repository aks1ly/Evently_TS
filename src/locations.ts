interface CloudLocation {
	id: number;
	name: string;
	type: string;
	city: string;
	price: number;
	capacity: number;
	rating: number;
	features: string[];
	image: string;
	address?: string;
	description?: string;
}
interface EventDetails { guestCount?: number; eventCity?: string; budget?: number }

const BIN_URL = 'https://api.jsonbin.io/v3/b/6ad73eabac6210605a41cf36/latest';
const cityNames: Record<string,string> = {kyiv:'Київ',lviv:'Львів',odesa:'Одеса',dnipro:'Дніпро',kharkiv:'Харків'};
const localImages: Record<string,string> = {
	'Garden Hall':'/images/forrest-club.png',
	'Sky Loft':'/images/river-grill.png',
	'Green Valley':'/images/shtandart.png'
};
const money = (value: number): string => new Intl.NumberFormat('uk-UA').format(value);

export async function initLocations(): Promise<void> {
	const section = document.querySelector<HTMLElement>('.order-locations');
	if (!section) return;
	const list = section.querySelector<HTMLElement>('#locationsList');
	const status = section.querySelector<HTMLElement>('#locationStatus');
	const count = section.querySelector<HTMLElement>('#locationsCount');
	const minRange = section.querySelector<HTMLInputElement>('#minPriceRange');
	const maxRange = section.querySelector<HTMLInputElement>('#maxPriceRange');
	const minInput = section.querySelector<HTMLInputElement>('#minPrice');
	const maxInput = section.querySelector<HTMLInputElement>('#maxPrice');
	if (!list || !status || !minRange || !maxRange || !minInput || !maxInput) return;
	const typeChecks = Array.from(section.querySelectorAll<HTMLInputElement>('input[name="locationType"]'));
	const featureChecks = Array.from(section.querySelectorAll<HTMLInputElement>('input[name="features"]'));
	let details: EventDetails | null = null;
	try { details = JSON.parse(localStorage.getItem('evently-event-details') || 'null') as EventDetails | null; } catch { /* no draft */ }

	// Відновлюємо вибір після повернення з третього етапу.
	let selectedLocationId: number | null = null;
	try {
		const saved = JSON.parse(localStorage.getItem('evently-selected-location') || 'null') as { id?: unknown } | null;
		if (typeof saved?.id === 'number') selectedLocationId = saved.id;
	} catch {
		// Пошкоджені дані не повинні зупиняти сторінку.
	}

	let locations: CloudLocation[] = [];
	try {
	const response = await fetch(BIN_URL, { headers: { 'Accept': 'application/json' } });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const payload: unknown = await response.json();
	const data = payload as { record?: { locations?: unknown } };
	if (!Array.isArray(data.record?.locations)) throw new Error('Неправильна структура JSON');
	locations = data.record.locations.filter((item: unknown): item is CloudLocation => {
		if (!item || typeof item !== 'object') return false;
		const l = item as Partial<CloudLocation>;
		return typeof l.id === 'number' && typeof l.name === 'string' &&
		typeof l.price === 'number' && Number.isFinite(l.price) &&
		typeof l.capacity === 'number' && typeof l.type === 'string' &&
		typeof l.city === 'string' && Array.isArray(l.features);
	});
	} catch (error) {
	console.error('Помилка завантаження локацій:', error);
	status.textContent = 'Не вдалося завантажити локації. Перевір доступ до JSONBin і онови сторінку.';
	status.className = 'order-locations__status';
	return;
	}

	const budget = typeof details?.budget === 'number' && Number.isFinite(details.budget) && details.budget >= 10000 ? details.budget : 50000;
	const ceiling = budget;
	const floor = 10000;
	minRange.min = maxRange.min = String(floor);
	minInput.min = maxInput.min = String(floor);
	minRange.value = minInput.value = String(floor);
	maxInput.max = minInput.max = String(ceiling);
	maxRange.max = String(ceiling);
	minRange.max = String(ceiling);
	maxRange.value = String(budget);
	maxInput.value = String(budget);
	const limitLabels = section.querySelectorAll<HTMLElement>('.order-locations__limits span');
	if (limitLabels[0]) limitLabels[0].textContent = money(floor);
	if (limitLabels[1]) limitLabels[1].textContent = money(ceiling);

	function sync(source: 'minRange' | 'maxRange' | 'minInput' | 'maxInput'): void {
	const minRaw = Number(source === 'minRange' ? minRange!.value : minInput!.value);
	const maxRaw = Number(source === 'maxRange' ? maxRange!.value : maxInput!.value);
	let low = Math.min(ceiling, Math.max(floor, Number.isFinite(minRaw) ? minRaw : floor));
	let high = Math.min(ceiling, Math.max(floor, Number.isFinite(maxRaw) ? maxRaw : ceiling));
	if (low > high) {
		if (source.startsWith('min')) high = low;
		else low = high;
	}
	minInput!.value = String(low);
	maxInput!.value = String(high);
	minRange!.value = String(Math.min(low, ceiling));
	maxRange!.value = String(Math.min(high, ceiling));
	render();
	}

	function render(): void {
	const selectedTypes = typeChecks.filter(c => c.checked).map(c => c.value);
	const selectedFeatures = featureChecks.filter(c => c.checked).map(c => c.value);
	const low = Number(minInput!.value);
	const high = Number(maxInput!.value);
	const matching = locations.filter(l =>
		(!selectedTypes.length || selectedTypes.includes(l.type)) &&
		selectedFeatures.every(f => l.features.includes(f)) &&
		l.price >= low && l.price <= high &&
		(!details?.guestCount || l.capacity >= details.guestCount) &&
		(!details?.eventCity || l.city === details.eventCity)
	);
	list!.replaceChildren();
	if (count) count.textContent = `Знайдено локацій: ${matching.length}`;
	if (!matching.length) {
		const message = document.createElement('p');
		message.className = 'order-locations__empty';
		message.textContent = 'За обраними параметрами локацій не знайдено. Змініть фільтри.';
		list!.append(message);
		return;
	}
	for (const location of matching) {
		const article = document.createElement('article');
		article.className = 'order-locations__card';
		const isSelected = selectedLocationId === location.id;
		if (isSelected) article.classList.add('order-locations__card--selected');
		const photo = document.createElement('img');
		photo.className = 'order-locations__image';
		photo.src = location.image || localImages[location.name] || '/images/forrest-club.png';
		photo.alt = location.name;
		photo.onerror = () => { photo.onerror = null; photo.src = '/images/forrest-club.png'; };
		const detailsBox = document.createElement('div');
		detailsBox.className = 'order-locations__details';
		const title = document.createElement('h3');
		title.className = 'order-locations__name';
		title.textContent = location.name;
		const meta = document.createElement('div');
		meta.className = 'order-locations__meta';
		const address = document.createElement('span');
		const pin = document.createElement('img');
		pin.className = 'order-locations__meta-icon';
		pin.src = '/images/map-pin.png'; pin.alt = '';
		address.append(pin, document.createTextNode(location.address || cityNames[location.city] || location.city));
		const guests = document.createElement('span');
		const users = document.createElement('img');
		users.className = 'order-locations__meta-icon'; users.src = '/images/users.png'; users.alt = '';
		guests.append(users, document.createTextNode(`До ${location.capacity} гостей`));
		meta.append(address, guests);
		const description = document.createElement('p');
		description.className = 'order-locations__description';
		description.textContent = location.description || `Локація для проведення святкових заходів у місті ${cityNames[location.city] || location.city}.`;
		detailsBox.append(title, meta, description);
		const bottom = document.createElement('div');
		bottom.className = 'order-locations__bottom';
		const cost = document.createElement('strong');
		cost.className = 'order-locations__cost';
		cost.textContent = `${money(location.price)} грн`;
		const note = document.createElement('span');
		note.className = 'order-locations__note';
		note.textContent = 'Оренда залу за захід · меню оплачується окремо';
		const choose = document.createElement('a');
		choose.className = 'order-locations__choose';
		choose.href = '/order-services.html';
		choose.textContent = isSelected ? '✓ Обрано' : 'Обрати →';
		if (isSelected) choose.classList.add('order-locations__choose--selected');
		choose.addEventListener('click', event => {
		event.preventDefault();
		if (!details?.guestCount || !details.eventCity || !details.budget) {
			alert('Спочатку заповніть параметри заходу.');
			window.location.href = '/order.html';
			return;
		}
		if (selectedLocationId !== location.id) {
			localStorage.removeItem('evently-services-completed');
		}
		localStorage.setItem('evently-selected-location', JSON.stringify({
			id: location.id, name: location.name, price: location.price,
			guests: location.capacity, address: location.address || cityNames[location.city] || location.city,
			image: photo.src, city: location.city
		}));
		selectedLocationId = location.id;
		window.location.href = '/order-services.html';
		});
		bottom.append(cost, note, choose);
		article.append(photo, detailsBox, bottom);
		list!.append(article);
	}
	}
	minRange.addEventListener('input', () => sync('minRange'));
	maxRange.addEventListener('input', () => sync('maxRange'));
	minInput.addEventListener('change', () => sync('minInput'));
	maxInput.addEventListener('change', () => sync('maxInput'));
	[...typeChecks, ...featureChecks].forEach(c => c.addEventListener('change', render));
	render();
}
