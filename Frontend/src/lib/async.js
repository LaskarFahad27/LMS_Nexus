import { useCallback, useEffect, useState } from 'react';

export function useLiveData(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loader();
      setData(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const onFocus = () => reload();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  return { data, setData, loading, error, reload };
}

export function getError(err, fallback = 'Something went wrong') {
  return err.response?.data?.message || err.message || fallback;
}
