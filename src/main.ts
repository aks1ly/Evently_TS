import "./scss/main.scss";
import { initOrder } from "./order";
import { initLocations } from "./locations";
import { initServices } from "./services";
import { initConfirmation } from "./confirmation";
import { initOrderNavigation } from "./order-navigation";

function initPage(): void {
	initOrder();
	void initLocations();
	void initServices();
	void initConfirmation();
	initOrderNavigation();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initPage);
} else {
	initPage();
}
