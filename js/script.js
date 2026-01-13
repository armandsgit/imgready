"use strict";

const navToggle = document.querySelector(".nav-toggle");
const navMenu = document.querySelector(".nav-menu");

if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
        const isOpen = navMenu.classList.toggle("open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

const form = document.getElementById("request-form");

if (form) {
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const button = form.querySelector("button");
        if (button) {
            button.textContent = "Paldies! Sazināsimies drīz.";
            button.disabled = true;
        }
        form.reset();
    });
}
