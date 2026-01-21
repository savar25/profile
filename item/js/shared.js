// shared.js - Common utilities for food and product labels
// Shared between label.js and label-product.js

// ============================================
// Parsing Utilities
// ============================================

function parseNumeric(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const m = value.match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : NaN;
    }
    return NaN;
}

function toNumber(value) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
        const m = value.match(/-?\d+(\.\d+)?/);
        return m ? parseFloat(m[0]) : null;
    }
    return null;
}

// ============================================
// Formatting Utilities
// ============================================

function formatValue(value, name, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return "0";
    const n = name ? name.toLowerCase() : "";
    if (n.includes("calories") || n.includes("gwp") || n.includes("warming")) {
        return Math.round(value).toString();
    }
    return value.toFixed(decimals);
}

function formatKg(value) {
    if (value === null || value === undefined || isNaN(value)) return "0.0";
    return value.toFixed(1);
}

function formatPercent(value) {
    if (value === null || value === undefined || isNaN(value)) return "0";
    return Math.round(value).toString();
}

// ============================================
// Unit Utilities
// ============================================

function getUnit(nutrientName) {
    const name = (nutrientName || "").toLowerCase();
    if (name.includes("calories")) return "";
    if (name.includes("gwp") || name.includes("warming") || name.includes("co2")) return " kgCO2e";
    if (name.includes("energy")) return " MJ";
    if (name.includes("water")) return " L";
    if (name.includes("percent") || name.includes("%")) return "%";
    if (name.includes("sodium") || name.includes("potassium") ||
        name.includes("calcium") || name.includes("iron") ||
        name.includes("vitamin d") || name.includes("cholesterol") ||
        name.includes("caffeine")) return "mg";
    if (name.includes("mass") || name.includes("weight")) return " kg";
    if (name.includes("density")) return " kg/m\u00b3";
    return "g";
}

// ============================================
// Impact Rating System (Environmental Badge Style)
// ============================================

// Impact thresholds for different metrics (can be customized)
const IMPACT_THRESHOLDS = {
    gwp: { low: 2, medium: 5, high: 15 },           // kgCO2e/unit
    energy: { low: 20, medium: 50, high: 100 },     // MJ/unit
    water: { low: 10, medium: 50, high: 200 },      // L/unit
    percentile: { low: 25, medium: 50, high: 75 }   // percentile rank
};

function getImpactRating(value, metricType) {
    const thresholds = IMPACT_THRESHOLDS[metricType] || IMPACT_THRESHOLDS.gwp;
    if (value <= thresholds.low) return { level: "low", color: "#22c55e", label: "Low Impact" };
    if (value <= thresholds.medium) return { level: "medium", color: "#f59e0b", label: "Moderate Impact" };
    if (value <= thresholds.high) return { level: "high", color: "#f97316", label: "High Impact" };
    return { level: "very-high", color: "#ef4444", label: "Very High Impact" };
}

function getPercentileRating(percentile) {
    if (percentile <= 20) return { level: "excellent", color: "#22c55e", label: "Top 20%" };
    if (percentile <= 40) return { level: "good", color: "#84cc16", label: "Top 40%" };
    if (percentile <= 60) return { level: "average", color: "#f59e0b", label: "Average" };
    if (percentile <= 80) return { level: "below-average", color: "#f97316", label: "Below Average" };
    return { level: "poor", color: "#ef4444", label: "Bottom 20%" };
}

// ============================================
// Daily Value Calculations (for food labels)
// ============================================

const dailyValueReferences = {
    fat: 65,
    satFat: 20,
    cholesterol: 300,
    sodium: 2400,
    carb: 300,
    fiber: 25,
    addedSugars: 50,
    vitaminD: 20,
    calcium: 1300,
    iron: 18,
    potassium: 4700
};

function calculateDailyValue(value, type) {
    const base = dailyValueReferences[type];
    return base ? ((value / base) * 100).toFixed(0) : null;
}

// ============================================
// Average Impact Benchmarks (for product labels)
// ============================================

const averageImpactBenchmarks = {
    gwp: 10,          // kgCO2e per m2 (building materials average)
    energy: 50,       // MJ per m2
    water: 100,       // L per m2
    waste: 5          // kg per m2
};

function calculateImpactPercentOfAverage(value, type) {
    const base = averageImpactBenchmarks[type];
    return base ? ((value / base) * 100).toFixed(0) : null;
}

// ============================================
// Style Settings Management
// ============================================

const LABEL_STYLES = {
    FDA: "fda",
    BADGE: "badge"
};

const VERBOSITY_LEVELS = {
    SIMPLE: "simple",
    MEDIUM: "medium",
    DETAILED: "detailed"
};

const CALCULATOR_UNITS = {
    DECLARED: "declared",
    PER_KG: "per_kg",
    PER_1000: "per_1000"
};

// Default settings stored in localStorage
function getLabelSettings() {
    const defaults = {
        style: LABEL_STYLES.FDA,
        verbosity: VERBOSITY_LEVELS.MEDIUM,
        calculatorUnit: CALCULATOR_UNITS.DECLARED
    };

    try {
        const stored = localStorage.getItem("labelSettings");
        if (stored) {
            return { ...defaults, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn("Could not read label settings from localStorage:", e);
    }
    return defaults;
}

function saveLabelSettings(settings) {
    try {
        localStorage.setItem("labelSettings", JSON.stringify(settings));
    } catch (e) {
        console.warn("Could not save label settings to localStorage:", e);
    }
}

function updateLabelSetting(key, value) {
    const settings = getLabelSettings();
    settings[key] = value;
    saveLabelSettings(settings);
    return settings;
}

// ============================================
// Settings UI Components
// ============================================

function createSettingsToggle(containerId, onChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const settings = getLabelSettings();

    const wrapper = document.createElement("div");
    wrapper.className = "label-settings-bar";
    wrapper.innerHTML = `
        <div class="settings-bar-content">
            <div class="settings-group">
                <span class="settings-label">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    Display
                </span>
                <div class="style-toggle">
                    <button class="style-btn ${settings.style === 'fda' ? 'active' : ''}" data-style="fda">
                        <span class="btn-icon">\u2630</span> FDA Facts
                    </button>
                    <button class="style-btn ${settings.style === 'badge' ? 'active' : ''}" data-style="badge">
                        <span class="btn-icon">\ud83c\udf3f</span> Eco Badge
                    </button>
                </div>
            </div>
            <div class="settings-divider"></div>
            <div class="settings-group">
                <span class="settings-label">Detail Level</span>
                <div class="verbosity-toggle">
                    <button class="verbosity-btn ${settings.verbosity === 'simple' ? 'active' : ''}" data-verbosity="simple">
                        Simple
                    </button>
                    <button class="verbosity-btn ${settings.verbosity === 'medium' ? 'active' : ''}" data-verbosity="medium">
                        Medium
                    </button>
                    <button class="verbosity-btn ${settings.verbosity === 'detailed' ? 'active' : ''}" data-verbosity="detailed">
                        Detailed
                    </button>
                </div>
            </div>
        </div>
    `;

    container.appendChild(wrapper);

    // Style toggle buttons
    wrapper.querySelectorAll(".style-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            wrapper.querySelectorAll(".style-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const newSettings = updateLabelSetting("style", btn.dataset.style);
            if (onChange) onChange(newSettings);
        });
    });

    // Verbosity toggle buttons
    wrapper.querySelectorAll(".verbosity-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            wrapper.querySelectorAll(".verbosity-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const newSettings = updateLabelSetting("verbosity", btn.dataset.verbosity);
            if (onChange) onChange(newSettings);
        });
    });

    return wrapper;
}

function createCalculatorUnitDropdown(defaultUnit, onChange) {
    const settings = getLabelSettings();
    const currentUnit = settings.calculatorUnit || defaultUnit || CALCULATOR_UNITS.DECLARED;

    const wrapper = document.createElement("div");
    wrapper.className = "calculator-unit-dropdown";
    wrapper.innerHTML = `
        <label>Calculate per:</label>
        <select class="unit-select">
            <option value="declared" ${currentUnit === 'declared' ? 'selected' : ''}>Declared Unit</option>
            <option value="per_kg" ${currentUnit === 'per_kg' ? 'selected' : ''}>Per Kg</option>
            <option value="per_1000" ${currentUnit === 'per_1000' ? 'selected' : ''}>Per $1000</option>
        </select>
    `;

    const select = wrapper.querySelector(".unit-select");
    select.addEventListener("change", () => {
        const newSettings = updateLabelSetting("calculatorUnit", select.value);
        if (onChange) onChange(select.value, newSettings);
    });

    return wrapper;
}

// ============================================
// URL Hash Utilities
// ============================================

function getUrlHash() {
    return (function (pairs) {
        if (pairs === "") return {};
        var result = {};
        pairs.forEach(function(pair) {
            var keyValue = pair.split('=');
            var key = keyValue[0];
            var value = keyValue.slice(1).join('=');
            value = value.replace(/%26/g, '&');
            result[key] = value;
        });
        return result;
    })(window.location.hash.substr(1).split('&'));
}

// ============================================
// GitHub API Utilities
// ============================================

async function fetchJSON(url) {
    const r = await fetch(url);
    return r.json();
}

async function fetchText(url) {
    const r = await fetch(url);
    return r.text();
}

// ============================================
// Export for module systems (optional)
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseNumeric,
        toNumber,
        formatValue,
        formatKg,
        formatPercent,
        getUnit,
        getImpactRating,
        getPercentileRating,
        calculateDailyValue,
        calculateImpactPercentOfAverage,
        LABEL_STYLES,
        VERBOSITY_LEVELS,
        CALCULATOR_UNITS,
        getLabelSettings,
        saveLabelSettings,
        updateLabelSetting,
        createSettingsToggle,
        createCalculatorUnitDropdown,
        getUrlHash,
        fetchJSON,
        fetchText,
        dailyValueReferences,
        averageImpactBenchmarks,
        IMPACT_THRESHOLDS
    };
}
