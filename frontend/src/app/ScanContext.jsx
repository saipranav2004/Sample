import { createContext, useContext, useMemo, useState } from 'react';
import { fetchScans } from '../lib/api/endpoints';
import { useQuery } from '../lib/hooks';

const ScanContext = createContext(null);

/**
 * Every data screen is scoped to one discovery scan. An empty selection means
 * "latest completed scan", which is what the API falls back to on its own -
 * so the default costs no extra request and stays correct as new scans land.
 */
export function ScanProvider({ children }) {
  const [selectedScanId, setSelectedScanId] = useState('');

  const query = useQuery((signal) => fetchScans({ page: 1, pageSize: 50 }, signal), []);
  // Stable identity: an inline fallback array would be a new value each render
  // and would invalidate every memo below.
  const scans = useMemo(() => query.data?.rows ?? [], [query.data]);

  const latestCompleted = useMemo(
    () => scans.find((scan) => String(scan.status).toUpperCase() === 'COMPLETED') ?? null,
    [scans],
  );

  const activeScan = useMemo(() => {
    if (!selectedScanId) return latestCompleted;
    return scans.find((scan) => scan.scan_id === selectedScanId) ?? null;
  }, [selectedScanId, scans, latestCompleted]);

  const value = useMemo(
    () => ({
      selectedScanId,
      setSelectedScanId,
      scans,
      activeScan,
      isLatest: !selectedScanId,
      loading: query.isLoading,
      error: query.error,
      refetch: query.refetch,
    }),
    [selectedScanId, scans, activeScan, query.isLoading, query.error, query.refetch],
  );

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}

export function useScanContext() {
  const context = useContext(ScanContext);
  if (!context) throw new Error('useScanContext must be used inside a ScanProvider');
  return context;
}
