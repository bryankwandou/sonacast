import { useEffect, useState } from 'react';
import {
  FEATURED_DAILY_PLAYLISTS,
  FEATURED_RELEASE_ALBUMS,
  fetchPopularCharts,
  type PopularChartsResult
} from '../services/musicService';

const EMPTY_CHARTS: PopularChartsResult = {
  global: [],
  indonesia: [],
  albums: FEATURED_RELEASE_ALBUMS,
  playlists: FEATURED_DAILY_PLAYLISTS
};

let cachedChartsPromise: Promise<PopularChartsResult> | null = null;
let cachedChartsData: PopularChartsResult | null = null;

/**
 * Loads and caches Global & Indonesia popular charts, Top Daily Albums, and
 * Top Daily Playlists across views so navigating between screens avoids redundant requests.
 */
export function usePopularCharts() {
  const [popularCharts, setPopularCharts] = useState<PopularChartsResult>(
    () => cachedChartsData || EMPTY_CHARTS
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
