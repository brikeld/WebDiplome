import { PoFold } from './PoCard.jsx';
import PersonaPill from './PersonaPill.jsx';

export default function NetworkTrace({ network, dominantPersona = 'security', expanded = false }) {
  const networks = network.wifi_networks_recent ?? [];

  return (
    <>
      <div className="po-chip-row">
        <PersonaPill dot personaKey={dominantPersona}>{network.connectivity_status}</PersonaPill>
        <PersonaPill>{network.vpn_detected} VPN</PersonaPill>
      </div>

      <p className="po-summary-line">
        <strong>{networks.length}</strong> network{networks.length !== 1 ? 's' : ''} remembered ·{' '}
        {network.open_ports.length} open port{network.open_ports.length !== 1 ? 's' : ''}
      </p>

      <PoFold open={expanded}>
        <div className="po-block">
          <span className="po-block-label">Recent networks</span>
          <div className="po-panel po-net-list">
            {networks.map((ssid) => (
              <div key={ssid} className="po-net-item">
                <span className="po-net-icon" aria-hidden>
                  ◇
                </span>
                <span className="po-mono">{ssid}</span>
              </div>
            ))}
          </div>
          <p className="po-secondary po-foot-note">
            Network patterns can infer physical location with high confidence.
          </p>
        </div>

        {network.open_ports.length ? (
          <div className="po-block">
            <span className="po-block-label">Open ports</span>
            <div className="po-chip-row">
              {network.open_ports.map((port) => (
                <code key={port} className="po-code-tag">
                  {port}
                </code>
              ))}
            </div>
          </div>
        ) : null}
      </PoFold>
    </>
  );
}
