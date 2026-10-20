# Synthetic demo code for Nexus Intelligence. Not a real system.
# orbit-node 2026.10.2
FROM ubuntu:24.04
COPY limits.conf /etc/security/limits.d/orbit-nproc.conf
COPY apt/20auto-upgrades /etc/apt/apt.conf.d/20auto-upgrades
COPY apt/50unattended-upgrades /etc/apt/apt.conf.d/50unattended-upgrades
COPY systemd/apt-daily-upgrade.timer.conf /etc/systemd/system/apt-daily-upgrade.timer.d/orbit.conf
COPY networkd/lxc-health-foreign-routes.sh /usr/lib/networkd-dispatcher/off.d/lxc_health
RUN printf '%s\n' '#!/bin/bash' | cat - /usr/lib/networkd-dispatcher/off.d/lxc_health > /tmp/lxc_health \
    && mv /tmp/lxc_health /usr/lib/networkd-dispatcher/off.d/lxc_health \
    && chmod 755 /usr/lib/networkd-dispatcher/off.d/lxc_health
