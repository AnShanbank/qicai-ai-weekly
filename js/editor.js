(function () {
  const stage = document.getElementById("editorStage");
  const toastEl = document.getElementById("edToast");
  const fileInput = document.getElementById("imgFile");
  const mediaTools = document.getElementById("mediaTools");
  const fadeSize = document.getElementById("fadeSize");
  const fadeVal = document.getElementById("fadeVal");
  const fadeRow = document.getElementById("fadeRow");
  const fadeHint = document.getElementById("fadeHint");
  const posY = document.getElementById("posY");
  const posVal = document.getElementById("posVal");
  const targetHint = document.getElementById("targetHint");
  let textOn = false;
  let selectedPage = null;
  let selectedMedia = null;
  let pendingImg = null;
  let insertMode = "replace";
  let insertSide = "auto";
  let insertFloat = "right";

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function setVar(name, value) {
    document.documentElement.style.setProperty(name, value);
  }

  function pageList() {
    return Array.from(document.querySelectorAll("#book .page"));
  }

  function visiblePages() {
    const pf = window.AIWeekly && window.AIWeekly.getPageFlip();
    const pages = pageList();
    if (!pf || !pages.length) return [];
    const i = pf.getCurrentPageIndex();
    const total = pf.getPageCount();
    const portrait = pf.getOrientation && pf.getOrientation() === "portrait";
    if (portrait || i === 0 || i === total - 1) return [pages[i]].filter(Boolean);
    return [pages[i], pages[i + 1]].filter(Boolean);
  }

  function selectPage(page) {
    document.querySelectorAll("#book .page.ed-page-on").forEach((el) => {
      el.classList.remove("ed-page-on");
    });
    selectedPage = page || null;
    if (selectedPage) selectedPage.classList.add("ed-page-on");
    updateTargetHint();
  }

  function updateTargetHint() {
    const vis = visiblePages();
    if (!targetHint) return;
    if (!vis.length) {
      targetHint.textContent = "先点书里要改的那一页（左页或右页都可以）。";
      return;
    }
    const idx = vis.indexOf(selectedPage);
    if (idx === 0) targetHint.textContent = "当前目标：左页。右侧白页请点右页再插入，或直接点「底部大图·右页」。";
    else if (idx === 1) targetHint.textContent = "当前目标：右页。";
    else {
      const rightArt = vis[1] && vis[1].querySelector(".sheet.article");
      const leftArt = vis[0] && vis[0].querySelector(".sheet.article");
      if (rightArt && !leftArt) targetHint.textContent = "未点选时，底部大图会插到右侧白页。也可先点那一页。";
      else targetHint.textContent = "先点要改的左页或右页，或用「底部大图·左页 / 右页」。";
    }
  }

  function targetPage(forcedSide) {
    const vis = visiblePages();
    if (!vis.length) return null;
    const side = forcedSide || insertSide;
    if (side === "left") return vis[0] || null;
    if (side === "right") return vis[1] || vis[0] || null;
    if (selectedPage && vis.includes(selectedPage)) return selectedPage;
    const arts = vis.filter((p) => p.querySelector(".sheet.article"));
    if (arts.length === 1) return arts[0];
    if (arts.length === 2) return arts[1];
    return vis[1] || vis[0] || null;
  }

  function articleSheet(forcedSide) {
    const page = targetPage(forcedSide);
    return page && page.querySelector(".sheet.article");
  }

  function mediaImg(el) {
    if (!el) return null;
    if (el.matches && el.matches("img")) return el;
    return el.querySelector("img");
  }

  function isBanner(el) {
    return !!(el && (el.classList.contains("mag-banner-wrap") || el.querySelector(".mag-banner")));
  }

  function parsePos(img) {
    const raw = (img && (img.style.objectPosition || img.style.getPropertyValue("object-position"))) || "";
    const parts = raw.trim().split(/\s+/);
    const y = parseFloat(parts[1] || "50");
    return Number.isFinite(y) ? y : 50;
  }

  function parseFade(wrap) {
    const raw = wrap && wrap.style.getPropertyValue("--fade");
    const n = parseFloat(raw || "28");
    return Number.isFinite(n) ? n : 28;
  }

  function applyPos(el, y) {
    const wrap = el.classList.contains("mag-banner-wrap") ? el : el.closest && el.closest(".mag-banner-wrap");
    const img = mediaImg(el);
    if (wrap) wrap.style.setProperty("--pos", y + "%");
    if (img) {
      img.style.objectPosition = "50% " + y + "%";
      img.style.setProperty("--pos", y + "%");
    }
  }

  function applyFade(wrap, n) {
    wrap.style.setProperty("--fade", n + "%");
    const fade = wrap.querySelector(".mag-banner-fade");
    if (fade) fade.style.opacity = n <= 0 ? "0" : "1";
  }

  function selectMedia(el) {
    document.querySelectorAll(".ed-media-on").forEach((n) => n.classList.remove("ed-media-on"));
    selectedMedia = el || null;
    if (!selectedMedia) {
      mediaTools.hidden = true;
      return;
    }
    selectedMedia.classList.add("ed-media-on");
    const page = selectedMedia.closest(".page");
    if (page) selectPage(page);
    mediaTools.hidden = false;
    const banner = isBanner(selectedMedia);
    fadeRow.hidden = !banner;
    fadeSize.hidden = !banner;
    fadeHint.hidden = !banner;
    const wrap = selectedMedia.classList.contains("mag-banner-wrap")
      ? selectedMedia
      : selectedMedia.closest && selectedMedia.closest(".mag-banner-wrap");
    const img = mediaImg(selectedMedia);
    const y = parsePos(img);
    posY.value = String(Math.round(y));
    posVal.textContent = String(Math.round(y));
    if (banner && wrap) {
      const f = parseFade(wrap);
      fadeSize.value = String(Math.round(f));
      fadeVal.textContent = String(Math.round(f));
    }
  }

  function enableText(on) {
    textOn = on;
    const book = document.getElementById("book");
    const extras = document.querySelectorAll(".viewer-brand");
    const nodes = [
      ...(book ? book.querySelectorAll("h1, h2, p, span, b, strong") : []),
      ...extras,
    ];
    nodes.forEach((el) => {
      if (el.closest(".pn")) return;
      el.contentEditable = on ? "true" : "false";
      el.spellcheck = false;
    });
    document.getElementById("btnText").textContent = on ? "关闭文字编辑" : "启用文字编辑";
  }

  function tintFromImg(img) {
    const ch = img && img.closest(".chapter");
    if (!ch || !window.AIWeekly || !window.AIWeekly.tintChapter) return;
    window.AIWeekly.tintChapter(img, ch.querySelector(".ch-mask"));
  }

  function themeTag() {
    const s = getComputedStyle(document.documentElement);
    return `<style id="issued-theme">:root {
  --blue: ${s.getPropertyValue("--blue").trim()};
  --blue-deep: ${s.getPropertyValue("--blue-deep").trim()};
  --orange: ${s.getPropertyValue("--orange").trim()};
  --gold: ${s.getPropertyValue("--gold").trim()};
  --title-size: ${s.getPropertyValue("--title-size").trim()};
  --body-size: ${s.getPropertyValue("--body-size").trim()};
}</style>`;
  }

  function exportReadonly() {
    enableText(false);
    selectMedia(null);
    selectPage(null);
    const pages =
      (window.AIWeekly && window.AIWeekly.serializePages()) ||
      document.getElementById("book").innerHTML;
    const brand = document.querySelector(".viewer-brand");
    const title = document.title.replace(/^编辑 · /, "") || "AI周刊";
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="人物专访、AI科普、事业部案例与行业标杆。" />
  <link rel="icon" href="./assets/share-cover.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700;900&family=Noto+Serif+SC:wght@500;650&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="./css/styles.css?v=20260818p" />
  ${themeTag()}
</head>
<body>
  <div class="viewer">
    <header class="viewer-top">
      <img class="viewer-logo" src="./assets/logo-black.png" alt="HIFICHEM" />
      <div class="viewer-brand">${brand ? brand.innerHTML : "AI 周刊"}</div>
    </header>
    <button type="button" class="nav-arrow nav-prev" id="prevBtn" aria-label="上一页">‹</button>
    <button type="button" class="nav-arrow nav-next" id="nextBtn" aria-label="下一页">›</button>
    <main class="stage">
      <div class="book-shell mode-cover" id="bookShell">
        <div class="book-viewport" id="bookViewport">
        <div id="book">
${pages}
        </div>
        </div>
        <div class="book-gutter" id="bookGutter" aria-hidden="true"></div>
        <div class="book-spine-cover" id="bookSpineCover" aria-hidden="true"></div>
        <div class="book-edge book-edge--left" id="bookEdgeLeft" aria-hidden="true"></div>
        <div class="book-edge book-edge--right" id="bookEdgeRight" aria-hidden="true"></div>
        <div class="book-edge book-edge--bottom" id="bookEdgeBottom" aria-hidden="true"></div>
      </div>
    </main>
    <footer class="viewer-bottom">
      <div class="page-indicator"><span id="pageLabel">1</span><span class="sep">/</span><span id="pageTotal">21</span></div>
    </footer>
  </div>
  <script src="./js/page-flip.browser.js"><\/script>
  <script src="./js/app.js?v=20260818p"><\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "AI周刊-发布.html";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("已导出只读页：请放在本文件夹内打开");
  }

  function pickFile(mode, side, floatSide) {
    insertMode = mode;
    insertSide = side || "auto";
    insertFloat = floatSide || "right";
    pendingImg = null;
    fileInput.click();
  }

  function makeBannerWrap(src) {
    const wrap = document.createElement("div");
    wrap.className = "mag-banner-wrap";
    wrap.style.setProperty("--fade", "28%");
    wrap.style.setProperty("--pos", "50%");
    const img = document.createElement("img");
    img.className = "mag-banner";
    img.alt = "";
    img.src = src;
    img.style.objectPosition = "50% 50%";
    const fade = document.createElement("span");
    fade.className = "mag-banner-fade";
    wrap.append(img, fade);
    return wrap;
  }

  function insertBanner(src, side) {
    const article = articleSheet(side);
    if (!article) {
      toast(side === "right" ? "右侧不是白底文章页" : side === "left" ? "左侧不是白底文章页" : "请翻到白底文章页，或点「底部大图·右页」");
      return;
    }
    let wrap = article.querySelector(".mag-banner-wrap");
    if (!wrap) {
      wrap = makeBannerWrap(src);
      article.appendChild(wrap);
    } else {
      const img = wrap.querySelector(".mag-banner");
      if (img) img.src = src;
    }
    selectPage(article.closest(".page"));
    selectMedia(wrap);
    toast("已插入底部大图，可调上部渐变和上下取景");
  }

  function insertInset(src, floatSide, pageSide) {
    const page = targetPage(pageSide);
    const body = page && page.querySelector(".art-body");
    if (!body) {
      toast("请先点白底文章页（右页请点「底部大图·右页」同侧的页面），再插入小图");
      return;
    }
    const img = document.createElement("img");
    img.className = "mag-inset" + (floatSide === "left" ? " left" : "");
    img.alt = "";
    img.src = src;
    img.style.setProperty("--pos", "50%");
    img.style.objectPosition = "50% 50%";
    body.insertBefore(img, body.firstChild);
    selectPage(page);
    selectMedia(img);
    toast(floatSide === "left" ? "已插入左侧绕排小图" : "已插入右侧绕排小图");
  }

  async function boot() {
    window.AIWeeklyConfig = { disableFlipByClick: true };
    const res = await fetch("./index.html?v=editor");
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const viewer = doc.querySelector(".viewer");
    if (!viewer) {
      toast("无法载入周刊页面");
      return;
    }
    stage.appendChild(document.importNode(viewer, true));
    document.title = "编辑 · " + (doc.title || "AI周刊");
    await loadScript("./js/app.js?v=20260818p");

    document.getElementById("btnText").addEventListener("click", () => enableText(!textOn));
    document.getElementById("btnExport").addEventListener("click", exportReadonly);
    document.getElementById("btnBannerL").addEventListener("click", () => pickFile("banner", "left"));
    document.getElementById("btnBannerR").addEventListener("click", () => pickFile("banner", "right"));
    document.getElementById("btnInsetR").addEventListener("click", () => pickFile("inset", "auto", "right"));
    document.getElementById("btnInsetL").addEventListener("click", () => pickFile("inset", "auto", "left"));
    document.getElementById("btnReplaceSel").addEventListener("click", () => {
      if (!selectedMedia) {
        toast("请先点书里的图片");
        return;
      }
      insertMode = "replace";
      pendingImg = mediaImg(selectedMedia);
      fileInput.click();
    });

    fadeSize.addEventListener("input", () => {
      fadeVal.textContent = fadeSize.value;
      if (selectedMedia && isBanner(selectedMedia)) {
        const wrap = selectedMedia.classList.contains("mag-banner-wrap")
          ? selectedMedia
          : selectedMedia.closest(".mag-banner-wrap");
        if (wrap) applyFade(wrap, Number(fadeSize.value));
      }
    });
    posY.addEventListener("input", () => {
      posVal.textContent = posY.value;
      if (selectedMedia) applyPos(selectedMedia, Number(posY.value));
    });

    document.getElementById("colorBlue").addEventListener("input", (e) => {
      setVar("--blue", e.target.value);
      setVar("--blue-deep", e.target.value);
    });
    document.getElementById("colorOrange").addEventListener("input", (e) => setVar("--orange", e.target.value));
    document.getElementById("colorGold").addEventListener("input", (e) => setVar("--gold", e.target.value));
    document.getElementById("sizeTitle").addEventListener("input", (e) => {
      setVar("--title-size", e.target.value + "rem");
      document.getElementById("sizeTitleVal").textContent = e.target.value;
    });
    document.getElementById("sizeBody").addEventListener("input", (e) => {
      setVar("--body-size", e.target.value + "rem");
      document.getElementById("sizeBodyVal").textContent = e.target.value;
    });

    stage.addEventListener(
      "click",
      (e) => {
        const wrap = e.target.closest(".mag-banner-wrap");
        const img = e.target.closest("#book img");
        const page = e.target.closest("#book .page");
        if (wrap) {
          e.preventDefault();
          e.stopPropagation();
          selectMedia(wrap);
          return;
        }
        if (img) {
          e.preventDefault();
          e.stopPropagation();
          selectMedia(img);
          return;
        }
        if (page) selectPage(page);
      },
      true
    );

    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result;
        if (insertMode === "banner") {
          insertBanner(src, insertSide);
          return;
        }
        if (insertMode === "inset") {
          insertInset(src, insertFloat, insertSide);
          return;
        }
        if (pendingImg) {
          pendingImg.src = src;
          tintFromImg(pendingImg);
          if (selectedMedia) selectMedia(selectedMedia);
          pendingImg = null;
          toast("图片已替换，可用滑杆调取景和渐变");
        }
      };
      reader.readAsDataURL(file);
    });

    const pf = window.AIWeekly && window.AIWeekly.getPageFlip();
    if (pf && pf.on) pf.on("flip", () => setTimeout(updateTargetHint, 40));
    updateTargetHint();
  }

  boot().catch((err) => {
    console.error(err);
    toast("编辑器启动失败，请用本地服务器打开");
  });
})();
