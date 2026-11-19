# Synthetic demo code for Nexus Intelligence. Not a real system.
# networkd-dispatcher hook for the lxc_health link. Invoke with bash.
# systemd-networkd treats Cilium's pod routes as foreign. When the link loses
# carrier (networkd is restarted by an unattended systemd upgrade) those routes
# are removed. Journal line matches the networkd unit prefix used on the node.
echo "lxc_health: Lost carrier; removing foreign routes"
if command -v ip >/dev/null 2>&1; then
  ip route show | awk '/cilium_host/ {print $1}' | while read -r cidr; do
    ip route del "$cidr" via cilium_host || true
  done
fi
