(function () {
  const bookEl = document.getElementById("book");
  const bookShell = document.getElementById("bookShell");
  const bookViewport = document.getElementById("bookViewport");
  const gutterEl = document.getElementById("bookGutter");
  const edgeLeft = document.getElementById("bookEdgeLeft");
  const edgeRight = document.getElementById("bookEdgeRight");
  const edgeBottom = document.getElementById("bookEdgeBottom");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const pageLabel = document.getElementById("pageLabel");
  const pageTotal = document.getElementById("pageTotal");
  const originalHTML = bookEl.innerHTML;

  let pageFlip = null;
  let isMobile = window.innerWidth <= 900;
  let lastLayoutW = window.innerWidth;
  let lastLayoutH = 0;

  function viewSize() {
    const vv = window.visualViewport;
    return {
      w: Math.round(window.innerWidth),
      h: Math.round(vv && vv.height ? vv.height : window.innerHeight),
    };
  }

  /** width = 单页宽；spreadWidth = 横屏双页总宽。手机铺满舞台，封面和内页同一尺寸。 */
  function sizeBook() {
    const { w, h } = viewSize();
    const mobile = w <= 900;
    if (mobile) {
      const pageW = Math.max(260, w - 28);
      const pageH = Math.max(340, h - 48 - 40 - 22);
      return {
        pageWidth: pageW,
        spreadWidth: pageW,
        height: pageH,
        usePortrait: true,
      };
    }
    const maxSpread = Math.min(920, Math.max(680, Math.floor(w - 120)));
    const pageWidth = Math.floor(maxSpread / 2);
    return {
      pageWidth: pageWidth,
      spreadWidth: pageWidth * 2,
      height: Math.min(660, Math.max(480, h - 120)),
      usePortrait: false,
    };
  }

  function applyBookBox(s) {
    if (!bookEl || !bookViewport) return;
    bookViewport.style.width = s.spreadWidth + "px";
    bookViewport.style.height = s.height + "px";
    bookEl.style.width = s.spreadWidth + "px";
    bookEl.style.height = s.height + "px";
  }

  function resetBook() {
    bookEl.innerHTML = originalHTML;
    bookEl.style.transform = "";
    bookEl.style.width = "";
    bookEl.style.maxWidth = "";
    bookEl.classList.remove("stf__parent");
    bookShell.classList.remove("mode-cover", "mode-back", "mode-spread");
    bookShell.style.width = "";
    bookShell.style.overflow = "";
    bookViewport.style.width = "";
    bookViewport.style.transform = "";
    bookViewport.style.overflow = "";
  }

  function disposePageFlip() {
    if (!pageFlip) return;
    try {
      pageFlip.clear();
    } catch (_) {}
    pageFlip = null;
  }

  /**
   * 封面/封底：外壳裁成单页宽，用 clip-path 切掉另一侧空白。
   * viewport / #book 必须保持双页宽，否则 stretch 会把书缩成小卡片。
   * 不要给 #book 铺白底——空着的那一半会变成「假空白页」。
   */
  function syncShell() {
    if (!pageFlip || !bookShell || !bookViewport) return;

    const i = pageFlip.getCurrentPageIndex();
    const total = pageFlip.getPageCount();
    const portrait = pageFlip.getOrientation() === "portrait";
    const flipping = pageFlip.getState() !== "read";
    const s = sizeBook();
    const pw = s.pageWidth;
    const sw = s.spreadWidth;

    bookViewport.style.width = sw + "px";

    if (portrait) {
      bookShell.classList.remove("mode-cover", "mode-back");
      bookShell.classList.add("mode-spread");
      bookShell.style.width = pw + "px";
      bookViewport.style.width = pw + "px";
      bookViewport.style.height = s.height + "px";
      bookViewport.style.transform = "";
      bookViewport.style.overflow = "hidden";
      bookEl.style.width = pw + "px";
      bookEl.style.height = s.height + "px";
      return;
    }

    /* 翻页过程需要整幅双页，动画结束再裁回封面/封底 */
    if (flipping) {
      bookShell.classList.remove("mode-cover", "mode-back");
      bookShell.classList.add("mode-spread");
      bookShell.style.width = sw + "px";
      bookViewport.style.transform = "";
      bookViewport.style.overflow = "";
      return;
    }

    if (i === 0) {
      bookShell.classList.remove("mode-back", "mode-spread");
      bookShell.classList.add("mode-cover");
      bookShell.style.width = pw + "px";
      bookViewport.style.overflow = "visible";
      bookViewport.style.transform = "translateX(" + -pw + "px)";
      return;
    }

    if (i === total - 1) {
      bookShell.classList.remove("mode-cover", "mode-spread");
      bookShell.classList.add("mode-back");
      bookShell.style.width = pw + "px";
      bookViewport.style.overflow = "visible";
      bookViewport.style.transform = "translateX(0)";
      return;
    }

    bookShell.classList.remove("mode-cover", "mode-back");
    bookShell.classList.add("mode-spread");
    bookShell.style.width = sw + "px";
    bookViewport.style.transform = "";
    bookViewport.style.overflow = "";
  }

  /** 对齐参考月刊：全书约 12px 厚；翻 1 张左侧约 2px */
  function stackPx(pages, total) {
    if (pages <= 0) return 0;
    const max = 12;
    const t = Math.max((total || 21) - 1, 1);
    return Math.max(2, Math.round((pages / t) * max));
  }

  function setEdge(el, pages, total) {
    if (!el) return;
    const w = stackPx(pages, total);
    el.style.setProperty("--edge-w", w + "px");
    el.classList.toggle("is-on", w > 0);
  }

  function visibleFlipPage(side) {
    const cls = side === "left" ? "--left" : "--right";
    const nodes = bookEl.querySelectorAll(".stf__item." + cls);
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.style.display === "none") continue;
      if (!el.getClientRects().length) continue;
      return el;
    }
    return null;
  }

  /** 纸摞贴「当前最近的那一页」外缘，向内 1px，而不是贴书壳最外沿 */
  function placeEdgesOnBlock() {
    if (!bookShell) return;

    const shellRect = bookShell.getBoundingClientRect();
    const leftPage = visibleFlipPage("left");
    const rightPage = visibleFlipPage("right");
    const leftRect = leftPage ? leftPage.getBoundingClientRect() : null;
    const rightRect = rightPage ? rightPage.getBoundingClientRect() : null;
    const flush = 1;

    if (edgeLeft && leftRect) {
      edgeLeft.style.top = leftRect.top - shellRect.top + "px";
      edgeLeft.style.height = leftRect.height + "px";
      edgeLeft.style.bottom = "auto";
      edgeLeft.style.left = leftRect.left - shellRect.left + flush + "px";
      edgeLeft.style.right = "auto";
      edgeLeft.style.transform = "translateX(-100%)";
    }
    if (edgeRight && rightRect) {
      edgeRight.style.top = rightRect.top - shellRect.top + "px";
      edgeRight.style.height = rightRect.height + "px";
      edgeRight.style.bottom = "auto";
      edgeRight.style.left = rightRect.right - shellRect.left - flush + "px";
      edgeRight.style.right = "auto";
      edgeRight.style.transform = "translateX(0)";
    }

    const bottomRect = leftRect || rightRect;
    const bottomRight = rightRect || leftRect;
    if (edgeBottom && bottomRect && bottomRight) {
      edgeBottom.style.left = bottomRect.left - shellRect.left + "px";
      edgeBottom.style.width = Math.max(0, bottomRight.right - bottomRect.left - flush) + "px";
      edgeBottom.style.right = "auto";
      edgeBottom.style.top = bottomRect.bottom - shellRect.top - flush + "px";
      edgeBottom.style.bottom = "auto";
      edgeBottom.style.height = "";
      edgeBottom.style.transform = "translateY(0)";
    }
  }

  function syncEdges() {
    if (!pageFlip) return;

    const portrait = pageFlip.getOrientation() === "portrait";
    if (portrait) {
      edgeLeft && edgeLeft.classList.remove("is-on");
      edgeRight && edgeRight.classList.remove("is-on");
      edgeBottom && edgeBottom.classList.remove("is-on");
      return;
    }

    /* 翻页动画中保持当前纸摞，不要藏掉 */
    if (pageFlip.getState() !== "read") return;

    const i = pageFlip.getCurrentPageIndex();
    const total = pageFlip.getPageCount();
    const leftPages = i;
    const rightPages = Math.max(0, total - 1 - i);

    setEdge(edgeLeft, leftPages, total);
    setEdge(edgeRight, rightPages, total);
    /* 封面底边不要纸摞；封底合上才显示底边厚度 */
    setEdge(edgeBottom, i === total - 1 ? leftPages : 0, total);
    placeEdgesOnBlock();
  }

  function syncGutter() {
    if (gutterEl) gutterEl.classList.remove("visible");
    if (!pageFlip || !bookShell) return;
    bookShell.classList.toggle("is-flipping", pageFlip.getState() !== "read");
  }

  function syncAll(e) {
    if (!pageFlip) return;
    const i =
      e && typeof e.data === "number" ? e.data : pageFlip.getCurrentPageIndex();
    const total = pageFlip.getPageCount();
    const portrait = pageFlip.getOrientation() === "portrait";

    pageLabel.textContent =
      !portrait && i > 0 && i < total - 1 ? i + 1 + " – " + (i + 2) : String(i + 1);
    pageTotal.textContent = String(total);

    syncShell();
    syncGutter();
    syncEdges();
  }

  function mount(startPage) {
    resetBook();
    const s = sizeBook();
    applyBookBox(s);
    const mobile = s.usePortrait;

    pageFlip = new St.PageFlip(bookEl, {
      width: s.pageWidth,
      height: s.height,
      size: "fixed",
      minWidth: s.pageWidth,
      maxWidth: s.pageWidth,
      minHeight: s.height,
      maxHeight: s.height,
      drawShadow: !mobile,
      flippingTime: mobile ? 520 : 800,
      usePortrait: mobile,
      startPage: startPage || 0,
      autoSize: false,
      maxShadowOpacity: mobile ? 0 : 0.28,
      showCover: !mobile,
      mobileScrollSupport: false,
      swipeDistance: 20,
      useMouseEvents: !mobile,
      disableFlipByClick: !!(window.AIWeeklyConfig && window.AIWeeklyConfig.disableFlipByClick),
    });

    pageFlip.loadFromHTML(bookEl.querySelectorAll(".page"));
    pageFlip.on("flip", syncAll);
    pageFlip.on("changeState", () => {
      requestAnimationFrame(() => {
        syncShell();
        syncGutter();
        syncEdges();
      });
    });
    pageFlip.on("init", () => {
      pageTotal.textContent = String(pageFlip.getPageCount());
      syncAll({ data: pageFlip.getCurrentPageIndex() });
    });
    pageFlip.on("update", () => syncAll({ data: pageFlip.getCurrentPageIndex() }));

    syncAll({ data: startPage || 0 });
    setTimeout(syncAll, 80);
    setTimeout(syncAll, 300);
    setTimeout(tintAllChapters, 60);
    setTimeout(tintAllChapters, 400);
  }

  function relayout() {
    if (pageFlip && pageFlip.getState() !== "read") return;

    const { w, h } = viewSize();
    const mobile = w <= 900;
    const idx = pageFlip ? pageFlip.getCurrentPageIndex() : 0;

    if (mobile && Math.abs(w - lastLayoutW) < 24 && Math.abs(h - lastLayoutH) < 80) {
      return;
    }

    lastLayoutW = w;
    lastLayoutH = h;

    if (!pageFlip || mobile !== isMobile) {
      isMobile = mobile;
      disposePageFlip();
      mount(idx);
      return;
    }

    const s = sizeBook();
    applyBookBox(s);
    pageFlip.update();
    try {
      pageFlip.turnToPage(idx);
    } catch (_) {}
    syncAll({ data: idx });
  }

  lastLayoutW = viewSize().w;
  lastLayoutH = viewSize().h;
  mount(0);

  let navLock = 0;
  function go(dir) {
    if (!pageFlip) return;
    const now = Date.now();
    if (now - navLock < 280) return;
    navLock = now;

    const before = pageFlip.getCurrentPageIndex();
    const total = pageFlip.getPageCount();
    if (dir > 0 && before >= total - 1) return;
    if (dir < 0 && before <= 0) return;

    const hardTurn = () => {
      try {
        dir > 0 ? pageFlip.turnToNextPage() : pageFlip.turnToPrevPage();
      } catch (_) {}
      syncAll();
    };

    try {
      if (pageFlip.getState() !== "read") {
        hardTurn();
        return;
      }
      dir > 0 ? pageFlip.flipNext("bottom") : pageFlip.flipPrev("bottom");
      setTimeout(() => {
        if (!pageFlip) return;
        if (pageFlip.getCurrentPageIndex() === before && pageFlip.getState() === "read") {
          hardTurn();
        }
      }, 80);
    } catch (_) {
      hardTurn();
    }
  }

  function bindTap(el, fn) {
    if (!el) return;
    const run = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
    el.addEventListener("click", run);
    el.addEventListener("touchend", run, { passive: false });
  }

  bindTap(prevBtn, () => go(-1));
  bindTap(nextBtn, () => go(1));
  bindTap(document.getElementById("prevBtnFoot"), () => go(-1));
  bindTap(document.getElementById("nextBtnFoot"), () => go(1));

  const stageEl = document.getElementById("stage") || bookEl;
  let touchX = 0;
  let touchY = 0;
  let touchT = 0;
  stageEl.addEventListener(
    "touchstart",
    (e) => {
      if (!e.changedTouches.length) return;
      touchX = e.changedTouches[0].clientX;
      touchY = e.changedTouches[0].clientY;
      touchT = Date.now();
    },
    { passive: true }
  );
  stageEl.addEventListener(
    "touchend",
    (e) => {
      if (!e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;
      if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy)) return;
      if (Date.now() - touchT > 900) return;
      e.preventDefault();
      go(dx < 0 ? 1 : -1);
    },
    { passive: false }
  );

  window.addEventListener("keydown", (e) => {
    if (!pageFlip) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") go(1);
    if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
  });

  let t;
  function onResize() {
    clearTimeout(t);
    t = setTimeout(relayout, 280);
  }
  window.addEventListener("resize", onResize);

  function shadeRgb(r, g, b, k) {
    return [
      Math.max(0, Math.round(r * k)),
      Math.max(0, Math.round(g * k)),
      Math.max(0, Math.round(b * k)),
    ];
  }

  function applyChapterTint(img, mask) {
    if (!img || !mask) return;
    const paint = (r, g, b) => {
      const d = shadeRgb(r, g, b, 0.38);
      const m = shadeRgb(r, g, b, 0.55);
      mask.style.background =
        "linear-gradient(90deg," +
        "rgba(" + d[0] + "," + d[1] + "," + d[2] + ",0.84) 0%," +
        "rgba(" + d[0] + "," + d[1] + "," + d[2] + ",0.52) 36%," +
        "rgba(" + m[0] + "," + m[1] + "," + m[2] + ",0.16) 68%," +
        "rgba(" + m[0] + "," + m[1] + "," + m[2] + ",0) 100%)";
    };

    const run = () => {
      try {
        const c = document.createElement("canvas");
        c.width = 40;
        c.height = 24;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 40, 24);
        const data = ctx.getImageData(0, 0, 16, 24).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        if (n) paint(r / n, g / n, b / n);
      } catch (_) {}
    };

    if (img.complete && img.naturalWidth) run();
    else img.addEventListener("load", run, { once: true });
  }

  function tintAllChapters() {
    bookEl.querySelectorAll(".chapter").forEach((ch) => {
      applyChapterTint(ch.querySelector(".ch-img"), ch.querySelector(".ch-mask"));
    });
  }

  window.AIWeekly = {
    getPageFlip: () => pageFlip,
    tintChapters: tintAllChapters,
    tintChapter: applyChapterTint,
    serializePages() {
      const nodes = bookEl.querySelectorAll(".page");
      if (!nodes.length) return originalHTML;
      return Array.from(nodes)
        .map((p) => {
          const c = p.cloneNode(true);
          c.className = Array.from(c.classList)
            .filter((x) => x === "page" || x.startsWith("page--"))
            .join(" ");
          c.removeAttribute("style");
          c.querySelectorAll("*").forEach((el) => {
            el.removeAttribute("contenteditable");
            el.removeAttribute("spellcheck");
            el.classList.remove("ed-pick", "ed-page-on", "ed-media-on");
          });
          return c.outerHTML;
        })
        .join("\n");
    },
  };
})();
