import { useState } from 'react';
import AnalyticsWorkspace from '../components/AnalyticsWorkspace';
import OnboardingCard from '../components/OnboardingCard';
import SimpleOverview from '../components/overview/SimpleOverview';
import { useAutoSync } from '../hooks/useAutoSync';

export default function Dashboard() {
  const { reloadToken, ...sync } = useAutoSync();
  const [data, setData] = useState({ hasData: null, lastSyncedAt: null });
  // Enquanto o painel recarrega depois de um sync, o passo "Buscar seus dados" segue em andamento.
  const [loadedToken, setLoadedToken] = useState(0);
  const settled = () => setLoadedToken(reloadToken);
  const reloading = sync.state === 'idle' && loadedToken !== reloadToken;
  return <>
    <OnboardingCard hasData={data.hasData} lastSyncedAt={data.lastSyncedAt} sync={reloading ? { ...sync, state: 'running' } : sync} />
    <AnalyticsWorkspace key="all" platform="all" title="Visão geral" reloadToken={reloadToken} onError={settled}
      overview={ctx => <SimpleOverview {...ctx} />}
      onData={result => { setData({ hasData: result.hasData, lastSyncedAt: result.lastSyncedAt }); settled(); }} />
  </>;
}
