import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import ProductCard from '../components/ProductCard';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { fetchCart } = useCart();
  const { fetchWishlist } = useWishlist();

  const [products, setProducts] = useState([]);
  const [allBrands, setAllBrands] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Derive filters directly from URL searchParams (single source of truth — zero lag/double-render)
  const catParam = searchParams.get('category');
  const selectedCategories = catParam && catParam !== 'all' ? catParam.split(',').filter(Boolean) : [];

  const brandParam = searchParams.get('brand');
  const selectedBrands = brandParam ? brandParam.split(',').filter(Boolean) : [];

  const sort = searchParams.get('sort') || 'popular';
  const search = searchParams.get('search') || '';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';

  // Local filter controls
  const [brandSearch, setBrandSearch] = useState('');
  const [localMinPrice, setLocalMinPrice] = useState(minPrice);
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice);

  // Accordions
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [brandOpen, setBrandOpen] = useState(true);

  useEffect(() => {
    fetchCart();
    fetchWishlist();
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const res = await api.get('/products/brands');
      setAllBrands(res.data || []);
    } catch {
      setAllBrands([
        'Apple', 'Dell', 'Logitech', 'Sony', 'Cisco',
        'Samsung', 'Lenovo', 'Microsoft', 'CrowdStrike',
        'Oracle', 'AWS', 'JetBrains', 'VMware',
      ]);
    }
  };

  // Fetch products cleanly on searchParams change — no skeleton flash on clicks!
  useEffect(() => {
    let isCancelled = false;

    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (sort) params.append('sort', sort);
    if (selectedCategories.length > 0) {
      params.append('category', selectedCategories.join(','));
    }
    if (selectedBrands.length > 0) {
      params.append('brand', selectedBrands.join(','));
    }
    if (minPrice) params.append('min_price', minPrice);
    if (maxPrice) params.append('max_price', maxPrice);

    api.get(`/products?${params.toString()}`)
      .then((res) => {
        if (!isCancelled) {
          setProducts(res.data.products || []);
        }
      })
      .catch((err) => console.error('Error loading products:', err))
      .finally(() => {
        if (!isCancelled) {
          setInitialLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [searchParams]);

  // Toggle category (multi-select + click to toggle off)
  const toggleCategory = (cat) => {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];

    const p = new URLSearchParams(searchParams);
    if (next.length === 0) {
      p.delete('category');
    } else {
      p.set('category', next.join(','));
    }
    setSearchParams(p);
  };

  // Show all categories
  const selectAllCategories = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('category');
    setSearchParams(p);
  };

  // Toggle brand (multi-select)
  const toggleBrand = (brand) => {
    const next = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];

    const p = new URLSearchParams(searchParams);
    if (next.length === 0) {
      p.delete('brand');
    } else {
      p.set('brand', next.join(','));
    }
    setSearchParams(p);
  };

  // Price range apply
  const handlePriceBlur = () => {
    const p = new URLSearchParams(searchParams);
    if (localMinPrice) p.set('min_price', localMinPrice);
    else p.delete('min_price');
    if (localMaxPrice) p.set('max_price', localMaxPrice);
    else p.delete('max_price');
    setSearchParams(p);
  };

  // Reset all filters
  const resetFilters = () => {
    setLocalMinPrice('');
    setLocalMaxPrice('');
    setBrandSearch('');
    setSearchParams({});
  };

  const removeFilter = (type, val) => {
    if (type === 'category') {
      toggleCategory(val);
    } else if (type === 'brand') {
      toggleBrand(val);
    } else if (type === 'search') {
      const p = new URLSearchParams(searchParams);
      p.delete('search');
      setSearchParams(p);
    }
  };

  const filteredBrands = allBrands.filter((b) =>
    b.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const activeFilterCount =
    selectedCategories.length +
    selectedBrands.length +
    (search ? 1 : 0) +
    (minPrice || maxPrice ? 1 : 0);

  const pageTitle =
    selectedCategories.length === 1
      ? selectedCategories[0]
      : selectedCategories.length === 2
      ? 'Hardware & Software'
      : search
      ? `Search: "${search}"`
      : 'Bestsellers';

  const isAllActive = selectedCategories.length === 0 || selectedCategories.length === 2;

  return (
    <div className="protech-shop-container">
      {/* Top Header Section */}
      <div className="protech-header-row">
        <div>
          {/* Breadcrumbs with click to reset */}
          <div className="protech-breadcrumbs">
            <span
              style={{ cursor: 'pointer' }}
              onClick={selectAllCategories}
              title="View all products"
            >
              Home
            </span>
            <span className="bc-sep">•</span>
            <span
              className="bc-active"
              style={{ cursor: selectedCategories.length > 0 ? 'pointer' : 'default' }}
              onClick={selectedCategories.length > 0 ? selectAllCategories : undefined}
            >
              {pageTitle}
            </span>
          </div>

          {/* Large Title */}
          <h1 className="protech-title">{pageTitle}</h1>
        </div>

        {/* Top Category Tabs & Sort */}
        <div className="protech-top-actions">
          {/* Category Tabs Pill Row (Multi-Select & Instant Toggle) */}
          <div className="protech-category-tabs">
            <button
              className={`protech-cat-tab ${isAllActive ? 'active' : ''}`}
              onClick={selectAllCategories}
            >
              All items
            </button>

            <button
              className={`protech-cat-tab ${selectedCategories.includes('Hardware') ? 'active' : ''}`}
              onClick={() => toggleCategory('Hardware')}
            >
              Hardware {selectedCategories.includes('Hardware') && '✓'}
            </button>

            <button
              className={`protech-cat-tab ${selectedCategories.includes('Software') ? 'active' : ''}`}
              onClick={() => toggleCategory('Software')}
            >
              Software {selectedCategories.includes('Software') && '✓'}
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="protech-sort-box">
            <span className="sort-icon">≡</span>
            <select
              value={sort}
              onChange={(e) => {
                const p = new URLSearchParams(searchParams);
                p.set('sort', e.target.value);
                setSearchParams(p);
              }}
              className="protech-sort-select"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="protech-main-grid">
        {/* Left Filter Sidebar */}
        <aside className="protech-sidebar">
          {/* Reset Filters CTA */}
          {activeFilterCount > 0 && (
            <div className="protech-reset-box">
              <button className="protech-reset-btn" onClick={resetFilters}>
                ✕ Reset filters
              </button>
            </div>
          )}

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="protech-filter-chips">
              {selectedCategories.map((cat) => (
                <span key={cat} className="protech-chip">
                  {cat}
                  <button onClick={() => removeFilter('category', cat)}>✕</button>
                </span>
              ))}

              {search && (
                <span className="protech-chip">
                  "{search}"
                  <button onClick={() => removeFilter('search')}>✕</button>
                </span>
              )}

              {selectedBrands.map((b) => (
                <span key={b} className="protech-chip">
                  {b}
                  <button onClick={() => removeFilter('brand', b)}>✕</button>
                </span>
              ))}
            </div>
          )}

          {/* Category Accordion */}
          <div className="protech-accordion">
            <div
              className="protech-accordion-header"
              onClick={() => setCategoryOpen(!categoryOpen)}
            >
              <span>Category</span>
              <span className="accordion-chevron">{categoryOpen ? '∧' : '∨'}</span>
            </div>
            {categoryOpen && (
              <div className="protech-accordion-body">
                {['Hardware', 'Software'].map((cat) => (
                  <label key={cat} className="protech-check-label">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="protech-checkbox"
                    />
                    <span className="check-custom" />
                    <span className="check-text">{cat}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {cat === 'Hardware' ? '8' : '6'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Price Range Accordion */}
          <div className="protech-accordion">
            <div
              className="protech-accordion-header"
              onClick={() => setPriceOpen(!priceOpen)}
            >
              <span>Price</span>
              <span className="accordion-chevron">{priceOpen ? '∧' : '∨'}</span>
            </div>
            {priceOpen && (
              <div className="protech-accordion-body">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="Min $"
                    value={localMinPrice}
                    onChange={(e) => setLocalMinPrice(e.target.value)}
                    onBlur={handlePriceBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handlePriceBlur()}
                    className="protech-price-input"
                  />
                  <span style={{ color: 'var(--text-muted)' }}>–</span>
                  <input
                    type="number"
                    placeholder="Max $"
                    value={localMaxPrice}
                    onChange={(e) => setLocalMaxPrice(e.target.value)}
                    onBlur={handlePriceBlur}
                    onKeyDown={(e) => e.key === 'Enter' && handlePriceBlur()}
                    className="protech-price-input"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Brand Accordion */}
          <div className="protech-accordion">
            <div
              className="protech-accordion-header"
              onClick={() => setBrandOpen(!brandOpen)}
            >
              <span>Brand</span>
              <span className="accordion-chevron">{brandOpen ? '∧' : '∨'}</span>
            </div>
            {brandOpen && (
              <div className="protech-accordion-body">
                {/* Search Brands Input */}
                <div className="protech-brand-search-wrap">
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search brands"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    className="protech-brand-search-input"
                  />
                </div>

                {/* Brands Checkboxes List */}
                <div className="protech-brand-list">
                  {filteredBrands.map((b) => (
                    <label key={b} className="protech-check-label">
                      <input
                        type="checkbox"
                        checked={selectedBrands.includes(b)}
                        onChange={() => toggleBrand(b)}
                        className="protech-checkbox"
                      />
                      <span className="check-custom" />
                      <span className="check-text">{b}</span>
                    </label>
                  ))}
                  {filteredBrands.length === 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '6px 0' }}>
                      No brands found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Right Product Grid — Smooth, instantaneous, NO blinking! */}
        <main className="protech-catalog-main">
          {initialLoading && products.length === 0 ? (
            <div className="protech-loading-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="protech-card-skeleton" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="No products match your selection"
              description="Try deselecting some categories or brands to view available products."
              actionText="Reset All Filters"
              onAction={resetFilters}
            />
          ) : (
            <div className="protech-products-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
