/* =========================================================================
   data/data.js — composes the site from the per-page fragments in
   data/pages/*.js (loaded before this file). Order here = nav order.
   ========================================================================= */

window.SITE_META = {
  title: { en: "Impact Investing & B Corps", zh: "影響力投資與 B 型企業圖鑑" },
  subtitle: {
    en: "A referenced field guide to impact investing, B Corps, Yunus & Grameen, global examples, key figures and Taiwan's ecosystem",
    zh: "影響力投資、B 型企業、尤努斯與窮人銀行、各國案例、關鍵人物與台灣生態系的附來源圖鑑"
  },
  url: "https://impact-investing.peteraim.com/",
  repo: "tingwei161803/impact-investing"
};

window.SITE_PAGES = [
  window.PAGE_HOME,
  window.PAGE_CONCEPTS,
  window.PAGE_BCORP,
  window.PAGE_YUNUS,
  window.PAGE_WORLD,
  window.PAGE_PEOPLE,
  window.PAGE_TAIWAN,
  window.PAGE_GLOSSARY,
  window.PAGE_QUIZ,
  window.PAGE_FLASHCARDS
].filter(Boolean);
