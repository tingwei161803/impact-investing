/* =========================================================================
   app.js — page-level layout engine. shell.js has already injected the
   shared chrome and published window.LDW. This script:

     1. reads the current page from <body data-page="...">,
     2. picks a renderer from RENDERERS by that page's `layout`,
     3. paints it into <main id="page"> and wires its interactions.

   It paints in the page's own language (LDW.state.lang, which comes from
   <html lang>) and never repaints for a language change: switching language
   is a navigation to the twin URL, not an in-page redraw.

   Layouts: hub | editorial | glossary | quiz | flashcards
   The `editorial` layout is a block system (p/h3/ul/quote/note/facts/stats/
   timeline/cases/table/links); `cases` rows open the shared <dialog> and are
   deep-linkable via #slug.
   ========================================================================= */
(function () {
  "use strict";

  function boot() {
    if (!window.LDW || !window.LDW.ready) {
      document.addEventListener("ldw:shell-ready", boot, { once: true });
      return;
    }
    var L = window.LDW;
    var t = L.t, esc = L.escapeHtml;
    var pageEl = document.getElementById("page");
    var teardowns = [];   // observers / listeners to disconnect before each repaint

    /* per-page UI strings (chrome strings live in shell.js) */
    var UI = {
      en: {
        open: "Details", refs: "References", profile: "Profile", keyFacts: "Key facts",
        search: "Search…", results: " result(s)", updated: "Compiled ",
        explore: "Read", quote: "In their words",
        qOf: ["Question ", " of "], next: "Next", check: "Answer", restart: "Restart",
        score: "Score", finalTitle: "Quiz complete", finalFmt: ["", " correct out of ", " questions"],
        flip: "Tap to flip", front: "Term", back: "Meaning", prev: "Previous", nextCard: "Next",
        cardOf: ["Card ", " of "]
      },
      zh: {
        open: "詳情", refs: "參考來源", profile: "簡介", keyFacts: "重點整理",
        search: "搜尋…", results: " 筆結果", updated: "整理於 ",
        explore: "閱讀", quote: "他們怎麼說",
        qOf: ["第 ", " 題,共 "], next: "下一題", check: "作答", restart: "重新開始",
        score: "得分", finalTitle: "測驗完成", finalFmt: ["答對 ", " 題,共 ", " 題"],
        flip: "點擊翻面", front: "詞", back: "義", prev: "上一張", nextCard: "下一張",
        cardOf: ["第 ", " 張,共 "]
      }
    };
    function ui(key) { return (UI[L.state.lang] || UI.en)[key]; }

    /* ---------- shared bits ---------- */
    function head(p) {
      var chip = t(p.chip)
        ? '<span class="page-head__chip"><span class="dot" aria-hidden="true"></span>' + esc(t(p.chip)) + "</span>" : "";
      var sub = t(p.subtitle)
        ? '<p class="page-head__sub">' + esc(t(p.subtitle)) + "</p>" : "";
      return '<header class="page-head">' + (chip ? chip + "<br/>" : "") +
        "<h1>" + esc(t(p.title)) + "</h1>" + sub + "</header>";
    }

    function linkRow(links) {
      if (!links || !links.length) return "";
      return '<div class="linkrow">' + links.map(function (l) {
        return '<a class="linkchip" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
          '<span class="material-symbols-rounded" aria-hidden="true">open_in_new</span>' +
          esc(typeof l.label === "string" ? l.label : t(l.label)) + "</a>";
      }).join("") + "</div>";
    }

    function tagChips(tags) {
      if (!tags || !tags.length) return "";
      return '<span class="case__tags">' + tags.map(function (g) {
        return '<span class="tag">' + esc(typeof g === "string" ? g : t(g)) + "</span>";
      }).join("") + "</span>";
    }

    /* ---------- dialog registry (cases + deep links) ---------- */
    var dialogItems = {};   // slug -> item (rebuilt each render)

    function openItem(slug) {
      var item = dialogItems[slug];
      if (!item) return;
      var dlg = L.dialog(), body = document.getElementById("dialogBody");
      var d = item.detail || {};
      var html = '<h2 id="dialogTitle" class="serif">' + esc(t(item.name)) + "</h2>";
      if (t(item.meta)) html += '<p class="dialog__role">' + esc(t(item.meta)) + "</p>";
      var paras = d.paragraphs || [];
      if (paras.length) {
        html += "<h3>" + esc(ui("profile")) + "</h3>" +
          paras.map(function (pp) { return '<p class="dialog__bio">' + esc(t(pp)) + "</p>"; }).join("");
      }
      if (d.points && d.points.length) {
        html += "<h3>" + esc(ui("keyFacts")) + "</h3><div>" +
          d.points.map(function (pt) {
            return '<div class="point-row"><b>' + esc(t(pt.label)) + "</b><p>" + esc(t(pt.text)) + "</p></div>";
          }).join("") + "</div>";
      }
      if (d.quote && t(d.quote.text)) {
        html += "<h3>" + esc(ui("quote")) + "</h3>" +
          '<blockquote class="pull">' + esc(t(d.quote.text)) +
          (t(d.quote.cite) ? "<cite>" + esc(t(d.quote.cite)) + "</cite>" : "") + "</blockquote>";
      }
      if (d.refs && d.refs.length) {
        html += "<h3>" + esc(ui("refs")) + "</h3><ul class=\"reflist\">" +
          d.refs.map(function (rf) {
            return '<li><a href="' + esc(rf.url) + '" target="_blank" rel="noopener">' +
              '<span class="material-symbols-rounded" aria-hidden="true">link</span>' +
              esc(typeof rf.label === "string" ? rf.label : t(rf.label)) + "</a></li>";
          }).join("") + "</ul>";
      }
      body.innerHTML = html;
      body.scrollTop = 0;
      if (!dlg.open) dlg.showModal();
      if (location.hash.slice(1) !== slug) history.replaceState(null, "", "#" + slug);
    }

    function wireDialogLinks() {
      [].forEach.call(pageEl.querySelectorAll(".case[data-slug]"), function (btn) {
        btn.addEventListener("click", function () { openItem(btn.dataset.slug); });
      });
      var dlg = L.dialog();
      function onClose() {
        var slug = location.hash.slice(1);
        if (slug && dialogItems[slug]) history.replaceState(null, "", location.pathname + location.search);
      }
      function onHash() {
        var slug = location.hash.slice(1);
        if (slug && dialogItems[slug]) openItem(slug);
        else if (dlg.open) dlg.close();
      }
      dlg.addEventListener("close", onClose);
      window.addEventListener("hashchange", onHash);
      teardowns.push(function () {
        dlg.removeEventListener("close", onClose);
        window.removeEventListener("hashchange", onHash);
      });
      /* deep link on load */
      var slug = location.hash.slice(1);
      if (slug && dialogItems[slug]) openItem(slug);
    }

    /* ---------- editorial blocks ---------- */
    function renderBlocks(blocks, counters) {
      return (blocks || []).map(function (b) {
        switch (b.type) {
          case "h3":
            return "<h3 class=\"serif\">" + esc(t(b.text)) + "</h3>";
          case "ul":
            return "<ul>" + (b.items || []).map(function (li) { return "<li>" + esc(t(li)) + "</li>"; }).join("") + "</ul>";
          case "quote":
            return '<blockquote class="pull">' + esc(t(b.text)) +
              (t(b.cite) ? "<cite>" + esc(t(b.cite)) + "</cite>" : "") + "</blockquote>";
          case "note":
            return '<div class="aside-note">' + esc(t(b.text)) + "</div>";
          case "facts":
            return '<div class="factlist">' + (b.items || []).map(function (f) {
              return '<div class="fact" data-item>' +
                '<div class="fact__label"><span class="material-symbols-rounded" aria-hidden="true">' +
                  esc(f.icon || "info") + "</span><span>" + esc(t(f.label)) + "</span></div>" +
                '<div><div class="fact__value">' + esc(t(f.value)) + "</div>" +
                  (t(f.note) ? '<div class="fact__note">' + esc(t(f.note)) + "</div>" : "") + "</div>" +
              "</div>";
            }).join("") + "</div>";
          case "stats":
            return '<div class="statstrip">' + (b.items || []).map(function (s) {
              return '<div class="statstrip__item" data-item>' +
                '<span class="statstrip__value serif">' + esc(typeof s.value === "string" ? s.value : t(s.value)) + "</span>" +
                '<span class="statstrip__label">' + esc(t(s.label)) + "</span>" +
                (t(s.note) ? '<span class="statstrip__note">' + esc(t(s.note)) + "</span>" : "") +
              "</div>";
            }).join("") + "</div>";
          case "timeline":
            return '<ol class="timeline">' + (b.events || []).map(function (ev) {
              return '<li class="tl-item" data-item><span class="tl-dot" aria-hidden="true"></span>' +
                '<span class="tl-date">' + esc(typeof ev.date === "string" ? ev.date : t(ev.date)) + "</span>" +
                '<h3 class="tl-title">' + esc(t(ev.title)) + "</h3>" +
                '<p class="tl-body">' + esc(t(ev.body)) + "</p></li>";
            }).join("") + "</ol>";
          case "cases":
            var label = t(b.label)
              ? '<p class="people-group-label">' + esc(t(b.label)) + "</p>" : "";
            return label + '<div class="cases">' + (b.items || []).map(function (it) {
              counters.caseNum += 1;
              var n = counters.caseNum;
              dialogItems[it.slug] = it;
              return '<button class="case" type="button" data-item data-slug="' + esc(it.slug) + '" ' +
                'aria-haspopup="dialog" aria-label="' + esc(t(it.name)) + '">' +
                '<span class="case__num" aria-hidden="true">' + (n < 10 ? "0" + n : n) + "</span>" +
                "<span>" +
                  '<span class="case__name">' + esc(t(it.name)) + "</span>" +
                  '<p class="case__meta">' + esc(t(it.meta)) + "</p>" +
                  tagChips(it.tags) +
                "</span>" +
                '<span class="case__cta">' + esc(ui("open")) +
                  '<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></span>' +
              "</button>";
            }).join("") + "</div>";
          case "table":
            var thead = (b.columns || []).map(function (c) { return "<th>" + esc(t(c.label)) + "</th>"; }).join("");
            var tbody = (b.rows || []).map(function (row) {
              return "<tr data-item>" + (b.columns || []).map(function (c) {
                var v = row[c.key];
                return "<td>" + esc(typeof v === "object" ? t(v) : String(v == null ? "" : v)) + "</td>";
              }).join("") + "</tr>";
            }).join("");
            return '<div class="table-wrap"><table class="data-table">' +
              "<thead><tr>" + thead + "</tr></thead><tbody>" + tbody + "</tbody></table></div>";
          case "links":
            return linkRow(b.items);
          default: /* p */
            return "<p>" + esc(t(b.text)) + "</p>";
        }
      }).join("");
    }

    /* =====================================================================
       LAYOUT REGISTRY
       ===================================================================== */
    var RENDERERS = {

      /* ---- hub: hero + stats + origin story + editorial page index ---- */
      hub: function (p) {
        var stats = (p.stats || []).map(function (s) {
          return '<div class="hero__stat" data-item>' +
            '<span class="hero__stat-value serif">' + esc(typeof s.value === "string" ? s.value : t(s.value)) + "</span>" +
            '<span class="hero__stat-label">' + esc(t(s.label)) + "</span></div>";
        }).join("");
        var intro = (p.intro || []).map(function (pp) {
          return "<p>" + esc(t(pp)) + "</p>";
        }).join("");
        var origin = "";
        if (p.origin) {
          origin = '<section class="section" data-item>' +
            '<header class="section-head"><div class="section-head__kicker">' + esc(t(p.origin.kicker)) + "</div>" +
            "<h2>" + esc(t(p.origin.heading)) + "</h2></header>" +
            '<div class="prose">' + (p.origin.paragraphs || []).map(function (pp) {
              return "<p>" + esc(t(pp)) + "</p>";
            }).join("") + "</div>" + linkRow(p.origin.links);
        }
        var idx = L.pages.filter(function (q) { return q.slug !== "home"; }).map(function (q, i) {
          var n = i + 1;
          return '<a class="pageindex__row" data-item href="' + esc(L.pageHref(q)) + '" ' +
              'aria-label="' + esc(t(q.title)) + '">' +
            '<span class="pageindex__num" aria-hidden="true">' + (n < 10 ? "0" + n : n) + "</span>" +
            "<span>" +
              '<span class="pageindex__title serif">' + esc(t(q.title)) + "</span>" +
              '<p class="pageindex__sub">' + esc(t(q.subtitle)) + "</p>" +
            "</span>" +
            '<span class="pageindex__cta">' + esc(ui("explore")) +
              '<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></span>' +
          "</a>";
        }).join("");
        return head(p) +
          '<div class="prose">' + intro + "</div>" +
          (stats ? '<div class="hero__stats">' + stats + "</div>" : "") +
          (origin ? origin + "</section>" : "") +
          '<div class="pageindex">' + idx + "</div>";
      },

      /* ---- editorial: numbered sections of blocks ---- */
      editorial: function (p) {
        var counters = { caseNum: 0 };
        var body = (p.sections || []).map(function (s, i) {
          var num = (i + 1) < 10 ? "0" + (i + 1) : String(i + 1);
          return '<section class="section" id="' + esc(s.id) + '" aria-labelledby="' + esc(s.id) + '-h">' +
            '<header class="section-head">' +
              '<div class="section-head__kicker">' + num + " · " + esc(t(s.kicker || s.heading)) + "</div>" +
              '<h2 id="' + esc(s.id) + '-h">' + esc(t(s.heading)) + "</h2>" +
              (t(s.sub) ? '<p class="section-head__sub">' + esc(t(s.sub)) + "</p>" : "") +
            "</header>" +
            '<div class="prose prose--wide">' + renderBlocks(s.blocks, counters) + "</div>" +
          "</section>";
        }).join("");
        return head(p) + body;
      },

      /* ---- glossary: searchable accordion ---- */
      glossary: function (p) {
        var items = (p.terms || []).map(function (row) {
          var hay = (t(row.term) + " " + (row.alias || "") + " " + t(row.def)).toLowerCase();
          return '<details class="acc-item" data-item data-q="' + esc(hay) + '">' +
            '<summary class="acc-q"><span class="acc-term">' + esc(t(row.term)) +
              (row.alias ? "<small>" + esc(row.alias) + "</small>" : "") + "</span>" +
            '<span class="material-symbols-rounded acc-chevron" aria-hidden="true">expand_more</span></summary>' +
            '<div class="acc-a">' + esc(t(row.def)) + "</div></details>";
        }).join("");
        return head(p) +
          '<div class="toolbar"><input id="search" class="search" type="search" autocomplete="off" ' +
            'placeholder="' + esc(ui("search")) + '" aria-label="' + esc(ui("search")) + '" /></div>' +
          '<p class="result-count" id="resultCount" aria-live="polite"></p>' +
          '<div class="accordion" id="accordion">' + items + "</div>";
      },

      /* ---- quiz: one question at a time, session-only score ---- */
      quiz: function (p) {
        return head(p) + '<div id="quizBox"></div>';
      },

      /* ---- flashcards: one flip card at a time ---- */
      flashcards: function (p) {
        return head(p) + '<div class="flash-wrap" id="flashBox"></div>';
      }
    };

    /* =====================================================================
       WIRING — keyed by layout, run after innerHTML is set
       ===================================================================== */
    var WIRE = {
      hub: function () { /* static rows; nothing to wire */ },

      editorial: function () { wireDialogLinks(); },

      glossary: function (p) {
        var search = document.getElementById("search");
        var count = document.getElementById("resultCount");
        var items = [].slice.call(pageEl.querySelectorAll(".acc-item"));
        function paintCount(n) {
          if (count) count.textContent = n + ui("results");
        }
        paintCount(items.length);
        if (search) search.addEventListener("input", function () {
          var q = this.value.trim().toLowerCase();
          var n = 0;
          items.forEach(function (it) {
            var hit = !q || (it.dataset.q || "").indexOf(q) !== -1;
            it.style.display = hit ? "" : "none";
            if (hit) n++;
          });
          paintCount(n);
        });
      },

      quiz: function (p) {
        var box = document.getElementById("quizBox");
        var qs = p.questions || [];
        var st = { i: 0, score: 0, answered: false, done: false };

        function paint() {
          if (st.done) {
            box.innerHTML = '<div class="quiz-card quiz-final" data-item>' +
              '<p class="quiz-progress">' + esc(ui("finalTitle")) + "</p>" +
              "<b class=\"serif\">" + st.score + " / " + qs.length + "</b>" +
              "<p>" + esc(ui("finalFmt")[0]) + st.score + esc(ui("finalFmt")[1]) + qs.length + esc(ui("finalFmt")[2]) + "</p>" +
              '<button class="btn" type="button" id="quizRestart">' + esc(ui("restart")) + "</button>" +
            "</div>";
            document.getElementById("quizRestart").addEventListener("click", function () {
              st.i = 0; st.score = 0; st.answered = false; st.done = false; paint();
            });
            return;
          }
          var q = qs[st.i];
          var keys = ["A", "B", "C", "D", "E"];
          var opts = (q.options || []).map(function (o, idx) {
            return '<button class="quiz-opt" type="button" data-idx="' + idx + '">' +
              '<span class="quiz-opt__key" aria-hidden="true">' + keys[idx] + "</span>" +
              "<span>" + esc(t(o)) + "</span></button>";
          }).join("");
          box.innerHTML =
            '<p class="quiz-progress">' + esc(ui("qOf")[0]) + (st.i + 1) + esc(ui("qOf")[1]) + qs.length +
              ' · ' + esc(ui("score")) + " " + st.score + "</p>" +
            '<div class="quiz-card" data-item>' +
              '<h3 class="quiz-q">' + esc(t(q.q)) + "</h3>" +
              '<div class="quiz-opts">' + opts + "</div>" +
              '<div id="quizFeedback"></div>' +
              '<div class="quiz-actions" id="quizActions"></div>' +
            "</div>";
          [].forEach.call(box.querySelectorAll(".quiz-opt"), function (btn) {
            btn.addEventListener("click", function () { answer(parseInt(btn.dataset.idx, 10)); });
          });
        }

        function answer(idx) {
          if (st.answered) return;
          st.answered = true;
          var q = qs[st.i];
          var correct = idx === q.answer;
          if (correct) st.score++;
          [].forEach.call(box.querySelectorAll(".quiz-opt"), function (btn) {
            var bi = parseInt(btn.dataset.idx, 10);
            btn.disabled = true;
            if (bi === q.answer) btn.classList.add("quiz-opt--correct");
            else if (bi === idx) btn.classList.add("quiz-opt--wrong");
          });
          var fb = document.getElementById("quizFeedback");
          if (fb && t(q.explain)) {
            fb.innerHTML = '<div class="quiz-explain">' + (correct ? "✅ " : "❌ ") + esc(t(q.explain)) + "</div>";
          }
          var act = document.getElementById("quizActions");
          act.innerHTML = '<button class="btn" type="button" id="quizNext">' + esc(ui("next")) + "</button>" +
            '<span class="quiz-score">' + esc(ui("score")) + " " + st.score + " / " + qs.length + "</span>";
          document.getElementById("quizNext").addEventListener("click", function () {
            st.answered = false;
            if (st.i + 1 >= qs.length) { st.done = true; } else { st.i++; }
            paint();
          });
        }

        paint();
      },

      flashcards: function (p) {
        var box = document.getElementById("flashBox");
        var cards = p.cards || [];
        var st = { i: 0, flipped: false };

        function paint() {
          var c = cards[st.i];
          if (!c) { box.innerHTML = '<p class="empty">—</p>'; return; }
          box.innerHTML =
            '<p class="flash-progress">' + esc(ui("cardOf")[0]) + (st.i + 1) + esc(ui("cardOf")[1]) + cards.length + "</p>" +
            '<button class="flashcard' + (st.flipped ? " flashcard--flipped" : "") + '" type="button" id="flashCard" ' +
              'aria-label="' + esc(ui("flip")) + '" data-item>' +
              '<span class="flashcard__inner">' +
                '<span class="flashcard__face flashcard__face--front">' +
                  '<span class="flashcard__hint">' + esc(ui("front")) + " · " + esc(ui("flip")) + "</span>" +
                  '<span class="flashcard__text serif">' + esc(t(c.front)) + "</span>" +
                "</span>" +
                '<span class="flashcard__face flashcard__face--back">' +
                  '<span class="flashcard__hint">' + esc(ui("back")) + "</span>" +
                  '<span class="flashcard__text">' + esc(t(c.back)) + "</span>" +
                "</span>" +
              "</span>" +
            "</button>" +
            '<div class="flash-actions">' +
              '<button class="btn btn--ghost" type="button" id="flashPrev">' +
                '<span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>' + esc(ui("prev")) + "</button>" +
              '<button class="btn" type="button" id="flashNext">' + esc(ui("nextCard")) +
                '<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>' +
            "</div>";
          document.getElementById("flashCard").addEventListener("click", function () {
            st.flipped = !st.flipped;
            this.classList.toggle("flashcard--flipped", st.flipped);
          });
          document.getElementById("flashPrev").addEventListener("click", function () {
            st.i = (st.i - 1 + cards.length) % cards.length; st.flipped = false; paint();
          });
          document.getElementById("flashNext").addEventListener("click", function () {
            st.i = (st.i + 1) % cards.length; st.flipped = false; paint();
          });
        }

        paint();
      }
    };

    /* =====================================================================
       RENDER the current page
       ===================================================================== */
    function render() {
      teardowns.forEach(function (fn) { try { fn(); } catch (e) {} });
      teardowns = [];
      dialogItems = {};
      var p = L.currentPage();
      if (!p) { pageEl.innerHTML = '<p class="empty">No page data.</p>'; return; }
      var fn = RENDERERS[p.layout] || RENDERERS.editorial;
      pageEl.className = "page page--" + p.layout;
      pageEl.innerHTML = fn(p);
      var w = WIRE[p.layout];
      if (w) w(p);
    }

    render();
  }

  boot();
})();
