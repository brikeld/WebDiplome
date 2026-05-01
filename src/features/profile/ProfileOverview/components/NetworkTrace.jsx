export default function NetworkTrace({ network }) {
  return (
    <div className="po-card po-network">
      <div className="po-row-between">
        <p className="po-card-title" style={{ margin: 0 }}>Network Trace</p>
        <span className="po-pill po-pill--accent">{network.connectivity_status}</span>
      </div>

      <div className="po-network-list">
        {network.wifi_networks_recent.map(ssid => (
          <div key={ssid} className="po-network-item">
            <span className="po-network-icon">⌘</span>
            <span className="po-mono">{ssid}</span>
          </div>
        ))}
      </div>
      <p className="po-secondary po-creepy-note">
        ⚠ Network patterns can infer physical location with high confidence
      </p>

      <hr className="po-divider" />

      <div className="po-row" style={{ marginBottom: 8 }}>
        <span className="po-network-vpn-dot" />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#2323FF' }}>
          {network.vpn_detected} active
        </span>
        <span className="po-secondary" style={{ marginLeft: 4 }}>— partial obfuscation</span>
      </div>

      <p className="po-secondary" style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
        Open ports detected
      </p>
      <div className="po-badge-row" style={{ marginTop: 0 }}>
        {network.open_ports.map(port => (
          <code key={port} className="po-code-tag">{port}</code>
        ))}
      </div>
    </div>
  );
}
