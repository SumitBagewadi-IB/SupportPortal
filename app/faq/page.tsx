'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface Article {
  id: string;
  title: string;
  question?: string;
  content: string;
  answer?: string;
  category: string;
  status?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
  sortOrder?: number;
  status?: string;
}

// Fallback static categories used if /categories API is unavailable
const FALLBACK_CATEGORIES: Category[] = [
  { id: 'getting-started', name: 'Getting Started',     icon: 'fas fa-rocket',               parentId: null },
  { id: 'account-opening', name: 'Account Opening',     icon: 'fas fa-id-card',              parentId: null },
  { id: 'trading',         name: 'Trading',             icon: 'fas fa-chart-line',           parentId: null },
  { id: 'portfolio',       name: 'Portfolio & Margin',  icon: 'fas fa-briefcase',            parentId: null },
  { id: 'funds',           name: 'Funds',               icon: 'fas fa-wallet',               parentId: null },
  { id: 'ipo',             name: 'IPO',                 icon: 'fas fa-rocket',               parentId: null },
  { id: 'fo',              name: 'F&O',                 icon: 'fas fa-bolt',                 parentId: null },
  { id: 'pledging',        name: 'Pledging',            icon: 'fas fa-link',                 parentId: null },
  { id: 'account',         name: 'Account',             icon: 'fas fa-user-circle',          parentId: null },
  { id: 'reports',         name: 'Reports',             icon: 'fas fa-file-invoice',         parentId: null },
  { id: 'contact-faq',     name: 'Contact & Help',      icon: 'fas fa-headset',              parentId: null },
  { id: 'mtf',             name: 'MTF',                 icon: 'fas fa-layer-group',          parentId: null },
  { id: 'tender-offers',   name: 'Tender Offers',       icon: 'fas fa-hand-holding-dollar',  parentId: null },
  { id: 'charges',         name: 'Charges & Brokerage', icon: 'fas fa-tags',                 parentId: null },
  { id: 'compliance',      name: 'Compliance & Safety', icon: 'fas fa-shield-halved',        parentId: null },
  { id: 'mutual-funds',    name: 'Mutual Funds',        icon: 'fas fa-seedling',             parentId: null },
  { id: 'nri',             name: 'NRI/HUF Accounts',   icon: 'fas fa-globe',                parentId: null },
  { id: 'advanced',        name: 'Advanced',            icon: 'fas fa-robot',                parentId: null },
];

function normalise(s: string) {
  return s?.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || '';
}

function articleMatchesCategory(article: Article, catName: string): boolean {
  const artNorm = normalise(article.category);
  const catNorm = normalise(catName);
  return artNorm === catNorm || article.category?.toLowerCase() === catName.toLowerCase();
}

function FAQContent() {
  const searchParams = useSearchParams();
  const catParam = searchParams.get('cat') || '';
  const subParam = searchParams.get('sub') || '';

  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  // Navigation state: selectedCatId = top-level, selectedSubId = subcategory
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedSubId, setSelectedSubId] = useState<string>('');

  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set(
    (() => {
      try {
        const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const raw = JSON.parse(localStorage.getItem('faq_feedback_given') || '{}');
        if (Array.isArray(raw)) return raw;
        const valid = Object.entries(raw as Record<string, number>)
          .filter(([, ts]) => now - ts < NINETY_DAYS)
          .map(([id]) => id);
        const cleaned = Object.fromEntries(valid.map(id => [id, (raw as Record<string, number>)[id]]));
        localStorage.setItem('faq_feedback_given', JSON.stringify(cleaned));
        return valid;
      } catch { return []; }
    })()
  ));
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackGivenRef = feedbackGiven;

  const fetchCategories = useCallback(async () => {
    if (!API_BASE) { setCategories(FALLBACK_CATEGORIES); return; }
    try {
      const res = await fetch(`${API_BASE}/categories`);
      if (res.ok) {
        const data: Category[] = await res.json();
        const active = data.filter(c => !c.status || c.status === 'active');
        // Always keep the full fallback list; merge DB categories on top.
        // DB top-level cats override matching fallback entries (same name).
        // DB subcategories (parentId set) are added as-is.
        // Extra DB top-level cats not in fallback are appended at the end.
        const dbTopLevel = active.filter(c => !c.parentId);
        const dbSubs = active.filter(c => c.parentId);
        const dbTopNames = new Set(dbTopLevel.map(c => c.name.toLowerCase()));
        // Start with fallback, replace any that exist in DB by name
        const merged: Category[] = FALLBACK_CATEGORIES.map(f => {
          const dbMatch = dbTopLevel.find(d => d.name.toLowerCase() === f.name.toLowerCase());
          return dbMatch || f;
        });
        // Append any DB top-level cats with new names not in fallback
        dbTopLevel.forEach(d => {
          if (!FALLBACK_CATEGORIES.some(f => f.name.toLowerCase() === d.name.toLowerCase())) {
            merged.push(d);
          }
        });
        // Add all subcategories
        merged.push(...dbSubs);
        setCategories(merged);
      } else {
        setCategories(FALLBACK_CATEGORIES);
      }
    } catch {
      setCategories(FALLBACK_CATEGORIES);
    }
  }, []);


  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setApiError(false);
    const attempt = async () => {
      if (!API_BASE) throw new Error('No API configured');
      const res = await fetch(`${API_BASE}/faq`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };
    try {
      let data;
      try { data = await attempt(); }
      catch { await new Promise(r => setTimeout(r, 1000)); data = await attempt(); }
      const items: Article[] = Array.isArray(data) ? data : (data.items || data.articles || []);
      const published = items.filter(a => !a.status || a.status === 'published' || a.status === 'active' || a.status === 'approved');
      setArticles(published);
      setApiError(false);
    } catch {
      setApiError(true);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); fetchArticles(); }, [fetchCategories, fetchArticles]);

  useEffect(() => {
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, []);

  // Merge dynamic categories with any article categories not yet in the DB.
  // useMemo ensures this recomputes only when categories or articles change.
  const allCategories = useMemo((): Category[] => {
    // If still on fallback (DB empty or API failed), return as-is
    if (categories === FALLBACK_CATEGORIES || categories.length === 0) return categories;
    const coveredNames = new Set(categories.map(c => c.name.toLowerCase()));
    const orphanNames = new Set<string>();
    for (const a of articles) {
      if (a.category && !coveredNames.has(a.category.toLowerCase())) {
        orphanNames.add(a.category);
      }
    }
    if (orphanNames.size === 0) return categories;
    const orphans: Category[] = Array.from(orphanNames).map(name => ({
      id: `orphan-${normalise(name)}`,
      name,
      icon: 'fas fa-folder',
      parentId: null,
    }));
    return [...categories, ...orphans];
  }, [categories, articles]);

  const topLevel = useMemo(() => allCategories.filter(c => !c.parentId), [allCategories]);
  const getSubcategories = useCallback((parentId: string) => allCategories.filter(c => c.parentId === parentId), [allCategories]);

  // Resolve URL catParam to a category ID whenever allCategories or catParam changes.
  // Both categories AND articles must be loaded before resolving.
  useEffect(() => {
    if (allCategories.length === 0 || loading) return;
    if (catParam) {
      const found = allCategories.find(c => normalise(c.name) === catParam || c.id === catParam);
      if (found) {
        if (found.parentId) {
          setSelectedCatId(found.parentId);
          setSelectedSubId(found.id);
        } else {
          setSelectedCatId(found.id);
          setSelectedSubId('');
        }
        return;
      }
    }
    setSelectedCatId('');
    setSelectedSubId('');
  }, [allCategories, catParam, loading]);

  const selectedCat = useMemo(() => allCategories.find(c => c.id === selectedCatId), [allCategories, selectedCatId]);
  const selectedSub = useMemo(() => allCategories.find(c => c.id === selectedSubId), [allCategories, selectedSubId]);
  const subcategories = useMemo(() => selectedCatId ? getSubcategories(selectedCatId) : [], [selectedCatId, getSubcategories]);

  // Filter articles based on navigation state
  const filtered = useMemo(() => articles.filter(a => {
    let matchesCat = true;
    if (selectedSubId && selectedSub && selectedCat) {
      const allSiblingSubs = getSubcategories(selectedCatId);
      const taggedExactlyToThisSub = articleMatchesCategory(a, selectedSub.name);
      // Also show parent-tagged articles that don't belong to any specific sibling subcategory
      // This ensures existing articles tagged with a top-level name remain visible
      const taggedToParentOnly = articleMatchesCategory(a, selectedCat.name) &&
        !allSiblingSubs.some(s => s.id !== selectedSubId && articleMatchesCategory(a, s.name));
      matchesCat = taggedExactlyToThisSub || taggedToParentOnly;
    } else if (selectedCatId && selectedCat) {
      // Show articles for the top-level category AND all its subcategories
      const subs = getSubcategories(selectedCatId);
      matchesCat = articleMatchesCategory(a, selectedCat.name) ||
        subs.some(s => articleMatchesCategory(a, s.name));
    }
    const matchesSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      (a.content || a.answer || '')?.toLowerCase().includes(search.toLowerCase()) ||
      a.category?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  }), [articles, selectedSubId, selectedSub, selectedCatId, selectedCat, getSubcategories, search]);

  const grouped: Record<string, Article[]> = useMemo(() => filtered.reduce<Record<string, Article[]>>((acc, a) => {
    const cat = a.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {}), [filtered]);

  const getArticleCount = (cat: Category): number => {
    const subs = getSubcategories(cat.id);
    return articles.filter(a =>
      articleMatchesCategory(a, cat.name) || subs.some(s => articleMatchesCategory(a, s.name))
    ).length;
  };

  const getSubCount = (sub: Category): number => {
    if (!sub.parentId) return articles.filter(a => articleMatchesCategory(a, sub.name)).length;
    const parent = allCategories.find(c => c.id === sub.parentId);
    const siblings = getSubcategories(sub.parentId);
    return articles.filter(a => {
      if (articleMatchesCategory(a, sub.name)) return true;
      // Count parent-tagged articles that don't belong to any other sibling sub
      if (parent && articleMatchesCategory(a, parent.name) &&
          !siblings.some(s => s.id !== sub.id && articleMatchesCategory(a, s.name))) return true;
      return false;
    }).length;
  };

  const heading = selectedSub?.name || selectedCat?.name || 'All Topics';

  const selectTopLevel = (catId: string) => {
    if (selectedCatId === catId) {
      // Toggle collapse
      setSelectedCatId('');
      setSelectedSubId('');
    } else {
      setSelectedCatId(catId);
      setSelectedSubId('');
    }
    setSearch('');
  };

  const selectSub = (subId: string) => {
    setSelectedSubId(subId);
    setSearch('');
  };

  return (
    <div className="kb-layout">

      {/* SIDEBAR */}
      <aside className="kb-sidebar">
        <p className="kb-sidebar-title">Topics</p>
        <div className="kb-sidebar-nav" id="kbSidebar">

          {/* All Topics button */}
          <button
            className={`kb-nav-link${!selectedCatId ? ' active' : ''}`}
            onClick={() => { setSelectedCatId(''); setSelectedSubId(''); setSearch(''); }}
          >
            <i className="fas fa-border-all" style={{ width: '14px' }}></i>
            All Topics
            {articles.length > 0 && <span className="nav-count">{articles.length}</span>}
          </button>

          {topLevel.map((cat) => {
            const count = getArticleCount(cat);
            const subs = getSubcategories(cat.id);
            const isExpanded = selectedCatId === cat.id;
            return (
              <div key={cat.id}>
                <button
                  className={`kb-nav-link${isExpanded && !selectedSubId ? ' active' : ''}`}
                  onClick={() => selectTopLevel(cat.id)}
                  style={{ justifyContent: 'space-between' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <i className={cat.icon} style={{ width: '14px', flexShrink: 0 }}></i>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                    {count > 0 && <span className="nav-count">{count}</span>}
                    {subs.length > 0 && (
                      <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`} style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: '0.125rem' }}></i>
                    )}
                  </span>
                </button>

                {/* Subcategories — shown when parent is expanded */}
                {isExpanded && subs.length > 0 && (
                  <div style={{ marginLeft: '1rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.5rem', marginBottom: '0.25rem' }}>
                    {subs.map(sub => {
                      const subCount = getSubCount(sub);
                      return (
                        <button
                          key={sub.id}
                          className={`kb-nav-link${selectedSubId === sub.id ? ' active' : ''}`}
                          onClick={() => selectSub(sub.id)}
                          style={{ fontSize: '0.8125rem', padding: '0.375rem 0.625rem' }}
                        >
                          <i className={sub.icon} style={{ width: '12px', fontSize: '0.75rem' }}></i>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{sub.name}</span>
                          {subCount > 0 && <span className="nav-count">{subCount}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.4rem' }}>Still stuck?</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Our team replies within 2 hours.</p>
          <Link href="/contact" className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
            <i className="fas fa-comment-dots"></i> Contact Support
          </Link>
        </div>

        <div style={{ marginTop: '1.25rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
            Regulatory Links
          </p>
          {[
            { href: 'https://www.sebi.gov.in', label: 'SEBI' },
            { href: 'https://www.nseindia.com', label: 'NSE India' },
            { href: 'https://www.bseindia.com', label: 'BSE India' },
            { href: 'https://www.cdslindia.com', label: 'CDSL' },
            { href: 'https://scores.sebi.gov.in', label: 'SCORES Grievance' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-mid)', padding: '0.3rem 0', textDecoration: 'none' }}
            >
              <i className="fas fa-external-link-alt" style={{ fontSize: '0.6rem' }}></i> {link.label}
            </a>
          ))}
        </div>
      </aside>

      {/* MAIN ARTICLES */}
      <main className="kb-main">
        {apiError && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10, padding: '0.875rem 1.25rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#92400E', margin: 0 }}>
              <i className="fas fa-circle-exclamation" style={{ marginRight: '0.5rem', color: '#F59E0B' }}></i>
              <strong>Help articles are temporarily unavailable.</strong> For urgent assistance call{' '}
              <a href="tel:02261446300" style={{ color: '#92400E', fontWeight: 700 }}>022-61446300</a> or email{' '}
              <a href="mailto:helpdesk@indiabullssecurities.com" style={{ color: '#92400E', fontWeight: 700 }}>helpdesk@indiabullssecurities.com</a>.{' '}
              <button onClick={fetchArticles} style={{ background: 'none', border: 'none', color: '#92400E', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', padding: 0, fontWeight: 600 }}>Retry</button>
            </p>
          </div>
        )}

        <div className="notice-banner">
          <i className="fas fa-shield-halved"></i>
          <span><strong>Verified content:</strong> All articles are cross-referenced with official Indiabulls Securities policies.</span>
        </div>

        {/* Breadcrumb when inside a category */}
        {selectedCatId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            <button onClick={() => { setSelectedCatId(''); setSelectedSubId(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, fontSize: 'inherit' }}>All Topics</button>
            <i className="fas fa-chevron-right" style={{ fontSize: '0.6rem' }}></i>
            <button onClick={() => setSelectedSubId('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: selectedSubId ? 'var(--text-muted)' : 'var(--text-dark)', padding: 0, fontSize: 'inherit', fontWeight: selectedSubId ? 400 : 600 }}>{selectedCat?.name}</button>
            {selectedSub && (<>
              <i className="fas fa-chevron-right" style={{ fontSize: '0.6rem' }}></i>
              <span style={{ color: 'var(--text-dark)', fontWeight: 600 }}>{selectedSub.name}</span>
            </>)}
          </div>
        )}

        {/* Subcategory pill filters — shown when a top-level category is selected and has subcats */}
        {selectedCatId && subcategories.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              onClick={() => setSelectedSubId('')}
              style={{ padding: '0.375rem 0.875rem', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 600, border: '1.5px solid', borderColor: !selectedSubId ? 'var(--green)' : 'var(--border)', background: !selectedSubId ? 'var(--green)' : 'var(--bg)', color: !selectedSubId ? 'white' : 'var(--text-muted)', cursor: 'pointer' }}
            >
              All
            </button>
            {subcategories.map(sub => (
              <button
                key={sub.id}
                onClick={() => selectSub(sub.id)}
                style={{ padding: '0.375rem 0.875rem', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 600, border: '1.5px solid', borderColor: selectedSubId === sub.id ? 'var(--green)' : 'var(--border)', background: selectedSubId === sub.id ? 'var(--green)' : 'var(--bg)', color: selectedSubId === sub.id ? 'white' : 'var(--text-muted)', cursor: 'pointer' }}
              >
                <i className={sub.icon} style={{ marginRight: '0.375rem', fontSize: '0.75rem' }}></i>
                {sub.name}
              </button>
            ))}
          </div>
        )}

        <div className="kb-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 id="kbHeading">{heading}</h1>
              <p id="kbSubheading">
                {!selectedCatId
                  ? 'Browse all support articles or filter by topic from the sidebar.'
                  : `${filtered.length} article${filtered.length !== 1 ? 's' : ''} in this topic.`}
              </p>
            </div>
            <div className="search-wrapper" style={{ width: '100%', maxWidth: '400px', margin: 0 }}>
              <i className="fas fa-search search-icon"></i>
              <input
                id="faqSearch"
                type="text"
                className="search-input"
                placeholder="Search Knowledge Base..."
                aria-label="Search knowledge base articles"
                autoComplete="off"
                maxLength={200}
                value={search}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearch(val);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  if (val.length >= 2) {
                    searchDebounceRef.current = setTimeout(() => {
                      trackEvent({ eventType: 'search', searchTerm: val, searchResultCount: filtered.length });
                    }, 800);
                  }
                }}
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>
        </div>

        <div id="articleContainer">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading articles...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <i className="fas fa-search" style={{ fontSize: '2rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'block' }}></i>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>No articles found{search ? ` for "${search}"` : ` in ${heading}`}</p>
              {search && (
                <button onClick={() => setSearch('')} className="btn-secondary" style={{ marginRight: '0.75rem' }}>
                  Clear Search
                </button>
              )}
              <Link href="/contact" className="btn-primary">Contact Support</Link>
            </div>
          ) : (
            (Object.entries(grouped) as [string, Article[]][]).map(([cat, items]) => (
              <div key={cat} className="article-group" data-cat={cat.toLowerCase()}>
                <p className="article-group-title">{cat}</p>
                {items.map((article: Article) => (
                  <div key={article.id} className="article-card" id={article.id}>
                    <button
                      className={`article-trigger${openId === article.id ? ' open' : ''}`}
                      onClick={() => {
                        const isOpening = openId !== article.id;
                        setOpenId(isOpening ? article.id : null);
                        if (isOpening) {
                          trackEvent({ eventType: 'article_view', articleId: article.id, articleTitle: article.title || article.question, category: article.category });
                        }
                      }}
                    >
                      <div className="article-trigger-left">
                        <span className="article-cat-dot"></span>
                        <div>
                          <h3>{article.title || article.question || 'Untitled'}</h3>
                          <p>{article.category}</p>
                        </div>
                      </div>
                      <i className="fas fa-chevron-down article-chevron"></i>
                    </button>
                    <div className={`article-body${openId === article.id ? ' open' : ''}`}>
                      <p style={{ whiteSpace: 'pre-line' }}>{article.content || article.answer || ''}</p>
                      <div className="article-feedback">
                        <span>Was this helpful?</span>
                        <div className="feedback-buttons">
                          {feedbackGivenRef.has(article.id) ? (
                            <span style={{ fontSize: '0.8rem', color: '#38A169', fontWeight: 600 }}>
                              <i className="fas fa-check" style={{ marginRight: '0.3rem' }}></i>Thanks for your feedback!
                            </span>
                          ) : (<>
                          <button
                            className="feedback-btn"
                            data-type="yes"
                            onClick={() => {
                              const next = new Set(feedbackGivenRef); next.add(article.id);
                              setFeedbackGiven(next);
                              try {
                                const stored = JSON.parse(localStorage.getItem('faq_feedback_given') || '{}');
                                const map = Array.isArray(stored) ? {} : stored;
                                map[article.id] = Date.now();
                                localStorage.setItem('faq_feedback_given', JSON.stringify(map));
                              } catch { /* ignore */ }
                              trackEvent({ eventType: 'faq_feedback', articleId: article.id, articleTitle: article.title || article.question, category: article.category, feedbackType: 'helpful' });
                            }}
                          >
                            <i className="far fa-thumbs-up"></i> Yes
                          </button>
                          <button
                            className="feedback-btn"
                            data-type="no"
                            onClick={() => {
                              const next = new Set(feedbackGivenRef); next.add(article.id);
                              setFeedbackGiven(next);
                              try {
                                const stored = JSON.parse(localStorage.getItem('faq_feedback_given') || '{}');
                                const map = Array.isArray(stored) ? {} : stored;
                                map[article.id] = Date.now();
                                localStorage.setItem('faq_feedback_given', JSON.stringify(map));
                              } catch { /* ignore */ }
                              trackEvent({ eventType: 'faq_feedback', articleId: article.id, articleTitle: article.title || article.question, category: article.category, feedbackType: 'not_helpful' });
                            }}
                          >
                            <i className="far fa-thumbs-down"></i> No
                          </button>
                          </>)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default function FAQPage() {
  return (
    <Suspense fallback={
      <div style={{ textAlign: 'center', padding: '8rem 0' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    }>
      <FAQContent />
    </Suspense>
  );
}
