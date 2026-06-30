import { useState, useEffect, useRef, useCallback } from "react";

// Hook générique de chargement asynchrone.
// Expose { data, loading, error, reload } et garde contre les réponses obsolètes
// (changement de dépendances ou démontage du composant).
//
//   const { data, loading, error, reload } = useAsync(() => getEmployees(), []);
//
export function useAsync(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reqId = useRef(0);

  const run = useCallback(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(fn)
      .then(
        (res) => { if (id === reqId.current) { setData(res); setLoading(false); } },
        (err) => { if (id === reqId.current) { setError(err); setLoading(false); } }
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
    return () => { reqId.current++; }; // invalide la requête en vol au démontage
  }, [run]);

  return { data, loading, error, reload: run };
}
