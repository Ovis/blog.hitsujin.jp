(function () {
	"use strict";

	function initializeNavigation() {
		const toggle = document.querySelector(".nav-toggle");
		const navigation = document.querySelector("#site-nav");

		if (!toggle || !navigation) {
			return;
		}

		toggle.addEventListener("click", function () {
			const isOpen = toggle.getAttribute("aria-expanded") === "true";
			toggle.setAttribute("aria-expanded", String(!isOpen));
			navigation.classList.toggle("is-open", !isOpen);
		});
	}

	function initializeImageZoom() {
		if (typeof window.mediumZoom !== "function") {
			return;
		}

		window.mediumZoom(document.querySelectorAll(".article-body > p > img"), {
			margin: 24,
			background: "#282b2a",
			scrollOffset: 0
		});
	}

	async function initializeMermaid() {
		const sourceElements = Array.from(document.querySelectorAll("pre.mermaid, pre > code.language-mermaid"));
		const sourceBlocks = Array.from(new Set(sourceElements.map(function (element) {
			return element.matches("pre") ? element : element.parentElement;
		}).filter(Boolean)));

		if (sourceBlocks.length === 0) {
			return;
		}

		try {
			const module = await import("https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs");
			const mermaid = module.default;
			mermaid.initialize({
				startOnLoad: false,
				securityLevel: "strict",
				suppressErrorRendering: true,
				theme: "neutral"
			});

			for (let index = 0; index < sourceBlocks.length; index += 1) {
				const pre = sourceBlocks[index];
				const code = pre.querySelector("code.language-mermaid");
				const source = (code || pre).textContent || "";

				if (source.trim().length === 0) {
					continue;
				}

				try {
					const renderId = `mermaid-diagram-${index + 1}`;
					const result = await mermaid.render(renderId, source);
					const container = document.createElement("div");
					container.className = "mermaid-diagram";
					container.setAttribute("role", "img");
					container.setAttribute("aria-label", `Mermaid diagram ${index + 1}`);
					container.innerHTML = result.svg;
					pre.replaceWith(container);
					if (typeof result.bindFunctions === "function") {
						result.bindFunctions(container);
					}
				} catch (error) {
					pre.classList.add("mermaid-source-error");
					console.error("Mermaid diagram rendering failed.", error);
				}
			}
		} catch (error) {
			console.error("Mermaid could not be loaded.", error);
		}
	}

	initializeNavigation();
	initializeImageZoom();
	initializeMermaid();
})();
