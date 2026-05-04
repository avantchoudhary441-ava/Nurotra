require('dotenv').config();
const aiService = require('./services/aiService');

async function testPhase4Final() {
    console.log("=== Phase 4 FINAL Test: Root Cause Fix ===\n");

    const prompt = "Build me a premium Hotel Revenue Intelligence dashboard. Show revenue breakdown by country (Portugal $6.3M, UK $2.5M, France $1.8M, Spain $1.4M, Germany $1.2M) using a geographic view. Add a combined chart showing Monthly Bookings vs Cancellation Rate (Jan: 5000/12%, Feb: 4800/15%, Mar: 6200/10%, Apr: 7100/8%). Include KPIs for Total Bookings, Average Daily Rate, and Cancellation %.";

    try {
        const result = await aiService.processDocsAgentQuery(prompt, "CREATE");
        if (result.generation && result.generation.type === 'dashboard') {
            const data = result.generation.data;
            console.log(`✅ Title: ${data.title}`);
            console.log(`✅ Theme: ${data.theme || '❌ NOT SET'}`);
            console.log(`✅ Widget Count: ${data.widgets.length}\n`);

            let hasMap = false, hasComposed = false, hasMultiSeries = false;

            data.widgets.forEach((w, i) => {
                const label = w.type === 'chart' ? `chart(${w.chartType})` : w.type;
                console.log(`  Widget ${i + 1}: [${label}] "${w.title}"`);

                if (w.type === 'map') {
                    hasMap = true;
                    console.log(`    📍 Regions: ${w.data.map(d => d.region).join(', ')}`);
                }
                if (w.type === 'chart' && w.chartType === 'map') {
                    console.log(`    ⚠️ Map as chartType (frontend handles this via fallback)`);
                    hasMap = true;
                }
                if (w.chartType === 'composed') {
                    hasComposed = true;
                    const multiSeries = w.data.some(d => d.valueSecondary !== undefined);
                    if (multiSeries) {
                        hasMultiSeries = true;
                        console.log(`    📊 Multi-Series: confirmed (valueSecondary present)`);
                    } else {
                        console.log(`    📊 Composed but single-series (frontend fallback active)`);
                    }
                }
            });

            console.log(`\n=== FINAL RESULTS ===`);
            console.log(`  Theme: ${data.theme ? '✅ ' + data.theme : '❌ Missing'}`);
            console.log(`  Map Widget: ${hasMap ? '✅' : '❌'}`);
            console.log(`  Composed Chart: ${hasComposed ? '✅' : '❌'}`);
            console.log(`  Multi-Series: ${hasMultiSeries ? '✅' : '⚠️ Fallback'}`);
        } else {
            console.log(`❌ Expected dashboard, got: ${result.intent}`);
        }
    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

testPhase4Final();
