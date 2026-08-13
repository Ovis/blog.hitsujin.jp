(function () {
	"use strict";

	const MERMAID_MIN_ZOOM = 1;
	const MERMAID_MAX_ZOOM = 8;
	const MERMAID_ZOOM_STEP = 1.25;
	let mermaidViewer;

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

	function createButton(text, className, title) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = className;
		button.textContent = text;
		button.title = title;
		button.setAttribute("aria-label", title);
		return button;
	}

	function getMermaidViewer() {
		if (mermaidViewer) {
			return mermaidViewer;
		}

		const dialog = document.createElement("dialog");
		dialog.className = "mermaid-viewer";

		const panel = document.createElement("div");
		panel.className = "mermaid-viewer-panel";

		const header = document.createElement("header");
		header.className = "mermaid-viewer-header";

		const title = document.createElement("h2");
		title.id = "mermaid-viewer-title";
		title.className = "mermaid-viewer-title";
		title.textContent = "Mermaid図の拡大表示";
		dialog.setAttribute("aria-labelledby", title.id);

		const controls = document.createElement("div");
		controls.className = "mermaid-viewer-controls";
		controls.setAttribute("role", "toolbar");
		controls.setAttribute("aria-label", "図の表示操作");

		const zoomOutButton = createButton("−", "mermaid-viewer-control", "縮小");
		const zoomInButton = createButton("＋", "mermaid-viewer-control", "拡大");
		const resetButton = createButton("リセット", "mermaid-viewer-control mermaid-viewer-reset", "表示をリセット");
		const closeButton = createButton("閉じる", "mermaid-viewer-control mermaid-viewer-close", "拡大表示を閉じる");

		controls.append(zoomOutButton, zoomInButton, resetButton, closeButton);
		header.append(title, controls);

		const canvas = document.createElement("div");
		canvas.className = "mermaid-viewer-canvas";
		canvas.tabIndex = 0;
		canvas.setAttribute("aria-label", "拡大したMermaid図。ドラッグで移動、マウスホイールで拡大縮小できます。");

		panel.append(header, canvas);
		dialog.append(panel);
		document.body.append(dialog);

		const state = {
			initialViewBox: null,
			currentViewBox: null,
			zoom: MERMAID_MIN_ZOOM,
			drag: null,
			origin: null
		};

		function getSvg() {
			return canvas.querySelector("svg");
		}

		function clamp(value, minimum, maximum) {
			return Math.min(Math.max(value, minimum), maximum);
		}

		function clampViewBox(viewBox) {
			const initial = state.initialViewBox;
			if (!initial) {
				return viewBox;
			}

			return {
				x: clamp(viewBox.x, initial.x, initial.x + initial.width - viewBox.width),
				y: clamp(viewBox.y, initial.y, initial.y + initial.height - viewBox.height),
				width: viewBox.width,
				height: viewBox.height
			};
		}

		function applyViewBox(viewBox) {
			const svg = getSvg();
			if (!svg) {
				return;
			}

			state.currentViewBox = clampViewBox(viewBox);
			const current = state.currentViewBox;
			svg.setAttribute("viewBox", `${current.x} ${current.y} ${current.width} ${current.height}`);
		}

		function clientPointToSvg(clientX, clientY, inverseMatrix) {
			const svg = getSvg();
			const matrix = inverseMatrix || svg?.getScreenCTM()?.inverse();
			if (!svg || !matrix) {
				return null;
			}

			return new DOMPoint(clientX, clientY).matrixTransform(matrix);
		}

		function resetView() {
			if (!state.initialViewBox) {
				return;
			}

			state.zoom = MERMAID_MIN_ZOOM;
			applyViewBox({ ...state.initialViewBox });
		}

		function zoomBy(factor, clientX, clientY) {
			if (!state.initialViewBox || !state.currentViewBox) {
				return;
			}

			const nextZoom = clamp(state.zoom * factor, MERMAID_MIN_ZOOM, MERMAID_MAX_ZOOM);
			if (nextZoom === state.zoom) {
				return;
			}

			const current = state.currentViewBox;
			const anchor = Number.isFinite(clientX) && Number.isFinite(clientY)
				? clientPointToSvg(clientX, clientY)
				: null;
			const anchorX = anchor?.x ?? current.x + current.width / 2;
			const anchorY = anchor?.y ?? current.y + current.height / 2;
			const relativeX = (anchorX - current.x) / current.width;
			const relativeY = (anchorY - current.y) / current.height;
			const width = state.initialViewBox.width / nextZoom;
			const height = state.initialViewBox.height / nextZoom;

			state.zoom = nextZoom;
			applyViewBox({
				x: anchorX - width * relativeX,
				y: anchorY - height * relativeY,
				width,
				height
			});
		}

		function restoreDiagram() {
			const svg = getSvg();
			if (svg && state.origin) {
				resetView();
				state.origin.parent.insertBefore(svg, state.origin.nextSibling);
			}

			canvas.replaceChildren();
			canvas.classList.remove("is-dragging");
			state.initialViewBox = null;
			state.currentViewBox = null;
			state.zoom = MERMAID_MIN_ZOOM;
			state.drag = null;
			state.origin = null;
		}

		zoomOutButton.addEventListener("click", function () {
			zoomBy(1 / MERMAID_ZOOM_STEP);
		});
		zoomInButton.addEventListener("click", function () {
			zoomBy(MERMAID_ZOOM_STEP);
		});
		resetButton.addEventListener("click", resetView);
		closeButton.addEventListener("click", function () {
			dialog.close();
		});

		canvas.addEventListener("wheel", function (event) {
			event.preventDefault();
			zoomBy(event.deltaY < 0 ? MERMAID_ZOOM_STEP : 1 / MERMAID_ZOOM_STEP, event.clientX, event.clientY);
		}, { passive: false });

		canvas.addEventListener("pointerdown", function (event) {
			if (event.button !== 0 || state.zoom <= MERMAID_MIN_ZOOM) {
				return;
			}

			const svg = getSvg();
			const inverseMatrix = svg?.getScreenCTM()?.inverse();
			const startPoint = inverseMatrix ? clientPointToSvg(event.clientX, event.clientY, inverseMatrix) : null;
			if (!startPoint || !state.currentViewBox) {
				return;
			}

			state.drag = {
				pointerId: event.pointerId,
				startPoint,
				inverseMatrix,
				viewBox: { ...state.currentViewBox }
			};
			canvas.setPointerCapture(event.pointerId);
			canvas.classList.add("is-dragging");
		});

		canvas.addEventListener("pointermove", function (event) {
			if (!state.drag || state.drag.pointerId !== event.pointerId) {
				return;
			}

			const currentPoint = clientPointToSvg(event.clientX, event.clientY, state.drag.inverseMatrix);
			if (!currentPoint) {
				return;
			}

			applyViewBox({
				x: state.drag.viewBox.x - (currentPoint.x - state.drag.startPoint.x),
				y: state.drag.viewBox.y - (currentPoint.y - state.drag.startPoint.y),
				width: state.drag.viewBox.width,
				height: state.drag.viewBox.height
			});
		});

		function stopDragging(event) {
			if (!state.drag || state.drag.pointerId !== event.pointerId) {
				return;
			}

			state.drag = null;
			canvas.classList.remove("is-dragging");
		}

		canvas.addEventListener("pointerup", stopDragging);
		canvas.addEventListener("pointercancel", stopDragging);
		dialog.addEventListener("keydown", function (event) {
			if (event.key === "Escape") {
				event.preventDefault();
				dialog.close();
			}
		});
		dialog.addEventListener("close", restoreDiagram);

		mermaidViewer = {
			open(container, diagramNumber) {
				const svg = container.querySelector("svg");
				const viewBox = svg?.viewBox?.baseVal;
				if (!svg || !viewBox || viewBox.width <= 0 || viewBox.height <= 0) {
					return;
				}

				state.origin = {
					parent: svg.parentNode,
					nextSibling: svg.nextSibling
				};
				state.initialViewBox = {
					x: viewBox.x,
					y: viewBox.y,
					width: viewBox.width,
					height: viewBox.height
				};
				state.currentViewBox = { ...state.initialViewBox };
				state.zoom = MERMAID_MIN_ZOOM;
				title.textContent = `Mermaid図 ${diagramNumber} の拡大表示`;
				canvas.replaceChildren(svg);
				dialog.showModal();
				canvas.focus();
			}
		};

		return mermaidViewer;
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
					const block = document.createElement("div");
					block.className = "mermaid-block";
					const toolbar = document.createElement("div");
					toolbar.className = "mermaid-toolbar";
					const expandButton = createButton("拡大表示", "mermaid-expand-button", `Mermaid図 ${index + 1} を拡大表示`);
					const container = document.createElement("div");
					container.className = "mermaid-diagram";
					container.setAttribute("role", "img");
					container.setAttribute("aria-label", `Mermaid diagram ${index + 1}`);
					container.innerHTML = result.svg;
					expandButton.addEventListener("click", function () {
						getMermaidViewer().open(container, index + 1);
					});
					toolbar.append(expandButton);
					block.append(toolbar, container);
					pre.replaceWith(block);
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
