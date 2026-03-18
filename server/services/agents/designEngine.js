/**
 * Agent 6 — Design Intelligence Engine
 * Maps content to layouts and selects visual assets.
 */
const ICON_MAPPING = {
    "ai": "mdi:robot",
    "finance": "mdi:chart-line",
    "healthcare": "mdi:medical-bag",
    "education": "mdi:school",
    "cloud": "mdi:cloud",
    "data": "mdi:database",
    "startup": "mdi:rocket-launch",
    "strategy": "mdi:lightbulb-on"
};

const LAYOUTS = [
    "text_image",
    "image_text",
    "two_column",
    "grid_cards",
    "icon_cards",
    "timeline",
    "chart_layout",
    "hero"
];

const selectDesign = (slideContent) => {
    // Basic heuristics for layout selection
    let layout = "two_column"; // Default

    // Logic from Stage 5
    if (slideContent.bullets.length > 5) layout = "grid_cards";
    if (slideContent.title.toLowerCase().includes("process") || slideContent.title.toLowerCase().includes("workflow")) layout = "timeline";
    if (slideContent.bullets.some(b => b.includes("%") || b.match(/\d+/))) layout = "chart_layout";

    // Randomize slightly to avoid repetition (Stage 5)
    if (Math.random() > 0.7) {
        layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
    }

    return {
        layout,
        icon: ICON_MAPPING[slideContent.icon_key] || "mdi:circle-medium",
        image_query: slideContent.image_query
    };
};

const processDesign = (generatedSlides) => {
    return generatedSlides.map(slide => ({
        ...slide,
        design: selectDesign(slide)
    }));
};

module.exports = { processDesign, ICON_MAPPING };
