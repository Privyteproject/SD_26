import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch } from "../lib/api";

/**
 * Recherche globale : debounce 300 ms, min 2 caractères, navigation clavier.
 * État : {query, results, isLoading, isOpen, selectedIndex}.
 * Actions : {setQuery, selectResult, closeDropdown, handleKeyDown, open}.
 */
export function useGlobalSearch() {
  const navigate = useNavigate();
  const [query, setQueryState] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const reqId = useRef(0);

  const setQuery = useCallback((v) => { setQueryState(v); setIsOpen(true); setSelectedIndex(-1); }, []);
  const open = useCallback(() => setIsOpen(true), []);
  const closeDropdown = useCallback(() => { setIsOpen(false); setSelectedIndex(-1); }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); setIsLoading(false); return; }
    setIsLoading(true);
    const id = ++reqId.current;
    const h = setTimeout(async () => {
      try {
        const res = await globalSearch(term, 10);
        if (id === reqId.current) setResults((res && res.data && res.data.results) || []);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(h);
  }, [query]);

  const selectResult = useCallback((item) => {
    if (!item) return;
    closeDropdown(); setQueryState("");
    navigate(item.url);
  }, [navigate, closeDropdown]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen || !results.length) {
      if (e.key === "Escape") closeDropdown();
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { if (selectedIndex >= 0 && results[selectedIndex]) { e.preventDefault(); selectResult(results[selectedIndex]); } }
    else if (e.key === "Escape") { closeDropdown(); }
  }, [isOpen, results, selectedIndex, selectResult, closeDropdown]);

  return { query, results, isLoading, isOpen, selectedIndex, setQuery, selectResult, closeDropdown, handleKeyDown, open };
}
