
/* =========================================================
   SOVT TRANSLATOR ENGINE
   V1.6
   Dictionary + SOVT API + Google + MyMemory
========================================================= */

class TranslatorEngine {

    constructor(
        dictionaryUrl = "/Data/ITACHI_DICTIONARY.tsv",
        apiUrl = ""
    ) {
        this.dictionaryUrl = dictionaryUrl;
        this.apiUrl = apiUrl;
        this.dictionary = new Map();
        this.cache = new Map();
        this.loaded = false;
        this.loading = null;
    }

    /* =====================================================
       LOAD DICTIONARY
    ===================================================== */

    async load() {

        if (this.loaded) return true;

        if (this.loading) return this.loading;

        this.loading = (async () => {
            try {
                const response = await fetch(
                    this.dictionaryUrl,
                    { cache: "no-cache" }
                );

                if (!response.ok) {
                    throw new Error("Failed to load dictionary.");
                }

                const text = await response.text();

                this.parseTSV(text);
                this.loaded = true;

                console.log(
                    "SOVT Dictionary Loaded:",
                    this.dictionary.size
                );

                return true;

            } finally {
                this.loading = null;
            }
        })();

        return this.loading;
    }

    /* =====================================================
       NORMALIZE
    ===================================================== */

    normalize(text) {

        if (typeof text !== "string") return "";

        let value = text
            .replace(/^\uFEFF/, "")
            .trim()
            .replace(/\s+/g, " ");

        value = value
            .replace(/[إأآٱ]/g, "ا")
            .replace(/ى/g, "ي")
            .replace(/ؤ/g, "و")
            .replace(/ئ/g, "ي");

        value = value.replace(
            /[\u064B-\u065F\u0670]/g,
            ""
        );

        value = value.replace(/ـ+/g, "");

        value = value.replace(
            /([\u0621-\u064A])\1{2,}/g,
            "$1$1"
        );

        value = value.replace(
            /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~،؛؟«»“”‘’…]+/g,
            " "
        );

        return value
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    /* =====================================================
       PARSE TSV
    ===================================================== */

    parseTSV(text) {

        const lines = text.split(/\r?\n/);

        for (const line of lines) {

            if (!line.trim()) continue;

            const separator = line.indexOf("\t");

            if (separator === -1) continue;

            const source = line
                .slice(0, separator)
                .trim();

            const target = line
                .slice(separator + 1)
                .trim();

            if (!source || !target) continue;

            const key = this.normalize(source);

            if (!this.dictionary.has(key)) {
                this.dictionary.set(key, new Set());
            }

            this.dictionary.get(key).add(target);
        }
    }

    /* =====================================================
       EXACT SEARCH
    ===================================================== */

    findExact(text) {

        const key = this.normalize(text);
        const results = this.dictionary.get(key);

        if (!results) return [];

        return Array.from(results);
    }

    /* =====================================================
       SCORE
    ===================================================== */

    scoreTranslation(original, candidate, options = {}) {

        const originalNormalized = this.normalize(original);
        const candidateNormalized = this.normalize(candidate);

        let score = 0;

        if (originalNormalized === candidateNormalized) {
            score += 1000;
        }

        const originalWords = originalNormalized
            .split(" ")
            .filter(Boolean);

        const candidateWords = candidateNormalized
            .split(" ")
            .filter(Boolean);

        if (originalWords.length === candidateWords.length) {
            score += 100;
        }

        score += Math.min(candidateWords.length * 10, 100);

        if (options.target === "ar") {
            if (/[\u0600-\u06FF]/.test(candidate)) {
                score += 30;
            }
        }

        if (options.target === "en") {
            if (/^[\x00-\x7F]+$/.test(candidate)) {
                score += 30;
            }
        }

        return score;
    }

    /* =====================================================
       CHOOSE BEST
    ===================================================== */

    chooseBest(original, translations, options = {}) {

        if (!Array.isArray(translations) || !translations.length) {
            return null;
        }

        const scored = translations.map(translation => ({
            translation,
            score: this.scoreTranslation(
                original,
                translation,
                options
            )
        }));

        scored.sort((a, b) => b.score - a.score);

        return scored[0];
    }

    /* =====================================================
       OPTIONAL SOVT API
       apiUrl must be a complete endpoint URL.
    ===================================================== */

    async apiTranslate(text, source, target) {

        if (!this.apiUrl) {
            throw new Error("SOVT API URL is not configured.");
        }

        const response = await fetch(this.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text,
                source,
                target
            })
        });

        if (!response.ok) {
            throw new Error("SOVT API request failed.");
        }

        const data = await response.json();

        if (
            !data ||
            !data.success ||
            typeof data.translation !== "string" ||
            !data.translation.trim()
        ) {
            throw new Error(
                data?.error || "Invalid SOVT API response."
            );
        }

        return data;
    }

    /* =====================================================
       LANGUAGE DETECTION FOR MYMEMORY
    ===================================================== */

    detectLanguage(text) {

        if (/[\u0600-\u06FF]/.test(text)) {
            return "ar";
        }

        return "en";
    }

    /* =====================================================
       GOOGLE TRANSLATE
    ===================================================== */

    async googleTranslate(
        text,
        source = "auto",
        target = "en"
    ) {

        const url =
            "https://translate.googleapis.com/" +
            "translate_a/single" +
            "?client=gtx" +
            "&sl=" + encodeURIComponent(source) +
            "&tl=" + encodeURIComponent(target) +
            "&dt=t" +
            "&q=" + encodeURIComponent(text);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Google translation failed.");
        }

        const data = await response.json();

        if (!Array.isArray(data) || !Array.isArray(data[0])) {
            throw new Error("Invalid Google response.");
        }

        const translation = data[0]
            .map(part => part[0] || "")
            .join("")
            .trim();

        if (!translation) {
            throw new Error("Google returned an empty translation.");
        }

        return translation;
    }

    /* =====================================================
       MYMEMORY BACKUP
    ===================================================== */

    async myMemoryTranslate(
        text,
        source = "auto",
        target = "en"
    ) {

        const detectedSource =
            source === "auto"
                ? this.detectLanguage(text)
                : source;

        if (detectedSource === target) {
            throw new Error("Source and target languages are identical.");
        }

        const url =
            "https://api.mymemory.translated.net/get" +
            "?q=" + encodeURIComponent(text) +
            "&langpair=" +
            encodeURIComponent(detectedSource + "|" + target);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("MyMemory request failed.");
        }

        const data = await response.json();

        if (
            !data ||
            data.responseStatus !== 200 ||
            !data.responseData ||
            typeof data.responseData.translatedText !== "string"
        ) {
            throw new Error("Invalid MyMemory response.");
        }

        const translation =
            data.responseData.translatedText.trim();

        if (!translation) {
            throw new Error("MyMemory returned an empty translation.");
        }

        return translation;
    }

    /* =====================================================
       MAIN TRANSLATION
    ===================================================== */

    async translate(text, options = {}) {

        if (typeof text !== "string" || !text.trim()) {
            return {
                success: false,
                type: "invalid_input",
                translations: []
            };
        }

        const source = options.source || "auto";
        const target = options.target || "en";

        try {
            await this.load();
        } catch (error) {
            console.error("SOVT Dictionary Error:", error);

            return {
                success: false,
                type: "dictionary_error",
                translations: [],
                error: error.message
            };
        }

        /* 1. LOCAL DICTIONARY */

        const localTranslations = this.findExact(text);

        if (localTranslations.length) {

            const best = this.chooseBest(
                text,
                localTranslations,
                { source, target }
            );

            if (best) {
                return {
                    success: true,
                    type: "exact",
                    translations: [best.translation],
                    score: best.score,
                    source: "dictionary",
                    api: false
                };
            }
        }

        /* CACHE */

        const cacheKey = [
            this.normalize(text),
            source,
            target
        ].join("::");

        if (this.cache.has(cacheKey)) {
            return {
                success: true,
                type: "external",
                translations: [this.cache.get(cacheKey)],
                source: "cache",
                cached: true,
                api: false
            };
        }

        /* 2. OPTIONAL SOVT API */

        if (this.apiUrl) {
            try {
                const apiResult = await this.apiTranslate(
                    text,
                    source,
                    target
                );

                const translation = apiResult.translation.trim();

                if (apiResult.type === "exact") {
                    return {
                        success: true,
                        type: "exact",
                        translations: [translation],
                        source: "api",
                        api: true
                    };
                }

                this.cache.set(cacheKey, translation);

                return {
                    success: true,
                    type: "external",
                    translations: [translation],
                    source: "api",
                    cached: apiResult.cached === true,
                    api: true
                };

            } catch (error) {
                console.warn("SOVT API unavailable:", error);
            }
        }

        /* 3. GOOGLE TRANSLATE */

        try {
            const translation = await this.googleTranslate(
                text,
                source,
                target
            );

            this.cache.set(cacheKey, translation);

            return {
                success: true,
                type: "external",
                translations: [translation],
                source: "google",
                api: false
            };

        } catch (error) {
            console.warn("Google Translate unavailable:", error);
        }

        /* 4. MYMEMORY BACKUP */

        try {
            const translation = await this.myMemoryTranslate(
                text,
                source,
                target
            );

            this.cache.set(cacheKey, translation);

            return {
                success: true,
                type: "external",
                translations: [translation],
                source: "mymemory",
                api: false
            };

        } catch (error) {
            console.error("External translation failed:", error);

            return {
                success: false,
                type: "external_error",
                translations: [],
                error: error.message
            };
        }
    }

    /* =====================================================
       DICTIONARY SIZE
    ===================================================== */

    getSize() {
        return this.dictionary.size;
    }
}

/* =========================================================
   GLOBAL ENGINE
========================================================= */

const translator = new TranslatorEngine(
    "/Data/ITACHI_DICTIONARY.tsv",
    ""
);

window.TranslatorEngine = TranslatorEngine;
window.translator = translator;

/* =========================================================
   AUTO LOAD
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        try {
            await translator.load();

            console.log("SOVT Translator Ready.");

            console.log(
                "Dictionary entries:",
                translator.getSize()
            );

        } catch (error) {
            console.error("SOVT startup error:", error);
        }
    }
);
