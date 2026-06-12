export default function NetworkTrace({ network }) {
  const networks = network?.wifiNetworks ?? [];
  const domains = network?.browserDomains ?? [];
  const maxVisits = Math.max(...domains.map((d) => d.count), 1);

  return (
    <>
      {networks.length > 0 ? (
        <>
          <p className="po-summary-line">
            <strong>{network.wifiCount ?? networks.length}</strong> Wi-Fi network
            {(network.wifiCount ?? networks.length) !== 1 ? 's' : ''} remembered
          </p>
          <div className="po-panel po-net-list">
            {networks.map((ssid) => (
              <div key={ssid} className="po-net-item">
                <span className="po-net-icon" aria-hidden>◇</span>
                <span className="po-mono">{ssid}</span>
              </div>
            ))}
          </div>
          <p className="po-secondary po-foot-note">
            Network names alone can place this machine at home, school, and the cafés in between.
          </p>
        </>
      ) : null}

      {domains.length > 0 ? (
        <div className="po-block">
          <span className="po-block-label">Most visited sites</span>
          <div className="po-panel po-ext-list">
            {domains.map(({ domain, count }) => (
              <div key={domain} className="po-ext-row">
                <span className="po-ext-name po-ext-name--domain">{domain}</span>
                <div className="po-ext-track">
                  <div className="po-ext-fill" style={{ width: `${(count / maxVisits) * 100}%` }} />
                </div>
                <span className="po-ext-count">{count}</span>
              </div>
            ))}
          </div>
          {network?.browserVisits != null ? (
            <p className="po-secondary po-foot-note">
              From {network.browserVisits} recent browser history entries.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
