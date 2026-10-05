console.log(`Tsk! is watching. ${window === window.top ? "top frame" : "iframe"}`);

function looksLikePopup(element) {
    if (
        element.matches(
            "dialog, [role='dialog'], [aria-modal='true']"
        )
    ) {
        return true;
    }

    const style = getComputedStyle(element);

    const id = element.id.toLowerCase();

    const className =
        typeof element.className === "string"
            ? element.className.toLowerCase()
            : "";

    const hasPopupName =
        id.includes("popup") ||
        id.includes("modal") ||
        className.includes("popup") ||
        className.includes("modal");

    const isFloating =
        style.position === "fixed" ||
        style.position === "sticky";

    return hasPopupName && isFloating;
}

function isVisible(element) {
    const style = getComputedStyle(element);

    if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
    ) {
        return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width > 0 && rect.height > 0;
}

function getDataAttributeText(element) {
    return [...element.attributes]
        .filter(attribute => attribute.name.startsWith("data-"))
        .map(attribute => attribute.value.toLowerCase())
        .join(" ");
}

function scoreCloseCandidate(element) {
    let score = 0;
    const reasons = [];

    const text = element.textContent.trim().toLowerCase();
    const ariaLabel = element.getAttribute("aria-label")?.trim().toLowerCase() ?? "";
    const title = element.getAttribute("title")?.trim().toLowerCase() ?? "";
    const id = element.id.toLowerCase();
    const className =
        typeof element.className === "string"
            ? element.className.toLowerCase()
            : "";

    const dataAction =
        element.getAttribute("data-action")?.toLowerCase() ?? "";

    const dataAttributes = getDataAttributeText(element);

    // Extremely strong signals.
    if (text === "×" || text === "✕" || text === "x") {
        score += 100;
        reasons.push("text matches X");
    }

    if (
        ariaLabel === "close" ||
        ariaLabel.startsWith("close ") ||
        title === "close" ||
        title.startsWith("close ")
    ) {
        score += 100;
        reasons.push("accessible close label");
    }
    else if (
        ariaLabel.includes("close") ||
        title.includes("close")
    ) {
        score += 60;
        reasons.push("accessible label contains close");
    }

    // Structural/name clues.
    if (id.includes("close")) {
        score += 60;
        reasons.push("id contains close");
    }

    if (className.includes("close")) {
        score += 60;
        reasons.push("class contains close");
    }

    if (dataAttributes.includes("close")) {
        score += 60;
        reasons.push("data attribute contains close");
    }

    if (dataAction.includes("close")) {
        score += 80;
        reasons.push("data action contains close");
    }

    // Common visual clue.
    if (className.includes("cross")) {
        score += 40;
        reasons.push("class contains cross");
    }

    return { score, reasons };
}

function findStrongCloseButtons(root = document) {
    const candidates = [];

    if (
        root instanceof Element &&
        root.matches('button, [role="button"], a')
    ) {
        candidates.push(root);
    }

    candidates.push(
        ...(root.querySelectorAll?.(
            'button, [role="button"], a'
        ) ?? [])
    );

    for (const candidate of candidates) {
        const { score, reasons } = scoreCloseCandidate(candidate);

        if (
            score >= 120 &&
            isVisible(candidate) &&
            !candidate.classList.contains("tsk-found-it")
        ) {
            candidate.classList.add("tsk-found-it");

            console.log(
                `Tsk! found a strong X (score: ${score}; ${reasons.join(", ")}):`,
                candidate
            );
        }
    }
}

function highlightCloseButtons(modal) {
    const candidates = modal.querySelectorAll(
        'button, [role="button"], a'
    );

    let bestCandidate = null;
    let bestScore = 0;
    let bestReasons = [];

    for (const candidate of candidates) {
        const { score, reasons } = scoreCloseCandidate(candidate);

        if (score > bestScore) {
            bestCandidate = candidate;
            bestScore = score;
            bestReasons = reasons;
        }
    }

    if (
        bestCandidate &&
        bestScore >= 60 &&
        !bestCandidate.classList.contains("tsk-found-it")
    ) {
        bestCandidate.classList.add("tsk-found-it");

        console.log(
            `Tsk! found an X (score: ${bestScore}; ${bestReasons.join(", ")}):`,
            bestCandidate
        );
    }
}

function scanForModals(root = document) {
    // The newly-added element might itself be the modal.
    if (root instanceof Element && looksLikePopup(root) && isVisible(root)) {
        highlightCloseButtons(root);
    }

    // Or a semantic modal might be somewhere underneath it.
    const modals = root.querySelectorAll?.(
        "dialog, [role='dialog'], [aria-modal='true']"
    );

    for (const modal of modals ?? []) {
        if (isVisible(modal)) {
            highlightCloseButtons(modal);
        }
    }
}

function scan(root = document) {
    // Path A:
    // A very strong close control can identify itself without modal context.
    findStrongCloseButtons(root);

    // Path B:
    // Recognized popup context allows weaker close candidates.
    scanForModals(root);
}

scan();

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        if (mutation.type === "childList") {
            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    scan(node);
                }
            }
        }

        if (
            mutation.type === "attributes" &&
            mutation.target instanceof Element
        ) {
            scan(mutation.target);
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
        "class",
        "style",
        "hidden",
        "open",
        "aria-hidden"
    ]
});