import { useEffect, useState } from 'react';
import type { Track } from '../types';
import { fetchPopularCharts } from '../services/musicService';

let cachedChartsPromise: Promise<{ global: Track[]; indonesia: Track[] }> | null = null;
let cachedChartsData: { global: Track[]; indonesia: Track[] } | null = null;

/**
 * Loads and caches Global & Indonesia popular charts across views
 * so navigating between Landing and Music Library avoids redundant requests.
 */
export function usePopularCharts() {
  const [popularCharts, setPopularCharts] = useState<{ global: Track[]; indonesia: Track[] }>(
    () => cachedChartsData || { global: [], indonesia: [] }
  );
  const [isLoadingCharts, setIsLoadingCharts] = useState(!cachedChartsData);

  useEffect(() => {
    if (cachedChartsData) return;

    let active = true;
    const requestPromise =
      cachedChartsPromise ?? (cachedChartsPromise = fetchPopularCharts());

    requestPromise
      .then((res) => {
        cachedChartsData = res;
        if (active) setPopularCharts(res);
      })
      .finally(() => {
        if (active) setIsLoadingCharts(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { popularCharts, isLoadingCharts };
}
