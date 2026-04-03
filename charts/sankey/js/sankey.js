// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
function getCSVRepoPath(year, country) {
  year = year || "2022";
  country = country || "WM";
  return `year/${year}/${country}/domestic/trade_impact.csv`;
}

function getCSV_URL(year, country) {
  return `https://raw.githubusercontent.com/ModelEarth/trade-data/main/${getCSVRepoPath(year, country)}`;
}

function getCSVSourceURL(year, country) {
  return `https://github.com/ModelEarth/trade-data/blob/main/${getCSVRepoPath(year, country)}`;
}

// Exiobase 3 sector code → readable name (~60 most common codes)
const SECTOR_NAMES = {
  AGRIC: "Agriculture",
  AGRI:  "Agriculture",
  FORE:  "Forestry",
  FISH:  "Fishing",
  COAL:  "Coal Mining",
  CRUDE: "Crude Oil & Gas",
  URAN:  "Uranium Mining",
  IRON:  "Iron Ore Mining",
  NFMET: "Non-ferrous Metal Ores",
  STONE: "Stone Quarrying",
  SALT:  "Salt Mining",
  NATUR: "Natural Resources",
  MINNG: "Mining & Quarrying",
  FOOD:  "Food Products",
  BEVER: "Beverages",
  TOBAC: "Tobacco",
  TEXTI: "Textiles",
  WEAR:  "Wearing Apparel",
  LEATH: "Leather & Footwear",
  WOOD:  "Wood Products",
  PAPER: "Paper & Pulp",
  PRINT: "Printing & Publishing",
  PETRO: "Petroleum Refining",
  NUCLE: "Nuclear Fuel",
  CHEMI: "Basic Chemicals",
  SPCHE: "Specialty Chemicals",
  PHARMA:"Pharmaceuticals",
  FERTL: "Fertilizers",
  RUBBE: "Rubber & Plastics",
  PLAST: "Plastics",
  GLASS: "Glass & Ceramics",
  CEMEN: "Cement & Concrete",
  STEEL: "Iron & Steel",
  NFMTL: "Non-ferrous Metals",
  METAL: "Fabricated Metals",
  MACHI: "Machinery & Equipment",
  OFMAC: "Office Machinery",
  ELECT: "Electrical Equipment",
  ELEC2: "Electricity",
  RADIO: "Radio & TV Equipment",
  MEDIC: "Medical Instruments",
  MOTOR: "Motor Vehicles",
  SHIPS: "Shipbuilding",
  AIRCR: "Aircraft",
  RAILW: "Railway Equipment",
  FURNI: "Furniture",
  RECYC: "Recycling",
  CONST: "Construction",
  DISTR: "Trade & Distribution",
  HOTEL: "Hotels & Restaurants",
  TRANS: "Transport Services",
  AIRTX: "Air Transport",
  WATRX: "Water Transport",
  POST:  "Post & Telecom",
  FINAN: "Financial Services",
  INSUR: "Insurance",
  REALE: "Real Estate",
  RESEA: "Research & Development",
  PUBLI: "Public Administration",
  EDUCA: "Education",
  HEALT: "Health Services",
  SEWAG: "Sewage & Waste Treatment",
  GAS:   "Gas Supply",
  WATR:  "Water Supply",
  GASES: "Industrial Gases",
  // Additional codes seen in WM 2022 data
  TRAN1: "Land Transport",
  TRAN2: "Water Transport",
  TRAN3: "Air Transport",
  GASDI: "Gas Distribution",
  RETA1: "Retail Trade",
  PFERT: "Fertilizers & Nitrogen",
  POSTT: "Post & Telecommunications",
  ALUM1: "Aluminium Production",
  VEGET: "Vegetable & Animal Oils",
  BASIC: "Basic Pharmaceuticals",
  WHOLT: "Wholesale Trade",
  TEXTI: "Textiles",
  PAPPE: "Paper & Paperboard",
  COALT: "Coal & Lignite",
  COKNG: "Coke & Refined Petroleum",
  ELECTR:"Electricity Distribution",
  SEWWT: "Sewage & Waste Treatment",
  PUBAD: "Public Administration",
  ACTIV: "Business Activities",
  RENTS: "Renting of Machinery",
};

// Per-metric display config
// Scale: divisor to convert raw values to display units
const METRICS = {
  amount:           { label: "Dollars Spent",      unit: "M EUR",         scale: 1e6  },
  CO2_total:        { label: "CO\u2082 Emissions",  unit: "Gt CO\u2082",  scale: 1e12 },
  Water_total:      { label: "Water Use",            unit: "Gm\u00B3",     scale: 1e9  },
  Employment_total: { label: "Employment",           unit: "M jobs",        scale: 1e6  },
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let rawData = null;
let currentMetric = "amount";
let currentTopN   = 20;
let currentTitleMode = "full";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sectorLabel(code) {
  return SECTOR_NAMES[code] || code;
}

function displaySectorLabel(code) {
  if (currentTitleMode === "short") return code;
  if (currentTitleMode === "verbose") return code + " - " + sectorLabel(code);
  return sectorLabel(code);
}

function fmtValue(val, metricKey) {
  const m = METRICS[metricKey];
  const scaled = val / m.scale;
  const formatted = scaled >= 1000
    ? scaled.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : scaled.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return formatted + "\u00A0" + m.unit;
}

function setStatus(msg) {
  document.getElementById("sankey-status").textContent = msg;
}

function updateCSVSourceLink(year, country) {
  const csvPath = getCSVRepoPath(year, country);
  const csvLink = document.getElementById("sankey-csv-link");
  const csvPathElem = document.getElementById("sankey-csv-path");

  if (csvLink) {
    csvLink.href = getCSVSourceURL(year, country);
  }
  if (csvPathElem) {
    csvPathElem.textContent = csvPath;
  }
}

// ---------------------------------------------------------------------------
// eCharts instance
// ---------------------------------------------------------------------------
const chartDom = document.getElementById("sankey-chart");
const chart = echarts.init(chartDom);
window.addEventListener("resize", () => chart.resize());

// ---------------------------------------------------------------------------
// Build Sankey data from rawData
// ---------------------------------------------------------------------------
function buildSankeyData(metricKey, topN) {
  // Step 1: Aggregate raw rows → (src, tgt) total value; skip self-loops.
  const flowMap = new Map();
  for (const row of rawData) {
    const src = row.industry1;
    const tgt = row.industry2;
    if (!src || !tgt || src === tgt) continue;
    const val = parseFloat(row[metricKey]);
    if (!isFinite(val) || val <= 0) continue;
    const key = src + "\x00" + tgt;
    flowMap.set(key, (flowMap.get(key) || 0) + val);
  }

  // Step 2: Resolve bidirectional pairs (A→B and B→A) — keep only the
  // dominant direction so the aggregated graph has no 2-node cycles.
  const resolvedMap = new Map();
  for (const [key, val] of flowMap) {
    const sep    = key.indexOf("\x00");
    const src    = key.slice(0, sep);
    const tgt    = key.slice(sep + 1);
    const revKey = tgt + "\x00" + src;
    if (resolvedMap.has(revKey)) {
      if (val > resolvedMap.get(revKey)) {
        resolvedMap.delete(revKey);
        resolvedMap.set(key, val);
      }
      // else reverse direction is dominant — leave it, drop this one.
    } else {
      resolvedMap.set(key, val);
    }
  }

  // Step 3: Sort descending, take top N, convert to link objects.
  let links = Array.from(resolvedMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, value]) => {
      const sep = key.indexOf("\x00");
      return {
        source: key.slice(0, sep),
        target: key.slice(sep + 1),
        value,
      };
    });

  // Step 4: Strip any remaining multi-node cycles via iterative DFS.
  // Each pass finds all back-edges; remove the lowest-value one and repeat.
  links = removeCycles(links);

  // Step 5: Collect unique node names from the clean link set.
  const nodeSet = new Set();
  for (const lk of links) { nodeSet.add(lk.source); nodeSet.add(lk.target); }
  const nodes = Array.from(nodeSet).map(name => ({ name }));

  return { nodes, links };
}

// ---------------------------------------------------------------------------
// Cycle removal helpers
// ---------------------------------------------------------------------------

// Returns all back-edges found by DFS (edges whose target is "gray" / on the
// current recursion stack, meaning they point back into an ancestor).
function findBackEdges(links) {
  const adj = new Map();
  for (const lk of links) {
    if (!adj.has(lk.source)) adj.set(lk.source, []);
    adj.get(lk.source).push(lk);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color    = new Map();
  const backEdges = [];

  function dfs(node) {
    color.set(node, GRAY);
    for (const lk of (adj.get(node) || [])) {
      const c = color.get(lk.target) || WHITE;
      if (c === GRAY) {
        backEdges.push(lk);        // back-edge → cycle
      } else if (c === WHITE) {
        dfs(lk.target);
      }
    }
    color.set(node, BLACK);
  }

  const nodes = new Set();
  for (const lk of links) { nodes.add(lk.source); nodes.add(lk.target); }
  for (const node of nodes) {
    if (!color.get(node)) dfs(node);
  }
  return backEdges;
}

// Repeatedly remove the lowest-value back-edge until the graph is a DAG.
function removeCycles(links) {
  let remaining = links.slice();
  for (let guard = 0; guard < links.length; guard++) {
    const backs = findBackEdges(remaining);
    if (backs.length === 0) break;
    // Drop the cheapest back-edge (least information loss).
    const worst = backs.reduce((min, e) => e.value < min.value ? e : min);
    remaining = remaining.filter(lk => lk !== worst);
  }
  return remaining;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render() {
  if (!rawData) return;

  const m = METRICS[currentMetric];
  const { nodes, links } = buildSankeyData(currentMetric, currentTopN);

  if (links.length === 0) {
    setStatus("No data available for this combination.");
    chart.clear();
    return;
  }

  const option = {
    tooltip: {
      trigger: "item",
      triggerOn: "mousemove",
      confine: true,
      formatter: function(params) {
        if (params.dataType === "edge") {
          return (
            "<b>" + sectorLabel(params.data.source) + "</b>"
            + " &rarr; "
            + "<b>" + sectorLabel(params.data.target) + "</b>"
            + "<br/>"
            + m.label + ": <b>" + fmtValue(params.data.value, currentMetric) + "</b>"
          );
        }
        // Node tooltip — sum of all adjacent links
        return "<b>" + sectorLabel(params.name) + "</b>";
      },
    },
    series: [{
      type: "sankey",
      layout: "none",
      layoutIterations: 32,
      emphasis: {
        focus: "adjacency",
      },
      nodeAlign: "left",
      nodeGap: 14,
      nodeWidth: 22,
      left:   "1%",
      right:  currentTitleMode === "verbose" ? "36%" : (currentTitleMode === "full" ? "30%" : "18%"),
      top:    "2%",
      bottom: "4%",
      data:  nodes,
      links: links,
      label: {
        position: "right",
        fontSize: currentTitleMode === "verbose" ? 10 : (currentTitleMode === "full" ? 11 : 12),
        color: "#333",
        formatter: function(params) { return displaySectorLabel(params.name); },
      },
      lineStyle: {
        color:     "gradient",
        opacity:   0.45,
        curveness: 0.5,
      },
      itemStyle: {
        borderWidth: 1,
        borderColor: "#aaa",
      },
    }],
  };

  chart.setOption(option, /* notMerge = */ true);
  chart.resize();

  setStatus(
    "Showing top\u00A0" + links.length + " flows by " + m.label
    + " \u00B7 " + nodes.length + " industries"
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
function fitSelectToValue(sel) {
  const tmp = document.createElement("select");
  const cs = window.getComputedStyle(sel);
  tmp.style.cssText = "position:absolute;visibility:hidden;";
  tmp.style.font = cs.font;
  tmp.style.padding = cs.padding;
  tmp.style.border = cs.border;
  tmp.style.boxSizing = cs.boxSizing;
  const opt = document.createElement("option");
  opt.textContent = sel.options[sel.selectedIndex].text;
  tmp.appendChild(opt);
  document.body.appendChild(tmp);
  sel.style.width = tmp.offsetWidth + "px";
  document.body.removeChild(tmp);
}

const currencySelect = document.getElementById("currency-select");
currencySelect.addEventListener("change", function() { fitSelectToValue(this); });
fitSelectToValue(currencySelect);

const titleModeSelect = document.getElementById("title-mode-select");
titleModeSelect.addEventListener("change", function() { fitSelectToValue(this); });
fitSelectToValue(titleModeSelect);

document.getElementById("metric-select").addEventListener("change", function(e) {
  currentMetric = e.target.value;
  document.getElementById("currency-label").style.display = currentMetric === "amount" ? "" : "none";
  render();
});

document.getElementById("topn-slider").addEventListener("input", function(e) {
  currentTopN = parseInt(e.target.value, 10);
  document.getElementById("topn-label").textContent = currentTopN;
  render();
});

document.getElementById("title-mode-select").addEventListener("change", function(e) {
  currentTitleMode = e.target.value;
  render();
});

// ---------------------------------------------------------------------------
// Year + Country hash filter
// ---------------------------------------------------------------------------
function initFilters() {
  const countrySelect = document.getElementById('country-select');
  const yearSelect = document.getElementById('year-select');

  countrySelect.addEventListener('change', function() {
    goHash({
      country: countrySelect.value,
      year: yearSelect.value,
    });
  });

  yearSelect.addEventListener('change', function() {
    goHash({
      country: countrySelect.value,
      year: yearSelect.value,
    });
  });

  loadFromHash();
}

function loadFromHash() {
  const hash = getHash();
  const year = hash.year || '2022';
  const country = hash.country || 'WM';

  // Update filter selects if they exist
  const countrySelect = document.getElementById('country-select');
  if (countrySelect) countrySelect.value = country;

  const yearSelect = document.getElementById('year-select');
  if (yearSelect) yearSelect.value = year;

  // Reload data with new URL
  const url = getCSV_URL(year, country);
  updateCSVSourceLink(year, country);
  setStatus('Loading data…');
  rawData = null;
  chart.clear();

  d3.csv(url).then(function(data) {
    rawData = data;
    setStatus('Loaded ' + data.length.toLocaleString() + ' trade flow records.');
    render();
  }).catch(function(err) {
    setStatus('Error loading CSV: ' + err.message);
  });
}

// Listen for hash changes (year or country)
document.addEventListener('hashChangeEvent', loadFromHash, false);

// Init
initFilters();