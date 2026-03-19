/**
 * Website Generation Engine (Stage 9)
 * Generates modern, responsive HTML code with Tailwind and Framer Motion.
 */

const generateWebsite = async (data) => {
    // This is a high-level generator. In a real system, this would be an LLM-powered template synthesizer.
    const sections = data.slides.map((slide, index) => `
        <section class="min-h-screen flex items-center justify-center p-12" id="section-${index}">
            <div class="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div class="space-y-6">
                    <h2 class="text-5xl font-bold text-gray-900">${slide.title}</h2>
                    <ul class="space-y-4">
                        ${slide.bullets.map(b => `
                            <li class="flex items-start gap-3 text-lg text-gray-700">
                                <span class="mt-1.5 w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></span>
                                ${b}
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <div class="rounded-2xl overflow-hidden shadow-2xl bg-gray-100 aspect-video flex items-center justify-center">
                    <img src="https://source.unsplash.com/featured/?${slide.image_query || 'technology'}" alt="${slide.title}" class="w-full h-full object-cover">
                </div>
            </div>
        </section>
    `).join('');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.topic || 'Nurotra Generated Site'}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; scroll-behavior: smooth; }
    </style>
</head>
<body class="bg-slate-50">
    <nav class="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b">
        <div class="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <span class="font-bold text-xl text-blue-600">Nurotra AI</span>
            <div class="flex gap-6 text-sm font-medium">
                ${data.slides.map((s, i) => `<a href="#section-${i}" class="hover:text-blue-600 transition">${s.title.split(' ')[0]}</a>`).join('')}
            </div>
        </div>
    </nav>
    <main>
        ${sections}
    </main>
    <footer class="bg-gray-900 text-white py-12 px-4 text-center">
        <p>&copy; 2026 Nurotra AI. Generated with modular agentic architecture.</p>
    </footer>
</body>
</html>
    `;

    return {
        type: 'website',
        code: html,
        previewUrl: null // In production, this would be a temporary Vercel/S3 URL
    };
};

module.exports = { generateWebsite };
