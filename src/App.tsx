import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { getPassage, getPassages, isDemo, publishPassage, reportPassage } from "./api";
import { createShareCard } from "./shareCard";
import type { NewPassage, Passage, ReportReason } from "./types";

type View = "feed" | "submit" | "saved";
type Theme = "light" | "dark";
type PassageDraft = Pick<NewPassage, "text" | "bookTitle" | "author">;
type ReplayCard = { passage: Passage; key: string };

const REPLAY_BATCH_SIZE = 10;
const REPLAY_HISTORY_LIMIT = 60;

// Keep the original keys so the rename preserves existing browser data.
const SAVED_KEY = "merak:saved";
const THEME_KEY = "merak:theme";
const LAST_KEY = "merak:last";

function shufflePassages(passages: Passage[], lastId?: string): Passage[] {
  const shuffled = [...passages];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled[0].id === lastId) {
    const other = 1 + Math.floor(Math.random() * (shuffled.length - 1));
    [shuffled[0], shuffled[other]] = [shuffled[other], shuffled[0]];
  }
  return shuffled;
}

function readSaved(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z" /></svg>;
}

function ShareIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 13v7h14v-7" /></svg>;
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === "light"
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M20 14.4A8 8 0 0 1 9.6 4 8 8 0 1 0 20 14.4Z" /></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>;
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m0 0 6-6m-6 6 6 6" /></svg>;
}

function FullscreenIcon({ active }: { active: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={active ? "M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5" : "M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"} />
  </svg>;
}

function passageDensity(text: string) {
  return text.length > 520 ? "dense" : text.length > 420 ? "long" : "normal";
}

function PassageCopy({ text, contributorName, curated }: Pick<Passage, "text" | "contributorName"> & { curated?: boolean }) {
  return <div className="passage-copy">
    <p className="contributor">{curated ? "Tomar seçkisi" : contributorName === "Okur" ? "Bir okurun seçkisi" : `Paylaşan: ${contributorName}`}</p>
    <p className="excerpt">{text}</p>
  </div>;
}

function PassageSource({ bookTitle, author }: Pick<Passage, "bookTitle" | "author">) {
  return <><strong>{bookTitle}</strong><span className="source-meta"><span className="source-label">Yazar</span><span className="source-author">{author}</span></span></>;
}

function App() {
  const [view, setView] = useState<View>("feed");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [fullscreen, setFullscreen] = useState(() => Boolean(document.fullscreenElement));
  const fullscreenAvailable = document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function";
  const iphoneBrowser = /iPhone|iPod/.test(navigator.userAgent)
    && !(navigator as Navigator & { standalone?: boolean }).standalone
    && !matchMedia("(display-mode: standalone)").matches;
  const showFullscreen = fullscreenAvailable || iphoneBrowser || fullscreen;
  const [draft, setDraft] = useState<PassageDraft>({ text: "", bookTitle: "", author: "" });
  const [publishing, setPublishing] = useState(false);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [replayCards, setReplayCards] = useState<ReplayCard[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>(readSaved);
  const [savedPassages, setSavedPassages] = useState<Passage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Passage | null>(null);
  const [shareData, setShareData] = useState<{ passage: Passage; imageUrl: string; blob: Blob; shortened: boolean } | null>(null);
  const [shareZoomed, setShareZoomed] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("incorrect_source");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const fullscreenHelpRef = useRef<HTMLDialogElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const pendingScrollRef = useRef<string | null>(null);
  const visibleCardRef = useRef<string | null>(null);
  const replayQueueRef = useRef<Passage[]>([]);
  const replayKeyRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const dockDragStartRef = useRef<number | null>(null);
  const suppressDockClickRef = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#222b26" : "#fbfaf7");
  }, [theme]);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await getPassages();
      const linkedId = new URLSearchParams(location.search).get("p");
      if (linkedId && !page.items.some(item => item.id === linkedId)) {
        const linked = await getPassage(linkedId).catch(() => null);
        if (linked) page.items.unshift(linked);
      }
      setPassages(page.items);
      setReplayCards([]);
      replayQueueRef.current = [];
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pasajlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFirst(); }, [loadFirst]);

  useEffect(() => {
    if (loading || restoredRef.current || !passages.length) return;
    restoredRef.current = true;
    const linkedId = new URLSearchParams(location.search).get("p");
    const id = linkedId ?? localStorage.getItem(LAST_KEY);
    if (id) requestAnimationFrame(() => document.getElementById(`pasaj-${id}`)?.scrollIntoView());
  }, [loading, passages]);

  useEffect(() => {
    if (view !== "feed" || !feedRef.current) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const id = visible?.target.getAttribute("data-passage-id");
      if (id && visible) {
        visibleCardRef.current = visible.target.id;
        localStorage.setItem(LAST_KEY, id);
      }
    }, { root: feedRef.current, threshold: 0.65 });
    feedRef.current.querySelectorAll("[data-passage-id]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [view, passages, replayCards]);

  useEffect(() => {
    if (view !== "feed" || !pendingScrollRef.current) return;
    const id = pendingScrollRef.current;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [view, passages]);

  useEffect(() => {
    if (!selected && !shareData) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (shareZoomed) setShareZoomed(false);
        else { setSelected(null); setReporting(false); closeShare(); }
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [selected, shareData, shareZoomed]);

  async function loadMore() {
    if (loadingMoreRef.current || loading || !passages.length) return;
    if (!nextCursor) {
      if (replayQueueRef.current.length === 0) {
        const lastId = replayCards.at(-1)?.passage.id ?? passages.at(-1)?.id;
        replayQueueRef.current = shufflePassages(passages, lastId);
      }
      const batch = replayQueueRef.current.splice(0, REPLAY_BATCH_SIZE).map(passage => ({
        passage,
        key: `tekrar-${++replayKeyRef.current}`,
      }));
      setReplayCards(current => [...current, ...batch].slice(-REPLAY_HISTORY_LIMIT));
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await getPassages(nextCursor);
      setPassages(current => [...current, ...page.items.filter(item => !current.some(existing => existing.id === item.id))]);
      setNextCursor(page.nextCursor);
    } catch {
      setNotice("Yeni pasajlar yüklenemedi.");
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }

  function onFeedScroll() {
    const feed = feedRef.current;
    if (feed && feed.scrollTop + feed.clientHeight >= feed.scrollHeight - feed.clientHeight * 1.5) void loadMore();
  }

  function toggleSaved(id: string) {
    setSavedIds(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
      localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function openSaved() {
    setSelected(null);
    setView("saved");
    const items = await Promise.all(savedIds.map(id => getPassage(id).catch(() => null)));
    setSavedPassages(items.filter((item): item is Passage => item !== null));
  }

  function returnToFeed(id?: string) {
    setView("feed");
    setSelected(null);
    if (id) {
      pendingScrollRef.current = `pasaj-${id}`;
      setPassages(current => current.some(item => item.id === id) ? current : [...savedPassages.filter(item => item.id === id), ...current]);
    } else if (view !== "feed") {
      pendingScrollRef.current = visibleCardRef.current;
    }
  }

  function closeShare() {
    if (shareData) URL.revokeObjectURL(shareData.imageUrl);
    setShareZoomed(false);
    setShareData(null);
  }

  function passageUrl(passage: Passage): string {
    const url = new URL(location.href);
    url.searchParams.set("p", passage.id);
    return url.toString();
  }

  async function share(passage: Passage) {
    setShareLoading(true);
    try {
      const card = await createShareCard(passage, theme);
      setShareData({ passage, imageUrl: URL.createObjectURL(card.blob), blob: card.blob, shortened: card.shortened });
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Görsel oluşturulamadı.");
    } finally {
      setShareLoading(false);
    }
  }

  function downloadShareImage() {
    if (!shareData) return;
    const link = document.createElement("a");
    link.href = shareData.imageUrl;
    link.download = `tomar-pasaj-${shareData.passage.id}.png`;
    link.click();
  }

  async function shareImage() {
    if (!shareData) return;
    const file = new File([shareData.blob], `tomar-pasaj-${shareData.passage.id}.png`, { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: shareData.passage.bookTitle, ...(!isDemo && { url: passageUrl(shareData.passage) }) });
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) setNotice("Görsel paylaşılamadı.");
    }
  }

  async function copyShareLink() {
    if (!shareData || isDemo) return;
    try {
      await navigator.clipboard.writeText(passageUrl(shareData.passage));
      setNotice("Pasaj bağlantısı kopyalandı.");
    } catch {
      setNotice("Bağlantı kopyalanamadı.");
    }
  }

  async function publish(input: PassageDraft) {
    setPublishing(true);
    try {
      const created = await publishPassage({ ...input, translator: "", sourceUrl: "", contributorName: "" });
      setDraft({ text: "", bookTitle: "", author: "" });
      setPassages(current => [created, ...current]);
      setView("feed");
      setNotice(isDemo ? "Pasaj bu tarayıcıya kaydedildi." : "Pasajın yayımlandı.");
      pendingScrollRef.current = `pasaj-${created.id}`;
    } finally {
      setPublishing(false);
    }
  }

  async function sendReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setReportBusy(true);
    try {
      await reportPassage(selected.id, reportReason, reportDetails);
      setReporting(false);
      setSelected(null);
      setReportDetails("");
      setNotice(isDemo ? "Bildirim yalnızca bu tarayıcıya kaydedildi." : "Bildirim alındı. Teşekkürler.");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Bildirim gönderilemedi.");
    } finally {
      setReportBusy(false);
    }
  }

  async function toggleFullscreen() {
    if (iphoneBrowser && !fullscreenAvailable && !document.fullscreenElement) {
      fullscreenHelpRef.current?.showModal();
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      setNotice("Tam ekran modu değiştirilemedi.");
    }
  }

  function dock() {
    const fullscreenLabel = fullscreen ? "Tam ekrandan çık" : "Tam ekrana geç";
    return <nav className={`bottom-dock${view === "feed" ? "" : " bottom-dock--with-back"}${showFullscreen ? " bottom-dock--with-fullscreen" : ""}`} aria-label="Ana işlemler">
      <div className={`dock-switch dock-switch--${view}`} aria-label="Ekle ve kaydedilenler arasında geç" onPointerDown={event => { dockDragStartRef.current = event.clientX; }} onPointerUp={event => {
        if (dockDragStartRef.current === null) return;
        const distance = event.clientX - dockDragStartRef.current;
        dockDragStartRef.current = null;
        if (Math.abs(distance) < 32) return;
        suppressDockClickRef.current = true;
        window.setTimeout(() => { suppressDockClickRef.current = false; }, 100);
        if (distance > 0) void openSaved();
        else setView("submit");
      }} onPointerCancel={() => { dockDragStartRef.current = null; }} onClickCapture={event => {
        if (!suppressDockClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressDockClickRef.current = false;
      }}>
        <span className="dock-thumb" aria-hidden="true" />
        <button className="dock-tab" type="button" aria-pressed={view === "submit"} onClick={() => setView("submit")}><span className="dock-plus" aria-hidden="true">+</span><span>Ekle</span></button>
        <button className="dock-tab" type="button" aria-pressed={view === "saved"} onClick={() => void openSaved()}><BookmarkIcon /><span>Kaydedilenler</span></button>
      </div>
      <button className="dock-icon" type="button" onClick={() => setTheme(current => current === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Koyu temaya geç" : "Açık temaya geç"}><ThemeIcon theme={theme} /></button>
      {showFullscreen && <button className="dock-icon dock-fullscreen" type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreenLabel} title={fullscreenLabel} aria-haspopup={!fullscreenAvailable && iphoneBrowser ? "dialog" : undefined}><FullscreenIcon active={fullscreen} /></button>}
      {view !== "feed" && <button className="dock-icon" type="button" onClick={() => returnToFeed()} disabled={view === "submit" && publishing} aria-label="Akışa dön" title="Akışa dön"><BackIcon /></button>}
    </nav>;
  }

  return <>
    <header className="brand-bar">
      <button className="wordmark" type="button" onClick={() => returnToFeed()}>tomar</button>
    </header>
    {view === "feed" && <main className="feed" ref={feedRef} onScroll={onFeedScroll} aria-label="Pasaj akışı">
      {loading && <section className="page state-page"><div className="state-message">Pasajlar yükleniyor…</div></section>}
      {!loading && error && <section className="page state-page"><div className="state-message"><p>{error}</p><button className="secondary-button" onClick={() => void loadFirst()}>Tekrar dene</button></div></section>}
      {!loading && !error && passages.length === 0 && <section className="page state-page"><div className="state-message"><h1>İlk pasajı sen paylaş.</h1><p>Aklında kalan bir bölümü akışa ekleyebilirsin.</p><button className="primary-button" onClick={() => setView("submit")}>Pasaj ekle</button></div></section>}
      {!loading && [...passages.map(passage => ({ passage, key: `pasaj-${passage.id}` })), ...replayCards].map(({ passage, key }) => <article className="page passage-page" id={key} data-passage-id={passage.id} data-density={passageDensity(passage.text)} key={key}>
        {isDemo && <span className="demo-label">Yerel önizleme</span>}
        <div className="reading-area">
          <PassageCopy text={passage.text} contributorName={passage.contributorName} curated={passage.curated} />
        </div>
        <footer className="passage-footer">
          <button className="source-button" type="button" onClick={() => setSelected(passage)}>
            <PassageSource bookTitle={passage.bookTitle} author={passage.author} />
          </button>
          <div className="footer-actions">
            <button className="icon-button" type="button" onClick={() => toggleSaved(passage.id)} aria-label={savedIds.includes(passage.id) ? "Kaydı kaldır" : "Pasajı kaydet"}><BookmarkIcon filled={savedIds.includes(passage.id)} /></button>
            <button className="icon-button" type="button" onClick={() => void share(passage)} disabled={shareLoading} aria-label="Pasajı paylaş"><ShareIcon /></button>
          </div>
        </footer>
      </article>)}
      {!loading && loadingMore && <p className="feed-status">Yeni pasajlar yükleniyor…</p>}
    </main>}

    {view === "submit" && <SubmitPage input={draft} onChange={setDraft} onPublish={publish} busy={publishing} />}

    {view === "saved" && <main className="single-view"><section className="page list-page">
      <div className="list-content"><h1>Kaydedilenler</h1>{savedPassages.length === 0 ? <p>Henüz pasaj kaydetmedin.</p> : <ul>{savedPassages.map(passage => <li key={passage.id}><button type="button" onClick={() => returnToFeed(passage.id)}><span>{passage.text}</span><small>{passage.bookTitle} · {passage.author}</small></button></li>)}</ul>}</div>
    </section></main>}

    {dock()}

    {iphoneBrowser && <dialog ref={fullscreenHelpRef} className="passage-preview fullscreen-help" aria-labelledby="fullscreen-help-title">
      <header className="passage-preview-header">
        <h2 id="fullscreen-help-title">iPhone’da tam ekran</h2>
        <form method="dialog"><button className="icon-button" type="submit" aria-label="Kapat">×</button></form>
      </header>
      <p>Tomar’ı Safari’de aç. Paylaş menüsünden <strong>Ana Ekrana Ekle</strong>’ye dokun. <strong>Web Uygulaması Olarak Aç</strong> seçeneği görünüyorsa açık bırak. Ardından Tomar’ı ana ekrandaki simgesinden aç.</p>
    </dialog>}

    {selected && <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="sheet" role="dialog" aria-modal="true" aria-label={reporting ? "Pasajı bildir" : "Pasaj kaynağı"}>
      <button className="sheet-close" type="button" onClick={() => { setSelected(null); setReporting(false); }} aria-label="Kapat">×</button>
      {!reporting ? <><p className="sheet-label">Kaynak</p><h2>{selected.bookTitle}</h2><p>{selected.author}{selected.translator && ` · Çeviren: ${selected.translator}`}</p><p className="sheet-muted">{selected.curated ? "Tomar seçkisi · kaynak kontrol edildi" : `${selected.contributorName} tarafından paylaşıldı · kaynak kontrol edilmedi`}</p>{selected.sourceUrl && <a className="source-link" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{selected.curated ? selected.translator === "Tomar" ? "Özgün metni aç ↗" : "Metnin kaynağını aç ↗" : "Paylaşanın bağlantısını aç ↗"}</a>}<button className="report-link" type="button" onClick={() => setReporting(true)}>Bu pasajı bildir</button></> : <form onSubmit={event => void sendReport(event)}><p className="sheet-label">Bildirim</p><h2>Bu pasajı bildir</h2><label>Neden?<select value={reportReason} onChange={event => setReportReason(event.target.value as ReportReason)}><option value="incorrect_source">Kaynak bilgisi yanlış</option><option value="copyright">Telif hakkı</option><option value="spam">Spam</option><option value="other">Diğer</option></select></label><label>Açıklama <span>(isteğe bağlı)</span><textarea maxLength={500} value={reportDetails} onChange={event => setReportDetails(event.target.value)} /></label><button className="primary-button" type="submit" disabled={reportBusy}>{reportBusy ? "Gönderiliyor…" : "Bildirimi gönder"}</button></form>}
    </section></div>}
    {shareData && <div className="overlay share-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeShare(); }}><section className="sheet share-sheet" role="dialog" aria-modal="true" aria-label="Pasajı paylaş">
      <button className="sheet-close" type="button" onClick={closeShare} aria-label="Kapat">×</button>
      <p className="sheet-label">Paylaş</p><h2>Paylaşım görseli</h2>
      <button className="share-preview" type="button" onClick={() => setShareZoomed(true)} aria-label="Paylaşım görselini büyüt"><img src={shareData.imageUrl} alt={`${shareData.passage.bookTitle} pasajı için paylaşım görseli`} /><span className="share-preview-hint">Büyüt</span></button>
      {shareData.shortened && <p className="share-note">Uzun pasaj görselde kısaltıldı. Tam metin uygulamada duruyor.</p>}
      {isDemo && <p className="share-note">Önizleme bağlantısı başka cihazlarda açılmaz. Görseli indirip paylaşabilirsin.</p>}
      <div className="share-actions">
        {typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([shareData.blob], "tomar-pasaj.png", { type: "image/png" })] }) && <button className="primary-button" type="button" onClick={() => void shareImage()}>Görseli paylaş</button>}
        <button className="secondary-button" type="button" onClick={downloadShareImage}>Görseli indir</button>
        {!isDemo && <button className="text-action share-link-button" type="button" onClick={() => void copyShareLink()}>Bağlantıyı kopyala</button>}
      </div>
    </section></div>}
    {shareData && shareZoomed && <div className="share-zoom" role="dialog" aria-modal="true" aria-label="Paylaşım görseli büyük önizleme" onMouseDown={event => { if (event.target === event.currentTarget) setShareZoomed(false); }}><button type="button" className="share-zoom-close" onClick={() => setShareZoomed(false)} aria-label="Büyük önizlemeyi kapat">×</button><img src={shareData.imageUrl} alt={`${shareData.passage.bookTitle} pasajı için büyük paylaşım görseli`} /></div>}
    {notice && <div className="toast" role="status" onAnimationEnd={() => setNotice("")}>{notice}</div>}
  </>;
}

function SubmitPage({ input, onChange, onPublish, busy }: {
  input: PassageDraft;
  onChange: React.Dispatch<React.SetStateAction<PassageDraft>>;
  onPublish: (input: PassageDraft) => Promise<void>;
  busy: boolean;
}) {
  const [error, setError] = useState("");
  const previewRef = useRef<HTMLDialogElement>(null);
  const draftText = input.text.trim();

  function change(field: keyof PassageDraft, value: string) { onChange(current => ({ ...current, [field]: value })); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try { await onPublish(input); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Pasaj yayımlanamadı."); }
  }

  return <main className="single-view"><section className="page submit-page">
    <form className="submit-content" onSubmit={event => void submit(event)}>
      <h1>Pasaj ekle</h1>
      <p className="submit-intro">Okurken dönüp yeniden baktığın bir bölümü paylaş.</p>
      <div className="submit-editor">
        <div className="submit-editor-heading">
          <label htmlFor="draft-text">Pasaj</label>
          <span id="draft-length">80–1600 karakter</span>
        </div>
        <textarea id="draft-text" aria-describedby="draft-length" required minLength={80} maxLength={1600} value={input.text} onChange={event => change("text", event.target.value)} placeholder="Kitaptan bir bölüm yaz…" />
      </div>
      <div className="submit-fields">
        <label>Kitap adı<input required maxLength={160} value={input.bookTitle} onChange={event => change("bookTitle", event.target.value)} /></label>
        <label>Yazar<input required maxLength={120} value={input.author} onChange={event => change("author", event.target.value)} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="submit-actions">
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "Yayımlanıyor…" : "Pasajı yayımla"}</button>
        <button className="secondary-button" type="button" disabled={!draftText || busy} onClick={() => previewRef.current?.showModal()}>Önizle</button>
      </div>
      <p className="form-note">{isDemo ? "Yerel demoda paylaşım yalnızca bu tarayıcıda görünür." : "Paylaşımın akışta hemen görünür. Kitap ve yazar bilgisini doğru yaz."}</p>
    </form>
    <dialog ref={previewRef} className="passage-preview" data-density={passageDensity(draftText)} aria-labelledby="passage-preview-title">
      <header className="passage-preview-header">
        <h2 id="passage-preview-title">Akış önizlemesi</h2>
        <button className="icon-button" type="button" onClick={() => previewRef.current?.close()} aria-label="Önizlemeyi kapat">×</button>
      </header>
      <div className="reading-area" tabIndex={0} aria-label="Taslak pasaj">
        <PassageCopy text={draftText} contributorName="Okur" />
      </div>
      <footer className="passage-footer">
        <div className="source-button"><PassageSource bookTitle={input.bookTitle.trim() || "Kitap adı"} author={input.author.trim() || "—"} /></div>
      </footer>
    </dialog>
  </section></main>;
}

export default App;
