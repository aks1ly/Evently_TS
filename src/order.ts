// Дані першого етапу створення замовлення Evently.
export interface EventDetails {
    eventType: string;
    eventDate: string;
    eventTime: string;
    eventCity: string;
    guestCount: number;
    budget: number;
}

const STORAGE_KEY = "evently-event-details";

export function initOrder(): void {
    const eventType = document.querySelector<HTMLSelectElement>("#eventType");
    const eventDate = document.querySelector<HTMLInputElement>("#eventDate");
    const eventTime = document.querySelector<HTMLInputElement>("#eventTime");
    const eventCity = document.querySelector<HTMLSelectElement>("#eventCity");
    const guestCount = document.querySelector<HTMLInputElement>("#guestCount");
    const budgetRange = document.querySelector<HTMLInputElement>("#budgetRange");
    const budgetValue = document.querySelector<HTMLInputElement>("#budgetValue");
    const nextButton = document.querySelector<HTMLAnchorElement>("#orderNextButton");

    // Ця функція виконується тільки на сторінці першого етапу.
    if (!eventType || !eventDate || !eventTime || !eventCity ||
        !guestCount || !budgetRange || !budgetValue || !nextButton) return;

    const todayLocal = (): string => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };
    eventDate.min = todayLocal();

    // Відновлення чернетки після повернення або оновлення сторінки.
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data: EventDetails = JSON.parse(saved);
            if (typeof data.eventType === "string") eventType.value = data.eventType;
            if (typeof data.eventDate === "string") eventDate.value = data.eventDate;
            if (typeof data.eventTime === "string") eventTime.value = data.eventTime;
            if (typeof data.eventCity === "string") eventCity.value = data.eventCity;
            if (Number.isInteger(data.guestCount) && data.guestCount >= 1 && data.guestCount <= 1000)
                guestCount.value = String(data.guestCount);
            if (Number.isSafeInteger(data.budget) && data.budget >= 5000) {
                budgetValue.value = String(data.budget);
                budgetRange.value = String(Math.min(data.budget, 200000));
            }
        }
    } catch (error) {
        console.warn("Evently: не вдалося прочитати чернетку", error);
    }

    // Повзунок змінює число; ручне введення змінює повзунок.
    budgetRange.addEventListener("input", () => {
        budgetValue.value = budgetRange.value;
        budgetValue.setCustomValidity("");
    });
    budgetValue.addEventListener("input", () => {
        budgetValue.setCustomValidity("");
        const amount = Number(budgetValue.value);
        if (budgetValue.value !== "" && Number.isFinite(amount)) {
            budgetRange.value = String(Math.min(200000, Math.max(5000, amount)));
        }
    });

    guestCount.addEventListener("input", () => guestCount.setCustomValidity(""));
    const resetDateError = () => eventTime.setCustomValidity("");
    eventDate.addEventListener("input", resetDateError);
    eventTime.addEventListener("input", resetDateError);

    // Зберігаємо тільки після перевірки; не даємо посиланню перейти завчасно.
    nextButton.addEventListener("click", (event: MouseEvent) => {
        event.preventDefault();
        eventDate.min = todayLocal();
        const fields = [eventType, eventDate, eventTime, eventCity, guestCount, budgetValue];
        for (const field of fields) {
            if (!field.reportValidity()) return;
        }

        const guests = Number(guestCount.value);
        const budget = Number(budgetValue.value);
        if (!Number.isSafeInteger(guests) || guests < 1 || guests > 1000) {
            guestCount.setCustomValidity("Вкажіть цілу кількість гостей від 1 до 1000.");
            guestCount.reportValidity();
            return;
        }
        if (!Number.isSafeInteger(budget) || budget < 5000) {
            budgetValue.setCustomValidity("Вкажіть бюджет від 5 000 грн цілим числом.");
            budgetValue.reportValidity();
            return;
        }
        const timestamp = new Date(`${eventDate.value}T${eventTime.value}`).getTime();
        if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
            eventTime.setCustomValidity("Дата й час проведення мають бути в майбутньому.");
            eventTime.reportValidity();
            return;
        }

        const details: EventDetails = {
            eventType: eventType.value,
            eventDate: eventDate.value,
            eventTime: eventTime.value,
            eventCity: eventCity.value,
            guestCount: guests,
            budget
        };
    try {
        const previousDetails = localStorage.getItem(STORAGE_KEY);
        const newDetails = JSON.stringify(details);

        if (previousDetails !== newDetails) {
            localStorage.removeItem('evently-services-completed');
            localStorage.removeItem('evently-selected-location');
        }

        localStorage.setItem(STORAGE_KEY, newDetails);
        } catch (error) {
            console.error("Evently: помилка збереження", error);
            alert("Не вдалося зберегти параметри замовлення. Перевірте налаштування браузера.");
            return;
        }
        window.location.assign(nextButton.href);
    });
}
