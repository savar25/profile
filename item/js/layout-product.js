// layout-product.js - Creates a comprehensive profile object from product YAML data
// This file parses EPD (Environmental Product Declaration) YAML files
// and structures the data for display in label-product.js

// ============================================
// Main Profile Object Creator
// ============================================

function createProductProfileObject(sourceData) {
    // Extract product name
    const itemName = extractProductName(sourceData);

    // Extract declared unit
    const declaredUnit = extractDeclaredUnit(sourceData);

    // Build sections array with all available metrics
    const sections = buildProductSections(sourceData);

    // Extract material composition
    const composition = extractComposition(sourceData);

    // Extract percentile data
    const percentiles = extractPercentiles(sourceData);

    // Raw data for calculators
    const rawData = {
        gwp: toNumber(sourceData.gwp),
        massPerUnit: toNumber(sourceData.mass_per_declared_unit),
        density: toNumber(sourceData.density),
        pricePerUnit: toNumber(sourceData.price_per_unit),
        defaultDistance: sourceData.category ? toNumber(sourceData.category.default_distance) : null
    };

    return {
        itemName,
        declaredUnit,
        sections,
        composition,
        percentiles,
        rawData
    };
}

// Alias for compatibility with existing code
function createProfileObject(sourceData) {
    return createProductProfileObject(sourceData);
}

// ============================================
// Product Name Extraction
// ============================================

function extractProductName(data) {
    // Try multiple possible name fields
    return data.name ||
        (data.product_specific && data.product_specific.product_name) ||
        data.product_name ||
        (data.category && data.category.name) ||
        "Product";
}

// ============================================
// Declared Unit Extraction
// ============================================

function extractDeclaredUnit(data) {
    return data.declared_unit ||
        data.category_declared_unit ||
        (data.category && data.category.declared_unit) ||
        "unit";
}

// ============================================
// Build Product Sections
// ============================================

function buildProductSections(data) {
    const sections = [];

    // 1. Primary GWP (Global Warming Potential)
    const gwp = toNumber(data.gwp);
    if (gwp !== null) {
        sections.push({
            name: "Global Warming Potential",
            value: gwp,
            unit: " kgCO2e",
            primary: true,
            importance: "high",
            metricType: "gwp",
            percentOfAverage: calculateImpactPercentOfAverage(gwp, "gwp"),
            subsections: buildGWPSubsections(data)
        });
    }

    // 2. GWP per kg (if mass data available)
    const massPerUnit = toNumber(data.mass_per_declared_unit);
    if (gwp !== null && massPerUnit !== null && massPerUnit > 0) {
        const gwpPerKg = gwp / massPerUnit;
        sections.push({
            name: "GWP per Kilogram",
            value: gwpPerKg,
            unit: " kgCO2e/kg",
            importance: "medium"
        });
    }

    // 3. Uncertainty-adjusted GWP
    const gwpAdj = toNumber(data.uncertainty_adjusted_gwp);
    if (gwpAdj !== null && gwpAdj !== gwp) {
        sections.push({
            name: "Uncertainty-Adjusted GWP",
            value: gwpAdj,
            unit: " kgCO2e",
            importance: "medium",
            subsections: [
                {
                    name: "Best Practice Estimate",
                    value: toNumber(data.best_practice_gwp) || toNumber(data.lowest_plausible_gwp),
                    unit: " kgCO2e"
                },
                {
                    name: "Conservative Estimate",
                    value: toNumber(data.conservative_gwp),
                    unit: " kgCO2e"
                }
            ].filter(s => s.value !== null)
        });
    }

    // 4. Physical Properties
    if (massPerUnit !== null || data.density) {
        const physicalSubs = [];

        if (massPerUnit !== null) {
            physicalSubs.push({
                name: "Mass per Unit",
                value: massPerUnit,
                unit: " kg"
            });
        }

        const density = toNumber(data.density);
        if (density !== null) {
            physicalSubs.push({
                name: "Density",
                value: density,
                unit: " kg/m\u00b3"
            });
        }

        if (physicalSubs.length > 0) {
            sections.push({
                name: "Physical Properties",
                value: massPerUnit || density,
                unit: massPerUnit ? " kg" : " kg/m\u00b3",
                importance: "low",
                subsections: physicalSubs
            });
        }
    }

    // 5. Statistical Distribution (percentiles)
    const p50 = toNumber(data.gwp_per_category_declared_unit_50p);
    if (p50 !== null) {
        sections.push({
            name: "Category Statistics",
            value: p50,
            unit: " kgCO2e (median)",
            importance: "low",
            subsections: [
                {
                    name: "10th Percentile (Best)",
                    value: toNumber(data.gwp_per_category_declared_unit_10p),
                    unit: " kgCO2e"
                },
                {
                    name: "20th Percentile",
                    value: toNumber(data.gwp_per_category_declared_unit_20p),
                    unit: " kgCO2e"
                },
                {
                    name: "50th Percentile (Median)",
                    value: p50,
                    unit: " kgCO2e"
                },
                {
                    name: "90th Percentile (Worst)",
                    value: toNumber(data.gwp_per_category_declared_unit_90p),
                    unit: " kgCO2e"
                }
            ].filter(s => s.value !== null)
        });
    }

    // 6. Uncertainty Metrics
    const stdDev = toNumber(data.gwp_per_kg_std);
    const uncertainty = toNumber(data.lcia_uncertainty);
    if (stdDev !== null || uncertainty !== null) {
        const uncertaintySubs = [];

        if (stdDev !== null) {
            uncertaintySubs.push({
                name: "Standard Deviation",
                value: stdDev,
                unit: " kgCO2e"
            });
        }

        if (uncertainty !== null) {
            uncertaintySubs.push({
                name: "LCIA Uncertainty",
                value: uncertainty * 100,
                unit: "%",
                decimals: 1
            });
        }

        const factor = toNumber(data.uncertainty_factor);
        if (factor !== null) {
            uncertaintySubs.push({
                name: "Uncertainty Factor",
                value: factor,
                unit: "",
                decimals: 3
            });
        }

        if (uncertaintySubs.length > 0) {
            sections.push({
                name: "Uncertainty Analysis",
                value: stdDev || uncertainty,
                unit: stdDev ? " kgCO2e" : "",
                importance: "low",
                subsections: uncertaintySubs
            });
        }
    }

    // 7. Category Information
    if (data.category) {
        const catSubs = [];

        if (data.category.name) {
            catSubs.push({
                name: "Category Name",
                value: data.category.name,
                unit: "",
                isText: true
            });
        }

        const defaultDist = toNumber(data.category.default_distance);
        if (defaultDist !== null) {
            catSubs.push({
                name: "Default Transport Distance",
                value: defaultDist,
                unit: " km"
            });
        }

        if (catSubs.length > 0) {
            sections.push({
                name: "Category Information",
                value: 0,
                unit: "",
                importance: "low",
                isInfoSection: true,
                subsections: catSubs
            });
        }
    }

    // 8. Additional Environmental Metrics (if available)
    const additionalMetrics = extractAdditionalMetrics(data);
    if (additionalMetrics.length > 0) {
        sections.push({
            name: "Additional Environmental Impacts",
            value: 0,
            unit: "",
            importance: "low",
            subsections: additionalMetrics
        });
    }

    return sections;
}

// ============================================
// GWP Subsections Builder
// ============================================

function buildGWPSubsections(data) {
    const subsections = [];

    // Best practice GWP
    const bestPractice = toNumber(data.best_practice_gwp) || toNumber(data.lowest_plausible_gwp);
    if (bestPractice !== null) {
        subsections.push({
            name: "Best Practice",
            value: bestPractice,
            unit: " kgCO2e"
        });
    }

    // Conservative GWP
    const conservative = toNumber(data.conservative_gwp);
    if (conservative !== null) {
        subsections.push({
            name: "Conservative",
            value: conservative,
            unit: " kgCO2e"
        });
    }

    return subsections;
}

// ============================================
// Additional Environmental Metrics
// ============================================

function extractAdditionalMetrics(data) {
    const metrics = [];

    // Energy consumption
    const energy = toNumber(data.energy_consumption) || toNumber(data.primary_energy);
    if (energy !== null) {
        metrics.push({
            name: "Energy Consumption",
            value: energy,
            unit: " MJ"
        });
    }

    // Water usage
    const water = toNumber(data.water_consumption) || toNumber(data.water_use);
    if (water !== null) {
        metrics.push({
            name: "Water Consumption",
            value: water,
            unit: " L"
        });
    }

    // Ozone depletion
    const ozone = toNumber(data.ozone_depletion);
    if (ozone !== null) {
        metrics.push({
            name: "Ozone Depletion Potential",
            value: ozone,
            unit: " kg CFC-11 eq"
        });
    }

    // Acidification
    const acid = toNumber(data.acidification);
    if (acid !== null) {
        metrics.push({
            name: "Acidification Potential",
            value: acid,
            unit: " kg SO2 eq"
        });
    }

    // Eutrophication
    const eutro = toNumber(data.eutrophication);
    if (eutro !== null) {
        metrics.push({
            name: "Eutrophication Potential",
            value: eutro,
            unit: " kg PO4 eq"
        });
    }

    return metrics;
}

// ============================================
// Material Composition Extraction
// ============================================

function extractComposition(data) {
    const composition = [];

    // Check for composition field
    if (data.composition && Array.isArray(data.composition)) {
        data.composition.forEach(item => {
            composition.push({
                name: item.name || item.material || "Unknown",
                percent: toNumber(item.percent) || toNumber(item.percentage) || 0,
                mass: toNumber(item.mass) || toNumber(item.weight) || null
            });
        });
    }

    // Check for material fields (common in EPD YAML)
    if (data.materials && typeof data.materials === "object") {
        Object.entries(data.materials).forEach(([name, value]) => {
            if (typeof value === "object") {
                composition.push({
                    name: name,
                    percent: toNumber(value.percent) || toNumber(value.percentage) || 0,
                    mass: toNumber(value.mass) || toNumber(value.weight) || null
                });
            } else {
                composition.push({
                    name: name,
                    percent: toNumber(value) || 0,
                    mass: null
                });
            }
        });
    }

    // Parse from string description if no structured data
    if (composition.length === 0 && data.product_description) {
        // Try to extract material percentages from description
        const percentRegex = /(\w+[\w\s]*?):\s*(\d+(?:\.\d+)?)\s*%/gi;
        let match;
        while ((match = percentRegex.exec(data.product_description)) !== null) {
            composition.push({
                name: match[1].trim(),
                percent: parseFloat(match[2]),
                mass: null
            });
        }
    }

    return composition;
}

// ============================================
// Percentile Data Extraction
// ============================================

function extractPercentiles(data) {
    return {
        p10: toNumber(data.gwp_per_category_declared_unit_10p),
        p20: toNumber(data.gwp_per_category_declared_unit_20p),
        p50: toNumber(data.gwp_per_category_declared_unit_50p),
        p90: toNumber(data.gwp_per_category_declared_unit_90p)
    };
}

// ============================================
// Helper: toNumber (if not defined in shared.js)
// ============================================

if (typeof toNumber !== "function") {
    function toNumber(value) {
        if (typeof value === "number") return value;
        if (typeof value === "string") {
            const m = value.match(/-?\d+(\.\d+)?/);
            return m ? parseFloat(m[0]) : null;
        }
        return null;
    }
}

// ============================================
// Helper: calculateImpactPercentOfAverage (if not defined)
// ============================================

if (typeof calculateImpactPercentOfAverage !== "function") {
    const avgBenchmarks = {
        gwp: 10,
        energy: 50,
        water: 100,
        waste: 5
    };

    function calculateImpactPercentOfAverage(value, type) {
        const base = avgBenchmarks[type];
        return base ? ((value / base) * 100).toFixed(0) : null;
    }
}

// ============================================
// Export for module systems (optional)
// ============================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createProductProfileObject,
        createProfileObject,
        extractProductName,
        extractDeclaredUnit,
        buildProductSections,
        extractComposition,
        extractPercentiles
    };
}
